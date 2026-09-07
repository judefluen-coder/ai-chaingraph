import { useState } from "react";
import { Database, GitFork, Github, Search, X } from "lucide-react";
import { getMarketLabel } from "../lib/transmissionViewModel.js";

export function TopBar({
  query,
  onQueryChange,
  searchResults,
  onSelectSearchResult,
  marketFilter,
  onMarketFilterChange,
  dataVersion,
  dataStatus,
  onReset,
  locale,
  onLocaleChange,
  searchPlaceholder,
  copy,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const showResults = searchOpen && query.trim();
  const dataStateLabel = dataStatus === "ready" ? copy.dataReady : copy.dataBuilding;

  return (
    <header className="txTopbar">
      <button className="txBrand" type="button" onClick={onReset}>
        <span className="txBrandMark"><GitFork size={18} strokeWidth={1.8} /></span>
        <span>
          <strong>{copy.brand}</strong>
          <small>{copy.brandTagline}</small>
        </span>
      </button>

      <div
        className="txSearchArea"
        role="search"
        onFocus={() => setSearchOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
        }}
      >
        <div className="txSearchBox">
          <Search size={18} strokeWidth={1.8} />
          <input
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchResults.length === 1) onSelectSearchResult(searchResults[0]);
              if (event.key === "Escape") setSearchOpen(false);
            }}
            placeholder={searchPlaceholder || copy.searchPlaceholder}
            aria-label={copy.searchLabel}
            autoComplete="off"
          />
          {query && (
            <button type="button" aria-label={copy.clearSearch} title={copy.clearSearch} onClick={() => onQueryChange("")}>
              <X size={16} strokeWidth={1.8} />
            </button>
          )}
        </div>
        {showResults && (
          <div className="txSearchResults" role="listbox">
            {searchResults.length === 0 ? (
              <span className="txSearchEmpty">{copy.noSearchResults}</span>
            ) : searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected="false"
                onPointerDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onSelectSearchResult(item);
                  setSearchOpen(false);
                }}
              >
                <span>
                  <strong>{item.primary}</strong>
                  <small>{item.secondary}</small>
                </span>
                <em>{item.kind === "issuer" ? getMarketTag(item.secondary) : item.entity.entity_type}</em>
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="txTopbarTools" aria-label={copy.filters}>
        <div className="txSegmented txMarketSwitch" aria-label={copy.marketFilter}>
          {["all", "a_share", "us"].map((market) => (
            <button
              key={market}
              type="button"
              className={marketFilter === market ? "isActive" : ""}
              aria-pressed={marketFilter === market}
              onClick={() => onMarketFilterChange(market)}
            >
              {getMarketLabel(market, locale)}
            </button>
          ))}
        </div>
        <div className="txSegmented txLanguageSwitch" aria-label={copy.language}>
          <button type="button" className={locale === "zh" ? "isActive" : ""} aria-pressed={locale === "zh"} onClick={() => onLocaleChange("zh")}>中</button>
          <button type="button" className={locale === "en" ? "isActive" : ""} aria-pressed={locale === "en"} onClick={() => onLocaleChange("en")}>EN</button>
        </div>
        <a className="txIconLink" href="https://github.com/judefluen-coder/ai-chaingraph" target="_blank" rel="noreferrer" aria-label={copy.github} title={copy.github}>
          <Github size={18} strokeWidth={1.8} />
        </a>
        <span className="txDataState" title={`${dataStateLabel} · ${dataVersion}`}>
          <Database size={15} strokeWidth={1.8} />
          <span>{dataStateLabel}</span>
        </span>
      </nav>
    </header>
  );
}

function getMarketTag(value) {
  if (/\.(SH|SZ|BJ)\b/.test(value)) return "A";
  if (value) return "US";
  return "";
}
