import test from "node:test";
import assert from "node:assert/strict";
import { assertGraphPerformanceBudget, assertSearchPerformance } from "../scripts/lib/performance-budget.mjs";

test("search performance budget accepts normal cached work", () => {
  assert.equal(assertSearchPerformance(40, 80), 2);
});

test("search performance budget rejects a cache regression", () => {
  assert.throws(() => assertSearchPerformance(40, 300), /maximum allowed is 6x/);
});

test("search performance budget rejects invalid calibration", () => {
  assert.throws(() => assertSearchPerformance(0, 80), /valid, positive first-search timing/);
});

const normalGraphMetrics = {
  snapshot_gzip_bytes: 2_500_000,
  parse_ms: 45,
  index_ms: 25,
  overview_ms: 12,
  chain_ms: 4,
  traversal_ms: 5,
};

test("graph performance budget accepts the current scale", () => {
  assert.doesNotThrow(() => assertGraphPerformanceBudget(normalGraphMetrics));
});

test("graph performance budget blocks oversized snapshots and slow phases", () => {
  assert.throws(() => assertGraphPerformanceBudget({ ...normalGraphMetrics, snapshot_gzip_bytes: 4_000_001 }), /Compressed snapshot exceeds/);
  for (const name of ["parse_ms", "index_ms", "overview_ms", "chain_ms", "traversal_ms"]) {
    assert.throws(() => assertGraphPerformanceBudget({ ...normalGraphMetrics, [name]: 1_001 }), new RegExp(name));
  }
});
