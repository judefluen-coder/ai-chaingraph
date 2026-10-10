import assert from "node:assert/strict";
import test from "node:test";
import { nextWeeklyCheckAt } from "../scripts/lib/weekly-schedule.mjs";

test("the next review follows the Monday 09:00 Shanghai cadence", () => {
  assert.equal(nextWeeklyCheckAt(new Date("2026-10-10T12:34:44.135Z")), "2026-10-12T01:00:00.000Z");
  assert.equal(nextWeeklyCheckAt(new Date("2026-10-12T00:59:59.000Z")), "2026-10-12T01:00:00.000Z");
  assert.equal(nextWeeklyCheckAt(new Date("2026-10-12T01:00:00.000Z")), "2026-10-19T01:00:00.000Z");
  assert.equal(nextWeeklyCheckAt(new Date("2026-12-31T16:00:00.000Z")), "2027-01-04T01:00:00.000Z");
  assert.throws(() => nextWeeklyCheckAt(new Date("invalid")), /valid check time/);
});
