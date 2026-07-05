import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  buildCoverageMatrix,
  buildFlow,
  buildListRows,
  buildScopedData,
  getDataStatus,
  getMarketOptions,
  searchItems,
} from "../src/lib/graphViewModel.js";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
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
const coverageMatrix = buildCoverageMatrix(graph, "all", "all");
assert.equal(coverageMatrix.rows.length, graph.chains.length, "覆盖矩阵需要按每条一级链路生成行");
assert.equal(coverageMatrix.totals.companyCount, 12, "覆盖矩阵需要统计 demo 公司覆盖数");
assert.ok(coverageMatrix.rows.some((row) => row.chain.id === "optical_communication" && row.marketCounts.us === 1), "覆盖矩阵需要展示链路内美股覆盖");
assert.ok(coverageMatrix.rows.every((row) => row.qualityScore >= 0 && row.qualityScore <= 100), "覆盖矩阵质量分需要保持在 0-100");
const l1UsCoverage = buildCoverageMatrix(graph, "L1", "us");
assert.equal(l1UsCoverage.totals.companyCount, 1, "覆盖矩阵需要响应市场与证据筛选");

assert.ok(schema.$defs.market_signal, "schema 需要保留市场情报接口字段");
assert.ok(schema.$defs.review_queue_item, "schema 需要保留人工校正字段");
assert.ok(schema.$defs.import_job, "schema 需要保留导入任务字段");
assert.ok(schema.$defs.dataset, "schema 需要保留数据集字段");

const sqliteSchema = await readFile(new URL("../schemas/sqlite-schema.sql", import.meta.url), "utf8");
assert.match(sqliteSchema, /CREATE TABLE IF NOT EXISTS dataset/, "SQLite schema 需要 dataset 表");
assert.match(sqliteSchema, /CREATE TABLE IF NOT EXISTS import_job/, "SQLite schema 需要 import_job 表");
assert.match(sqliteSchema, /CREATE TABLE IF NOT EXISTS chain/, "SQLite schema 需要 chain 表");
assert.match(sqliteSchema, /NASDAQ.*NYSE.*AMEX.*OTC/s, "SQLite schema 需要允许美股交易所");

const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
for (const ignoredPath of ["data/", "feedbacks/", "logs/", "secrets/", "public/snapshots/", "*.sqlite"]) {
  assert.ok(gitignore.includes(ignoredPath), `.gitignore 需要覆盖 ${ignoredPath}`);
}

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
assert.match(readme, /选股地图/, "README 需要明确选股地图定位");
assert.match(readme, /信息组织与产业研究辅助工具/, "README 需要保留非投资建议定位");
assert.match(readme, /仓库边界与提交安全/, "README 需要说明仓库边界与提交安全");
assert.match(readme, /git rev-parse --show-toplevel/, "README 需要包含 Git root 检查命令");
assert.match(readme, /L1.*L2.*L3/s, "README 需要解释 L1/L2/L3 证据等级");
assert.match(readme, /本地观察列表/, "README 需要说明本地观察列表能力");
assert.match(readme, /公司覆盖矩阵/, "README 需要说明公司覆盖矩阵能力");
assert.match(readme, /证据时间线/, "README 需要说明证据时间线能力");
assert.match(readme, /CSV\/JSONL/, "README 需要说明 CSV/JSONL 扁平映射表导入");
assert.match(packageJson, /validate:tabular/, "package.json 需要提供 tabular 导入示例校验命令");

