const VALID_MARKETS = new Set(["all", "a_share", "us"]);
const VALID_DIRECTIONS = new Set(["upstream", "downstream", "both"]);
const VALID_DEPTHS = new Set([1, 3, 5]);
const VALID_LOCALES = new Set(["zh", "en"]);

export function parseWorkspaceSearch(search = "") {
  const params = new URLSearchParams(search);
  const depth = Number(params.get("depth"));
  const market = params.get("market");
  const direction = params.get("direction");
  const locale = params.get("lang");

  return {
    query: params.get("q") || "",
    activeId: params.get("entity") || null,
    activeRelationId: params.get("relation") || null,
    selectedChainId: params.get("chain") || null,
    marketFilter: VALID_MARKETS.has(market) ? market : "all",
    direction: VALID_DIRECTIONS.has(direction) ? direction : "downstream",
    depth: VALID_DEPTHS.has(depth) ? depth : 3,
    pathStartId: params.get("pathStart") || null,
    pathTargetId: params.get("pathTarget") || null,
    shockType: params.get("shock") || null,
    locale: VALID_LOCALES.has(locale) ? locale : null,
  };
}

export function serializeWorkspaceSearch(state) {
  const params = new URLSearchParams();

  if (state.selectedChainId) params.set("chain", state.selectedChainId);
  if (state.activeId) params.set("entity", state.activeId);
  if (state.activeRelationId) params.set("relation", state.activeRelationId);
  if (state.marketFilter && state.marketFilter !== "all") params.set("market", state.marketFilter);
  if (state.direction && state.direction !== "downstream") params.set("direction", state.direction);
  if (state.depth && state.depth !== 3) params.set("depth", String(state.depth));
  if (state.pathStartId) params.set("pathStart", state.pathStartId);
  if (state.pathTargetId) params.set("pathTarget", state.pathTargetId);
  if (state.shockType) params.set("shock", state.shockType);
  if (state.query) params.set("q", state.query);
  if (state.locale && state.locale !== "zh") params.set("lang", state.locale);

  const value = params.toString();
  return value ? `?${value}` : "";
}
