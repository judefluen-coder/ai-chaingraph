import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readApprovedCandidateBatches } from "./lib/weekly-batches.mjs";

const root = resolve(import.meta.dirname, "..");
const graph = JSON.parse(await readFile(resolve(root, "public/snapshots/transmission-v1.1.json"), "utf8"));
const applied = new Set(graph.meta.refresh?.applied_batch_ids || []);
const batches = (await readApprovedCandidateBatches(root)).filter((batch) => applied.has(batch.batch_id));
const events = batches.flatMap((batch) => batch.relations
  .filter((relation) => relation.relation_type.startsWith("issuer_"))
  .map((relation) => ({
    id: `${batch.batch_id}:${relation.id}`,
    batch_id: batch.batch_id,
    relation_id: relation.id,
    issuer_id: relation.from_id,
    target_id: relation.to_id,
    relation_type: relation.relation_type,
    kind: relation.replaces_relation_id ? "replaced" : "added",
    recorded_at: batch.reviewed_at,
    effective_at: relation.effective_at || null,
    reviewer: batch.reviewer,
    ...(relation.replaces_relation_id ? { replaces_relation_id: relation.replaces_relation_id } : {}),
  })));

// A missing current record may only be archived when a later batch explicitly replaces it.
const currentIds = new Set(graph.relations.map((relation) => relation.id));
const archivedRelations = batches.flatMap((batch) => batch.relations).filter((relation) => !currentIds.has(relation.id)).map((relation) => {
  const replacement = events.find((event) => event.replaces_relation_id === relation.id);
  if (!replacement) throw new Error(`Missing published relation without a replacement: ${relation.id}`);
  return { ...relation, lifecycle_status: "superseded", replacement_relation_id: replacement.relation_id };
});
const history = {
  schema_version: "1.0.0",
  data_updated_at: graph.meta.updated_at,
  batches: batches.map((batch) => ({ id: batch.batch_id, reviewed_at: batch.reviewed_at })),
  events,
  archived_relations: archivedRelations,
};
await writeFile(resolve(root, "public/snapshots/release-history.json"), `${JSON.stringify(history, null, 2)}\n`);
console.log(`Release history: ${batches.length} batches, ${events.length} relationship events.`);
