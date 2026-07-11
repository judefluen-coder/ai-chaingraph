import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Database, GitBranch, ListFilter, Map, PanelRight } from "lucide-react";
import { loadGraphData } from "./data/loadGraphData";
import { TopBar } from "./components/TopBar";
import { ChainSidebar } from "./components/ChainSidebar";
import { IndustryExplorer } from "./components/IndustryExplorer";
import { CompanyMapList } from "./components/CompanyMapList";
import { GraphViewport } from "./components/GraphViewport";
import { DetailDrawer } from "./components/DetailDrawer";
import {
  buildFlow,
  buildIndustryAtlas,
  buildListRows,
  buildScopedData,
  exportDisclaimer,
  getCompanyMarket,
  getEntity,
  getMarketOptions,
  getPathSummary,
  searchItems,
} from "./lib/graphViewModel";
import "./styles.css";

function readStoredWatchlist() {
  try {
    const records = JSON.parse(localStorage.getItem("ai-chaingraph-watchlist") || "[]");
    return Array.isArray(records) ? records.map(normalizeWatchlistRecord) : [];
  } catch {
    return [];
  }
}

function normalizeWatchlistRecord(record) {
  return {
    priority: "medium",
    tags: "",
    thesis: "",
    next_review_at: "",
    ...record,
  };
}

function writeStoredWatchlist(records) {
  localStorage.setItem("ai-chaingraph-watchlist", JSON.stringify(records, null, 2));
}

function downloadText(filename, mimeType, content) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toWatchlistCsv(records) {
  const headers = ["company_id", "stock_code", "name", "market", "industry", "priority", "tags", "thesis", "next_review_at", "added_at", "updated_at"];
  const rows = records.map((record) => headers.map((header) => JSON.stringify(record[header] ?? "")).join(","));
  return [`# ${exportDisclaimer}`, headers.join(","), ...rows].join("\n");
}

