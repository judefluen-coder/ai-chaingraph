import { buildDetailModel } from "./transmissionViewModel.js";

export const MAX_COMPARISON_COMPANIES = 4;

export function normalizeComparisonIds(ids = []) {
  return [...new Set(ids.filter((id) => typeof id === "string" && id.startsWith("issuer:") && id.length <= 200))].slice(0, MAX_COMPARISON_COMPANIES);
}

export function buildCompanyComparison(graph, ids, locale = "zh") {
  const companies = normalizeComparisonIds(ids).map((id) => buildDetailModel(graph, id, { locale }))
    .filter((detail) => detail?.kind === "issuer");
  const counts = new Map();
  for (const company of companies) {
    for (const id of new Set(company.mappings.map((item) => item.element?.id).filter(Boolean))) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return { companies, sharedElementIds: new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id)) };
}

export function comparisonSearch(ids, locale = "zh") {
  const params = new URLSearchParams();
  for (const id of normalizeComparisonIds(ids)) params.append("compare", id);
  if (locale === "en") params.set("lang", "en");
  return `?${params}`;
}
