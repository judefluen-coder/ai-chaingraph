import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Plus, X } from "lucide-react";
import { buildCompanyComparison, comparisonSearch, MAX_COMPARISON_COMPANIES } from "../lib/companyComparison.js";
import { formatSecurityCode, getRelationLabel, localize, searchTransmissionGraph } from "../lib/transmissionViewModel.js";
import { isSemanticReviewPending } from "../lib/semanticReview.js";
import { getRefreshStatus } from "../lib/refreshStatus.js";

export function ComparisonDialog({ graph, ids, onChange, locale, onClose, onSelectRelation }) {
  const ref = useRef(null);
  const [query, setQuery] = useState("");
  const [sharedOnly, setSharedOnly] = useState(false);
  const [message, setMessage] = useState("");
  const [fallbackLink, setFallbackLink] = useState("");
  const en = locale === "en";
  const refreshStatus = getRefreshStatus(graph.meta.refresh);
  const { companies, sharedElementIds } = useMemo(() => buildCompanyComparison(graph, ids, locale), [graph, ids, locale]);
  const results = useMemo(() => query.trim() ? searchTransmissionGraph(graph, query, { locale, limit: 30 })
    .filter((item) => item.kind === "issuer" && !ids.includes(item.id)).slice(0, 6) : [], [graph, query, locale, ids]);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  async function share() {
    const url = new URL(window.location.href);
    url.search = comparisonSearch(ids, locale);
    url.hash = "";
    try {
      await navigator.clipboard.writeText(url.href);
      setMessage(en ? "Link copied" : "已复制对比链接");
      setFallbackLink("");
    } catch {
      setFallbackLink(url.href);
      setMessage(en ? "Select and copy the link below" : "请选中下方链接复制");
    }
  }

  return <dialog ref={ref} className="txReleaseDialog txComparisonDialog" aria-labelledby="comparison-title" onClose={onClose}>
    <header><div><h2 id="comparison-title">{en ? "Company comparison" : "公司对比"}</h2><span>{en ? "Last checked" : "最近核验"} {refreshStatus.checkedDate || "—"}<br />{en ? "Source cutoff" : "已收录来源截止"} {graph.meta.refresh?.source_cutoff_date || "—"}</span></div>
      <div className="txComparisonTools">
        <button type="button" className="txIconButton" onClick={share} disabled={companies.length < 2} aria-label={en ? "Copy comparison link" : "复制对比链接"} title={en ? "Copy comparison link" : "复制对比链接"}><Link size={18} /></button>
        <button type="button" className="txIconButton" onClick={onClose} aria-label={en ? "Close comparison" : "关闭对比"} title={en ? "Close comparison" : "关闭对比"}><X size={18} /></button>
      </div>
    </header>
    <div className="txComparisonBody">
      {refreshStatus.state !== "current" && <p className="txReleaseWarning" role="status">{en ? "Review is overdue or unknown. Verify current disclosures before relying on these records." : "数据核验已过期或时间未知，使用前请核对最新披露。"}</p>}
      <div className="txComparisonControls">
        <label>{en ? "Add company" : "添加公司"} <span>{companies.length}/{MAX_COMPARISON_COMPANIES}</span>
          <input type="search" value={query} disabled={companies.length >= MAX_COMPARISON_COMPANIES} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Name or ticker" : "公司名称或证券代码"} />
        </label>
        <label className="txComparisonToggle"><input type="checkbox" checked={sharedOnly} onChange={(event) => setSharedOnly(event.target.checked)} />{en ? "Shared positions only" : "只看共同产业位置"}</label>
      </div>
      {query.trim() && companies.length < MAX_COMPARISON_COMPANIES && <div className="txComparisonResults">
        {results.length ? results.map((item) => <button key={item.id} type="button" onClick={() => { onChange([...companies.map((company) => company.entity.id), item.id]); setQuery(""); setMessage(""); setFallbackLink(""); }}><Plus size={15} /><span>{item.primary}<small>{item.secondary}</small></span></button>) : <p>{en ? "No matching companies" : "未找到匹配公司"}</p>}
      </div>}
      {message && <p role="status">{message}</p>}
      {fallbackLink && <input className="txComparisonLink" aria-label={en ? "Comparison link" : "对比链接"} readOnly value={fallbackLink} onFocus={(event) => event.target.select()} />}
      {ids.length > companies.length && <p role="status">{en ? "Some companies are unavailable in this snapshot." : "部分公司在当前快照中不存在，请重新选择。"}</p>}
      <p className="txComparisonBoundary">{en ? "Positions are disclosure-based, not rankings or confirmed supplier/customer links. Missing records do not mean absence of business." : "产业位置来自已收录披露，不代表排名或已确认的供需关系；未收录不等于没有相关业务。"}</p>
      <div className="txComparisonGrid" style={{ "--comparison-columns": Math.max(companies.length, 1) }}>
        {companies.map((company) => {
          const mappings = company.mappings.filter((item) => !sharedOnly || sharedElementIds.has(item.element?.id));
          return <section key={company.entity.id} className="txComparisonCompany">
            <div className="txComparisonCompanyHeader"><div><h3>{localize(company.entity, "name", locale)}</h3><small>{company.securities.map(formatSecurityCode).join(" · ")}</small></div><button type="button" className="txIconButton" aria-label={`${en ? "Remove" : "移除"} ${localize(company.entity, "name", locale)}`} onClick={() => { onChange(ids.filter((id) => id !== company.entity.id)); setMessage(""); setFallbackLink(""); }}><X size={16} /></button></div>
            <p className="txComparisonCount">{en ? "Recorded positions" : "已收录产业位置"} · {company.mappings.length}</p>
            {mappings.length ? mappings.map(({ relation, element, evidence }) => <article key={relation.id}>
              <strong>{localize(element, "name", locale)}</strong>
              <span>{getRelationLabel(relation.relation_type, locale)}</span>
              {sharedElementIds.has(element?.id) && <small className="txComparisonShared">{en ? "Shared position" : "共同位置"}</small>}
              {isSemanticReviewPending(relation) ? <small className="txComparisonPending">{en ? "Pending semantic review" : "动作语义待复核"}</small> : relation.relation_type === "issuer_participates_in_segment" ? <small>{en ? "Broad mapping" : "宽口径映射"}</small> : null}
              <small>{en ? "Latest source" : "最新来源日期"} {evidence.map(({ source }) => source?.publish_date).filter(Boolean).sort().at(-1) || (en ? "Unknown" : "未知")}</small>
              <button type="button" onClick={() => onSelectRelation(relation.id)}>{en ? "Review evidence" : "核验证据"}</button>
            </article>) : <p>{en ? "No recorded positions in this view" : "当前视图无已收录位置"}</p>}
          </section>;
        })}
      </div>
      {!companies.length && <p>{en ? "No companies selected" : "尚未选择公司"}</p>}
    </div>
  </dialog>;
}
