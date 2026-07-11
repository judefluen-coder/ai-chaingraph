import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  buildCompanyPathCompare,
  buildCoverageMatrix,
  buildEvidenceConflictAlerts,
  buildFlow,
  buildEntityQualityAlerts,
  buildListRows,
  buildScopedData,
  getDataStatus,
  getMappingQualityAlerts,
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
assert.ok(coverageMatrix.insights.some((item) => item.type === "market_gap"), "覆盖矩阵需要提示 A股/美股覆盖缺口");
const l1UsCoverage = buildCoverageMatrix(graph, "L1", "us");
assert.equal(l1UsCoverage.totals.companyCount, 1, "覆盖矩阵需要响应市场与证据筛选");
const reviewMapping = mappingEdges.find((edge) => edge.review_status === "needs_review");
assert.ok(getMappingQualityAlerts(graph, reviewMapping).some((item) => item.type === "needs_review"), "映射质量提示需要标出待审核关系");
const reviewCompany = graph.companies.find((company) => company.id === reviewMapping.to_id);
assert.ok(buildEntityQualityAlerts(graph, reviewCompany, "all", "all").some((item) => item.type === "needs_review"), "公司详情需要能展示待审核质量提示");
assert.ok(buildEntityQualityAlerts(graph, { id: "overview", node_type: "overview" }, "all", "all").some((item) => item.type === "market_gap"), "总览详情需要能展示覆盖缺口提示");

const conflictGraph = structuredClone(graph);
const conflictEdge = conflictGraph.edges.find((edge) => edge.id === "edge_company_star_chip");
conflictEdge.evidence_level = "L1";
for (const evidence of conflictGraph.evidences.filter((item) => conflictEdge.source_ids.includes(item.id))) {
  evidence.level = "L3";
}
const conflictCompany = conflictGraph.companies.find((company) => company.id === conflictEdge.to_id);
assert.ok(getMappingQualityAlerts(conflictGraph, conflictEdge).some((item) => item.type === "evidence_level_conflict"), "映射质量提示需要标出证据等级冲突");
assert.ok(buildEvidenceConflictAlerts(conflictGraph, "all", "all").some((item) => item.target_id === conflictEdge.id), "证据冲突汇总需要包含冲突映射");
assert.ok(buildEntityQualityAlerts(conflictGraph, conflictCompany, "all", "all").some((item) => item.type === "evidence_level_conflict"), "公司详情需要展示证据冲突");
assert.ok(buildCoverageMatrix(conflictGraph, "all", "all").insights.some((item) => item.type === "evidence_level_conflict"), "总览覆盖提示需要展示证据冲突");

const pcbCompany = graph.companies.find((company) => company.id === "company:002916.SZ");
const pathCompare = buildCompanyPathCompare(graph, pcbCompany, "all", "all");
assert.equal(pathCompare.paths.length, 2, "产业链路径对比需要列出当前公司的全部映射路径");
assert.ok(pathCompare.paths.some((path) => path.node.name === "封装基板"), "产业链路径对比需要包含公司所在节点");
const materialPeer = pathCompare.peers.find((peer) => peer.company.id === "company:688519.SH");
assert.ok(materialPeer, "产业链路径对比需要找出同链路同行公司");
assert.ok(materialPeer.sharedNodeNames.includes("封装基板"), "产业链路径对比需要识别共享产业节点");
assert.ok(materialPeer.uniqueNodeNames.includes("Low-Dk 材料"), "产业链路径对比需要识别同行差异节点");

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
assert.match(readme, /产业链路径对比/, "README 需要说明产业链路径对比能力");
assert.match(readme, /证据冲突/, "README 需要说明证据冲突提示能力");
assert.match(readme, /证据时间线/, "README 需要说明证据时间线能力");
assert.match(readme, /CSV\/JSONL/, "README 需要说明 CSV/JSONL 扁平映射表导入");
assert.match(readme, /观察备注/, "README 需要说明观察列表研究备注能力");
assert.match(readme, /本地 API/, "README 需要说明本地 API 服务");
assert.match(readme, /API.*人工校正|人工校正.*API/, "README 需要说明人工校正可同步到本地 API");
assert.match(packageJson, /validate:tabular/, "package.json 需要提供 tabular 导入示例校验命令");
assert.match(packageJson, /"api": "node scripts\/serve-api\.mjs"/, "package.json 需要提供本地 API 启动命令");

