import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectPublication, isHumanReviewer } from "./publish-snapshot.mjs";

export function buildReviewPacket(data, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const companies = new Map((data.companies || []).map((company) => [company.id, company]));
  const nodes = new Map((data.nodes || []).map((node) => [node.id, node]));
  const evidences = new Map((data.evidences || []).map((evidence) => [evidence.id, evidence]));
  const mappings = (data.edges || [])
    .filter((edge) => edge.edge_type === "company_maps_to_industry_node")
    .sort((left, right) => {
      const leftCompany = companies.get(left.to_id);
      const rightCompany = companies.get(right.to_id);
      return `${leftCompany?.exchange || ""}:${leftCompany?.stock_code || ""}`.localeCompare(
        `${rightCompany?.exchange || ""}:${rightCompany?.stock_code || ""}`,
      );
    });
  const counts = countByStatus(mappings);
  const sourceCount = new Set(mappings.flatMap((edge) => edge.source_ids || [])).size;
  const publication = inspectPublication(data, { allowDemo: true });
  const lines = [
    `# ${escapeInline(data.meta?.name || "AI-ChainGraph snapshot")} 人工审核包`,
    "",
    `- 数据版本：${escapeInline(data.meta?.data_version || "unknown")}`,
    `- 生成时间：${generatedAt}`,
    `- 公司映射：${mappings.length} 条（待审核 ${counts.needs_review || 0} / 已接受 ${counts.accepted || 0} / 已拒绝 ${counts.rejected || 0} / 已过期 ${counts.stale || 0}）`,
    `- 唯一来源：${sourceCount} 个`,
    `- 发布预检：${publication.errors.length === 0 ? "通过" : `阻止发布（${publication.errors.length} 项）`}`,
    "",
    "> 勾选前请打开原始来源，确认公司、产业节点、事实摘要和日期均与来源一致。只有 `human:*` 审核人可以让真实数据通过发布闸门。",
    "",
  ];

  mappings.forEach((edge, index) => {
    const company = companies.get(edge.to_id);
    const node = nodes.get(edge.from_id);
    const edgeSources = (edge.source_ids || []).map((sourceId) => evidences.get(sourceId)).filter(Boolean);
    const humanReviewed = edgeSources.length > 0 && edgeSources.every((evidence) => isHumanReviewer(evidence.reviewer));
    lines.push(
      `## ${index + 1}. ${escapeInline(company?.name || edge.to_id)} -> ${escapeInline(node?.name || edge.from_id)}`,
      "",
      `- [ ] 人工确认（当前：${humanReviewed ? "已有 human:* 签名" : "未签名"}）`,
      `- 证券：${escapeInline(company?.stock_code || edge.to_id)} / ${escapeInline(company?.exchange || "unknown")}`,
      `- 映射 ID：\`${escapeInline(edge.id)}\``,
      `- 关系依据：\`${escapeInline(edge.relation_basis || "missing")}\`；证据等级：\`${escapeInline(edge.evidence_level || "missing")}\`；状态：\`${escapeInline(edge.review_status || "missing")}\``,
      `- 事实摘要：${escapeInline(edge.relation_summary || "缺失")}`,
      `- 最后核验：${escapeInline(edge.last_verified_at || "缺失")}`,
      "",
      "来源：",
      "",
    );
    if (edgeSources.length === 0) {
      lines.push("- 缺少来源", "");
      return;
    }
    for (const evidence of edgeSources) {
      const sourceLabel = `${escapeInline(evidence.title || evidence.id)}（${escapeInline(evidence.publish_date || "日期缺失")}）`;
      const sourceLink = isHttpUrl(evidence.url) ? `[${sourceLabel}](${evidence.url})` : sourceLabel;
      lines.push(
        `- ${sourceLink}`,
        `  - 摘要：${escapeInline(evidence.excerpt || "缺失")}`,
        `  - 核验：${escapeInline(evidence.reviewer || "缺失")} / ${escapeInline(evidence.reviewed_at || "未核验")}`,
      );
    }
    lines.push("");
  });

  if (publication.errors.length > 0) {
    lines.push("## 发布阻断项", "");
    for (const error of publication.errors) lines.push(`- ${escapeInline(error)}`);
    lines.push("");
  }

  if (publication.warnings.length > 0) {
    lines.push("## 时效提醒", "");
    for (const warning of publication.warnings) lines.push(`- ${escapeInline(warning)}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function countByStatus(edges) {
  return edges.reduce((counts, edge) => {
    const status = edge.review_status || "accepted";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function escapeInline(value) {
  return String(value).replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function parseCli(args) {
  const options = { inputPath: null, outputPath: null, write: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--write") options.write = true;
    else if (arg === "--output") options.outputPath = args[index += 1];
    else if (!arg.startsWith("--") && !options.inputPath) options.inputPath = arg;
  }
  return options;
}

async function runCli() {
  const options = parseCli(process.argv.slice(2));
  if (!options.inputPath) {
    console.error("用法: node scripts/review-snapshot.mjs <snapshot.json> [--write] [--output <path>]");
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(process.cwd(), options.inputPath);
  const data = JSON.parse(await readFile(inputPath, "utf8"));
  const packet = buildReviewPacket(data);
  if (!options.write && !options.outputPath) {
    process.stdout.write(packet);
    return;
  }

  const version = String(data.meta?.data_version || "snapshot").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const outputPath = path.resolve(process.cwd(), options.outputPath || `data/review-packets/${version}.md`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, packet);
  console.log(JSON.stringify({ inputPath, outputPath, mappingCount: data.edges.filter((edge) => edge.edge_type === "company_maps_to_industry_node").length }, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await runCli();
