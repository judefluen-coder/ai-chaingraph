import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildRelationshipQuality, SPECIFIC_RELATION_TYPES } from "./lib/relationship-quality.mjs";

const snapshotPath = resolve(
  process.cwd(),
  process.argv[2] || "public/snapshots/transmission-v1.1.json",
);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    invariant(typeof item?.id === "string" && item.id, `${label} contains an item without an id.`);
    invariant(!ids.has(item.id), `${label} contains duplicate id ${item.id}.`);
    ids.add(item.id);
  }
  return ids;
}

const graph = JSON.parse(await readFile(snapshotPath, "utf8"));
for (const key of ["entities", "relations", "source_documents", "claims", "shock_events"]) {
  invariant(Array.isArray(graph[key]), `${key} must be an array.`);
}

invariant(graph.meta?.contract_version === "1.1.0", "Expected transmission contract 1.1.0.");
invariant(graph.meta?.status === "ready", "The public snapshot must be release-ready.");

const entityIds = uniqueIds(graph.entities, "entities");
const relationIds = uniqueIds(graph.relations, "relations");
const sourceIds = uniqueIds(graph.source_documents, "source_documents");
const claimIds = uniqueIds(graph.claims, "claims");

const entityCounts = Object.groupBy(graph.entities, (entity) => entity.entity_type);
const issuerMappings = graph.relations.filter((relation) => relation.relation_type.startsWith("issuer_"));
const relationshipQuality = buildRelationshipQuality(graph);

const expectedCounts = {
  domains: entityCounts.domain?.length || 0,
  chains: entityCounts.chain?.length || 0,
  segments: entityCounts.segment?.length || 0,
  typed_elements: graph.relations.filter((relation) => relation.relation_type === "segment_has_element").length,
  issuers: entityCounts.issuer?.length || 0,
  securities: entityCounts.security?.length || 0,
  dependency_relations: graph.relations.filter((relation) => !relation.relation_type.startsWith("issuer_") && !["domain_has_chain", "chain_has_segment", "segment_has_element", "security_issued_by"].includes(relation.relation_type)).length,
  issuer_mappings: issuerMappings.length,
  specific_issuer_mappings: relationshipQuality.specific_relations,
  generic_issuer_mappings: relationshipQuality.generic_relations,
  claims: graph.claims.length,
  source_documents: graph.source_documents.length,
};

for (const [key, count] of Object.entries(expectedCounts)) {
  invariant(graph.meta?.counts?.[key] === count, `meta.counts.${key} does not match the snapshot.`);
}

for (const relation of graph.relations) {
  invariant(entityIds.has(relation.from_id), `${relation.id} has an unknown from_id.`);
  invariant(entityIds.has(relation.to_id), `${relation.id} has an unknown to_id.`);
  if (relation.relation_type === "issuer_participates_in_segment") {
    invariant(relation.to_id.startsWith("segment:"), `${relation.id} broad mapping must target a segment.`);
  }
  if (SPECIFIC_RELATION_TYPES.has(relation.relation_type)) {
    invariant(!relation.to_id.startsWith("segment:"), `${relation.id} specific mapping must target a typed element.`);
  }
  for (const claimId of relation.claim_ids || []) {
    invariant(claimIds.has(claimId), `${relation.id} references unknown claim ${claimId}.`);
  }
}

for (const claim of graph.claims) {
  invariant(sourceIds.has(claim.source_document_id), `${claim.id} references an unknown source document.`);
}

for (const source of graph.source_documents) {
  invariant(/^https:\/\//.test(source.url || ""), `${source.id} must use a public HTTPS URL.`);
  if (source.issuer_id) {
    invariant(entityIds.has(source.issuer_id), `${source.id} references unknown issuer ${source.issuer_id}.`);
  }
}

invariant(graph.meta?.refresh?.cadence === "weekly", "The public snapshot must declare its weekly refresh cadence.");
invariant(!Number.isNaN(Date.parse(graph.meta.refresh.last_checked_at)), "meta.refresh.last_checked_at must be an ISO timestamp.");
invariant(!Number.isNaN(Date.parse(graph.meta.refresh.next_scheduled_at)), "meta.refresh.next_scheduled_at must be an ISO timestamp.");
invariant(JSON.stringify(graph.meta.quality) === JSON.stringify(relationshipQuality), "meta.quality does not match the snapshot.");

console.log(JSON.stringify({
  contract: graph.meta.contract_version,
  entities: entityIds.size,
  relations: relationIds.size,
  issuers: expectedCounts.issuers,
  chains: expectedCounts.chains,
  issuerMappings: expectedCounts.issuer_mappings,
  specificIssuerRate: relationshipQuality.specific_issuer_rate,
  genericMappings: relationshipQuality.generic_relations,
  claims: claimIds.size,
  sources: sourceIds.size,
}, null, 2));
