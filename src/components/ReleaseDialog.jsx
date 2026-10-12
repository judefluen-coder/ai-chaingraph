import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { historyCopy } from "../lib/releaseHistory.js";
import { getCopy } from "../lib/i18n.js";
import { getRefreshStatus } from "../lib/refreshStatus.js";
import { HistoryDetails } from "./HistoryDetails.jsx";

export function ReleaseDialog({ graph, history, historyLoading, historyUnavailable, locale, onClose, onSelectRelation, onRetry }) {
  const ref = useRef(null);
  const text = historyCopy(locale);
  const copy = getCopy(locale);
  const refresh = graph.meta.refresh;
  const refreshStatus = getRefreshStatus(refresh);
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
      {refreshStatus.state !== "current" && <p className="txReleaseWarning" role="status">{refreshStatus.state === "stale" ? copy.reviewOverdueWarning : copy.reviewUnknownWarning}</p>}
      <dl>{[
        [text.checked, refresh?.last_checked_at],
        [copy.sourceCutoff, refresh?.source_cutoff_date],
        [copy.listingReconciledThrough, refresh?.a_share_listing_reconciled_through],
        [text.changed, refresh?.last_changed_at],
        [text.next, refresh?.next_scheduled_at],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value?.slice(0, 10) || "—"}</dd></div>)}</dl>
      <details className="txHistoryDetails"><summary>{text.releases}</summary>
        <p>{text.provenance}</p>
        {historyLoading ? <p role="status">{text.loading}</p> : historyUnavailable ? <p>{text.failed} <button type="button" onClick={onRetry}>{text.retry}</button></p> : !history?.batches?.length ? <p>{text.empty}</p> :
          [...history.batches].sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at)).map((batch) =>
            <HistoryDetails key={batch.id} title={`${text.auditDate} · ${batch.reviewed_at.slice(0, 16).replace("T", " ")} UTC`} events={history.events.filter((event) => event.batch_id === batch.id)} locale={locale} entitiesById={new Map(graph.entities.map((entity) => [entity.id, entity]))} onSelectRelation={(id) => { onSelectRelation(id); onClose(); }} />)}
      </details>
    </div>
  </dialog>;
}
