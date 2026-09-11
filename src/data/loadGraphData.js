const PUBLIC_TRANSMISSION_PATH = `${import.meta.env.BASE_URL}snapshots/transmission-v1.1.json`;

function normalizeGraphData(data) {
  if (!Array.isArray(data?.entities) || !Array.isArray(data?.relations) || !String(data?.meta?.contract_version || "").startsWith("1.1")) {
    throw new Error("The graph source does not implement the v1.1 transmission contract.");
  }
  return {
    ...data,
    source_documents: data.source_documents || [],
    claims: data.claims || [],
    shock_events: data.shock_events || [],
    meta: {
      ...data.meta,
      source: "public_snapshot",
    },
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "default" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

export async function loadGraphData() {
  const [data, history] = await Promise.all([
    fetchJson(PUBLIC_TRANSMISSION_PATH),
    fetchJson(`${import.meta.env.BASE_URL}snapshots/release-history.json`).catch(() => null),
  ]);
  const validHistory = history?.schema_version === "1.0.0" && history.data_updated_at === data.meta?.updated_at
    && Array.isArray(history.events) && Array.isArray(history.batches) && Array.isArray(history.archived_relations);
  return { ...normalizeGraphData(data), release_history: validHistory ? history : null, releaseHistoryError: !validHistory };
}
