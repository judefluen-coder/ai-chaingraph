import { CalendarClock, GitBranch, Link2, ListFilter, Map, Search, X } from "lucide-react";
import { getMarketLabel } from "../lib/graphViewModel";

export function TopBar({
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
  marketFilter,
  onMarketFilterChange,
  marketOptions,
  dataVersion,
  dataStatus,
  onCopyLink,
  onReset,
}) {
  const isDemo = dataStatus?.datasetType === "demo";
  const statusTitle = [
    `版本 ${dataVersion}`,
    dataStatus?.staleCount ? `${dataStatus.staleCount} 条过期证据` : null,
    dataStatus?.expiringCount ? `${dataStatus.expiringCount} 条即将过期` : null,
    dataStatus?.mappingReviewCount ? `${dataStatus.mappingReviewCount} 条映射待审核` : null,
    dataStatus?.feedbackPendingCount ? `${dataStatus.feedbackPendingCount} 条反馈待处理` : null,
  ].filter(Boolean).join(" · ");

  return (
    <header className="topbar">
      <button className="brandButton" onClick={onReset}>
        <GitBranch size={19} />
        <span>AI产业链研究地图</span>
        <small>ChainGraph · 关系可追溯 · {isDemo ? "演示数据" : "公开数据"}</small>
      </button>

      <div className="searchBox">
        <Search size={18} />
        <input
          aria-label="搜索产业链、环节、公司或代码"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索产业链、环节、公司或代码"
        />
        {query && (
          <button aria-label="清除搜索" onClick={() => onQueryChange("")}>
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="toolbarGroup" aria-label="工作台筛选">
        <div className="marketSwitch" aria-label="市场筛选">
          {marketOptions.map((market) => (
            <button
              key={market}
              className={marketFilter === market ? "isActive" : ""}
              aria-pressed={marketFilter === market}
              onClick={() => onMarketFilterChange(market)}
            >
              {getMarketLabel(market)}
            </button>
          ))}
        </div>
        <div className="viewSwitch" aria-label="视图切换">
          <button
            className={viewMode === "atlas" ? "isActive" : ""}
            aria-pressed={viewMode === "atlas"}
            onClick={() => onViewModeChange("atlas")}
          >
            <Map size={15} />产业链
          </button>
          <button
            className={viewMode === "list" ? "isActive" : ""}
            aria-pressed={viewMode === "list"}
            onClick={() => onViewModeChange("list")}
          >
            <ListFilter size={15} />公司
          </button>
          <button
            className={viewMode === "graph" ? "isActive" : ""}
            aria-pressed={viewMode === "graph"}
            onClick={() => onViewModeChange("graph")}
          >
            <GitBranch size={15} />关系
          </button>
        </div>
        <span className={`dataPill status-${dataStatus?.tone || "muted"}`} title={statusTitle}>
          <CalendarClock size={14} />
          <span className="dataPillCopy">
            <strong>{dataStatus?.label || "数据状态"} · {dataStatus?.sourceLabel || "来源待确认"}</strong>
            <small>{dataVersion}{dataStatus?.issueCount ? ` · ${dataStatus.issueCount} 项待核验` : " · 已通过当前检查"}</small>
          </span>
        </span>
        <button className="shareLinkButton" aria-label="复制当前研究视图链接" title="复制当前研究视图链接" onClick={onCopyLink}>
          <Link2 size={16} />
        </button>
      </nav>
    </header>
  );
}
