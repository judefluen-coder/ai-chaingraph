const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export function assertNoFutureReleaseDates({ checkedAt, listingThrough, sourceCutoffDate }, now = new Date()) {
  const checkedTime = Date.parse(checkedAt || "");
  if (!Number.isFinite(checkedTime) || checkedTime > now.getTime() + CLOCK_SKEW_MS) {
    throw new Error("The weekly check time is missing, invalid, or in the future.");
  }

  const shanghaiToday = new Date(now.getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
  for (const [label, value] of [["A-share listing reconciliation", listingThrough], ["Official source cutoff", sourceCutoffDate]]) {
    if (!value) continue;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value > shanghaiToday) {
      throw new Error(`${label} date is invalid or in the future.`);
    }
  }
}
