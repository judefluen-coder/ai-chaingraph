const VALID_VIEWS = new Set(["atlas", "list", "graph"]);
const VALID_MARKETS = new Set(["all", "a_share", "us"]);

const mobileTabByView = {
  atlas: "atlas",
  list: "stocks",
  graph: "graph",
};

export function parseWorkspaceSearch(search = "") {
  const params = new URLSearchParams(search);
  const viewMode = VALID_VIEWS.has(params.get("view")) ? params.get("view") : "atlas";
  const marketFilter = VALID_MARKETS.has(params.get("market")) ? params.get("market") : "all";
  const onlyChain = params.get("chain") || null;
  const entityId = params.get("entity") || null;
  const query = params.get("q") || "";

  return {
    query,
    activeId: entityId || onlyChain || "overview",
    viewMode,
    mobileTab: entityId || query ? "detail" : mobileTabByView[viewMode],
    onlyChain,
    marketFilter,
  };
}

export function serializeWorkspaceSearch({ query, activeId, viewMode, onlyChain, marketFilter }) {
  const params = new URLSearchParams();

  if (viewMode && viewMode !== "atlas") params.set("view", viewMode);
  if (onlyChain) params.set("chain", onlyChain);
  if (activeId && activeId !== "overview" && activeId !== onlyChain) params.set("entity", activeId);
  if (marketFilter && marketFilter !== "all") params.set("market", marketFilter);
  if (query) params.set("q", query);

  const value = params.toString();
  return value ? `?${value}` : "";
}
