const STORAGE_KEY = "ai-chaingraph-v1.1-watchlist";

export function readWatchlist() {
  try {
    const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(records) ? records.map(normalizeWatchlistRecord) : [];
  } catch {
    return [];
  }
}

export function writeWatchlist(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function createWatchlistRecord({ issuer, codes }) {
  const now = new Date().toISOString();
  return normalizeWatchlistRecord({
    issuer_id: issuer.id,
    name: issuer.name || issuer.name_en || issuer.id,
    name_en: issuer.name_en || "",
    codes,
    industry: issuer.industry || issuer.industry_en || "",
    priority: "medium",
    tags: "",
    thesis: "",
    next_review_at: "",
    added_at: now,
    updated_at: now,
  });
}

export function downloadWatchlist(records) {
  if (records.length === 0) return;
  const headers = ["issuer_id", "codes", "name", "industry", "priority", "tags", "thesis", "next_review_at", "added_at", "updated_at"];
  const rows = records.map((record) => headers.map((header) => csvCell(record[header])).join(","));
  const content = [
    "# AI-ChainGraph research watchlist; public evidence research only, not investment advice.",
    headers.join(","),
    ...rows,
  ].join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ai-chaingraph-watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeWatchlistRecord(record) {
  return {
    priority: "medium",
    tags: "",
    thesis: "",
    next_review_at: "",
    ...record,
  };
}

function csvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}
