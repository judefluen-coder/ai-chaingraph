import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildFlow,
  buildListRows,
  buildScopedData,
  getDataStatus,
  getMarketOptions,
  searchItems,
} from "../src/lib/graphViewModel.js";

const graph = JSON.parse(await readFile(new URL("../src/data/demoGraph.json", import.meta.url)));
const schema = JSON.parse(await readFile(new URL("../schemas/chaingraph.schema.json", import.meta.url)));

assert.equal(graph.chains.length, 4, "需要四条一级链路");
assert.ok(graph.nodes.length >= 20, "需要至少 20 个示例产业节点");
assert.ok(graph.companies.length >= 8, "需要示例公司数据");
assert.ok(graph.edges.some((edge) => edge.edge_type === "company_maps_to_industry_node"), "需要公司映射边");
assert.ok(graph.evidences.every((item) => ["L1", "L2", "L3"].includes(item.level)), "证据等级必须合法");
assert.ok(graph.quote_snapshots.every((quote) => "latest_price" in quote && "pe" in quote && "pb" in quote), "行情字段缺失");
const exchanges = new Set(graph.companies.map((company) => company.exchange));
assert.ok(["SH", "SZ", "BJ"].some((exchange) => exchanges.has(exchange)), "demo 需要包含 A股公司");
assert.ok(["NASDAQ", "NYSE", "AMEX", "OTC"].some((exchange) => exchanges.has(exchange)), "demo 需要包含美股公司");
assert.ok(schema.$defs.company.properties.exchange.enum.includes("NASDAQ"), "schema 需要允许美股交易所");

const mappingEdges = graph.edges.filter((edge) => edge.edge_type === "company_maps_to_industry_node");
assert.deepEqual(getMarketOptions(graph), ["all", "a_share", "us"], "市场筛选需要识别 A股和美股");
assert.equal(buildListRows(graph, "all", null, "", "all").length, mappingEdges.length, "全部市场列表需要展示所有公司映射");
const usRows = buildListRows(graph, "all", null, "", "us");
assert.equal(usRows.length, 2, "美股筛选需要保留 demo 中的两条映射");
assert.ok(usRows.every((row) => ["NASDAQ", "NYSE", "AMEX", "OTC"].includes(row.company.exchange)), "美股筛选不能混入 A股公司");
const opticalRows = buildListRows(graph, "all", null, "光模块", "all");
assert.ok(opticalRows.some((row) => row.company.name === "光桥通信"), "搜索光模块需要命中 A股光模块公司");
assert.ok(opticalRows.some((row) => row.company.name === "PhotonMesh Networks"), "搜索光模块需要命中美股光模块公司");
const scopedUs = buildScopedData(graph, null, "us");
assert.ok(scopedUs.companies.every((company) => ["NASDAQ", "NYSE", "AMEX", "OTC"].includes(company.exchange)), "美股 scoped graph 只能包含美股公司");
assert.ok(
  scopedUs.edges
    .filter((edge) => edge.edge_type === "company_maps_to_industry_node")
    .every((edge) => scopedUs.companies.some((company) => company.id === edge.to_id)),
  "美股 scoped graph 的公司映射边必须指向可见公司",
);
const l1UsFlow = buildFlow(scopedUs, "overview", "", "L1");
assert.ok(l1UsFlow.nodes.some((node) => node.id === "company:VRCK"), "L1 美股图谱需要展示 L1 美股公司");
assert.ok(!l1UsFlow.nodes.some((node) => node.id === "company:PMN"), "L1 美股图谱不能展示 L2 美股公司");
assert.ok(searchItems(graph, "光模块").some((item) => item.id === "ev_demo_l2_us_optical"), "搜索需要覆盖证据摘要文本");
const status = getDataStatus(graph);
assert.equal(status.datasetType, "demo", "demo 数据状态需要保持 demo 类型");
assert.equal(status.mappingReviewCount, 2, "数据状态需要统计待审核映射");

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
assert.match(readme, /选股地图/, "README 需要明确选股地图定位");
assert.match(readme, /信息组织与产业研究辅助工具/, "README 需要保留非投资建议定位");
assert.match(readme, /仓库边界与提交安全/, "README 需要说明仓库边界与提交安全");
assert.match(readme, /git rev-parse --show-toplevel/, "README 需要包含 Git root 检查命令");
assert.match(readme, /L1.*L2.*L3/s, "README 需要解释 L1/L2/L3 证据等级");
assert.match(readme, /本地观察列表/, "README 需要说明本地观察列表能力");

const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const loadGraphData = await readFile(new URL("../src/data/loadGraphData.js", import.meta.url), "utf8");
const viteConfig = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
const pagesWorkflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const companyMapList = await readFile(new URL("../src/components/CompanyMapList.jsx", import.meta.url), "utf8");
const chainSidebar = await readFile(new URL("../src/components/ChainSidebar.jsx", import.meta.url), "utf8");
const detailDrawer = await readFile(new URL("../src/components/DetailDrawer.jsx", import.meta.url), "utf8");
assert.match(main, /viewMode/, "UI 需要保留视图切换状态");
assert.match(main, /mobileTab/, "UI 需要提供移动端视图切换状态");
assert.match(main, /"url", "note"/, "CSV 导出需要包含本地反馈的来源 URL 和说明");
assert.match(main, /ai-chaingraph-watchlist/, "UI 需要把观察列表保存在本地浏览器");
assert.match(main, /exportWatchlist/, "UI 需要支持导出本地观察列表");
assert.match(companyMapList, /公司映射列表/, "列表视图需要明确公司映射列表标题");
assert.match(companyMapList, /为什么相关/, "列表视图需要突出相关性解释");
assert.match(chainSidebar, /产业链导航/, "UI 需要保留产业链导航入口");
assert.match(detailDrawer, /人工校正/, "UI 需要保留人工校正入口");
assert.match(detailDrawer, /观察列表/, "详情面板需要提供观察列表入口");
assert.match(detailDrawer, /onToggleWatchlist/, "公司详情需要支持加入或移出观察列表");
assert.match(detailDrawer, /record\.payload\?\.url/, "本地审核队列需要展示反馈来源 URL");
assert.match(viteConfig, /VITE_BASE_PATH/, "Vite 需要支持 GitHub Pages 子路径构建");
assert.match(loadGraphData, /import\.meta\.env\.BASE_URL/, "public snapshot 路径需要跟随 Vite base");
assert.match(pagesWorkflow, /VITE_BASE_PATH: \/ai-chaingraph\//, "Pages workflow 需要使用仓库子路径构建");

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

console.log("smoke ok: demo fallback, market/search view model, schema/import boundaries, ignored local data paths, quote fields, and reference integrity are present");
