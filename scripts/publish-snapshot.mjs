import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPublishedGraph, getEvidenceFreshness, isPublishedEdge } from "../src/lib/graphViewModel.js";

export function inspectPublication(data, options = {}) {
  const allowDemo = options.allowDemo === true;
  const requireProjected = options.requireProjected === true;
  const now = options.now || new Date();
  const errors = [];
  const warnings = [];
  const datasetType = data?.meta?.dataset_type || "unknown";
  const requiredCollections = ["chains", "nodes", "companies", "edges", "evidences", "quote_snapshots"];

  if (!data?.meta) errors.push("缺少 meta 数据集信息");
  for (const key of requiredCollections) {
    if (!Array.isArray(data?.[key])) errors.push(`缺少 ${key}[]`);
  }
  if (errors.length > 0) return emptyReport(datasetType, errors, warnings);

  if (datasetType === "demo" && !allowDemo) {
    errors.push("演示数据不能作为真实快照发布；仅验证 demo 时显式使用 --allow-demo");
  }
  if (!["demo", "local_real", "mixed"].includes(datasetType)) {
    errors.push(`不支持的数据集类型：${datasetType}`);
  }
  if (!data.meta.data_version) errors.push("meta.data_version 不能为空");
  if (!data.meta.updated_at) errors.push("meta.updated_at 不能为空");
  if (!data.meta.data_license) errors.push("meta.data_license 不能为空");
  if (!data.meta.disclaimer) errors.push("meta.disclaimer 不能为空");

  const strictSources = datasetType !== "demo";
  const evidenceById = new Map(data.evidences.map((evidence) => [evidence.id, evidence]));
  const mappingEdges = data.edges.filter((edge) => edge.edge_type === "company_maps_to_industry_node");
  const publishedMappings = mappingEdges.filter(isPublishedEdge);
  const withheldMappings = mappingEdges.filter((edge) => !isPublishedEdge(edge));

  if (strictSources && publishedMappings.length === 0) {
    errors.push("真实快照至少需要一条已接受的公司产业映射");
  }

  for (const edge of publishedMappings) {
    if (strictSources && edge.review_status !== "accepted") {
      errors.push(`${edge.id} 缺少明确的 accepted 审核状态`);
    }
    if (strictSources && !edge.relation_basis) errors.push(`${edge.id} 缺少 relation_basis`);
    if (strictSources && !edge.relation_summary) errors.push(`${edge.id} 缺少 relation_summary`);
    if (strictSources && !edge.last_verified_at) errors.push(`${edge.id} 缺少 last_verified_at`);
    if (!edge.source_ids?.length) {
      errors.push(`${edge.id} 没有绑定证据来源`);
      continue;
    }

    for (const sourceId of edge.source_ids) {
      const evidence = evidenceById.get(sourceId);
      if (!evidence) {
        errors.push(`${edge.id} 引用了不存在的证据 ${sourceId}`);
        continue;
      }
      if (!evidence.publish_date) errors.push(`${sourceId} 缺少 publish_date`);
      if (strictSources && !isPublicHttpUrl(evidence.url)) errors.push(`${sourceId} 缺少可公开访问的 HTTP(S) 来源 URL`);
      if (strictSources && !evidence.reviewed_at) errors.push(`${sourceId} 缺少 reviewed_at`);
      if (strictSources && !isHumanReviewer(evidence.reviewer)) {
        errors.push(`${sourceId} 缺少 human:* 格式的人工审核人`);
      }
      if (strictSources && evidence.source_type === "imported_unverified") errors.push(`${sourceId} 仍是 imported_unverified 来源`);

      const freshness = getEvidenceFreshness(evidence, now);
      if (freshness.status === "stale") warnings.push(`${sourceId} 已超过 ${evidence.stale_threshold_days || 365} 天时效阈值`);
      if (freshness.status === "expiring") warnings.push(`${sourceId} 即将达到时效阈值`);
    }
  }

  const publicGraph = createPublicSnapshot(data);
  if (requireProjected) {
    if (data.edges.some((edge) => !isPublishedEdge(edge))) errors.push("公开快照仍包含未通过审核的关系");
    if ((data.review_queue || []).length > 0) errors.push("公开快照仍包含审核队列");
    if ((data.import_jobs || []).length > 0) errors.push("公开快照仍包含导入记录");
    if (data.evidences.some((evidence) => "local_path" in evidence)) errors.push("公开快照仍包含本地证据路径");
    if (data.meta.latest_import_job_id || data.meta.source) errors.push("公开快照仍包含内部导入来源信息");
    if (publicGraph.companies.length !== data.companies.length) errors.push("公开快照仍包含没有已发布映射的公司");
    if (publicGraph.evidences.length !== data.evidences.length) errors.push("公开快照仍包含未发布证据");
  }
  return {
    datasetType,
    dataVersion: data.meta.data_version || null,
    publishedMappings: publishedMappings.length,
    withheldMappings: withheldMappings.length,
    publishedCompanies: publicGraph.companies.length,
    publishedEvidences: publicGraph.evidences.length,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}

export function createPublicSnapshot(data) {
  const projected = buildPublishedGraph(data);
  const { latest_import_job_id: _latestImportJobId, source: _source, ...publicMeta } = projected.meta || {};
  return {
    ...projected,
    meta: {
      ...publicMeta,
      source_policy: projected.meta?.dataset_type === "demo" ? "public_demo_only" : "public_reviewed_snapshot",
    },
    evidences: projected.evidences.map(({ local_path: _localPath, ...evidence }) => evidence),
    review_queue: [],
    import_jobs: [],
  };
}

function emptyReport(datasetType, errors, warnings) {
  return {
    datasetType,
    dataVersion: null,
    publishedMappings: 0,
    withheldMappings: 0,
    publishedCompanies: 0,
    publishedEvidences: 0,
    errors,
    warnings,
  };
}

function isPublicHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) return false;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isHumanReviewer(value) {
  return typeof value === "string" && /^human:\S+$/.test(value);
}

async function runCli() {
  const options = parseCli(process.argv.slice(2));
  if (!options.inputPath) {
    console.error("用法: node scripts/publish-snapshot.mjs <snapshot.json> [--allow-demo] [--require-projected] [--write] [--output <path>]");
    process.exitCode = 1;
    return;
  }

  const absoluteInputPath = path.resolve(process.cwd(), options.inputPath);
  const graph = JSON.parse(await readFile(absoluteInputPath, "utf8"));
  const report = inspectPublication(graph, { allowDemo: options.allowDemo, requireProjected: options.requireProjected });

  if (report.errors.length > 0) {
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }

  if (options.write) {
    const outputPath = path.resolve(process.cwd(), options.outputPath || "public/snapshots/current.json");
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(createPublicSnapshot(graph), null, 2)}\n`);
    report.outputPath = outputPath;
  }

  console.log(JSON.stringify(report, null, 2));
}

function parseCli(args) {
  const options = { inputPath: null, outputPath: null, allowDemo: false, requireProjected: false, write: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--allow-demo") options.allowDemo = true;
    else if (arg === "--require-projected") options.requireProjected = true;
    else if (arg === "--write") options.write = true;
    else if (arg === "--output") options.outputPath = args[index += 1];
    else if (!arg.startsWith("--") && !options.inputPath) options.inputPath = arg;
  }
  return options;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await runCli();
