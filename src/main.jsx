import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Database, GitBranch, ListFilter, Map, ShieldAlert } from "lucide-react";
import { loadGraphData } from "./data/loadGraphData";
import { TopBar } from "./components/TopBar";
import { ChainSidebar } from "./components/ChainSidebar";
import { CompanyMapList } from "./components/CompanyMapList";
import { GraphViewport } from "./components/GraphViewport";
import { DetailDrawer } from "./components/DetailDrawer";
import {
  buildFlow,
  buildListRows,
  buildScopedData,
  exportDisclaimer,
  getDataStatus,
  getEntity,
  getMarketOptions,
  getPathSummary,
  reviewStatusLabels,
  searchItems,
} from "./lib/graphViewModel";
import "./styles.css";

function readStoredReviewQueue() {
  try {
    return JSON.parse(localStorage.getItem("ai-chaingraph-review-queue") || "[]");
  } catch {
    return [];
  }
}

function writeStoredReviewQueue(records) {
  localStorage.setItem("ai-chaingraph-review-queue", JSON.stringify(records, null, 2));
}

function downloadText(filename, mimeType, content) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(records) {
  const headers = ["id", "target_type", "target_id", "issue_type", "status", "created_by", "created_at", "url", "note", "resolution_note"];
  const rows = records.map((record) => headers.map((header) => JSON.stringify(record[header] ?? record.payload?.[header] ?? "")).join(","));
  return [`# ${exportDisclaimer}`, headers.join(","), ...rows].join("\n");
}

