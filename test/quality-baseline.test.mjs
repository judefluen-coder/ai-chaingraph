import assert from "node:assert/strict";
import test from "node:test";
import { assertQualityBaseline } from "../scripts/lib/quality-baseline.mjs";

const baseline = {
  specific_issuer_rate: 0.9332,
  specific_relation_rate: 0.9056,
  issuers_generic_only: 304,
  sparse_segments: 7,
};

function quality(overrides = {}) {
  return {
    ...baseline,
    sparse_segments: Array(baseline.sparse_segments).fill({}),
    ...overrides,
  };
}

test("approved relationship quality passes", () => {
  assert.doesNotThrow(() => assertQualityBaseline(quality(), baseline));
});

test("each quality regression blocks release", () => {
  for (const regression of [
    { specific_issuer_rate: 0.9331 },
    { specific_relation_rate: 0.9055 },
    { issuers_generic_only: 305 },
    { sparse_segments: Array(8).fill({}) },
  ]) {
    assert.throws(() => assertQualityBaseline(quality(regression), baseline));
  }
});
