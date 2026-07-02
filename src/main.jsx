import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  AlertTriangle,
  BadgeInfo,
  CheckCircle2,
  ChevronRight,
  Database,
  GitBranch,
  ListFilter,
  LockKeyhole,
  Search,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { loadGraphData } from "./data/loadGraphData";
import "./styles.css";

const evidenceLabels = {
  L1: "强确证",
  L2: "合理推断",
  L3: "公开线索",
};

const typeLabels = {
  overview: "总览",
  chain: "一级链路",
  segment: "二级环节",
  subsegment: "三级节点",
  company: "A 股公司",
};

const edgeTypeLabels = {
  industry_parent: "产业层级",
  company_maps_to_industry_node: "公司映射",
};

const dataTypeLabels = {
  demo: "示例数据",
  local_real: "本地真实",
  mixed: "混合数据",
};

const reviewStatusLabels = {
  pending: "待处理",
  accepted: "已接受",
  needs_review: "待审核",
  rejected: "已拒绝",
  needs_more_source: "需更多来源",
  stale: "已过期",
};

const exportDisclaimer = "导出数据仅供研究参考，重新分发时需附带 AI-ChainGraph 的免责声明。";

function matchesEvidenceFilter(edge, evidenceFilter) {
  return evidenceFilter === "all" || edge.edge_type === "industry_parent" || edge.evidence_level === evidenceFilter;
}

function buildFlow(data, activeId, query, evidenceFilter) {
  const matched = new Set(searchItems(data, query).map((item) => item.id));
  const chainIndex = new Map(data.chains.map((chain, index) => [chain.id, index]));
  const visibleEdges = data.edges.filter((edge) => matchesEvidenceFilter(edge, evidenceFilter));
  const visibleCompanyIds = new Set(
    visibleEdges
      .filter((edge) => edge.edge_type === "company_maps_to_industry_node")
      .map((edge) => edge.to_id),
  );
  const nodes = data.nodes.map((node, index) => {
    const chainOrder = chainIndex.get(node.chain) ?? 0;
    const siblings = data.nodes.filter((item) => item.chain === node.chain && item.level === node.level);
    const siblingIndex = siblings.findIndex((item) => item.id === node.id);
    const x = 80 + chainOrder * 290 + node.level * 24;
    const y = 90 + node.level * 108 + siblingIndex * 96 + (chainOrder % 2) * 24;
    const isActive = node.id === activeId;
    const isMatched = matched.has(node.id);

    return {
      id: node.id,
      type: "default",
      position: { x, y },
      data: {
        label: (
          <div className="flowNodeInner">
            <span>{node.name}</span>
            <small>{typeLabels[node.node_type]} · {node.company_ids.length} 家</small>
          </div>
        ),
      },
      className: [
        "flowNode",
        `chain-${node.chain}`,
        isActive ? "isActive" : "",
        isMatched ? "isMatched" : "",
      ].join(" "),
    };
  });

  const companyNodes = data.companies.filter((company) => visibleCompanyIds.has(company.id)).map((company, index) => {
    const mapping = visibleEdges.find((edge) => edge.to_id === company.id);
    const parent = data.nodes.find((node) => node.id === mapping?.from_id);
    const chainOrder = chainIndex.get(parent?.chain) ?? 0;
    const x = 190 + chainOrder * 290;
    const y = 520 + (index % 4) * 74;
    const isActive = company.id === activeId;
    const isMatched = matched.has(company.id);

    return {
      id: company.id,
      position: { x, y },
      data: {
        label: (
          <div className="flowNodeInner companyNodeInner">
            <span>{company.name}</span>
            <small>{company.stock_code} · 示例</small>
          </div>
        ),
      },
      className: ["flowNode", "companyFlowNode", isActive ? "isActive" : "", isMatched ? "isMatched" : ""].join(" "),
    };
  });

  const edges = visibleEdges.map((edge) => ({
    id: edge.id,
    source: edge.from_id,
    target: edge.to_id,
    animated: edge.from_id === activeId || edge.to_id === activeId,
    label: edge.edge_type === "company_maps_to_industry_node" ? "映射" : "上下游",
    className: [
      "flowEdge",
      edge.from_id === activeId || edge.to_id === activeId ? "isActiveEdge" : "",
      matched.has(edge.from_id) || matched.has(edge.to_id) ? "isMatchedEdge" : "",
    ].join(" "),
  }));

  return { nodes: nodes.concat(companyNodes), edges };
}

