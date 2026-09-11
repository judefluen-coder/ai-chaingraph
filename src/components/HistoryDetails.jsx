import { historyCopy } from "../lib/releaseHistory.js";
import { getRelationLabel, localize } from "../lib/transmissionViewModel.js";

export function HistoryDetails({ events, locale, title, onSelectRelation, entitiesById, unavailable, onRetry }) {
  const text = historyCopy(locale);
  return <details className="txHistoryDetails">
    <summary>{title || text.history}</summary>
    {unavailable ? <p>{text.failed} <button type="button" onClick={onRetry}>{text.retry}</button></p> : events.length === 0 ? <p>{text.empty}</p> :
      events.map((event) => <article key={event.id}>
        <time>{text.recorded} · {event.recorded_at.slice(0, 10)}</time>
        <strong>{text[event.kind] || event.kind} · {getRelationLabel(event.relation_type, locale)}</strong>
        {entitiesById && <p>{localize(entitiesById.get(event.issuer_id), "name", locale)} → {localize(entitiesById.get(event.target_id), "name", locale)}</p>}
        <p>{text.effective} · {event.effective_at || text.unknown}</p>
        {event.reason && <p>{locale === "en" ? event.reason_en || event.reason : event.reason}</p>}
        {onSelectRelation && <button type="button" onClick={() => onSelectRelation(event.relation_id)}>{text.relation}</button>}
      </article>)}
  </details>;
}
