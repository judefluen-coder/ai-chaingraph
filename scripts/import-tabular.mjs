import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = process.argv.find((arg) => !arg.startsWith("--") && arg !== process.argv[0] && arg !== process.argv[1]);
const shouldWrite = process.argv.includes("--write");
const shouldPrintSnapshot = process.argv.includes("--print-snapshot");

if (!inputPath) {
  console.error("用法: node scripts/import-tabular.mjs <mappings.csv|mappings.jsonl> [--write] [--print-snapshot]");
  process.exit(1);
}

const absoluteInputPath = path.resolve(process.cwd(), inputPath);
const raw = await readFile(absoluteInputPath, "utf8");
const extension = path.extname(absoluteInputPath).toLowerCase();
const adapterType = extension === ".jsonl" ? "jsonl" : extension === ".csv" ? "csv" : null;
if (!adapterType) {
  console.error("仅支持 .csv 或 .jsonl 输入。");
  process.exit(1);
}

const now = new Date().toISOString();
const today = now.slice(0, 10);
const sourceHash = createHash("sha256").update(raw).digest("hex");
const rows = parseRows(raw, adapterType);
const datasetId = `tabular-${path.basename(absoluteInputPath, extension).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
const errors = [];
const importStats = { duplicate_mapping_rows: 0, merged_mapping_edges: new Set() };
let graph;

try {
  graph = buildGraph(rows, { datasetId, sourceName: path.basename(absoluteInputPath), now, today, importStats });
  validateGraph(graph);
} catch (error) {
  errors.push(error.message);
  graph = graph || emptyGraph(datasetId, now);
}

const acceptedRecords = graph.nodes.length + graph.companies.length + graph.edges.length + graph.evidences.length + graph.quote_snapshots.length;
const reviewRecords = graph.edges.filter((edge) => edge.edge_type === "company_maps_to_industry_node" && edge.review_status !== "accepted").length;
const importJob = {
  id: `import:${Date.now()}`,
  dataset_id: datasetId,
  adapter_type: adapterType,
  source_name: path.basename(absoluteInputPath),
  source_path: absoluteInputPath,
  source_hash: sourceHash,
  status: errors.length > 0 ? "failed" : shouldWrite ? "applied" : "validated",
  total_records: errors.length > 0 ? rows.length : acceptedRecords + reviewRecords,
  accepted_records: errors.length > 0 ? 0 : acceptedRecords,
  review_records: errors.length > 0 ? 0 : reviewRecords,
  rejected_records: errors.length,
  error_json: errors,
  report_json: {
    rows: rows.length,
    chains: graph.chains.length,
    nodes: graph.nodes.length,
    companies: graph.companies.length,
    edges: graph.edges.length,
    evidences: graph.evidences.length,
    quote_snapshots: graph.quote_snapshots.length,
    mappings_needing_review: reviewRecords,
    duplicate_mapping_rows: importStats.duplicate_mapping_rows,
    merged_mapping_edges: importStats.merged_mapping_edges.size,
  },
  created_by: "local",
  created_at: now,
  applied_at: errors.length === 0 && shouldWrite ? now : null,
};

if (errors.length > 0) {
  console.error(JSON.stringify(importJob, null, 2));
  process.exit(1);
}

const snapshot = {
  ...graph,
  import_jobs: [importJob],
  meta: {
    ...graph.meta,
    latest_import_job_id: importJob.id,
    updated_at: now,
  },
};

if (shouldWrite) {
  const snapshotDir = path.join(rootDir, "data", "snapshots");
  const reportDir = path.join(rootDir, "data", "import-reports");
  await mkdir(snapshotDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(snapshotDir, "current.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  await writeFile(path.join(reportDir, `${importJob.id.replace(":", "-")}.json`), `${JSON.stringify(importJob, null, 2)}\n`);
}

console.log(JSON.stringify(shouldPrintSnapshot ? snapshot : importJob, null, 2));

function parseRows(content, type) {
  if (type === "jsonl") {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({ __line: index + 1, ...JSON.parse(line) }));
  }
  return parseCsv(content).map((row, index) => ({ __line: index + 2, ...row }));
}

function parseCsv(content) {
  const table = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (char === "\"") {
      if (quoted && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) table.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) table.push(row);
  const headers = table.shift()?.map((header) => header.trim()) || [];
  return table.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""])));
}

function buildGraph(records, context) {
  assert.ok(records.length > 0, "输入表不能为空");
  const chains = new Map();
  const nodes = new Map();
  const companies = new Map();
  const edges = new Map();
  const evidences = new Map();
  const quoteSnapshots = new Map();

  for (const row of records) {
    const rowTag = `第 ${row.__line} 行`;
    const chainId = required(row, rowTag, "chain_id");
    const chainName = required(row, rowTag, "chain_name");
    const nodeId = required(row, rowTag, "node_id");
    const nodeName = required(row, rowTag, "node_name");
    const stockCode = required(row, rowTag, "stock_code");
    const companyName = required(row, rowTag, "company_name", "name");
    const exchange = required(row, rowTag, "exchange");
    const evidenceTitle = required(row, rowTag, "evidence_title");
    const evidenceExcerpt = required(row, rowTag, "evidence_excerpt");
    const evidencePublishDate = required(row, rowTag, "evidence_publish_date", "publish_date");
    const evidenceLevel = cell(row, "evidence_level", "level") || "L3";
    const normalizedCompanyId = cell(row, "company_id") || `company:${stockCode}`;
    const parentId = cell(row, "parent_id") || (nodeId === chainId ? null : chainId);
    const nodeLevel = integerCell(row, "level") || (nodeId === chainId ? 1 : parentId === chainId ? 2 : 3);
    const nodeType = cell(row, "node_type") || (nodeLevel === 1 ? "chain" : nodeLevel === 2 ? "segment" : "subsegment");
    const edgeId = cell(row, "edge_id") || `edge_${safeId(nodeId)}_${safeId(stockCode)}`;
    const evidenceId = cell(row, "evidence_id") || `ev_${safeId(edgeId)}_${safeId(row.__line)}`;
    const rowReviewStatus = reviewStatus(row, evidenceLevel);
    const reviewedAt = rowReviewStatus === "accepted" ? context.now : null;

    chains.set(chainId, {
      id: chainId,
      name: chainName,
      description: cell(row, "chain_description") || `${chainName} imported from tabular mappings.`,
      node_count: 0,
      company_count: 0,
      updated_at: context.today,
    });

    upsertNode(nodes, chainId, {
      id: chainId,
      name: chainName,
      node_type: "chain",
      chain: chainId,
      parent_id: null,
      level: 1,
      aliases: listCell(row, "chain_aliases"),
      description: cell(row, "chain_description") || `${chainName} imported from tabular mappings.`,
      company_ids: [],
      status: "active",
      updated_at: context.today,
    });

    upsertNode(nodes, nodeId, {
      id: nodeId,
      name: nodeName,
      node_type: nodeType,
      chain: chainId,
      parent_id: parentId,
      level: nodeLevel,
      aliases: listCell(row, "node_aliases"),
      description: cell(row, "node_description") || `${nodeName} imported from tabular mappings.`,
      source_ids: [],
      company_ids: [],
      status: cell(row, "node_status") || "active",
      updated_at: context.today,
    });

    upsertCompany(companies, normalizedCompanyId, {
      id: normalizedCompanyId,
      stock_code: stockCode,
      stock_symbol: cell(row, "stock_symbol") || stockCode.split(".")[0],
      exchange,
      name: companyName,
      full_name: cell(row, "full_name") || null,
      industry: cell(row, "industry") || null,
      listed_at: cell(row, "listed_at") || null,
      aliases: listCell(row, "company_aliases"),
      source_ids: [evidenceId],
      updated_at: context.today,
    });

    upsertMappingEdge(edges, {
      id: edgeId,
      from_id: nodeId,
      to_id: normalizedCompanyId,
      edge_type: "company_maps_to_industry_node",
      direction: "directed",
      weight: numberCell(row, "weight") ?? numberCell(row, "relevance_score") ?? defaultScore(evidenceLevel).relevance,
      evidence_level: evidenceLevel,
      relevance_score: numberCell(row, "relevance_score") ?? defaultScore(evidenceLevel).relevance,
      purity_score: numberCell(row, "purity_score") ?? defaultScore(evidenceLevel).purity,
      confidence: numberCell(row, "confidence") ?? defaultScore(evidenceLevel).confidence,
      source_ids: [evidenceId],
      review_status: rowReviewStatus,
      created_at: context.now,
      updated_at: context.now,
    }, context.importStats);

    evidences.set(evidenceId, {
      id: evidenceId,
      target_type: "edge",
      target_id: edgeId,
      level: evidenceLevel,
      source_type: cell(row, "evidence_source_type", "source_type") || "imported_unverified",
      title: evidenceTitle,
      url: cell(row, "evidence_url", "url") || null,
      local_path: cell(row, "evidence_local_path", "local_path") || null,
      publish_date: evidencePublishDate,
      excerpt: evidenceExcerpt,
      language: cell(row, "language") || "zh",
      reliability: numberCell(row, "evidence_reliability", "reliability") ?? defaultReliability(evidenceLevel),
      mapped_at: context.now,
      reviewed_at: reviewedAt,
      reviewer: cell(row, "reviewer") || "human:local-import",
      stale_threshold_days: integerCell(row, "stale_threshold_days") || 365,
      notes: cell(row, "notes") || `Imported from ${context.sourceName}`,
    });

    const quote = buildQuote(row, normalizedCompanyId, stockCode, companyName, context);
    if (quote) quoteSnapshots.set(quote.id, quote);
  }

  for (const node of nodes.values()) {
    if (node.parent_id) {
      const parentEdgeId = `edge_parent_${safeId(node.parent_id)}_${safeId(node.id)}`;
      edges.set(parentEdgeId, {
        id: parentEdgeId,
        from_id: node.parent_id,
        to_id: node.id,
        edge_type: "industry_parent",
        direction: "directed",
        weight: 1,
        evidence_level: "L1",
        relevance_score: 1,
        purity_score: 1,
        confidence: 1,
        source_ids: [],
        review_status: "accepted",
        created_at: context.now,
        updated_at: context.now,
      });
    }
  }

  for (const edge of edges.values()) {
    if (edge.edge_type !== "company_maps_to_industry_node") continue;
    const node = nodes.get(edge.from_id);
    const chainNode = nodes.get(node?.chain);
    if (node && !node.company_ids.includes(edge.to_id)) node.company_ids.push(edge.to_id);
    if (chainNode && !chainNode.company_ids.includes(edge.to_id)) chainNode.company_ids.push(edge.to_id);
  }

  for (const chain of chains.values()) {
    const chainNodes = [...nodes.values()].filter((node) => node.chain === chain.id);
    chain.node_count = chainNodes.length;
    chain.company_count = new Set(chainNodes.flatMap((node) => node.company_ids)).size;
  }

  return {
    meta: {
      name: "AI-ChainGraph tabular import",
      dataset_id: context.datasetId,
      dataset_type: "local_real",
      source_policy: "local_only",
      data_version: `${context.datasetId}-${context.today}`,
      updated_at: context.now,
      disclaimer: "Imported tabular data is for research organization only and is not investment advice.",
    },
    chains: [...chains.values()],
    nodes: [...nodes.values()],
    companies: [...companies.values()],
    edges: [...edges.values()],
    evidences: [...evidences.values()],
    quote_snapshots: [...quoteSnapshots.values()],
    market_signals: [],
    review_queue: [],
    import_jobs: [],
  };
}

function buildQuote(row, companyId, stockCode, companyName, context) {
  const hasQuote = ["market_cap", "latest_price", "change_pct", "turnover_amount", "pe", "pb"].some((key) => cell(row, key));
  if (!hasQuote) return null;
  return {
    id: `quote:${stockCode}:tabular`,
    stock_code: stockCode,
    name: companyName,
    industry: cell(row, "industry") || null,
    market_cap: numberCell(row, "market_cap"),
    latest_price: numberCell(row, "latest_price"),
    change_pct: numberCell(row, "change_pct"),
    turnover_amount: numberCell(row, "turnover_amount"),
    pe: numberCell(row, "pe"),
    pb: numberCell(row, "pb"),
    quote_time: cell(row, "quote_time") || context.now,
    source: cell(row, "quote_source") || "manual:tabular",
    source_delay_note: cell(row, "source_delay_note") || "Imported local tabular quote. Verify before use.",
    refresh_job_id: `refresh:${safeId(companyId)}:tabular`,
  };
}

function validateGraph(data) {
  assert.ok(data.meta, "缺少 meta");
  assert.ok(Array.isArray(data.chains), "缺少 chains[]");
  assert.ok(Array.isArray(data.nodes), "缺少 nodes[]");
  assert.ok(Array.isArray(data.companies), "缺少 companies[]");
  assert.ok(Array.isArray(data.edges), "缺少 edges[]");
  assert.ok(Array.isArray(data.evidences), "缺少 evidences[]");
  assert.ok(Array.isArray(data.quote_snapshots), "缺少 quote_snapshots[]");
  const companyIds = new Set(data.companies.map((company) => company.id));
  const nodeIds = new Set(data.nodes.map((node) => node.id));
  const edgeIds = new Set(data.edges.map((edge) => edge.id));
  const evidenceIds = new Set(data.evidences.map((evidence) => evidence.id));
  for (const node of data.nodes) {
    assert.ok(node.id && node.name, "节点必须包含 id/name");
    for (const companyId of node.company_ids || []) {
      assert.ok(companyIds.has(companyId), `节点 ${node.id} 引用了不存在的公司 ${companyId}`);
    }
  }
  for (const edge of data.edges) {
    assert.ok(nodeIds.has(edge.from_id) || companyIds.has(edge.from_id), `边 ${edge.id} 的 from_id 不存在: ${edge.from_id}`);
    assert.ok(nodeIds.has(edge.to_id) || companyIds.has(edge.to_id), `边 ${edge.id} 的 to_id 不存在: ${edge.to_id}`);
    for (const sourceId of edge.source_ids || []) {
      assert.ok(evidenceIds.has(sourceId), `边 ${edge.id} 引用了不存在的证据 ${sourceId}`);
    }
  }
  for (const evidence of data.evidences) {
    if (evidence.target_type === "edge") assert.ok(edgeIds.has(evidence.target_id), `证据 ${evidence.id} 指向不存在的边 ${evidence.target_id}`);
    if (evidence.target_type === "node" && evidence.target_id !== "overview") assert.ok(nodeIds.has(evidence.target_id), `证据 ${evidence.id} 指向不存在的节点 ${evidence.target_id}`);
    if (evidence.target_type === "company") assert.ok(companyIds.has(evidence.target_id), `证据 ${evidence.id} 指向不存在的公司 ${evidence.target_id}`);
  }
}

function emptyGraph(datasetId, now) {
  return {
    meta: { name: "failed import", dataset_id: datasetId, data_version: datasetId, updated_at: now, disclaimer: "" },
    chains: [],
    nodes: [],
    companies: [],
    edges: [],
    evidences: [],
    quote_snapshots: [],
  };
}

function upsertNode(nodes, id, nextNode) {
  const existing = nodes.get(id);
  if (!existing) {
    nodes.set(id, nextNode);
    return;
  }
  nodes.set(id, { ...existing, ...nextNode, company_ids: existing.company_ids });
}

function upsertCompany(companies, id, nextCompany) {
  const existing = companies.get(id);
  if (!existing) {
    companies.set(id, nextCompany);
    return;
  }
  companies.set(id, {
    ...existing,
    ...nextCompany,
    aliases: uniqueList([...(existing.aliases || []), ...(nextCompany.aliases || [])]),
    source_ids: uniqueList([...(existing.source_ids || []), ...(nextCompany.source_ids || [])]),
  });
}

function upsertMappingEdge(edges, nextEdge, stats) {
  const existing = edges.get(nextEdge.id);
  if (!existing) {
    edges.set(nextEdge.id, nextEdge);
    return;
  }
  if (existing.edge_type === "company_maps_to_industry_node" && nextEdge.edge_type === "company_maps_to_industry_node") {
    stats.duplicate_mapping_rows += 1;
    stats.merged_mapping_edges.add(nextEdge.id);
  }
  edges.set(nextEdge.id, {
    ...existing,
    weight: maxNumber(existing.weight, nextEdge.weight),
    evidence_level: strongerEvidenceLevel(existing.evidence_level, nextEdge.evidence_level),
    relevance_score: maxNumber(existing.relevance_score, nextEdge.relevance_score),
    purity_score: maxNumber(existing.purity_score, nextEdge.purity_score),
    confidence: maxNumber(existing.confidence, nextEdge.confidence),
    source_ids: uniqueList([...(existing.source_ids || []), ...(nextEdge.source_ids || [])]),
    review_status: mergeReviewStatus(existing.review_status, nextEdge.review_status),
    updated_at: nextEdge.updated_at,
  });
}

function uniqueList(items) {
  return [...new Set(items.filter(Boolean))];
}

function maxNumber(left, right) {
  return Math.max(Number(left) || 0, Number(right) || 0);
}

function strongerEvidenceLevel(left, right) {
  return evidenceRank(right) > evidenceRank(left) ? right : left;
}

function evidenceRank(level) {
  return { L1: 3, L2: 2, L3: 1 }[level] || 0;
}

function mergeReviewStatus(left, right) {
  return left === "accepted" && right === "accepted" ? "accepted" : "needs_review";
}

function cell(row, ...keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function required(row, rowTag, ...keys) {
  const value = cell(row, ...keys);
  assert.ok(value, `${rowTag} 缺少字段 ${keys.join("/")}`);
  return value;
}

function listCell(row, ...keys) {
  const value = cell(row, ...keys);
  return value ? value.split(/[;|]/).map((item) => item.trim()).filter(Boolean) : [];
}

function numberCell(row, ...keys) {
  const value = cell(row, ...keys);
  if (!value) return null;
  const parsed = Number(value);
  assert.ok(Number.isFinite(parsed), `字段 ${keys.join("/")} 需要是数字: ${value}`);
  return parsed;
}

function integerCell(row, ...keys) {
  const value = numberCell(row, ...keys);
  return value === null ? null : Math.trunc(value);
}

function reviewStatus(row, evidenceLevel) {
  return cell(row, "review_status") || (evidenceLevel === "L3" ? "needs_review" : "accepted");
}

function defaultScore(level) {
  return {
    L1: { relevance: 0.88, purity: 0.82, confidence: 0.88 },
    L2: { relevance: 0.7, purity: 0.62, confidence: 0.7 },
    L3: { relevance: 0.45, purity: 0.32, confidence: 0.45 },
  }[level] || { relevance: 0.4, purity: 0.3, confidence: 0.4 };
}

function defaultReliability(level) {
  return { L1: 0.9, L2: 0.7, L3: 0.45 }[level] || 0.4;
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}
