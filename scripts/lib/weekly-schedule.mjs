const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function nextWeeklyCheckAt(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error("Expected a valid check time.");
  const local = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  const daysUntilMonday = (8 - local.getUTCDay()) % 7;
  let next = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysUntilMonday, 1);
  if (next <= now.getTime()) next += WEEK_MS;
  return new Date(next).toISOString();
}
