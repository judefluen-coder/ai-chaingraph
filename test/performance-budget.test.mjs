import test from "node:test";
import assert from "node:assert/strict";
import { assertSearchPerformance } from "../scripts/lib/performance-budget.mjs";

test("search performance budget accepts normal cached work", () => {
  assert.equal(assertSearchPerformance(40, 80), 2);
});

test("search performance budget rejects a cache regression", () => {
  assert.throws(() => assertSearchPerformance(40, 300), /maximum allowed is 6x/);
});

test("search performance budget rejects invalid calibration", () => {
  assert.throws(() => assertSearchPerformance(0, 80), /valid, positive first-search timing/);
});