function App() {
  const [graphState, setGraphState] = useState({ data: null, error: null });
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState("overview");
  const [viewMode, setViewMode] = useState("list");
  const [mobileTab, setMobileTab] = useState("stocks");
  const [onlyChain, setOnlyChain] = useState(null);
  const [marketFilter, setMarketFilter] = useState("all");
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const [ack, setAck] = useState(() => localStorage.getItem("ai-chaingraph-disclaimer") === "ack");
  const [feedback, setFeedback] = useState({ issue_type: "stale", url: "", note: "" });
  const [reviewRecords, setReviewRecords] = useState(readStoredReviewQueue);
  const [notice, setNotice] = useState("");
  const showDesktopMiniGraph = useMediaQuery("(min-width: 1101px)");
  const isMobileLayout = useMediaQuery("(max-width: 760px)");
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
    writeStoredReviewQueue(reviewRecords);
  }, [reviewRecords]);

  useEffect(() => {
    setNotice("");
  }, [activeId]);

  useEffect(() => {
    setSearchCollapsed(false);
  }, [query]);

  const scopedData = useMemo(() => graphData ? buildScopedData(graphData, onlyChain, marketFilter) : null, [graphData, onlyChain, marketFilter]);
  const flow = useMemo(() => scopedData ? buildFlow(scopedData, activeId, query, evidenceFilter) : { nodes: [], edges: [] }, [scopedData, activeId, query, evidenceFilter]);
  const listRows = useMemo(() => graphData ? buildListRows(graphData, evidenceFilter, onlyChain, query, marketFilter) : [], [graphData, evidenceFilter, onlyChain, query, marketFilter]);
  const searchResults = useMemo(() => graphData ? searchItems(graphData, query) : [], [graphData, query]);
  const active = graphData ? getEntity(graphData, activeId) : null;
  const dataStatus = graphData ? getDataStatus(graphData, reviewRecords) : null;
  const pathSummary = graphData && active ? getPathSummary(scopedData || graphData, active, marketFilter) : "数据加载中";
  const marketOptions = useMemo(() => graphData ? getMarketOptions(graphData) : ["all"], [graphData]);

  function acknowledgeDisclaimer() {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    setAck(true);
  }

  function resetWorkspace() {
    setActiveId("overview");
    setOnlyChain(null);
    setQuery("");
    setMarketFilter("all");
    setEvidenceFilter("all");
    setViewMode("list");
    setMobileTab("stocks");
  }

  function selectEntity(id) {
    setActiveId(id);
    if (isMobileLayout) setViewMode("list");
    setMobileTab("detail");
  }

  function saveFeedback() {
    if (!active) return;
    if (feedback.issue_type === "add_evidence" && !feedback.url.trim()) {
      setNotice("补充证据需要至少填写来源 URL。");
      return;
    }
    const nextRecord = {
      id: `review:${Date.now()}`,
      target_type: active?.stock_code ? "company" : "node",
      target_id: active?.id,
      issue_type: feedback.issue_type,
      payload: {
        url: feedback.url,
        note: feedback.note,
      },
      status: "pending",
      created_by: "human:local",
      created_at: new Date().toISOString(),
      operations: [],
    };
    setReviewRecords((records) => records.concat(nextRecord));
    setFeedback({ issue_type: "stale", url: "", note: "" });
    setNotice("反馈已写入本地待审核队列。");
  }

  function resolveReview(id, status) {
    setReviewRecords((records) => records.map((record) => record.id === id ? {
      ...record,
      status,
      resolved_at: new Date().toISOString(),
      resolution_note: reviewStatusLabels[status],
      operations: (record.operations || []).concat({
        action: status,
        actor: "human:local",
        at: new Date().toISOString(),
        reason: reviewStatusLabels[status],
        target_id: record.target_id,
      }),
    } : record));
  }

  function exportFeedback(format) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "csv") {
      downloadText(`ai-chaingraph-feedback-${stamp}.csv`, "text/csv;charset=utf-8", toCsv(reviewRecords));
      return;
    }
    downloadText(
      `ai-chaingraph-feedback-${stamp}.json`,
      "application/json;charset=utf-8",
      JSON.stringify({ disclaimer: exportDisclaimer, exported_at: new Date().toISOString(), records: reviewRecords }, null, 2),
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
          setViewMode(mode);
          setMobileTab(mode === "graph" ? "graph" : "stocks");
        }}
        marketFilter={marketFilter}
        onMarketFilterChange={setMarketFilter}
        marketOptions={marketOptions}
        dataStatus={dataStatus}
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
            onScope={setOnlyChain}
            evidenceFilter={evidenceFilter}
            onEvidenceFilterChange={setEvidenceFilter}
          />
        </div>

        <section className={`centerPane mobilePane pane-stocks ${mobileTab === "stocks" || mobileTab === "graph" ? "isMobileActive" : ""}`}>
          {viewMode === "graph" ? (
            <GraphViewport
              flow={flow}
              activeId={activeId}
              pathSummary={pathSummary}
              onSelect={selectEntity}
            />
          ) : (
            <CompanyMapList
              rows={listRows}
              activeId={activeId}
              evidenceFilter={evidenceFilter}
              marketFilter={marketFilter}
              onlyChain={onlyChain}
              query={query}
              onSelect={selectEntity}
              onViewGraph={() => {
                setViewMode("graph");
                setMobileTab("graph");
              }}
            />
          )}
        </section>

        <div className={`mobilePane pane-detail ${mobileTab === "detail" ? "isMobileActive" : ""}`}>
          <DetailDrawer
            data={graphData}
            active={active}
            flow={flow}
            showMiniGraph={showDesktopMiniGraph}
            query={query}
            searchResults={searchResults}
            searchCollapsed={searchCollapsed}
            onToggleSearch={() => setSearchCollapsed(!searchCollapsed)}
            onClearSearch={() => setQuery("")}
            onSelect={selectEntity}
            evidenceFilter={evidenceFilter}
            marketFilter={marketFilter}
            dataStatus={dataStatus}
            feedback={feedback}
            onFeedbackChange={setFeedback}
            onSaveFeedback={saveFeedback}
            reviewRecords={reviewRecords}
            onResolveReview={resolveReview}
            onExportFeedback={exportFeedback}
            notice={notice}
          />
        </div>
      </main>

      <nav className="mobileTabs" aria-label="移动端视图">
        <button className={mobileTab === "chain" ? "isActive" : ""} onClick={() => { setViewMode("list"); setMobileTab("chain"); }}><GitBranch size={16} />产业链</button>
        <button className={mobileTab === "stocks" ? "isActive" : ""} onClick={() => { setViewMode("list"); setMobileTab("stocks"); }}><ListFilter size={16} />股票池</button>
        <button className={mobileTab === "graph" ? "isActive" : ""} onClick={() => { setViewMode("graph"); setMobileTab("graph"); }}><Map size={16} />图谱</button>
        <button className={mobileTab === "detail" ? "isActive" : ""} onClick={() => { setViewMode("list"); setMobileTab("detail"); }}><ShieldAlert size={16} />详情</button>
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
          <li>证据等级仅描述信息来源可靠性，不代表未来表现。</li>
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
