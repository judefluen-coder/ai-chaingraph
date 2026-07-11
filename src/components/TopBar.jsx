import { CalendarClock, GitBranch, ListFilter, Map, Search, X } from "lucide-react";
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
  onReset,
}) {
  return (
    <header className="topbar">
      <button className="brandButton" onClick={onReset}>
        <GitBranch size={19} />
        <span>AI产业链研究地图</span>
        <small>ChainGraph · 关系可追溯</small>
      </button>

      <label className="searchBox">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索产业链、环节、公司或代码"
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
            className={viewMode === "atlas" ? "isActive" : ""}
            onClick={() => onViewModeChange("atlas")}
          >
            <Map size={15} />产业链
          </button>
          <button
            className={viewMode === "list" ? "isActive" : ""}
            onClick={() => onViewModeChange("list")}
          >
            <ListFilter size={15} />公司
          </button>
          <button
            className={viewMode === "graph" ? "isActive" : ""}
            onClick={() => onViewModeChange("graph")}
          >
            <GitBranch size={15} />关系
          </button>
        </div>
        <span className="dataPill"><CalendarClock size={14} />{dataVersion} · 每周更新</span>
      </nav>
    </header>
  );
}
