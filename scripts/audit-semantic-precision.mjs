import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  findAmbiguousPhysicalIntegrations,
  findNewSemanticCandidates,
} from "./lib/semantic-precision.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const graph = JSON.parse(await readFile(resolve(projectRoot, "public/snapshots/transmission-v1.1.json"), "utf8"));
const candidates = findAmbiguousPhysicalIntegrations(graph);

if (process.argv.includes("--list-ids")) {
  console.log(JSON.stringify(candidates.map(({ relation }) => relation.id), null, 2));
} else {
  const baseline = JSON.parse(await readFile(resolve(projectRoot, "scripts/semantic-review-backlog.json"), "utf8"));
  const newCandidates = findNewSemanticCandidates(candidates, baseline.unresolved_relation_ids);
  const candidateIds = new Set(candidates.map(({ relation }) => relation.id));
  const resolvedFromBacklog = baseline.unresolved_relation_ids.filter((id) => !candidateIds.has(id));
  console.log(JSON.stringify({
    review_status: "unresolved_candidates_not_approved_evidence",
    ambiguous_physical_integrations: candidates.length,
    resolved_from_backlog: resolvedFromBacklog.length,
    new_unreviewed_candidates: newCandidates.map(({ relation }) => relation.id),
    sample: candidates.slice(0, 5).map(({ relation, excerpt }) => ({
      relation_id: relation.id,
      from_id: relation.from_id,
      to_id: relation.to_id,
      excerpt: excerpt.slice(0, 160),
    })),
  }, null, 2));
  if (newCandidates.length > 0) {
    throw new Error(`${newCandidates.length} new usage-only physical integration mapping(s) need manual review before release.`);
  }
}