function App() {
  const [graphState, setGraphState] = useState({ data: null, error: null });
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState("overview");
  const [viewMode, setViewMode] = useState("atlas");
  const [mobileTab, setMobileTab] = useState("atlas");
  const [onlyChain, setOnlyChain] = useState(null);
  const [marketFilter, setMarketFilter] = useState("all");
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const [ack, setAck] = useState(() => localStorage.getItem("ai-chaingraph-disclaimer") === "ack");
  const [watchlistRecords, setWatchlistRecords] = useState(readStoredWatchlist);
  const [notice, setNotice] = useState("");
  const isMobileLayout = useMediaQuery("(max-width: 760px)");
  const evidenceFilter = "all";
  const graphData = graphState.data;

  useEffect(() => {
    let alive = true;
    loadGraphData()
      .then((data) => {
        if (alive) setGraphState({ data, error: null });
      })
      .catch((error) => {
        if (alive) setGraphState({ data: null, error });
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    writeStoredWatchlist(watchlistRecords);
  }, [watchlistRecords]);

  useEffect(() => {
    setNotice("");
  }, [activeId]);

  useEffect(() => {
    setSearchCollapsed(false);
  }, [query]);

  const scopedData = useMemo(() => graphData ? buildScopedData(graphData, onlyChain, marketFilter) : null, [graphData, onlyChain, marketFilter]);
  const flow = useMemo(
    () => scopedData ? buildFlow(scopedData, activeId, query, evidenceFilter, isMobileLayout ? "TB" : "LR") : { nodes: [], edges: [] },
    [scopedData, activeId, query, evidenceFilter, isMobileLayout],
  );
  const listRows = useMemo(() => graphData ? buildListRows(graphData, evidenceFilter, onlyChain, query, marketFilter) : [], [graphData, evidenceFilter, onlyChain, query, marketFilter]);
  const industryAtlas = useMemo(() => graphData ? buildIndustryAtlas(graphData, marketFilter) : [], [graphData, marketFilter]);
  const searchResults = useMemo(() => graphData ? searchItems(graphData, query) : [], [graphData, query]);
  const active = graphData ? getEntity(graphData, activeId) : null;
  const pathSummary = graphData && active ? getPathSummary(scopedData || graphData, active, marketFilter) : "数据加载中";
  const marketOptions = useMemo(() => graphData ? getMarketOptions(graphData) : ["all"], [graphData]);
  const watchlistIds = useMemo(() => new Set(watchlistRecords.map((record) => record.company_id)), [watchlistRecords]);

  function acknowledgeDisclaimer() {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    setAck(true);
  }

  function resetWorkspace() {
    setActiveId("overview");
    setOnlyChain(null);
    setQuery("");
    setMarketFilter("all");
    setViewMode("atlas");
    setMobileTab("atlas");
  }

  function selectEntity(id) {
    setActiveId(id);
    if (isMobileLayout) setMobileTab("detail");
  }

  function focusChain(chainId) {
    setOnlyChain(chainId);
    setActiveId(chainId || "overview");
    setViewMode("atlas");
    setMobileTab("atlas");
  }

  function showChainCompanies(chainId) {
    setOnlyChain(chainId);
    setActiveId(chainId);
    setViewMode("list");
    setMobileTab("stocks");
  }

  function showChainGraph(chainId) {
    const nextChainId = chainId || onlyChain || graphData.chains[0]?.id;
    setOnlyChain(nextChainId);
    setActiveId(nextChainId);
    setViewMode("graph");
    setMobileTab("graph");
  }

  function toggleWatchlist(company) {
    if (!company?.stock_code) return;
    const isWatched = watchlistIds.has(company.id);
    if (isWatched) {
      setWatchlistRecords((records) => records.filter((record) => record.company_id !== company.id));
      setNotice(`${company.name} 已移出观察列表。`);
      return;
    }
    setWatchlistRecords((records) => records.some((record) => record.company_id === company.id) ? records : records.concat({
      company_id: company.id,
      stock_code: company.stock_code,
      name: company.name,
      market: getCompanyMarket(company),
      industry: company.industry || "",
      priority: "medium",
      tags: "",
      thesis: "",
      next_review_at: "",
      added_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    setNotice(`${company.name} 已加入观察列表。`);
  }

  function updateWatchlistRecord(companyId, patch) {
    setWatchlistRecords((records) => records.map((record) => (
      record.company_id === companyId
        ? normalizeWatchlistRecord({ ...record, ...patch, updated_at: new Date().toISOString() })
        : record
    )));
  }

  function removeWatchlist(companyId) {
    const record = watchlistRecords.find((item) => item.company_id === companyId);
    setWatchlistRecords((records) => records.filter((item) => item.company_id !== companyId));
    if (record) setNotice(`${record.name} 已移出观察列表。`);
  }

  function exportWatchlist(format) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "csv") {
      downloadText(`ai-chaingraph-watchlist-${stamp}.csv`, "text/csv;charset=utf-8", toWatchlistCsv(watchlistRecords));
      return;
    }
    downloadText(
      `ai-chaingraph-watchlist-${stamp}.json`,
      "application/json;charset=utf-8",
      JSON.stringify({ disclaimer: exportDisclaimer, exported_at: new Date().toISOString(), records: watchlistRecords }, null, 2),
    );
  }

  if (!graphData) {
    return (
      <div className="appShell loadingShell">
        <Database size={26} />
        <strong>正在加载 AI 产业链地图</strong>
        <span>{graphState.error ? `加载失败：${graphState.error.message}` : "尝试 API、本地 snapshot，然后回退演示数据。"}</span>
      </div>
    );
  }

  return (
    <div className="appShell">
      {!ack && <DisclaimerModal onAccept={acknowledgeDisclaimer} />}
      <TopBar
        query={query}
        onQueryChange={setQuery}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          if (mode === "graph") {
            showChainGraph();
            return;
          }
          setViewMode(mode);
          setMobileTab(mode === "atlas" ? "atlas" : "stocks");
        }}
        marketFilter={marketFilter}
        onMarketFilterChange={setMarketFilter}
        marketOptions={marketOptions}
        dataVersion={graphData.meta.data_version}
        onReset={resetWorkspace}
      />

      <main className="workbench">
        <div className={`mobilePane pane-chain ${mobileTab === "chain" ? "isMobileActive" : ""}`}>
          <ChainSidebar
            data={graphData}
            activeId={activeId}
            query={query}
            onlyChain={onlyChain}
            onSelect={selectEntity}
            onScope={focusChain}
          />
        </div>

        <section className={`centerPane mobilePane pane-stocks ${["atlas", "stocks", "graph"].includes(mobileTab) ? "isMobileActive" : ""}`}>
          {viewMode === "atlas" ? (
            <IndustryExplorer
              atlas={industryAtlas}
              focusedChainId={onlyChain}
              dataVersion={graphData.meta.data_version}
              onFocusChain={focusChain}
              onSelectNode={selectEntity}
              onSelectCompany={selectEntity}
              onViewGraph={showChainGraph}
              onViewCompanies={showChainCompanies}
            />
          ) : viewMode === "graph" ? (
            <GraphViewport
              flow={flow}
              pathSummary={pathSummary}
              onSelect={selectEntity}
            />
          ) : (
            <CompanyMapList
              rows={listRows}
              activeId={activeId}
              marketFilter={marketFilter}
              query={query}
              onSelect={selectEntity}
              onViewGraph={() => showChainGraph(onlyChain)}
            />
          )}
        </section>

        <div className={`mobilePane pane-detail ${mobileTab === "detail" ? "isMobileActive" : ""}`}>
          <DetailDrawer
            data={graphData}
            active={active}
            query={query}
            searchResults={searchResults}
            searchCollapsed={searchCollapsed}
            onToggleSearch={() => setSearchCollapsed(!searchCollapsed)}
            onClearSearch={() => setQuery("")}
            onSelect={selectEntity}
            evidenceFilter={evidenceFilter}
            marketFilter={marketFilter}
            watchlistRecords={watchlistRecords}
            watchlistIds={watchlistIds}
            onToggleWatchlist={toggleWatchlist}
            onUpdateWatchlist={updateWatchlistRecord}
            onRemoveWatchlist={removeWatchlist}
            onExportWatchlist={exportWatchlist}
            notice={notice}
          />
        </div>
      </main>

      <nav className="mobileTabs" aria-label="移动端视图">
        <button className={mobileTab === "atlas" ? "isActive" : ""} onClick={() => { setViewMode("atlas"); setMobileTab("atlas"); }}><Map size={16} />产业链</button>
        <button className={mobileTab === "stocks" ? "isActive" : ""} onClick={() => { setViewMode("list"); setMobileTab("stocks"); }}><ListFilter size={16} />股票池</button>
        <button className={mobileTab === "graph" ? "isActive" : ""} onClick={() => showChainGraph()}><GitBranch size={16} />关系</button>
        <button className={mobileTab === "detail" ? "isActive" : ""} onClick={() => { setViewMode("list"); setMobileTab("detail"); }}><PanelRight size={16} />详情</button>
      </nav>
    </div>
  );
}

function DisclaimerModal({ onAccept }) {
  return (
    <div className="modalBackdrop">
      <section className="disclaimerModal">
        <h1>重要声明</h1>
        <p>AI-ChainGraph 是信息组织与产业研究辅助工具，不是投资决策工具。</p>
        <ul>
          <li>本工具不提供、不构成、不暗示任何形式的投资建议、买卖建议或交易策略。</li>
          <li>展示的上市公司、产业环节、关联关系，不代表对投资价值、股价走势或公司经营状况的判断。</li>
          <li>关系依据只说明事实来源类型，不代表公司质量、投资价值或未来表现。</li>
          <li>演示数据只用于本地原型验证。使用真实数据前请自行查证原始来源。</li>
        </ul>
        <button className="primaryButton" onClick={onAccept}>已知晓并同意，进入地图</button>
      </section>
    </div>
  );
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

const rootElement = document.getElementById("root");
const appRoot = rootElement.__aiChainGraphRoot || createRoot(rootElement);
rootElement.__aiChainGraphRoot = appRoot;
appRoot.render(<App />);
