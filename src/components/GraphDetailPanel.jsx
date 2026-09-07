import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  ChevronRight,
  ExternalLink,
  FileText,
  GitCompareArrows,
  Route,
  Star,
  X,
} from "lucide-react";
import {
  formatSecurityCode,
  getEntityTypeLabel,
  getRelationLabel,
  getStageLabel,
  localize,
} from "../lib/transmissionViewModel.js";

const eventOptions = [
  ["price_up", "eventPriceUp"],
  ["price_down", "eventPriceDown"],
  ["supply_up", "eventSupplyUp"],
  ["supply_down", "eventSupplyDown"],
  ["demand_up", "eventDemandUp"],
  ["demand_down", "eventDemandDown"],
  ["capacity_up", "eventCapacityUp"],
  ["capacity_down", "eventCapacityDown"],
  ["policy_change", "eventPolicy"],
  ["technology_shift", "eventTechnology"],
];

export function GraphDetailPanel({
  detail,
  relationDetail,
  locale,
  copy,
  pathStartId,
  shockOverlay,
  watchRecord,
  onToggleWatchlist,
  onUpdateWatchlist,
  onSelectEntity,
  onSelectRelation,
  onExploreDirection,
  onSetPathStart,
  onRunShock,
  onClearShock,
  onClose,
}) {
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const [eventType, setEventType] = useState("demand_up");

  useEffect(() => {
    setShowAllCompanies(false);
  }, [detail?.entity?.id]);

  if (!detail) return null;
  const { entity } = detail;
  const securities = detail.kind === "issuer" ? detail.securities : [];
  const codes = securities.map(formatSecurityCode).filter(Boolean).join(" · ");

  return (
    <aside className="txDetailPanel" aria-label={copy.industryPosition}>
      <header className="txDetailHeader">
        <div>
          <span>{getEntityTypeLabel(entity.entity_type, locale)}</span>
          <h2>{localize(entity, "name", locale)}</h2>
          {codes && <small>{codes}</small>}
        </div>
        <button type="button" className="txIconButton" aria-label={copy.closeDetails} title={copy.closeDetails} onClick={onClose}>
          <X size={18} strokeWidth={1.8} />
        </button>
      </header>

      <div className="txDetailActions">
        {detail.kind === "issuer" && (
          <button type="button" className={watchRecord ? "isActive" : ""} aria-pressed={Boolean(watchRecord)} onClick={onToggleWatchlist}>
            <Star size={16} strokeWidth={1.8} fill={watchRecord ? "currentColor" : "none"} />
            {watchRecord ? copy.watching : copy.addToWatchlist}
          </button>
        )}
        {detail.kind === "element" && (
          <>
            <button type="button" onClick={() => onExploreDirection("upstream")}><ArrowDownLeft size={16} strokeWidth={1.8} />{copy.upstream}</button>
            <button type="button" onClick={() => onExploreDirection("downstream")}><ArrowUpRight size={16} strokeWidth={1.8} />{copy.downstream}</button>
          </>
        )}
        <button type="button" className={pathStartId === entity.id ? "isActive" : ""} onClick={() => onSetPathStart(entity.id)}>
          <Route size={16} strokeWidth={1.8} />{copy.setPathStart}
        </button>
      </div>

      {detail.kind !== "issuer" && detail.context && <ContextSection context={detail.context} locale={locale} copy={copy} />}
      {relationDetail && <RelationEvidence detail={relationDetail} locale={locale} copy={copy} />}

      {detail.kind === "issuer" ? (
        <IssuerPositions
          detail={detail}
          locale={locale}
          copy={copy}
          onSelectEntity={onSelectEntity}
          onSelectRelation={onSelectRelation}
        />
      ) : (
        <>
          <DirectRelations
            detail={detail}
            locale={locale}
            copy={copy}
            onSelectEntity={onSelectEntity}
            onSelectRelation={onSelectRelation}
          />
          <RelatedCompanies
            items={detail.relatedIssuers}
            showAll={showAllCompanies}
            onToggle={() => setShowAllCompanies((value) => !value)}
            onSelect={onSelectEntity}
            locale={locale}
            copy={copy}
          />
        </>
      )}

      {detail.kind === "issuer" && watchRecord && (
        <ResearchNote record={watchRecord} copy={copy} onUpdate={onUpdateWatchlist} />
      )}

      <details className="txConditionalSection" open={Boolean(shockOverlay)}>
        <summary><GitCompareArrows size={16} strokeWidth={1.8} />{copy.conditionalTransmission}</summary>
        <div>
          <label>
            <span>{copy.eventType}</span>
            <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
              {eventOptions.map(([value, key]) => <option key={value} value={value}>{copy[key]}</option>)}
            </select>
          </label>
          <button type="button" className="txPrimaryButton" onClick={() => onRunShock(eventType)}>{copy.runEvent}</button>
          <p>{copy.eventDisclaimer}</p>
          {shockOverlay && (
            <div className="txImpactSummary">
              <span><strong>{shockOverlay.conditional_impacts.length.toLocaleString()}</strong>{copy.impactElements}</span>
              <span><strong>{shockOverlay.impacted_issuers.length.toLocaleString()}</strong>{copy.impactCompanies}</span>
              <button type="button" onClick={onClearShock}>{copy.clearEvent}</button>
            </div>
          )}
        </div>
      </details>
    </aside>
  );
}

