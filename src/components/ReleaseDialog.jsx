import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { historyCopy } from "../lib/releaseHistory.js";
import { HistoryDetails } from "./HistoryDetails.jsx";

export function ReleaseDialog({ graph, locale, onClose, onSelectRelation, onRetry }) {
  const ref = useRef(null);
  const text = historyCopy(locale);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="txReleaseDialog" aria-labelledby="release-title" onClose={onClose} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <header><div><h2 id="release-title">{text.updates}</h2><span>{graph.meta.data_version}</span></div><button type="button" className="txIconButton" onClick={onClose} aria-label={text.close} title={text.close}><X size={18} /></button></header>
    <div className="txReleaseBody">
      <dl>{[[text.checked, graph.meta.refresh?.last_checked_at], [text.changed, graph.meta.refresh?.last_changed_at]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value?.slice(0, 10) || "—"}</dd></div>)}</dl>
      <details className="txHistoryDetails"><summary>{text.releases}</summary>
        <p>{text.provenance}</p>
        {graph.releaseHistoryError ? <p>{text.failed} <button type="button" onClick={onRetry}>{text.retry}</button></p> : !graph.release_history?.batches?.length ? <p>{text.empty}</p> :
          [...graph.release_history.batches].sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at)).map((batch) =>
            <HistoryDetails key={batch.id} title={`${text.auditDate} · ${batch.reviewed_at.slice(0, 16).replace("T", " ")} UTC`} events={graph.release_history.events.filter((event) => event.batch_id === batch.id)} locale={locale} entitiesById={new Map(graph.entities.map((entity) => [entity.id, entity]))} onSelectRelation={(id) => { onSelectRelation(id); onClose(); }} />)}
      </details>
    </div>
  </dialog>;
}