const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const importTabular = await readFile(new URL("../scripts/import-tabular.mjs", import.meta.url), "utf8");
const serveApi = await readFile(new URL("../scripts/serve-api.mjs", import.meta.url), "utf8");
const reviewTransport = await readFile(new URL("../src/data/reviewTransport.js", import.meta.url), "utf8");
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
assert.match(main, /"priority", "tags", "thesis", "next_review_at"/, "观察列表 CSV 导出需要包含研究备注字段");
assert.match(main, /ai-chaingraph-watchlist/, "UI 需要把观察列表保存在本地浏览器");
assert.match(main, /exportWatchlist/, "UI 需要支持导出本地观察列表");
assert.match(main, /updateWatchlistRecord/, "UI 需要支持编辑观察列表研究备注");
assert.match(main, /submitReviewRecord/, "人工校正需要优先尝试同步到本地 API");
assert.match(companyMapList, /公司映射列表/, "列表视图需要明确公司映射列表标题");
assert.match(companyMapList, /为什么相关/, "列表视图需要突出相关性解释");
assert.match(companyMapList, /CoverageMatrix/, "列表视图需要挂载公司覆盖矩阵");
assert.match(coverageMatrixComponent, /公司覆盖矩阵/, "覆盖矩阵组件需要有可访问标签");
assert.match(coverageMatrixComponent, /链路覆盖与证据质量/, "覆盖矩阵需要解释覆盖和证据质量");
assert.match(coverageMatrixComponent, /覆盖缺口提醒/, "覆盖矩阵需要展示覆盖缺口提醒");
assert.match(chainSidebar, /产业链导航/, "UI 需要保留产业链导航入口");
assert.match(detailDrawer, /人工校正/, "UI 需要保留人工校正入口");
assert.match(detailDrawer, /观察列表/, "详情面板需要提供观察列表入口");
assert.match(detailDrawer, /观察备注/, "详情面板需要提供观察备注入口");
assert.match(detailDrawer, /下次复核/, "观察列表需要支持下次复核日期");
assert.match(detailDrawer, /证据时间线/, "详情面板需要提供证据时间线入口");
assert.match(detailDrawer, /质量提示/, "详情面板需要展示质量提示");
assert.match(detailDrawer, /证据冲突/, "详情面板需要展示证据冲突提示");
assert.match(detailDrawer, /产业链路径对比/, "详情面板需要展示产业链路径对比");
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
assert.match(serveApi, /createApiServer/, "本地 API 需要导出 createApiServer 方便 smoke 测试");
assert.match(serveApi, /\/api\/graph/, "本地 API 需要提供 /api/graph");
assert.match(serveApi, /\/api\/search/, "本地 API 需要提供 /api/search");
assert.match(serveApi, /\/api\/node\/:id/, "本地 API 需要说明 /api/node/:id");
assert.match(serveApi, /\/api\/review/, "本地 API 需要提供 /api/review");
assert.match(serveApi, /readReviewQueue/, "本地 API 需要能读取 JSONL 审核队列");
assert.match(reviewTransport, /VITE_CHAINGRAPH_API_BASE/, "人工校正同步需要读取本地 API 配置");
assert.match(reviewTransport, /\/api\/review/, "人工校正同步需要调用 /api/review");
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

const { createApiServer } = await import("./serve-api.mjs");
const { resolveReviewApiBase, submitReviewRecord } = await import("../src/data/reviewTransport.js");
const apiDataDir = await mkdtemp(path.join(tmpdir(), "ai-chaingraph-api-"));
const apiServer = createApiServer({ dataDir: apiDataDir });
await new Promise((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
const apiBase = `http://127.0.0.1:${apiServer.address().port}`;
try {
  assert.equal(resolveReviewApiBase({ VITE_CHAINGRAPH_API_BASE: `${apiBase}/` }), apiBase, "人工校正 API 地址需要去掉末尾斜杠");
  const localOnlyReview = await submitReviewRecord({ target_type: "company", target_id: "company:688001.SH", issue_type: "stale" }, { apiBase: "" });
  assert.equal(localOnlyReview.source, "local", "未配置 API 时人工校正需要保留本地队列语义");
  const apiGraph = await fetchJson(`${apiBase}/api/graph`);
  assert.equal(apiGraph.meta.dataset_type, "demo", "本地 API 缺少 snapshot 时需要回退 demo graph");
  const apiSearch = await fetchJson(`${apiBase}/api/search?q=${encodeURIComponent("光模块")}`);
  assert.ok(apiSearch.items.some((item) => item.target_id === "company:300801.SZ"), "本地 API 搜索需要返回可定位目标");
  const apiNode = await fetchJson(`${apiBase}/api/node/${encodeURIComponent("company:688001.SH")}`);
  assert.equal(apiNode.entity.name, "星阵芯科", "本地 API 节点详情需要返回公司实体");
  assert.ok(apiNode.mapping_edges.length > 0, "本地 API 节点详情需要返回映射边");
  const apiReview = await fetchJson(`${apiBase}/api/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target_type: "company", target_id: "company:688001.SH", issue_type: "add_evidence", payload: { note: "smoke" } }),
  });
  assert.equal(apiReview.record.status, "pending", "本地 API 审核入口需要保存 pending 记录");
  const syncedReview = await submitReviewRecord(
    { target_type: "company", target_id: "company:688001.SH", issue_type: "incorrect", payload: { note: "transport smoke" } },
    { apiBase },
  );
  assert.equal(syncedReview.source, "api", "人工校正同步需要标记 API 来源");
  assert.equal(syncedReview.record.status, "pending", "人工校正同步需要返回 API 保存的 pending 记录");
  const apiReviewQueue = await fetchJson(`${apiBase}/api/review`);
  assert.equal(apiReviewQueue.count, 2, "本地 API 需要能读取已写入的 JSONL 审核记录");
  assert.ok(apiReviewQueue.records.some((record) => record.id === apiReview.record.id), "GET /api/review 需要返回直接 POST 的审核记录");
  assert.ok(apiReviewQueue.records.some((record) => record.id === syncedReview.record.id), "GET /api/review 需要返回前端 transport 同步的审核记录");
  const apiGraphWithReview = await fetchJson(`${apiBase}/api/graph`);
  assert.ok(apiGraphWithReview.review_queue.some((record) => record.id === syncedReview.record.id), "/api/graph 需要合并本地 JSONL 审核队列");
} finally {
  await new Promise((resolve) => apiServer.close(resolve));
  await rm(apiDataDir, { recursive: true, force: true });
}

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

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  assert.ok(response.ok, `${url} expected HTTP 2xx, got ${response.status}`);
  return response.json();
}
