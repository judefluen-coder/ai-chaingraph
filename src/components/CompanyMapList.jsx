import { ArrowUpRight, ListFilter } from "lucide-react";
import {
  getCompanyMarket,
  getMarketLabel,
  getRelationPresentation,
} from "../lib/graphViewModel";

export function CompanyMapList({
  rows,
  activeId,
  marketFilter,
  query,
  onSelect,
  onViewGraph,
}) {
  return (
    <section className="companyMapList">
      <div className="workspaceHero">
        <div>
          <span className="eyebrow">公司目录</span>
          <h1>产业链公司映射</h1>
          <p>按产业位置组织 A股与美股公司，每条关系都给出事实依据和核验时间。</p>
        </div>
        <button className="secondaryAction" onClick={onViewGraph}>
          <ArrowUpRight size={16} />查看关系图
        </button>
      </div>

      <div className="quickStats">
        <Metric value={rows.length} label="当前映射" />
        <Metric value={getMarketLabel(marketFilter)} label="市场" />
        <Metric value={new Set(rows.map((row) => row.company.id)).size} label="上市公司" />
        <Metric value={rows[0]?.chain?.name || "全部产业链"} label="当前范围" />
      </div>

      <div className="listContext">
        <ListFilter size={16} />
        <span>{query ? `搜索：${query}` : "按产业链位置排列，点击公司查看完整关系路径"}</span>
      </div>

      <div className="mapTable" role="table" aria-label="公司映射列表">
        <div className="mapRow mapHead" role="row">
          <span>公司</span>
          <span>产业链位置</span>
          <span>关系依据</span>
          <span>为什么相关</span>
          <span>最后核验</span>
        </div>
        {rows.length === 0 ? (
          <div className="emptyState">
            <strong>当前筛选下暂无公司映射</strong>
            <span>可以清空搜索词，或切换市场和产业链范围。</span>
          </div>
        ) : rows.map(({ edge, node, company, chain, evidence }) => {
          const active = activeId === company?.id || activeId === node?.id;
          const relation = getRelationPresentation({ evidences: evidence }, edge);
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
              <span className={`basisBadge basis-${relation.basis}`}>{relation.label}</span>
              <button className="reasonCell" onClick={() => onSelect(company.id)}>
                <strong>为什么相关</strong>
                <small>{relation.summary}</small>
              </button>
              <span className="statusCell">
                {formatDate(relation.lastVerifiedAt)}
                <small>{edge.source_ids?.length || 0} 个公开来源</small>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : "待补";
}

function Metric({ value, label }) {
  return (
    <div className="metricTile">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
