import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  buildRelationshipQuality,
  maxSourceDate,
  promoteEvidenceBackedFallbacks,
} from "./lib/relationship-quality.mjs";
import {
  readAshareReconciliations,
  validateAshareReconciliations,
} from "./lib/listing-reconciliation.mjs";
import {
  applyCandidateBatch,
  assertCandidateBatchApplied,
  readApprovedCandidateBatches,
} from "./lib/weekly-batches.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const snapshotPath = resolve(projectRoot, "public/snapshots/transmission-v1.1.json");
const statusPath = resolve(projectRoot, "public/snapshots/update-status.json");
const nowArgument = process.argv.find((argument) => argument.startsWith("--at="));
const now = nowArgument ? new Date(nowArgument.slice(5)) : new Date();

if (Number.isNaN(now.getTime())) throw new Error("--at must contain a valid ISO date.");

function recomputeCounts(graph, quality) {
  const entityGroups = Object.groupBy(graph.entities, (entity) => entity.entity_type);
  graph.meta.counts = {
    ...graph.meta.counts,
    domains: entityGroups.domain?.length || 0,
    chains: entityGroups.chain?.length || 0,
    segments: entityGroups.segment?.length || 0,
    typed_elements: graph.relations.filter((relation) => relation.relation_type === "segment_has_element").length,
    issuers: entityGroups.issuer?.length || 0,
    securities: entityGroups.security?.length || 0,
    dependency_relations: graph.relations.filter((relation) => !relation.relation_type.startsWith("issuer_") && !["domain_has_chain", "chain_has_segment", "segment_has_element", "security_issued_by"].includes(relation.relation_type)).length,
    issuer_mappings: quality.issuer_relations_total,
    specific_issuer_mappings: quality.specific_relations,
    generic_issuer_mappings: quality.generic_relations,
    claims: graph.claims.length,
    source_documents: graph.source_documents.length,
  };
}

const graph = JSON.parse(await readFile(snapshotPath, "utf8"));
const previousRefresh = graph.meta.refresh || {};
const appliedBatchIds = new Set(graph.meta.refresh?.applied_batch_ids || []);
const approvedBatches = await readApprovedCandidateBatches(projectRoot);
const batches = approvedBatches.filter((batch) => !appliedBatchIds.has(batch.batch_id));
const imported = { batches: 0, entities: 0, issuers: 0, securities: 0, sources: 0, claims: 0, relations: 0 };

for (const batch of batches) {
  const result = applyCandidateBatch(graph, batch);
  imported.batches += 1;
  imported.entities += result.entitiesAdded;
  imported.issuers += result.issuersAdded;
  imported.securities += result.securitiesAdded;
  imported.sources += result.sourcesAdded;
  imported.claims += result.claimsAdded;
  imported.relations += result.relationsAdded;
  appliedBatchIds.add(batch.batch_id);
}
for (const batch of approvedBatches) assertCandidateBatchApplied(graph, batch);

graph.meta.refresh = {
  ...previousRefresh,
  applied_batch_ids: [...appliedBatchIds].sort(),
};
const listingReconciliation = validateAshareReconciliations(
  await readAshareReconciliations(projectRoot),
  graph,
);

const promotions = promoteEvidenceBackedFallbacks(graph);
const quality = buildRelationshipQuality(graph);
const checkedAt = now.toISOString();
const changed = imported.entities
  + imported.sources
  + imported.claims
  + imported.relations
  + promotions.promotedRelations
  + promotions.reclassifiedRelations
  + promotions.revertedRelations > 0;
const currentChangeSummary = { imported, promotions };
const nextScheduledAt = new Date(now);
nextScheduledAt.setUTCDate(nextScheduledAt.getUTCDate() + 7);

if (changed) {
  graph.meta.updated_at = checkedAt;
  if (graph.meta.data_version === "1.1.0") graph.meta.data_version = "1.2.0";
}

graph.meta.refresh = {
  cadence: "weekly",
  last_checked_at: checkedAt,
  last_changed_at: changed ? checkedAt : previousRefresh.last_changed_at || graph.meta.updated_at,
  next_scheduled_at: nextScheduledAt.toISOString(),
  source_cutoff_date: maxSourceDate(graph),
  mechanism: "reviewed_incremental_batches",
  a_share_listing_reconciled_through: listingReconciliation.reconciled_through,
  a_share_listing_reconciliation: listingReconciliation,
  applied_batch_ids: [...appliedBatchIds].sort(),
  last_change_summary: changed ? currentChangeSummary : previousRefresh.last_change_summary || null,
};
graph.meta.quality = quality;
recomputeCounts(graph, quality);

const status = {
  schema_version: "1.0.0",
  data_version: graph.meta.data_version,
  checked_at: checkedAt,
  changed_at: graph.meta.refresh.last_changed_at,
  next_scheduled_at: graph.meta.refresh.next_scheduled_at,
  source_cutoff_date: graph.meta.refresh.source_cutoff_date,
  cadence: graph.meta.refresh.cadence,
  a_share_listing_reconciled_through: graph.meta.refresh.a_share_listing_reconciled_through,
  a_share_listing_reconciliation: graph.meta.refresh.a_share_listing_reconciliation,
  changed,
  imported,
  promotions,
  last_change_summary: graph.meta.refresh.last_change_summary,
  quality,
};

await writeFile(snapshotPath, `${JSON.stringify(graph)}\n`, "utf8");
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  snapshot: basename(snapshotPath),
  status: basename(statusPath),
  dataVersion: graph.meta.data_version,
  changed,
  imported,
  promotions,
  quality: {
    issuers: quality.issuers_total,
    specificIssuers: quality.issuers_with_specific_relations,
    specificIssuerRate: quality.specific_issuer_rate,
    specificRelations: quality.specific_relations,
    genericRelations: quality.generic_relations,
    sparseSegments: quality.sparse_segments.length,
  },
  aShareListingReconciliation: listingReconciliation,
}, null, 2));
