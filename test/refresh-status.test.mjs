import test from "node:test";
import assert from "node:assert/strict";
import { getRefreshStatus, MAX_CHECK_AGE_DAYS } from "../src/lib/refreshStatus.js";

const checkedAt = "2026-09-21T02:08:07.988Z";
const checkedTime = Date.parse(checkedAt);

test("uses the same eight-day freshness boundary as the release audit", () => {
  assert.equal(MAX_CHECK_AGE_DAYS, 8);
  assert.deepEqual(getRefreshStatus({ last_checked_at: checkedAt }, checkedTime + 8 * 86_400_000), {
    state: "current",
    checkedDate: "2026-09-21",
  });
  assert.equal(getRefreshStatus({ last_checked_at: checkedAt }, checkedTime + 8 * 86_400_000 + 1).state, "stale");
});

test("does not treat missing or future checks as current", () => {
  assert.deepEqual(getRefreshStatus({}, checkedTime), { state: "unknown", checkedDate: null });
  assert.equal(getRefreshStatus({ last_checked_at: checkedAt }, checkedTime - 1).state, "unknown");
});
