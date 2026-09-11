import { useEffect, useState } from "react";
import {
  ChevronDown,
  Database,
  Download,
  Github,
  GitFork,
  Link2,
  Network,
  Star,
  X,
} from "lucide-react";
import { getMarketLabel, localize } from "../lib/transmissionViewModel.js";

export function ChainNavigator({
  navigation,
  activeChainId,
  activeEntityId,
  onOverview,
  onSelect,
  locale,
  onLocaleChange,
  marketFilter,
  onMarketFilterChange,
  dataVersion,
  dataStatus,
  dataRefresh,
  relationshipQuality,
  onOpenUpdates,
  onReset,
  onCopyLink,
  watchlistRecords,
  onSelectWatchlist,
  onExportWatchlist,
  open,
  onClose,
  copy,
}) {
  const [openDomains, setOpenDomains] = useState(() => new Set(navigation.map(({ domain }) => domain.id)));
  const [watchlistOpen, setWatchlistOpen] = useState(true);
  const dataStateLabel = dataStatus === "ready" ? copy.dataReady : copy.dataBuilding;
  const checkedDate = dataRefresh?.last_checked_at?.slice(0, 10) || "-";
  const specificRate = relationshipQuality
    ? `${Math.round(relationshipQuality.specific_issuer_rate * 100)}%`
    : "-";

  useEffect(() => {
    setOpenDomains((current) => {
      const next = new Set(current);
      navigation.forEach(({ domain }) => next.add(domain.id));
      return next;
    });
  }, [navigation]);

  function selectChain(chainId) {
    onSelect(chainId);
    onClose();
  }

  function toggleDomain(domainId) {
    setOpenDomains((current) => {
      const next = new Set(current);
      if (next.has(domainId)) next.delete(domainId);
      else next.add(domainId);
      return next;
    });
  }

  return (
    <>
      <button className={`txSidebarBackdrop ${open ? "isVisible" : ""}`} type="button" aria-label={copy.closeNavigation} onClick={onClose} />
      <aside className={`txSidebar ${open ? "isOpen" : ""}`} aria-label={copy.workspaceNavigation}>
        <header className="txSidebarHeader">
          <button className="txSidebarBrand" type="button" onClick={() => { onReset(); onClose(); }}>
            <span><GitFork size={18} strokeWidth={1.8} /></span>
            <span><strong>{copy.brand}</strong><small>{copy.brandTagline}</small></span>
          </button>
          <button className="txSidebarClose" type="button" aria-label={copy.closeNavigation} title={copy.closeNavigation} onClick={onClose}>
            <X size={18} strokeWidth={1.8} />
          </button>
        </header>

        <div className="txSidebarScroll">
          <nav className="txPrimaryNav" aria-label={copy.workspaceNavigation}>
            <button type="button" className={!activeChainId && !activeEntityId ? "isActive" : ""} onClick={() => { onOverview(); onClose(); }}>
              <Network size={17} strokeWidth={1.8} />
              <span>{copy.overview}</span>
            </button>
          </nav>

          <section className="txSidebarSection">
            <div className="txSidebarSectionLabel">{copy.industryEntry}</div>
            <div className="txDomainList">
              {navigation.map(({ domain, chains }) => {
                const expanded = openDomains.has(domain.id);
                return (
                  <section key={domain.id}>
                    <button type="button" className="txDomainHeading" aria-expanded={expanded} onClick={() => toggleDomain(domain.id)}>
                      <span>{localize(domain, "name", locale)}</span>
                      <ChevronDown className={expanded ? "isExpanded" : ""} size={15} strokeWidth={1.8} />
                    </button>
                    {expanded && (
                      <div className="txSidebarChains">
                        {chains.map((chain) => (
                          <button
                            key={chain.id}
                            type="button"
                            className={activeChainId === chain.id ? "isActive" : ""}
                            aria-pressed={activeChainId === chain.id}
                            onClick={() => selectChain(chain.id)}
                          >
                            <span>{localize(chain, "name", locale)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </section>

          <section className="txSidebarSection txWatchlistNav">
            <button type="button" className="txWatchlistHeading" aria-expanded={watchlistOpen} onClick={() => setWatchlistOpen((value) => !value)}>
              <span><Star size={15} strokeWidth={1.8} />{copy.watchlist}</span>
              <span>{watchlistRecords.length}<ChevronDown className={watchlistOpen ? "isExpanded" : ""} size={15} strokeWidth={1.8} /></span>
            </button>
            {watchlistOpen && (
              <div className="txWatchlistItems">
                {watchlistRecords.length === 0 ? <p>{copy.watchlistEmpty}</p> : watchlistRecords.map((record) => (
                  <button key={record.issuer_id} type="button" className={activeEntityId === record.issuer_id ? "isActive" : ""} onClick={() => { onSelectWatchlist(record.issuer_id); onClose(); }}>
                    <span><strong>{locale === "en" ? record.name_en || record.name : record.name}</strong><small>{record.codes || record.industry}</small></span>
                    <em className={`priority-${record.priority}`}>{copy[`priority_${record.priority}`]}</em>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="txSidebarFooter">
          <div className="txSidebarFilter">
            <span>{copy.marketFilter}</span>
            <div className="txSegmented">
              {["all", "a_share", "us"].map((market) => (
                <button key={market} type="button" className={marketFilter === market ? "isActive" : ""} aria-pressed={marketFilter === market} onClick={() => onMarketFilterChange(market)}>
                  {getMarketLabel(market, locale)}
                </button>
              ))}
            </div>
          </div>
          <div className="txSidebarUtilities">
            <div className="txSegmented txSidebarLanguage" aria-label={copy.language}>
              <button type="button" className={locale === "zh" ? "isActive" : ""} aria-pressed={locale === "zh"} onClick={() => onLocaleChange("zh")}>中</button>
              <button type="button" className={locale === "en" ? "isActive" : ""} aria-pressed={locale === "en"} onClick={() => onLocaleChange("en")}>EN</button>
            </div>
            <button type="button" className="txUtilityButton" aria-label={copy.copyResearchLink} title={copy.copyResearchLink} onClick={onCopyLink}><Link2 size={16} strokeWidth={1.8} /></button>
            <button type="button" className="txUtilityButton" aria-label={copy.exportWatchlist} title={copy.exportWatchlist} disabled={watchlistRecords.length === 0} onClick={onExportWatchlist}><Download size={16} strokeWidth={1.8} /></button>
            <a className="txUtilityButton" href="https://github.com/judefluen-coder/ai-chaingraph" target="_blank" rel="noreferrer" aria-label={copy.github} title={copy.github}><Github size={16} strokeWidth={1.8} /></a>
          </div>
          <button type="button" onClick={onOpenUpdates}
            className="txSidebarDataState"
            aria-label={locale === "en" ? "Data version and updates" : "数据版本与更新"}
            title={`${dataStateLabel} · ${copy.weeklyRefresh} · ${copy.checkedOn} ${checkedDate} · ${copy.specificRelationshipRate} ${specificRate}`}
          >
            <Database size={14} strokeWidth={1.8} />
            <span>{dataStateLabel} · {copy.weeklyRefresh}</span>
            <small>{dataVersion} · {specificRate}</small>
          </button>
        </footer>
      </aside>
    </>
  );
}
