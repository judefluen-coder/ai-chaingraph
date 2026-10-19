import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

export const repositoryRoot = resolve(import.meta.dirname, "..");

export function parseDataset(graphText, historyText = null, reviewText = "") {
  const graph = JSON.parse(graphText);
  if (graph.meta?.contract_version !== "1.1.0" || !graph.meta.updated_at
    || ![graph.entities, graph.relations, graph.claims, graph.source_documents].every(Array.isArray)) {
    throw new Error("Invalid v1.1 graph snapshot. Run npm run validate:snapshot.");
  }
  let history = null;
  let historyStatus = "missing";
  if (historyText !== null) {
    try {
      const candidate = JSON.parse(historyText);
      if (candidate.schema_version === "1.0.0" && candidate.data_updated_at === graph.meta.updated_at
        && [candidate.events, candidate.batches, candidate.archived_relations].every(Array.isArray)) {
        history = candidate;
        historyStatus = "available";
      } else historyStatus = "mismatched";
    } catch {
      historyStatus = "invalid";
    }
  }
  // Bind queries to exact graph, history and semantic-review bytes for this process.
  const snapshotId = createHash("sha256").update(JSON.stringify([graphText, historyText, reviewText])).digest("hex");
  return { graph, history, historyStatus, snapshotId };
}

export async function loadDataset() {
  const graphText = await readFile(resolve(repositoryRoot, "public/snapshots/transmission-v1.1.json"), "utf8");
  const reviewText = await readFile(resolve(repositoryRoot, "scripts/semantic-review-backlog.json"), "utf8");
  let historyText = null;
  try {
    historyText = await readFile(resolve(repositoryRoot, "public/snapshots/release-history.json"), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return parseDataset(graphText, historyText, reviewText);
}
