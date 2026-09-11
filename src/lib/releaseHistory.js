export function relationEvents(history, relationId) {
  return (history?.events || []).filter((event) => event.relation_id === relationId || event.replaces_relation_id === relationId)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
}

export function issuerEvents(history, issuerId) {
  return (history?.events || []).filter((event) => event.issuer_id === issuerId)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
}

export function historicalRelation(history, relationId) {
  return (history?.archived_relations || []).find((relation) => relation.id === relationId) || null;
}

export function historyCopy(locale) {
  return locale === "en" ? {
    history: "View change history", updates: "Data version and updates", recent: "View recent relationship changes",
    empty: "No recorded changes. Earlier history has not been reconstructed.", failed: "Update records could not be loaded.",
    retry: "Retry", releases: "View update records", close: "Close", relation: "View relationship", recorded: "Recorded",
    effective: "Effective", unknown: "Not specified by source", added: "Added", replaced: "Replaced", withdrawn: "Withdrawn",
    expired: "No longer effective", superseded: "Superseded", archived: "Historical relationship; excluded from the current graph.",
    replacement: "View replacement", checked: "Last checked", changed: "Last data change", next: "Next scheduled check",
    auditDate: "Batch reviewed", provenance: "Recorded from approved batches; review dates are not publication dates.",
  } : {
    history: "查看变更历史", updates: "数据版本与更新", recent: "查看近期关系变化",
    empty: "暂无变更记录，未追溯补录更早的历史。", failed: "更新记录加载失败。",
    retry: "重试", releases: "查看更新记录", close: "关闭", relation: "查看关系", recorded: "记录时间",
    effective: "实际生效日", unknown: "来源未明确", added: "新增", replaced: "替代", withdrawn: "已撤回",
    expired: "已失效", superseded: "已被替代", archived: "历史关系，不属于当前有效图谱。",
    replacement: "查看替代关系", checked: "最近检查", changed: "最近数据变化", next: "下次计划检查",
    auditDate: "批次审核时间", provenance: "记录来自已批准批次；审核时间不等于上线时间。",
  };
}
