import { useEffect, useId, useState } from "react";
import { Menu, Search, X } from "lucide-react";

export function TopBar({
  query,
  onQueryChange,
  searchResults,
  onSelectSearchResult,
  onOpenNavigation,
  navigationOpen,
  searchPlaceholder,
  copy,
}) {
  const listboxId = useId();
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const showResults = searchOpen && query.trim();

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  function selectResult(item) {
    if (!item) return;
    onSelectSearchResult(item);
    setSearchOpen(false);
    setActiveIndex(-1);
  }

  return (
    <header className="txTopbar">
      <button
        className="txMobileMenu"
        type="button"
        aria-label={copy.openNavigation}
        title={copy.openNavigation}
        aria-expanded={navigationOpen}
        onClick={onOpenNavigation}
      >
        <Menu size={19} strokeWidth={1.8} />
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
            role="combobox"
            aria-controls={listboxId}
            aria-expanded={Boolean(showResults)}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && searchResults.length > 0) {
                event.preventDefault();
                setSearchOpen(true);
                setActiveIndex((index) => Math.min(index + 1, searchResults.length - 1));
              }
              if (event.key === "ArrowUp" && searchResults.length > 0) {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              }
              if (event.key === "Enter") selectResult(searchResults[activeIndex] || (searchResults.length === 1 ? searchResults[0] : null));
              if (event.key === "Escape") {
                setSearchOpen(false);
                setActiveIndex(-1);
              }
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
          <div className="txSearchResults" role="listbox" id={listboxId}>
            {searchResults.length === 0 ? (
              <span className="txSearchEmpty">{copy.noSearchResults}</span>
            ) : searchResults.map((item, index) => (
              <button
                key={item.id}
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={activeIndex === index ? "isActive" : ""}
                onPointerDown={(event) => event.preventDefault()}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => selectResult(item)}
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
    </header>
  );
}

function getMarketTag(value) {
  if (/\.(SH|SZ|BJ)\b/.test(value)) return "A";
  if (value) return "US";
  return "";
}
