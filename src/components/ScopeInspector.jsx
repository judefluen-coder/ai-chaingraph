import { ArrowLeft, ArrowRight, Building2, GitBranch, Layers3, Network, X } from "lucide-react";
import { getEntityTypeLabel, localize } from "../lib/transmissionViewModel.js";

export function ScopeInspector({
  selectedChain,
  chainElements,
  navigation,
  meta,
  dataRefresh,
  refreshStatus,
  locale,
  copy,
  onOpenUpdates,
  onSelectChain,
  onSelectEntity,
  mobileOpen,
  onCloseMobile,
}) {
  const isChain = Boolean(selectedChain);
  const metrics = isChain
    ? [
        [Layers3, copy.elements, meta?.element_count],
        [GitBranch, copy.relations, meta?.relation_count],
        [Network, copy.crossChain, meta?.cross_chain_relation_count],
        [Building2, copy.companies, meta?.issuer_count],
      ]
    : [
        [Network, copy.domains, meta?.domain_count],
        [Layers3, copy.chains, meta?.chain_count],
        [GitBranch, copy.relations, meta?.dependency_relation_count],
      ];

  return (
    <aside className={`txDetailPanel txScopeInspector ${mobileOpen ? "isMobileOpen" : ""}`} aria-label={copy.scopeInspector}>
      <header className="txDetailHeader">
        <div>
          <span>{copy.scopeInspector}</span>
          <h2>{isChain ? localize(selectedChain, "name", locale) : copy.overviewTitle}</h2>
          <small>{isChain ? copy.chainScope : copy.overviewScope}</small>
        </div>
        <button type="button" className="txIconButton txScopeMobileClose" aria-label={copy.showGraph} title={copy.showGraph} onClick={onCloseMobile}>
          <X size={18} strokeWidth={1.8} />
        </button>
      </header>

      {isChain && (
        <button type="button" className="txScopeBackButton" onClick={() => onSelectChain(null)}>
          <ArrowLeft size={15} strokeWidth={1.8} />{copy.backToDomains}
        </button>
      )}

      <section className="txDetailSection txScopeSummary">
        {isChain && localize(selectedChain, "description", locale) && (
          <p>{localize(selectedChain, "description", locale)}</p>
        )}
        <div className={`txScopeMetrics ${isChain ? "" : "isOverview"}`}>
          {metrics.map(([Icon, label, value]) => (
            <span key={label}>
              <Icon size={15} strokeWidth={1.8} />
              <strong>{Number(value || 0).toLocaleString()}</strong>
              <small>{label}</small>
            </span>
          ))}
        </div>
        <button type="button" className={`txScopeFreshness ${refreshStatus?.state === "stale" ? "isStale" : ""}`} onClick={onOpenUpdates}>
          <span><small>{copy.checkedOn}</small><strong>{refreshStatus?.checkedDate || "-"}</strong></span>
          <span><small>{copy.sourceCutoff}</small><strong>{dataRefresh?.source_cutoff_date || "-"}</strong></span>
          {refreshStatus?.state !== "current" && <em>{refreshStatus?.state === "stale" ? copy.reviewOverdue : copy.reviewUnknown}</em>}
        </button>
      </section>

      {isChain ? (
        <section className="txDetailSection txScopeDirectory">
          <div className="txSectionHeading">
            <h3>{copy.coreElements}</h3>
            <span>{chainElements.length}</span>
          </div>
          <div className="txScopeElementList">
            {chainElements.map((entity) => (
              <button key={entity.id} type="button" onClick={() => onSelectEntity(entity.id)}>
                <span>
                  <strong>{localize(entity, "name", locale)}</strong>
                  <small>{getEntityTypeLabel(entity.entity_type, locale)}</small>
                </span>
                <ArrowRight size={15} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="txDetailSection txScopeDirectory">
          <div className="txSectionHeading">
            <h3>{copy.capabilityDomains}</h3>
            <span>{navigation.length}</span>
          </div>
          <div className="txScopeDomainList">
            {navigation.map(({ domain, chains }) => (
              <section key={domain.id}>
                <header>
                  <strong>{localize(domain, "name", locale)}</strong>
                  <span>{chains.length} {copy.chains}</span>
                </header>
                <div>
                  {chains.map((chain) => (
                    <button key={chain.id} type="button" onClick={() => onSelectChain(chain.id)}>
                      <span>{localize(chain, "name", locale)}</span>
                      <ArrowRight size={14} strokeWidth={1.8} />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