function ContextSection({ context, locale, copy }) {
  const parts = [context.domain, context.chain, context.segment].filter(Boolean);
  return (
    <section className="txDetailSection txContextSection">
      <h3>{copy.industryPosition}</h3>
      <div className="txContextPath">
        {parts.map((item, index) => (
          <span key={item.id}>{index > 0 && <ChevronRight size={13} strokeWidth={1.8} />}{localize(item, "name", locale)}</span>
        ))}
      </div>
      {context.stage && <em>{getStageLabel(context.stage, locale)}</em>}
    </section>
  );
}

function RelationEvidence({ detail, locale, copy }) {
  const { relation, from, to, evidence } = detail;
  const summary = localize(relation, "relation_summary", locale);
  return (
    <section className="txDetailSection txEvidenceSection">
      <div className="txSectionHeading">
        <h3>{copy.evidence}</h3>
        <EvidenceBadge relation={relation} copy={copy} />
      </div>
      <div className="txSelectedRelation">
        <strong>{localize(from, "name", locale)}</strong>
        <span>{getRelationLabel(relation.relation_type, locale)}<ChevronRight size={13} strokeWidth={1.8} /></span>
        <strong>{localize(to, "name", locale)}</strong>
      </div>
      {summary && <p className="txRelationSummary">{summary}</p>}
      <div className="txEvidenceList">
        {evidence.length === 0 ? <span className="txEmptyText">{copy.noEvidence}</span> : evidence.map(({ claim, source }) => (
          <article key={claim.id}>
            <div>
              <FileText size={15} strokeWidth={1.8} />
              <strong>{localize(source, "title", locale)}</strong>
            </div>
            <p>{localize(claim, "excerpt", locale)}</p>
            <footer>
              {source?.publish_date && <time>{copy.sourceDate} {source.publish_date}</time>}
              {claim.reviewed_at && <time>{copy.reviewedDate} {String(claim.reviewed_at).slice(0, 10)}</time>}
              {source?.url && <a href={source.url} target="_blank" rel="noreferrer">{copy.openSource}<ExternalLink size={13} strokeWidth={1.8} /></a>}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function IssuerPositions({ detail, locale, copy, onSelectEntity, onSelectRelation }) {
  return (
    <section className="txDetailSection">
      <div className="txSectionHeading">
        <h3>{copy.companyPositions}</h3>
        <span>{detail.mappings.length}</span>
      </div>
      <div className="txRelationRows">
        {detail.mappings.map((item) => (
          <article key={item.relation.id}>
            <button type="button" className="txRelationMain" onClick={() => onSelectRelation(item.relation.id)}>
              <span>
                <strong>{localize(item.element, "name", locale)}</strong>
                <small>{localize(item.context?.chain, "name", locale)} · {getRelationLabel(item.relation.relation_type, locale)}</small>
              </span>
              <EvidenceBadge relation={item.relation} copy={copy} />
            </button>
            <button type="button" className="txRelationTarget" aria-label={localize(item.element, "name", locale)} onClick={() => onSelectEntity(item.element.id)}>
              <ChevronRight size={16} strokeWidth={1.8} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function DirectRelations({ detail, locale, copy, onSelectEntity, onSelectRelation }) {
  const rows = [...detail.incoming, ...detail.outgoing];
  return (
    <section className="txDetailSection">
      <div className="txSectionHeading">
        <h3>{copy.directRelations}</h3>
        <span>{rows.length}</span>
      </div>
      <div className="txRelationRows">
        {rows.map((item) => {
          const neighbor = item.direction === "upstream" ? item.from : item.to;
          return (
            <article key={item.relation.id}>
              <button type="button" className="txRelationMain" onClick={() => onSelectRelation(item.relation.id)}>
                {item.direction === "upstream" ? <ArrowDownLeft size={16} strokeWidth={1.8} /> : <ArrowUpRight size={16} strokeWidth={1.8} />}
                <span>
                  <strong>{localize(neighbor, "name", locale)}</strong>
                  <small>{item.direction === "upstream" ? copy.upstream : copy.downstream} · {getRelationLabel(item.relation.relation_type, locale)}</small>
                </span>
                <EvidenceBadge relation={item.relation} copy={copy} />
              </button>
              <button type="button" className="txRelationTarget" aria-label={localize(neighbor, "name", locale)} onClick={() => onSelectEntity(neighbor.id)}>
                <ChevronRight size={16} strokeWidth={1.8} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RelatedCompanies({ items, showAll, onToggle, onSelect, locale, copy }) {
  const visible = showAll ? items : items.slice(0, 12);
  return (
    <section className="txDetailSection">
      <div className="txSectionHeading">
        <h3>{copy.relatedCompanies}</h3>
        <span>{items.length}</span>
      </div>
      {visible.length === 0 ? <span className="txEmptyText">{copy.noCompanies}</span> : (
        <div className="txCompanyRows">
          {visible.map(({ issuer, securities, mapping }) => (
            <button type="button" key={issuer.id} onClick={() => onSelect(issuer.id)}>
              <Building2 size={15} strokeWidth={1.8} />
              <span><strong>{localize(issuer, "name", locale)}</strong><small>{securities.map(formatSecurityCode).filter(Boolean).join(" · ")}</small></span>
              <em>{mapping?.relation_type === "issuer_participates_in_segment" ? copy.evidenceFallback : copy.typedMapping}</em>
            </button>
          ))}
        </div>
      )}
      {items.length > 12 && <button type="button" className="txShowMore" onClick={onToggle}>{showAll ? copy.showLess : `${copy.showMore} · ${items.length - 12}`}</button>}
    </section>
  );
}

function EvidenceBadge({ relation, copy }) {
  let label = copy.industryReference;
  let className = "isReference";
  if (relation.relation_type === "issuer_participates_in_segment") {
    label = copy.evidenceFallback;
    className = "isFallback";
  } else if (relation.evidence_level === "L1") {
    label = copy.evidenceL1;
    className = "isVerified";
  } else if (relation.evidence_level === "L2") {
    label = copy.evidenceL2;
  } else if (relation.relation_basis === "ontology_curated") {
    label = copy.ontologyCurated;
    className = "isOntology";
  }
  return <em className={`txEvidenceBadge ${className}`}>{label}</em>;
}

function ResearchNote({ record, copy, onUpdate }) {
  return (
    <section className="txDetailSection txResearchNote">
      <div className="txSectionHeading">
        <h3>{copy.researchNote}</h3>
        <span>{record.updated_at ? String(record.updated_at).slice(0, 10) : ""}</span>
      </div>
      <div className="txResearchNoteGrid">
        <label>
          <span>{copy.priority}</span>
          <select value={record.priority} onChange={(event) => onUpdate({ priority: event.target.value })}>
            <option value="high">{copy.priority_high}</option>
            <option value="medium">{copy.priority_medium}</option>
            <option value="low">{copy.priority_low}</option>
          </select>
        </label>
        <label>
          <span>{copy.nextReview}</span>
          <input type="date" value={record.next_review_at} onChange={(event) => onUpdate({ next_review_at: event.target.value })} />
        </label>
        <label className="isWide">
          <span>{copy.tags}</span>
          <input value={record.tags} placeholder={copy.tagsPlaceholder} onChange={(event) => onUpdate({ tags: event.target.value })} />
        </label>
        <label className="isWide">
          <span>{copy.thesis}</span>
          <textarea value={record.thesis} placeholder={copy.thesisPlaceholder} rows={4} onChange={(event) => onUpdate({ thesis: event.target.value })} />
        </label>
      </div>
    </section>
  );
}