function searchItems(data, query) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return [];
  const nodeHits = data.nodes.filter((node) =>
    [node.name, node.description, node.chain, ...node.aliases].join(" ").toLowerCase().includes(keyword),
  );
  const companyHits = data.companies.filter((company) =>
    [company.name, company.stock_code, company.industry, ...company.aliases].join(" ").toLowerCase().includes(keyword),
  );
  const evidenceHits = data.evidences.filter((evidence) =>
    [evidence.title, evidence.excerpt, evidence.source_type].join(" ").toLowerCase().includes(keyword),
  );
  return [...nodeHits, ...companyHits, ...evidenceHits];
}

function getSearchTarget(data, item) {
  if (item.target_type === "edge") {
    const edge = data.edges.find((candidate) => candidate.id === item.target_id);
    return edge?.edge_type === "company_maps_to_industry_node" ? edge.to_id : edge?.from_id || "overview";
  }
  return item.target_id || item.id;
}

function getEntity(data, id) {
  if (!id || id === "overview") return { id: "overview", name: "AI 产业链总览", node_type: "overview" };
  return data.nodes.find((node) => node.id === id) || data.companies.find((company) => company.id === id);
}

function getEvidenceItems(data, edges) {
  return edges.flatMap((edge) =>
    edge.source_ids
      .map((sourceId) => data.evidences.find((evidence) => evidence.id === sourceId))
      .filter(Boolean)
      .map((evidence) => ({ evidence, edge })),
  );
}

function getEvidenceFreshness(evidence, now = new Date()) {
  if (!evidence?.publish_date) return { status: "missing", label: "无来源日期", recencyFactor: 0.1 };
  const publishTime = new Date(`${evidence.publish_date}T00:00:00`).getTime();
  if (Number.isNaN(publishTime)) return { status: "missing", label: "日期无效", recencyFactor: 0.1 };
  const ageDays = Math.max(0, Math.floor((now.getTime() - publishTime) / 86400000));
  const threshold = evidence.stale_threshold_days || 365;
  if (ageDays > threshold) return { status: "stale", label: "来源过期", recencyFactor: 0.1, ageDays };
  if (ageDays > threshold * 0.75) return { status: "expiring", label: "即将过期", recencyFactor: 0.4, ageDays };
  if (ageDays > 365) return { status: "normal", label: "正常", recencyFactor: 0.4, ageDays };
  if (ageDays > 183) return { status: "normal", label: "正常", recencyFactor: 0.7, ageDays };
  return { status: "normal", label: "正常", recencyFactor: 1, ageDays };
}

function getEdgeRecency(data, edge) {
  const states = edge.source_ids
    .map((sourceId) => data.evidences.find((evidence) => evidence.id === sourceId))
    .filter(Boolean)
    .map((evidence) => getEvidenceFreshness(evidence));
  if (states.length === 0) return { status: "missing", label: "缺少证据", recencyFactor: 0.1 };
  if (states.some((state) => state.status === "stale")) return { status: "stale", label: "来源过期", recencyFactor: Math.min(...states.map((state) => state.recencyFactor)) };
  if (states.some((state) => state.status === "expiring")) return { status: "expiring", label: "即将过期", recencyFactor: Math.min(...states.map((state) => state.recencyFactor)) };
  return { status: "normal", label: "正常", recencyFactor: Math.min(...states.map((state) => state.recencyFactor)) };
}

function getAdjustedRelevance(edge, recencyFactor) {
  return Math.max(0, Math.min(1, 0.5 * edge.relevance_score + 0.3 * edge.purity_score + 0.2 * recencyFactor));
}

function getDataStatus(data) {
  const evidences = data.evidences || [];
  const freshness = evidences.map((evidence) => getEvidenceFreshness(evidence));
  const staleCount = freshness.filter((item) => item.status === "stale").length;
  const expiringCount = freshness.filter((item) => item.status === "expiring").length;
  const feedbackPendingCount = (data.review_queue || []).filter((item) => item.status === "pending").length;
  const mappingReviewCount = (data.edges || []).filter(
    (edge) => edge.edge_type === "company_maps_to_industry_node" && edge.review_status === "needs_review",
  ).length;
  const datasetType = data.meta.dataset_type || "demo";
  const tone = staleCount > 0
    ? "danger"
    : expiringCount > 0 || feedbackPendingCount > 0 || mappingReviewCount > 0
      ? "amber"
      : datasetType === "demo" ? "muted" : "ok";
  return {
    datasetType,
    label: dataTypeLabels[datasetType] || datasetType,
    tone,
    staleCount,
    expiringCount,
    feedbackPendingCount,
    mappingReviewCount,
  };
}