const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const importTabular = await readFile(new URL("../scripts/import-tabular.mjs", import.meta.url), "utf8");
const csvMappingExample = await readFile(new URL("../examples/fictional-ai-mappings.csv", import.meta.url), "utf8");
const jsonlMappingExample = await readFile(new URL("../examples/fictional-ai-mappings.jsonl", import.meta.url), "utf8");
const duplicateMappingExample = await readFile(new URL("../examples/fictional-ai-mappings-duplicates.csv", import.meta.url), "utf8");
const loadGraphData = await readFile(new URL("../src/data/loadGraphData.js", import.meta.url), "utf8");
const viteConfig = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
const pagesWorkflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const ciWorkflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const companyMapList = await readFile(new URL("../src/components/CompanyMapList.jsx", import.meta.url), "utf8");
const coverageMatrixComponent = await readFile(new URL("../src/components/CoverageMatrix.jsx", import.meta.url), "utf8");
const chainSidebar = await readFile(new URL("../src/components/ChainSidebar.jsx", import.meta.url), "utf8");
const detailDrawer = await readFile(new URL("../src/components/DetailDrawer.jsx", import.meta.url), "utf8");
assert.match(main, /viewMode/, "UI 需要保留视图切换状态");
assert.match(main, /mobileTab/, "UI 需要提供移动端视图切换状态");
assert.match(main, /"url", "note"/, "CSV 导出需要包含本地反馈的来源 URL 和说明");
assert.match(main, /ai-chaingraph-watchlist/, "UI 需要把观察列表保存在本地浏览器");
assert.match(main, /exportWatchlist/, "UI 需要支持导出本地观察列表");
assert.match(companyMapList, /公司映射列表/, "列表视图需要明确公司映射列表标题");
assert.match(companyMapList, /为什么相关/, "列表视图需要突出相关性解释");
assert.match(companyMapList, /CoverageMatrix/, "列表视图需要挂载公司覆盖矩阵");
assert.match(coverageMatrixComponent, /公司覆盖矩阵/, "覆盖矩阵组件需要有可访问标签");
assert.match(coverageMatrixComponent, /链路覆盖与证据质量/, "覆盖矩阵需要解释覆盖和证据质量");
assert.match(chainSidebar, /产业链导航/, "UI 需要保留产业链导航入口");
assert.match(detailDrawer, /人工校正/, "UI 需要保留人工校正入口");
assert.match(detailDrawer, /观察列表/, "详情面板需要提供观察列表入口");
assert.match(detailDrawer, /证据时间线/, "详情面板需要提供证据时间线入口");
assert.match(detailDrawer, /sort\(\(a, b\).*publish_date/s, "证据时间线需要按发布日期排序");
assert.match(detailDrawer, /onToggleWatchlist/, "公司详情需要支持加入或移出观察列表");
assert.match(detailDrawer, /record\.payload\?\.url/, "本地审核队列需要展示反馈来源 URL");
assert.match(viteConfig, /VITE_BASE_PATH/, "Vite 需要支持 GitHub Pages 子路径构建");
assert.match(loadGraphData, /import\.meta\.env\.BASE_URL/, "public snapshot 路径需要跟随 Vite base");
assert.match(pagesWorkflow, /VITE_BASE_PATH: \/ai-chaingraph\//, "Pages workflow 需要使用仓库子路径构建");
assert.match(ciWorkflow, /validate:tabular/, "CI 需要校验 CSV/JSONL tabular 示例");
assert.match(importTabular, /parseCsv/, "tabular adapter 需要支持 CSV");
assert.match(importTabular, /jsonl/, "tabular adapter 需要支持 JSONL");
assert.match(importTabular, /company_maps_to_industry_node/, "tabular adapter 需要生成公司映射边");
assert.match(csvMappingExample, /chain_id,chain_name/, "CSV 示例需要包含标准表头");
assert.match(jsonlMappingExample, /VectorRack Systems/, "JSONL 示例需要包含美股映射");
assert.match(duplicateMappingExample, /星阵芯科 2025 年度报告/, "重复映射示例需要覆盖同一公司-产业节点多条证据");

const { stdout: duplicateSnapshotOutput } = await execFileAsync(
  process.execPath,
  ["scripts/import-tabular.mjs", "examples/fictional-ai-mappings-duplicates.csv", "--print-snapshot"],
  { cwd: repoRoot, maxBuffer: 1024 * 1024 },
);
const duplicateSnapshot = JSON.parse(duplicateSnapshotOutput);
const duplicateEdge = duplicateSnapshot.edges.find((edge) => edge.id === "edge_seg_ai_server_688001_sh");
const duplicateCompany = duplicateSnapshot.companies.find((company) => company.id === "company:688001.SH");
assert.equal(duplicateSnapshot.import_jobs[0].report_json.duplicate_mapping_rows, 1, "重复映射导入报告需要统计被合并的行数");
assert.equal(duplicateSnapshot.import_jobs[0].report_json.merged_mapping_edges, 1, "重复映射导入报告需要统计被合并的映射边");
assert.equal(duplicateSnapshot.evidences.length, 2, "同一映射的多条证据都需要保留");
assert.equal(duplicateEdge.source_ids.length, 2, "重复映射边需要引用全部证据");
assert.equal(duplicateEdge.evidence_level, "L1", "重复映射边需要使用最强证据等级");
assert.equal(duplicateEdge.review_status, "accepted", "全部已接受证据合并后仍应保持 accepted");
assert.equal(duplicateCompany.source_ids.length, 2, "重复映射公司需要引用全部证据");

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
