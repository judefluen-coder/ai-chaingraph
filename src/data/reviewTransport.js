export function resolveReviewApiBase(env = import.meta.env) {
  return (env?.VITE_CHAINGRAPH_API_BASE || "").replace(/\/$/, "");
}

export async function submitReviewRecord(record, options = {}) {
  const apiBase = (options.apiBase ?? resolveReviewApiBase()).replace(/\/$/, "");
  if (!apiBase) return { source: "local", record };

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(`${apiBase}/api/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!response.ok) {
    throw new Error(`Review API failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return { source: "api", record: payload.record || record };
}