function getPathSummary(data, active) {
  if (!active || active.node_type === "overview") {
    return `全局：${data.chains.length} 条链路 · ${data.nodes.length} 节点 · ${data.companies.length} 家示例公司`;
  }
  if (active.stock_code) {
    const mappingEdges = data.edges.filter((edge) => edge.to_id === active.id);
    const nodes = mappingEdges.map((edge) => data.nodes.find((node) => node.id === edge.from_id)?.name).filter(Boolean);
    return `${active.name} · 映射节点：${nodes.join(" / ") || "未绑定"} · 证据：${mappingEdges.map((edge) => edge.evidence_level).join("/") || "无"}`;
  }
  const chain = data.chains.find((item) => item.id === active.id || item.id === active.chain);
  const mappings = getMappingEdgesForNode(data, active, "all");
  const upstream = data.edges.filter((edge) => edge.to_id === active.id && edge.edge_type === "industry_parent").length;
  const downstream = data.edges.filter((edge) => edge.from_id === active.id && edge.edge_type === "industry_parent").length;
  const evidenceCounts = mappings.reduce((acc, edge) => {
    acc[edge.evidence_level] = (acc[edge.evidence_level] || 0) + 1;
    return acc;
  }, {});
  return `${chain?.name || "产业链"} > ${active.name} · 上游 ${upstream} · 下游 ${downstream} · 公司映射 ${mappings.length} · L1/L2/L3 ${evidenceCounts.L1 || 0}/${evidenceCounts.L2 || 0}/${evidenceCounts.L3 || 0}`;
}

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
  const headers = ["id", "target_type", "target_id", "issue_type", "status", "created_by", "created_at", "resolution_note"];
  const rows = records.map((record) => headers.map((header) => JSON.stringify(record[header] ?? record.payload?.[header] ?? "")).join(","));
  return [`# ${exportDisclaimer}`, headers.join(","), ...rows].join("\n");
}

function getMappingEdgesForNode(data, active, evidenceFilter) {
  if (!active || active.node_type === "overview") return [];
  const mappingEdges = data.edges.filter((edge) =>
    edge.edge_type === "company_maps_to_industry_node" && matchesEvidenceFilter(edge, evidenceFilter),
  );
  if (active.node_type === "chain") {
    return mappingEdges.filter((edge) => data.nodes.find((node) => node.id === edge.from_id)?.chain === active.id);
  }
  const directEdges = mappingEdges.filter((edge) => edge.from_id === active.id);
  if (directEdges.length > 0) return directEdges;
  return mappingEdges.filter((edge) => active.company_ids?.includes(edge.to_id));
}

function buildListRows(data, evidenceFilter, onlyChain, query) {
  const keyword = query.trim().toLowerCase();
  return data.edges
    .filter((edge) => edge.edge_type === "company_maps_to_industry_node" && matchesEvidenceFilter(edge, evidenceFilter))
    .map((edge) => {
      const node = data.nodes.find((item) => item.id === edge.from_id);
      const company = data.companies.find((item) => item.id === edge.to_id);
      const chain = data.chains.find((item) => item.id === node?.chain);
      const evidence = edge.source_ids
        .map((sourceId) => data.evidences.find((item) => item.id === sourceId))
        .filter(Boolean);
      const recency = getEdgeRecency(data, edge);
      return { edge, node, company, chain, evidence, recency };
    })
    .filter((row) => !onlyChain || row.node?.chain === onlyChain)
    .filter((row) => {
      if (!keyword) return true;
      return [
        row.node?.name,
        row.company?.name,
        row.company?.stock_code,
        row.company?.industry,
        row.chain?.name,
        ...row.evidence.map((item) => `${item.title} ${item.excerpt}`),
      ].join(" ").toLowerCase().includes(keyword);
    });
}

