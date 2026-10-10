export const MAX_CHECK_AGE_DAYS = 8;

export function getRefreshStatus(refresh, now = Date.now()) {
  const checkedAt = Date.parse(refresh?.last_checked_at || "");
  const checkedDate = Number.isFinite(checkedAt) ? new Date(checkedAt).toISOString().slice(0, 10) : null;
  const ageDays = (now - checkedAt) / 86_400_000;

  if (!Number.isFinite(ageDays) || ageDays < 0) return { state: "unknown", checkedDate };
  return { state: ageDays > MAX_CHECK_AGE_DAYS ? "stale" : "current", checkedDate };
}
