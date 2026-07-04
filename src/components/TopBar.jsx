import { Database, GitBranch, ListFilter, Search, SlidersHorizontal, X } from "lucide-react";
import { getMarketLabel } from "../lib/graphViewModel";

export function TopBar({
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
  marketFilter,
  onMarketFilterChange,
  marketOptions,
  dataStatus,
  dataVersion,
  onReset,
}) {
  return (
    <header className="topbar">
      <button className="brandButton" onClick={onReset}>
        <GitBranch size={19} />
        <span>AI产业链选股地图</span>
        <small>ChainGraph · 证据驱动</small>
      </button>

      <label className="searchBox">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索股票、产业环节、代码或证据"
        />
        {query && (
          <button aria-label="清除搜索" onClick={() => onQueryChange("")}>
            <X size={16} />
          </button>
        )}
      </label>

      <nav className="toolbarGroup" aria-label="工作台筛选">
        <div className="marketSwitch" aria-label="市场筛选">
          {marketOptions.map((market) => (
            <button
              key={market}
              className={marketFilter === market ? "isActive" : ""}
              onClick={() => onMarketFilterChange(market)}
            >
              {getMarketLabel(market)}
            </button>
          ))}
        </div>
        <div className="viewSwitch" aria-label="视图切换">
          <button
            className={viewMode === "list" ? "isActive" : ""}
            onClick={() => onViewModeChange("list")}
          >
            <ListFilter size={15} />股票池
          </button>
          <button
            className={viewMode === "graph" ? "isActive" : ""}
            onClick={() => onViewModeChange("graph")}
          >
            <GitBranch size={15} />图谱
          </button>
        </div>
        <span
          className={`dataPill status-${dataStatus.tone}`}
          title={`过期 ${dataStatus.staleCount}；即将过期 ${dataStatus.expiringCount}；映射待审核 ${dataStatus.mappingReviewCount}；本地反馈待处理 ${dataStatus.feedbackPendingCount}`}
        >
          <Database size={14} />
          {dataVersion} · {dataStatus.label}
        </span>
        <span className="desktopHint"><SlidersHorizontal size={14} />本地研究</span>
      </nav>
    </header>
  );
}