function App() {
  const [graphState, setGraphState] = useState({ data: null, error: null });
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState("overview");
  const [viewMode, setViewMode] = useState("graph");
  const [onlyChain, setOnlyChain] = useState(null);
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const [ack, setAck] = useState(() => localStorage.getItem("ai-chaingraph-disclaimer") === "ack");
  const [feedback, setFeedback] = useState({ issue_type: "stale", url: "", note: "" });
  const [reviewRecords, setReviewRecords] = useState(readStoredReviewQueue);
  const [notice, setNotice] = useState("");
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

  const scopedData = useMemo(() => {
    if (!graphData) return null;
    if (!onlyChain) return graphData;
    const nodeIds = new Set(graphData.nodes.filter((node) => node.chain === onlyChain).map((node) => node.id));
    const edges = graphData.edges.filter((edge) => nodeIds.has(edge.from_id) || nodeIds.has(edge.to_id));
    const companyIds = new Set(edges.map((edge) => edge.to_id).filter((id) => id.startsWith("company:")));
    return {
      ...graphData,
      nodes: graphData.nodes.filter((node) => nodeIds.has(node.id)),
      edges,
      companies: graphData.companies.filter((company) => companyIds.has(company.id)),
    };
  }, [graphData, onlyChain]);

  const flow = useMemo(() => scopedData ? buildFlow(scopedData, activeId, query, evidenceFilter) : { nodes: [], edges: [] }, [scopedData, activeId, query, evidenceFilter]);
  const listRows = useMemo(() => graphData ? buildListRows(graphData, evidenceFilter, onlyChain, query) : [], [graphData, evidenceFilter, onlyChain, query]);
  const searchResults = useMemo(() => graphData ? searchItems(graphData, query) : [], [graphData, query]);
  const active = graphData ? getEntity(graphData, activeId) : null;
  const dataStatus = graphData ? getDataStatus(graphData) : null;
  const pathSummary = graphData && active ? getPathSummary(graphData, active) : "数据加载中";

  React.useEffect(() => {
    setNotice("");
  }, [activeId]);

  React.useEffect(() => {
    setSearchCollapsed(false);
  }, [query]);

  function acknowledgeDisclaimer() {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    setAck(true);
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
        <Database size={24} />
        <strong>正在加载 AI-ChainGraph 数据</strong>
        <span>{graphState.error ? `加载失败：${graphState.error.message}` : "尝试 API、本地 snapshot，然后回退示例数据。"}</span>
      </div>
    );
  }

  return (
    <div className="appShell">
      {!ack && <DisclaimerModal onAccept={acknowledgeDisclaimer} />}
      <header className="topbar">
        <button className="brandButton" onClick={() => { setActiveId("overview"); setOnlyChain(null); }}>
          <GitBranch size={18} />
          <span>AI-ChainGraph</span>
          <small>链图 AI · v0.2 local loop</small>
        </button>
        <label className="searchBox">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索产业节点、公司名、股票代码或证据来源"
          />
          {query && <button aria-label="清除搜索" onClick={() => setQuery("")}><X size={16} /></button>}
        </label>
        <div className="toolbarGroup" aria-label="视图与数据状态">
          <button
            className={`segmented ${viewMode === "graph" ? "isActive" : ""}`}
            onClick={() => setViewMode("graph")}
          >
            <GitBranch size={15} />关系图
          </button>
          <button
            className={`segmented ${viewMode === "list" ? "isActive" : ""}`}
            onClick={() => setViewMode("list")}
          >
            <ListFilter size={15} />列表
          </button>
          <button className="intelButton" disabled><LockKeyhole size={15} />实验性接口</button>
          <span
            className={`dataPill status-${dataStatus.tone}`}
            title={`来源：${graphData.meta.source}；过期 ${dataStatus.staleCount}；即将过期 ${dataStatus.expiringCount}；映射待审核 ${dataStatus.mappingReviewCount}；本地反馈待处理 ${dataStatus.feedbackPendingCount}`}
          >
            <Database size={14} />{graphData.meta.data_version} · {dataStatus.label}
          </span>
        </div>
      </header>

      <main className="workbench">
        <aside className="leftPanel">
          <section className="panelHeader">
            <h2>产业链树</h2>
            <p>四条 AI 基础设施链路，按环节逐层浏览。</p>
          </section>
          <button className={`treeItem root ${activeId === "overview" ? "selected" : ""}`} onClick={() => { setActiveId("overview"); setOnlyChain(null); }}>
            <span>AI 产业链总览</span>
            <small>{graphData.nodes.length} 节点</small>
          </button>
          <div className="treeList">
            {graphData.chains.map((chain) => (
              <ChainTree
                key={chain.id}
                chain={chain}
                data={graphData}
                activeId={activeId}
                query={query}
                onSelect={(id) => setActiveId(id)}
                onScope={() => setOnlyChain(onlyChain === chain.id ? null : chain.id)}
                scoped={onlyChain === chain.id}
              />
            ))}
          </div>
          <section className="filterBlock">
            <h3>证据筛选</h3>
            <div className="filterButtons">
              {["all", "L1", "L2", "L3"].map((level) => (
                <button
                  key={level}
                  className={evidenceFilter === level ? "selected" : ""}
                  onClick={() => setEvidenceFilter(level)}
                >
                  {level === "all" ? "全部" : evidenceLabels[level]}
                </button>
              ))}
            </div>
            <p>按证据等级过滤图谱中的公司映射、右侧公司卡片和证据摘要；产业层级边始终保留。</p>
          </section>
        </aside>

        {viewMode === "graph" ? (
          <section className="graphPanel">
            <div className="pathExplain">{pathSummary}</div>
            <div className="graphNotice">
              <ShieldAlert size={16} />
              产业链结构与公司映射仅用于研究组织；证据等级不代表投资评级。行情快照可能延迟、遗漏或有误。
            </div>
            <div className="graphCanvas">
              <ReactFlow
                nodes={flow.nodes}
                edges={flow.edges}
                onNodeClick={(_, node) => setActiveId(node.id)}
                nodesDraggable={false}
                fitView
                minZoom={0.35}
                maxZoom={1.5}
              >
                <Background color="#2a2f38" gap={22} size={1} />
                <Controls position="bottom-left" />
                <MiniMap pannable zoomable nodeStrokeWidth={3} />
              </ReactFlow>
            </div>
          </section>
        ) : (
          <ListPanel
            rows={listRows}
            activeId={activeId}
            evidenceFilter={evidenceFilter}
            onlyChain={onlyChain}
            query={query}
            onSelect={setActiveId}
          />
        )}

        <aside className="rightPanel">
          {query && (
            <SearchPanel
              data={graphData}
              results={searchResults}
              query={query}
              collapsed={searchCollapsed}
              onToggle={() => setSearchCollapsed(!searchCollapsed)}
              onClear={() => setQuery("")}
              onSelect={(id) => {
                setActiveId(id);
                setSearchCollapsed(true);
              }}
            />
          )}
          <DataStatusPanel data={graphData} status={dataStatus} />
          <DetailPanel data={graphData} active={active} notice={notice} evidenceFilter={evidenceFilter} />
          <section className="feedbackPanel">
            <h3>人工校正入口</h3>
            <label>
              反馈类型
              <select value={feedback.issue_type} onChange={(event) => setFeedback({ ...feedback, issue_type: event.target.value })}>
                <option value="stale">证据过期</option>
                <option value="incorrect">证据有误</option>
                <option value="wrong_mapping">关联关系有误</option>
                <option value="wrong_category">分类不当</option>
                <option value="concept_pollution">存在概念污染</option>
                <option value="add_evidence">补充证据</option>
              </select>
            </label>
            <label>
              来源 URL
              <input value={feedback.url} onChange={(event) => setFeedback({ ...feedback, url: event.target.value })} placeholder="可选，本地记录" />
            </label>
            <label>
              说明
              <textarea value={feedback.note} onChange={(event) => setFeedback({ ...feedback, note: event.target.value })} placeholder="记录校正理由或补充线索" />
            </label>
            <button className="primaryButton" onClick={saveFeedback}><Send size={15} />保存到待审核</button>
          </section>
          <ReviewQueuePanel records={reviewRecords} onResolve={resolveReview} onExport={exportFeedback} />
        </aside>
      </main>
    </div>
  );
}

