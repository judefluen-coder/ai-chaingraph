export const MAX_WARM_TO_FIRST_SEARCH_RATIO = 6;

export function assertSearchPerformance(firstSearchMs, warmSearchMs, maxRatio = MAX_WARM_TO_FIRST_SEARCH_RATIO) {
  if (!Number.isFinite(firstSearchMs) || firstSearchMs <= 0 || !Number.isFinite(warmSearchMs) || warmSearchMs < 0) {
    throw new Error("Search benchmark needs valid, positive first-search timing and nonnegative warm-search timing.");
  }
  const ratio = warmSearchMs / firstSearchMs;
  if (ratio > maxRatio) {
    throw new Error(`Warm search is ${ratio.toFixed(2)}x the first search; maximum allowed is ${maxRatio}x.`);
  }
  return ratio;
}
