const PUBLIC_TRANSMISSION_PATH = `${import.meta.env.BASE_URL}snapshots/transmission-v1.1.json`;

function normalizeGraphData(data, source) {
  if (!Array.isArray(data?.entities) || !Array.isArray(data?.relations) || !String(data?.meta?.contract_version || "").startsWith("1.1")) {
    throw new Error("The graph source does not implement the v1.1 transmission contract.");
  }
  return {
    ...data,
    source_documents: data.source_documents || [],
    claims: data.claims || [],
    shock_events: data.shock_events || [],
    meta: {
      source,
      ...data.meta,
    },
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "default" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

export async function loadGraphData() {
  const apiBase = import.meta.env.VITE_CHAINGRAPH_API_BASE?.replace(/\/$/, "");
  if (apiBase) {
    try {
      return normalizeGraphData(await fetchJson(`${apiBase}/api/transmission-graph`), "api");
    } catch (error) {
      console.warn("AI-ChainGraph v1.1 API unavailable, falling back to the public transmission view.", error);
    }
  }
  return normalizeGraphData(await fetchJson(PUBLIC_TRANSMISSION_PATH), "public_snapshot");
}
