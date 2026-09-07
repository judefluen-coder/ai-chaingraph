import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  buildRelationshipQuality,
  maxSourceDate,
  promoteEvidenceBackedFallbacks,
  SPECIFIC_RELATION_TYPES,
} from "./lib/relationship-quality.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const snapshotPath = resolve(projectRoot, "public/snapshots/transmission-v1.1.json");
const statusPath = resolve(projectRoot, "public/snapshots/update-status.json");
const candidateDirectory = resolve(projectRoot, "data/weekly-candidates");
const nowArgument = process.argv.find((argument) => argument.startsWith("--at="));
const now = nowArgument ? new Date(nowArgument.slice(5)) : new Date();

if (Number.isNaN(now.getTime())) throw new Error("--at must contain a valid ISO date.");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sameRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function addOrConfirm(collection, item, label) {
  invariant(item?.id, `${label} must include an id.`);
  const existing = collection.find((record) => record.id === item.id);
  if (existing) {
    invariant(sameRecord(existing, item), `${label} ${item.id} conflicts with the existing snapshot.`);
    return false;
  }
  collection.push(item);
  return true;
}

async function readCandidateBatches(appliedBatchIds) {
  let filenames = [];
  try {
    filenames = await readdir(candidateDirectory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const batches = [];
  for (const filename of filenames.filter((name) => name.endsWith(".batch.json")).sort()) {
    const batch = JSON.parse(await readFile(resolve(candidateDirectory, filename), "utf8"));
    invariant(batch.batch_id, `${filename} must include batch_id.`);
    invariant(batch.review_status === "approved", `${filename} has not been approved.`);
    invariant(batch.reviewed_at && batch.reviewer, `${filename} must include reviewer and reviewed_at.`);
    if (!appliedBatchIds.has(batch.batch_id)) batches.push({ ...batch, filename });
  }
  return batches;
}

function applyCandidateBatch(graph, batch) {
  const entityTypes = new Map(graph.entities.map((entity) => [entity.id, entity.entity_type]));
  const pendingSources = batch.source_documents || [];
  const pendingClaims = batch.claims || [];
  const pendingRelations = batch.relations || [];
  const knownSourceIds = new Set(graph.source_documents.map((source) => source.id).concat(pendingSources.map((source) => source.id)));
  const knownClaimIds = new Set(graph.claims.map((claim) => claim.id).concat(pendingClaims.map((claim) => claim.id)));

  for (const source of pendingSources) {
    invariant(/^https:\/\//.test(source.url || ""), `${batch.filename}: source ${source.id} must use HTTPS.`);
    invariant(source.publish_date && source.issuer_id, `${batch.filename}: source ${source.id} needs publish_date and issuer_id.`);
    invariant(entityTypes.get(source.issuer_id) === "issuer", `${batch.filename}: source ${source.id} references an unknown issuer.`);
  }
  for (const claim of pendingClaims) {
    invariant(knownSourceIds.has(claim.source_document_id), `${batch.filename}: claim ${claim.id} references an unknown source.`);
    invariant(claim.excerpt && claim.reviewed_at, `${batch.filename}: claim ${claim.id} needs excerpt and reviewed_at.`);
  }
  for (const relation of pendingRelations) {
    const targetType = entityTypes.get(relation.to_id);
    invariant(SPECIFIC_RELATION_TYPES.has(relation.relation_type), `${batch.filename}: relation ${relation.id} must use a specific issuer action.`);
    invariant(entityTypes.get(relation.from_id) === "issuer", `${batch.filename}: relation ${relation.id} must start at an issuer.`);
    invariant(targetType && !["domain", "chain", "segment", "issuer", "security"].includes(targetType), `${batch.filename}: relation ${relation.id} must target a typed industry element.`);
    invariant(["L1", "L2"].includes(relation.evidence_level), `${batch.filename}: relation ${relation.id} must use L1 or L2 evidence.`);
    invariant(relation.claim_ids?.length > 0, `${batch.filename}: relation ${relation.id} needs at least one claim.`);
    invariant(relation.claim_ids.every((claimId) => knownClaimIds.has(claimId)), `${batch.filename}: relation ${relation.id} references an unknown claim.`);
  }

  let sourcesAdded = 0;
  let claimsAdded = 0;
  let relationsAdded = 0;
  for (const source of pendingSources) sourcesAdded += Number(addOrConfirm(graph.source_documents, source, "source"));
  for (const claim of pendingClaims) claimsAdded += Number(addOrConfirm(graph.claims, claim, "claim"));
  for (const relation of pendingRelations) {
    if (relation.replaces_relation_id) {
      graph.relations = graph.relations.filter((existing) => existing.id !== relation.replaces_relation_id);
    }
    const { replaces_relation_id: replacedRelationId, ...publishedRelation } = relation;
    relationsAdded += Number(addOrConfirm(graph.relations, {
      ...publishedRelation,
      attributes: {
        ...relation.attributes,
        update_batch_id: batch.batch_id,
        ...(replacedRelationId ? { replaces_relation_id: replacedRelationId } : {}),
        mapping_precision: relation.attributes?.mapping_precision || "reviewed_typed_anchor",
      },
    }, "relation"));
  }
  return { sourcesAdded, claimsAdded, relationsAdded };
}

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
const appliedBatchIds = new Set(graph.meta.refresh?.applied_batch_ids || []);
const batches = await readCandidateBatches(appliedBatchIds);
const imported = { batches: 0, sources: 0, claims: 0, relations: 0 };

for (const batch of batches) {
  const result = applyCandidateBatch(graph, batch);
  imported.batches += 1;
  imported.sources += result.sourcesAdded;
  imported.claims += result.claimsAdded;
  imported.relations += result.relationsAdded;
  appliedBatchIds.add(batch.batch_id);
}

const promotions = promoteEvidenceBackedFallbacks(graph);
const quality = buildRelationshipQuality(graph);
const checkedAt = now.toISOString();
const changed = imported.sources
  + imported.claims
  + imported.relations
  + promotions.promotedRelations
  + promotions.reclassifiedRelations
  + promotions.revertedRelations > 0;
const previousRefresh = graph.meta.refresh || {};
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
}, null, 2));
