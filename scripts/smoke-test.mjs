import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const graph = JSON.parse(await readFile(new URL("../src/data/demoGraph.json", import.meta.url)));
const schema = JSON.parse(await readFile(new URL("../schemas/chaingraph.schema.json", import.meta.url)));

assert.equal(graph.chains.length, 4, "需要四条一级链路");
assert.ok(graph.nodes.length >= 20, "需要至少 20 个示例产业节点");
assert.ok(graph.companies.length >= 8, "需要示例公司数据");
assert.ok(graph.edges.some((edge) => edge.edge_type === "company_maps_to_industry_node"), "需要公司映射边");
assert.ok(graph.evidences.every((item) => ["L1", "L2", "L3"].includes(item.level)), "证据等级必须合法");
assert.ok(graph.quote_snapshots.every((quote) => "latest_price" in quote && "pe" in quote && "pb" in quote), "行情字段缺失");
assert.ok(schema.$defs.market_signal, "schema 需要保留市场情报接口字段");
assert.ok(schema.$defs.review_queue_item, "schema 需要保留人工校正字段");
assert.ok(schema.$defs.import_job, "schema 需要保留导入任务字段");
assert.ok(schema.$defs.dataset, "schema 需要保留数据集字段");

const sqliteSchema = await readFile(new URL("../schemas/sqlite-schema.sql", import.meta.url), "utf8");
assert.match(sqliteSchema, /CREATE TABLE IF NOT EXISTS dataset/, "SQLite schema 需要 dataset 表");
assert.match(sqliteSchema, /CREATE TABLE IF NOT EXISTS import_job/, "SQLite schema 需要 import_job 表");
assert.match(sqliteSchema, /CREATE TABLE IF NOT EXISTS chain/, "SQLite schema 需要 chain 表");

const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
for (const ignoredPath of ["data/", "feedbacks/", "logs/", "secrets/", "public/snapshots/", "*.sqlite"]) {
  assert.ok(gitignore.includes(ignoredPath), `.gitignore 需要覆盖 ${ignoredPath}`);
}

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
assert.match(readme, /研究工作台/, "README 需要明确研究工作台定位");
assert.match(readme, /仓库边界与提交安全/, "README 需要说明仓库边界与提交安全");
assert.match(readme, /git rev-parse --show-toplevel/, "README 需要包含 Git root 检查命令");
assert.match(readme, /L1.*L2.*L3/s, "README 需要解释 L1/L2/L3 证据等级");

const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
assert.match(main, /viewMode/, "UI 需要保留视图切换状态");
assert.match(main, /function ListPanel/, "UI 需要提供列表视图入口");
assert.match(main, /公司映射列表/, "列表视图需要明确公司映射列表标题");

const companyIds = new Set(graph.companies.map((company) => company.id));
const nodeIds = new Set(graph.nodes.map((node) => node.id));
const edgeIds = new Set(graph.edges.map((edge) => edge.id));
const evidenceIds = new Set(graph.evidences.map((evidence) => evidence.id));
const mappingEdgesByCompany = new Map();
for (const edge of graph.edges) {
  assert.ok(nodeIds.has(edge.from_id), `边 ${edge.id} 的 from_id 不存在: ${edge.from_id}`);
  assert.ok(nodeIds.has(edge.to_id) || companyIds.has(edge.to_id), `边 ${edge.id} 的 to_id 不存在: ${edge.to_id}`);
  for (const sourceId of edge.source_ids) {
    assert.ok(evidenceIds.has(sourceId), `边 ${edge.id} 引用了不存在的证据 ${sourceId}`);
  }
  if (edge.edge_type === "company_maps_to_industry_node") {
    assert.ok(companyIds.has(edge.to_id), `公司映射边 ${edge.id} 未指向公司`);
    mappingEdgesByCompany.set(edge.to_id, (mappingEdgesByCompany.get(edge.to_id) || 0) + 1);
  }
}

for (const node of graph.nodes) {
  for (const companyId of node.company_ids) {
    assert.ok(companyIds.has(companyId), `节点 ${node.id} 引用了不存在的公司 ${companyId}`);
    assert.ok(mappingEdgesByCompany.has(companyId), `节点 ${node.id} 引用的公司 ${companyId} 缺少公司映射边`);
  }
}

for (const company of graph.companies) {
  assert.ok(mappingEdgesByCompany.has(company.id), `公司 ${company.id} 缺少公司映射边`);
  for (const sourceId of company.source_ids) {
    assert.ok(evidenceIds.has(sourceId), `公司 ${company.id} 引用了不存在的证据 ${sourceId}`);
  }
}

for (const evidence of graph.evidences) {
  assert.ok("stale_threshold_days" in evidence, `证据 ${evidence.id} 缺少 stale_threshold_days`);
  if (evidence.target_type === "edge") {
    assert.ok(edgeIds.has(evidence.target_id), `证据 ${evidence.id} 指向不存在的边 ${evidence.target_id}`);
  }
  if (evidence.target_type === "node" && evidence.target_id !== "overview") {
    assert.ok(nodeIds.has(evidence.target_id), `证据 ${evidence.id} 指向不存在的节点 ${evidence.target_id}`);
  }
}

console.log("smoke ok: demo fallback, v0.2 schema/import boundaries, ignored local data paths, quote fields, and reference integrity are present");
