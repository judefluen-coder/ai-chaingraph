import assert from "node:assert/strict";
import test from "node:test";
import { assertNoFutureReleaseDates } from "../scripts/lib/release-dates.mjs";

const now = new Date("2026-10-10T12:00:00.000Z");
const current = {
  checkedAt: "2026-10-10T12:00:00.000Z",
  listingThrough: "2026-10-10",
  sourceCutoffDate: "2026-10-09",
};

test("release dates allow the Shanghai day and modest clock skew", () => {
  assert.doesNotThrow(() => assertNoFutureReleaseDates(current, now));
  assert.doesNotThrow(() => assertNoFutureReleaseDates({ ...current, checkedAt: "2026-10-10T12:05:00.000Z" }, now));
  assert.doesNotThrow(() => assertNoFutureReleaseDates({ ...current, listingThrough: "2026-10-11" }, new Date("2026-10-10T17:00:00.000Z")));
});

test("release dates reject future checks, listings, and sources", () => {
  assert.throws(() => assertNoFutureReleaseDates({ ...current, checkedAt: "2026-10-10T12:05:01.000Z" }, now), /weekly check time/);
  assert.throws(() => assertNoFutureReleaseDates({ ...current, listingThrough: "2026-10-11" }, now), /listing reconciliation/);
  assert.throws(() => assertNoFutureReleaseDates({ ...current, sourceCutoffDate: "2026-10-11" }, now), /source cutoff/);
  assert.throws(() => assertNoFutureReleaseDates({ ...current, sourceCutoffDate: "2026-02-30" }, now), /source cutoff/);
});
