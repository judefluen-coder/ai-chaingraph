import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = process.argv.find((arg) => !arg.startsWith("--") && arg !== process.argv[0] && arg !== process.argv[1]);
const shouldWrite = process.argv.includes("--write");

if (!inputPath) {
  console.error("用法: node scripts/import-snapshot.mjs <snapshot.json> [--write]");
  process.exit(1);
}

const absoluteInputPath = path.resolve(process.cwd(), inputPath);
const raw = await readFile(absoluteInputPath, "utf8");
const graph = JSON.parse(raw);
const sourceHash = createHash("sha256").update(raw).digest("hex");
const now = new Date().toISOString();
const datasetId = graph.meta?.dataset_id || "local-snapshot";

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
  const validStages = new Set(["overview", "upstream", "core", "downstream"]);
  const validRelationBases = new Set(["official_disclosure", "product_fact", "industry_inference"]);

  for (const node of data.nodes) {
    assert.ok(node.id && node.name, "节点必须包含 id/name");
    assert.ok(validStages.has(node.stage), `节点 ${node.id} 缺少合法的 stage`);
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
    assert.ok(validRelationBases.has(edge.relation_basis), `边 ${edge.id} 缺少合法的 relation_basis`);
    assert.ok(edge.relation_summary, `边 ${edge.id} 缺少 relation_summary`);
    assert.ok(edge.last_verified_at, `边 ${edge.id} 缺少 last_verified_at`);
  }

  for (const evidence of data.evidences) {
    if (evidence.target_type === "edge") assert.ok(edgeIds.has(evidence.target_id), `证据 ${evidence.id} 指向不存在的边 ${evidence.target_id}`);
    if (evidence.target_type === "node" && evidence.target_id !== "overview") assert.ok(nodeIds.has(evidence.target_id), `证据 ${evidence.id} 指向不存在的节点 ${evidence.target_id}`);
    if (evidence.target_type === "company") assert.ok(companyIds.has(evidence.target_id), `证据 ${evidence.id} 指向不存在的公司 ${evidence.target_id}`);
  }
}

const errors = [];
try {
  validateGraph(graph);
} catch (error) {
  errors.push(error.message);
}

const mappingReviewRecords = graph.edges.filter(
  (edge) => edge.edge_type === "company_maps_to_industry_node" && edge.review_status !== "accepted",
).length;
const queueReviewRecords = (graph.review_queue || []).filter((item) => item.status === "pending").length;
const reviewRecords = mappingReviewRecords + queueReviewRecords;
const acceptedRecords = graph.nodes.length
  + graph.companies.length
  + graph.edges.length
  + graph.evidences.length
  + graph.quote_snapshots.length
  - mappingReviewRecords;
const importJob = {
  id: `import:${Date.now()}`,
  dataset_id: datasetId,
  adapter_type: "snapshot",
  source_name: path.basename(absoluteInputPath),
  source_path: absoluteInputPath,
  source_hash: sourceHash,
  status: errors.length > 0 ? "failed" : shouldWrite ? "applied" : "validated",
  total_records: acceptedRecords + reviewRecords,
  accepted_records: errors.length > 0 ? 0 : acceptedRecords,
  review_records: errors.length > 0 ? 0 : reviewRecords,
  rejected_records: errors.length,
  error_json: errors,
  report_json: {
    chains: graph.chains.length,
    nodes: graph.nodes.length,
    companies: graph.companies.length,
    edges: graph.edges.length,
    evidences: graph.evidences.length,
    quote_snapshots: graph.quote_snapshots.length,
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
  import_jobs: [...(graph.import_jobs || []), importJob],
  meta: {
    dataset_type: "local_real",
    source_policy: "local_only",
    ...graph.meta,
    dataset_id: datasetId,
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

console.log(JSON.stringify(importJob, null, 2));