function ListPanel({ rows, activeId, evidenceFilter, onlyChain, query, onSelect }) {
  return (
    <section className="listPanel">
      <div className="listHeader">
        <PanelTitle icon={<ListFilter size={18} />} title="公司映射列表" label={`${rows.length} 条映射`} />
        <p className="localRisk">
          当前列表沿用左侧链路、证据等级和搜索筛选；点击公司或产业节点会同步右侧详情。
        </p>
      </div>
      <div className="listMetaBar">
        <span>证据：{evidenceFilter === "all" ? "全部" : evidenceLabels[evidenceFilter]}</span>
        <span>链路：{onlyChain || "全部"}</span>
        <span>搜索：{query || "未筛选"}</span>
      </div>
      <div className="listTable" role="table" aria-label="公司映射列表">
        <div className="listRow listHead" role="row">
          <span>公司</span>
          <span>产业节点</span>
          <span>证据</span>
          <span>质量</span>
          <span>状态</span>
        </div>
        {rows.length === 0 ? (
          <p className="listEmpty">当前筛选下暂无公司映射。</p>
        ) : rows.map(({ edge, node, company, chain, evidence, recency }) => {
          const adjustedRelevance = getAdjustedRelevance(edge, recency.recencyFactor);
          const active = activeId === company?.id || activeId === node?.id;
          return (
            <div className={`listRow ${active ? "isActive" : ""}`} role="row" key={edge.id}>
              <button onClick={() => onSelect(company?.id)}>
                <strong>{company?.name}</strong>
                <small>{company?.stock_code} · {company?.industry}</small>
              </button>
              <button onClick={() => onSelect(node?.id)}>
                <strong>{node?.name}</strong>
                <small>{chain?.name}</small>
              </button>
              <span className={`levelPill level-${edge.evidence_level}`}>{edge.evidence_level}</span>
              <span className="listQuality">
                时效 {Math.round(adjustedRelevance * 100)}%
                <small>纯度 {Math.round(edge.purity_score * 100)}% · {evidence.length} 来源</small>
              </span>
              <span className="listQuality">
                {reviewStatusLabels[edge.review_status] || edge.review_status}
                <small>{recency.label}</small>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChainTree({ chain, data, activeId, query, onSelect, onScope, scoped }) {
  const nodes = data.nodes.filter((node) => node.chain === chain.id);
  const direct = nodes.filter((node) => node.level === 2);
  const matched = new Set(searchItems(data, query).map((item) => item.id));

  return (
    <section className="treeGroup">
      <div className="treeGroupHead">
        <button className={scoped ? "selected" : ""} onClick={onScope}>{scoped ? "显示全部" : "只看链路"}</button>
        <span>{chain.company_count} 家</span>
      </div>
      <button className={`treeItem chain ${activeId === chain.id ? "selected" : ""}`} onClick={() => onSelect(chain.id)}>
        <ChevronRight size={15} />
        <span>{chain.name}</span>
        {matched.has(chain.id) && <b>命中</b>}
      </button>
      {direct.map((node) => (
        <div key={node.id} className="treeBranch">
          <button className={`treeItem ${activeId === node.id ? "selected" : ""}`} onClick={() => onSelect(node.id)}>
            <span>{node.name}</span>
            <small>{node.company_ids.length} 家</small>
            {matched.has(node.id) && <b>命中</b>}
          </button>
          {nodes.filter((child) => child.parent_id === node.id).map((child) => (
            <button key={child.id} className={`treeItem child ${activeId === child.id ? "selected" : ""}`} onClick={() => onSelect(child.id)}>
              <span>{child.name}</span>
              <small>{child.company_ids.length} 家</small>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}

function DetailPanel({ data, active, notice, evidenceFilter }) {
  if (active?.node_type === "overview") {
    const evidenceCounts = data.edges.reduce((acc, edge) => {
      acc[edge.evidence_level] = (acc[edge.evidence_level] || 0) + 1;
      return acc;
    }, {});
    return (
      <section className="detailStack">
        <PanelTitle icon={<BadgeInfo size={18} />} title="AI 产业链总览" label="本地示例数据" />
        <p className="muted">打开即可浏览四条基础设施链路，也可通过搜索定位节点、公司代码和证据摘要。</p>
        <div className="metricGrid">
          <Metric value={data.chains.length} label="覆盖链路" />
          <Metric value={data.nodes.length} label="产业节点" />
          <Metric value={data.companies.length} label="示例公司" />
          <Metric value={`${evidenceCounts.L1 || 0}/${evidenceCounts.L2 || 0}/${evidenceCounts.L3 || 0}`} label="L1/L2/L3" />
        </div>
        <RiskNote />
      </section>
    );
  }

  if (active?.stock_code) {
    const mappings = data.edges.filter((edge) => edge.to_id === active.id && matchesEvidenceFilter(edge, evidenceFilter));
    const quote = data.quote_snapshots.find((item) => item.stock_code === active.stock_code);
    const evidenceItems = getEvidenceItems(data, mappings);
    return (
      <section className="detailStack">
        <PanelTitle icon={<CheckCircle2 size={18} />} title={active.name} label={active.stock_code} />
        <div className="quoteBox">
          <span>行业：{quote?.industry || "未填充"}</span>
          <span>市值：{quote?.market_cap ? `${quote.market_cap} 亿元` : "占位"}</span>
          <span>最新价：{quote?.latest_price ?? "占位"}</span>
          <span>PE/PB：{quote?.pe ?? "占位"} / {quote?.pb ?? "占位"}</span>
        </div>
        <p className="localRisk">行情数据为来源快照，可能延迟、遗漏或有误，不用于实时交易决策。更新时间：{quote?.quote_time}</p>
        <EvidenceList items={evidenceItems} />
        <RiskNote />
        {notice && <p className="noticeText">{notice}</p>}
      </section>
    );
  }

  const chain = data.chains.find((item) => item.id === active?.id || item.id === active?.chain);
  const mappingEdges = getMappingEdgesForNode(data, active, evidenceFilter);
  const edges = data.edges.filter((edge) => edge.from_id === active.id || edge.to_id === active.id);
  const filteredEdges = edges.filter((edge) => matchesEvidenceFilter(edge, evidenceFilter));
  const evidenceItems = getEvidenceItems(data, filteredEdges.concat(mappingEdges));
  const l3Mappings = mappingEdges.filter((edge) => edge.evidence_level === "L3");

  return (
    <section className="detailStack">
      <PanelTitle icon={<GitBranch size={18} />} title={active.name} label={typeLabels[active.node_type]} />
      <p className="muted">{active.description || chain?.description}</p>
      <div className="pathBox">{chain?.name} / {active.name}</div>
      {mappingEdges.length > 0 && l3Mappings.length === mappingEdges.length && (
        <p className="reviewWarning">当前筛选下公司映射全部为 L3 公开线索，默认进入待审核。</p>
      )}
      <CompanyList data={data} mappings={mappingEdges} />
      <EvidenceList items={evidenceItems} />
      <RiskNote />
      {notice && <p className="noticeText">{notice}</p>}
    </section>
  );
}

function SearchPanel({ data, results, query, collapsed, onToggle, onClear, onSelect }) {
  return (
    <section className="detailStack searchContext">
      <div className="searchContextHead">
        <PanelTitle icon={<Search size={18} />} title={`搜索：${query}`} label={`${results.length} 条命中`} />
        <div className="contextActions">
          <button onClick={onToggle}>{collapsed ? "展开" : "折叠"}</button>
          <button onClick={onClear}>清除</button>
        </div>
      </div>
      {!collapsed && (
        <>
          <p className="localRisk">搜索结果基于类目匹配和文本相似度，不反映投资价值排序。点击结果会在下方保留对应详情。</p>
          <div className="resultList">
            {results.length === 0 && <p className="muted">未命中示例数据，可尝试“光模块”“液冷”“300801”。</p>}
            {results.map((item) => (
              <button key={item.id} onClick={() => onSelect(getSearchTarget(data, item))}>
                <span>{item.title || item.name}</span>
                <small>{item.stock_code || item.source_type || typeLabels[item.node_type]}</small>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function PanelTitle({ icon, title, label }) {
  return (
    <div className="panelTitle">
      <span className="titleIcon">{icon}</span>
      <div>
        <h2>{title}</h2>
        <small>{label}</small>
      </div>
    </div>
  );
}

function Metric({ value, label }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>;
}

function DataStatusPanel({ data, status }) {
  return (
    <section className="detailStack dataStatusPanel">
      <PanelTitle icon={<Database size={18} />} title="数据状态" label={status.label} />
      <div className="statusGrid">
        <Metric value={status.staleCount} label="过期证据" />
        <Metric value={status.expiringCount} label="即将过期" />
        <Metric value={status.mappingReviewCount} label="映射待审核" />
        <Metric value={status.feedbackPendingCount} label="本地反馈待处理" />
        <Metric value={data.meta.source_policy || "public_demo_only"} label="数据边界" />
      </div>
      <p className="localRisk">当前数据集：{data.meta.name}。真实数据默认应保留在本地 `data/` 或私有路径，公开 `src/data/demoGraph.json` 只放虚构示例。</p>
    </section>
  );
}

function CompanyList({ data, mappings }) {
  return (
    <section className="infoBlock">
      <h3>公司映射</h3>
      <p className="localRisk">此列表用于组织研究对象。证据等级描述信息来源可靠性，不描述投资确定性。</p>
      {mappings.length === 0 ? <p className="muted">当前证据筛选下暂无公司映射。</p> : mappings.map((edge) => {
        const company = data.companies.find((item) => item.id === edge.to_id);
        const recency = getEdgeRecency(data, edge);
        const adjustedRelevance = getAdjustedRelevance(edge, recency.recencyFactor);
        return (
        <div key={edge.id} className="companyCard">
          <div className="companyCardHead">
            <strong>{company?.name}</strong>
            <span className={`levelPill level-${edge.evidence_level}`}>{edge.evidence_level}</span>
          </div>
          <span>{company?.stock_code} · {company?.industry}</span>
          <div className="mappingMeta">
            <span>{edgeTypeLabels[edge.edge_type]}</span>
            <span>时效调整 {Math.round(adjustedRelevance * 100)}%</span>
            <span>纯度 {Math.round(edge.purity_score * 100)}%</span>
            <b className={`freshness-${recency.status}`}>{recency.label}</b>
            {edge.review_status !== "accepted" && <b>待审核</b>}
          </div>
        </div>
        );
      })}
    </section>
  );
}

function EvidenceList({ items }) {
  return (
    <section className="infoBlock">
      <h3>证据摘要</h3>
      {items.length === 0 ? <p className="muted">当前证据筛选下暂无已绑定证据。</p> : items.map(({ evidence, edge }) => (
        <EvidenceCard key={`${edge.id}:${evidence.id}`} evidence={evidence} edge={edge} />
      ))}
    </section>
  );
}

function EvidenceCard({ evidence, edge }) {
  const freshness = getEvidenceFreshness(evidence);
  const adjustedRelevance = getAdjustedRelevance(edge, freshness.recencyFactor);
  return (
        <article className={`evidenceCard level-${evidence.level} freshness-${freshness.status}`}>
          <div><span>{evidence.level}</span><strong>{evidence.title}</strong></div>
          <p>{evidence.excerpt}</p>
          <div className="evidenceMeta">
            <span>{edgeTypeLabels[edge.edge_type]}</span>
            <span>时效调整 {Math.round(adjustedRelevance * 100)}%</span>
            <span>纯度 {Math.round(edge.purity_score * 100)}%</span>
            <b className={`freshness-${freshness.status}`}>{freshness.label}</b>
            {edge.review_status !== "accepted" && <b>待审核</b>}
          </div>
          <small>{evidence.source_type} · {evidence.publish_date} · {evidence.reviewer}</small>
        </article>
  );
}

function ReviewQueuePanel({ records, onResolve, onExport }) {
  return (
    <section className="feedbackPanel reviewQueuePanel">
      <div className="queueHead">
        <h3>本地审核队列</h3>
        <span>{records.filter((record) => record.status === "pending").length} 待处理</span>
      </div>
      <p className="localRisk">{exportDisclaimer}</p>
      <div className="exportActions">
        <button onClick={() => onExport("json")}>导出 JSON</button>
        <button onClick={() => onExport("csv")}>导出 CSV</button>
      </div>
      {records.length === 0 ? <p className="muted">暂无本地反馈。提交校正后会写入浏览器 localStorage。</p> : records.slice().reverse().map((record) => (
        <article className="reviewCard" key={record.id}>
          <strong>{record.issue_type} · {record.target_id}</strong>
          <small>{reviewStatusLabels[record.status] || record.status} · {record.created_at}</small>
          {record.payload?.note && <p>{record.payload.note}</p>}
          <div className="reviewActions">
            <button onClick={() => onResolve(record.id, "accepted")}>接受</button>
            <button onClick={() => onResolve(record.id, "rejected")}>拒绝</button>
            <button onClick={() => onResolve(record.id, "needs_more_source")}>需更多来源</button>
          </div>
        </article>
      ))}
    </section>
  );
}

function RiskNote() {
  return (
    <div className="riskNote">
      <AlertTriangle size={16} />
      本工具仅做信息组织与产业研究辅助，不提供、不构成、不暗示任何形式的投资建议、买卖建议或交易策略。
    </div>
  );
}

function DisclaimerModal({ onAccept }) {
  return (
    <div className="modalBackdrop">
      <section className="disclaimerModal">
        <h1>重要声明</h1>
        <p>AI-ChainGraph（链图 AI）是一个本地优先的信息组织与产业研究辅助工具，不是投资决策工具。</p>
        <ul>
          <li>本工具不提供、不构成、不暗示任何形式的投资建议、买卖建议或交易策略。</li>
          <li>展示的上市公司、产业环节、关联关系，不代表对投资价值、股价走势或公司经营状况的判断。</li>
          <li>证据等级仅描述信息来源本身的可靠性，不代表未来表现。</li>
          <li>示例数据为虚构数据，只用于本地原型验证。使用真实数据前请自行查证原始来源。</li>
        </ul>
        <button className="primaryButton" onClick={onAccept}>已知晓并同意，进入工具</button>
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
