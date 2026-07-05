import { ArrowUpRight, ListFilter } from "lucide-react";
import {
  evidenceLabels,
  getAdjustedRelevance,
  getCompanyMarket,
  getMarketLabel,
  reviewStatusLabels,
} from "../lib/graphViewModel";
import { CoverageMatrix } from "./CoverageMatrix";

export function CompanyMapList({
  rows,
  coverageMatrix,
  activeId,
  evidenceFilter,
  marketFilter,
  onlyChain,
  query,
  onSelect,
  onScope,
  onViewGraph,
}) {
  return (
    <section className="companyMapList">
      <div className="workspaceHero">
        <div>
          <span className="eyebrow">股票池</span>
          <h1>AI 上下游公司映射</h1>
          <p>按产业链位置、证据等级和时效整理公司，先看逻辑，再看证据。</p>
        </div>
        <button className="secondaryAction" onClick={onViewGraph}>
          <ArrowUpRight size={16} />查看关系图
        </button>
      </div>

      <div className="quickStats">
        <Metric value={rows.length} label="当前映射" />
        <Metric value={getMarketLabel(marketFilter)} label="市场" />
        <Metric value={evidenceFilter === "all" ? "全部" : evidenceLabels[evidenceFilter]} label="证据" />
        <Metric value={onlyChain || "全部链路"} label="范围" />
      </div>

      <CoverageMatrix matrix={coverageMatrix} activeChain={onlyChain} onScope={onScope} />

      <div className="listContext">
        <ListFilter size={16} />
        <span>{query ? `搜索：${query}` : "默认按时效调整相关性排序"}</span>
      </div>

      <div className="mapTable" role="table" aria-label="公司映射列表">
        <div className="mapRow mapHead" role="row">
          <span>公司</span>
          <span>产业链位置</span>
          <span>证据</span>
          <span>为什么相关</span>
          <span>状态</span>
        </div>
        {rows.length === 0 ? (
          <div className="emptyState">
            <strong>当前筛选下暂无公司映射</strong>
            <span>可以清空搜索词，或放宽证据等级筛选。</span>
          </div>
        ) : rows.map(({ edge, node, company, chain, evidence, recency }) => {
          const adjustedRelevance = getAdjustedRelevance(edge, recency.recencyFactor);
          const active = activeId === company?.id || activeId === node?.id;
          const firstEvidence = evidence[0];
          return (
            <article className={`mapRow ${active ? "isActive" : ""}`} role="row" key={edge.id}>
              <button className="companyCell" onClick={() => onSelect(company.id)}>
                <strong>{company.name}</strong>
                <small>{company.stock_code} · {getMarketLabel(getCompanyMarket(company))} · {company.industry || "行业待补"}</small>
              </button>
              <button className="nodeCell" onClick={() => onSelect(node.id)}>
                <strong>{node.name}</strong>
                <small>{chain?.name || "产业链"} / {node.node_type === "subsegment" ? "细分节点" : "环节"}</small>
              </button>
              <span className={`levelPill level-${edge.evidence_level}`}>{edge.evidence_level}</span>
              <button className="reasonCell" onClick={() => onSelect(company.id)}>
                <strong>{Math.round(adjustedRelevance * 100)}% 相关</strong>
                <small>{firstEvidence?.excerpt || "等待补充证据摘要"}</small>
              </button>
              <span className="statusCell">
                {reviewStatusLabels[edge.review_status] || edge.review_status}
                <small>{recency.label} · 纯度 {Math.round(edge.purity_score * 100)}%</small>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ value, label }) {
  return (
    <div className="metricTile">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
