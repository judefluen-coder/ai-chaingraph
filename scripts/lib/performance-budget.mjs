export const MAX_WARM_TO_FIRST_SEARCH_RATIO = 6;
export const MAX_SNAPSHOT_GZIP_BYTES = 4_000_000;

const MAX_COMPUTE_MS = {
  parse_ms: 1_000,
  index_ms: 1_000,
  overview_ms: 500,
  chain_ms: 500,
  traversal_ms: 500,
};

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

export function assertGraphPerformanceBudget(metrics) {
  if (!Number.isFinite(metrics.snapshot_gzip_bytes) || metrics.snapshot_gzip_bytes <= 0 || metrics.snapshot_gzip_bytes > MAX_SNAPSHOT_GZIP_BYTES) {
    throw new Error(`Compressed snapshot exceeds ${MAX_SNAPSHOT_GZIP_BYTES} bytes or has an invalid size.`);
  }
  for (const [name, limit] of Object.entries(MAX_COMPUTE_MS)) {
    if (!Number.isFinite(metrics[name]) || metrics[name] < 0 || metrics[name] > limit) {
      throw new Error(`${name} exceeds the ${limit} ms release budget or has an invalid timing.`);
    }
  }
}
