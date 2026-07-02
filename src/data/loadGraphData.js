import demoGraph from "./demoGraph.json";

const PUBLIC_SNAPSHOT_PATH = "/snapshots/current.json";

function normalizeGraphData(data, source) {
  return {
    ...data,
    market_signals: data.market_signals || [],
    review_queue: data.review_queue || [],
    meta: {
      dataset_type: "demo",
      source_policy: "public_demo_only",
      source,
      ...data.meta,
    },
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function loadGraphData() {
  const apiBase = import.meta.env.VITE_CHAINGRAPH_API_BASE?.replace(/\/$/, "");
  if (apiBase) {
    try {
      return normalizeGraphData(await fetchJson(`${apiBase}/api/graph`), "api");
    } catch (error) {
      console.warn("AI-ChainGraph API unavailable, falling back to local snapshot/demo.", error);
    }
  }

  try {
    return normalizeGraphData(await fetchJson(PUBLIC_SNAPSHOT_PATH), "public_snapshot");
  } catch (error) {
    return normalizeGraphData(demoGraph, "demo");
  }
}

export { demoGraph };
