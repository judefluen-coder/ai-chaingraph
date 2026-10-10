import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { SPECIFIC_RELATION_TYPES } from "./relationship-quality.mjs";

const NEW_ENTITY_TYPES = new Set(["issuer", "security"]);

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

function publishedRelation(relation, batchId) {
  const { replaces_relation_id: replacedRelationId, ...record } = relation;
  return {
    ...record,
    attributes: relation.relation_type === "security_issued_by" ? relation.attributes : {
      ...relation.attributes,
      update_batch_id: batchId,
      ...(replacedRelationId ? { replaces_relation_id: replacedRelationId } : {}),
      mapping_precision: relation.attributes?.mapping_precision || "reviewed_typed_anchor",
    },
  };
}

export async function readApprovedCandidateBatches(projectRoot) {
  const directory = resolve(projectRoot, "data/weekly-candidates");
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith(".batch.json"))
    .sort();
  const batches = [];

  for (const filename of filenames) {
    const batch = JSON.parse(await readFile(resolve(directory, filename), "utf8"));
    invariant(batch.batch_id, `${filename} must include batch_id.`);
    invariant(batch.review_status === "approved", `${filename} has not been approved.`);
    invariant(batch.reviewed_at && batch.reviewer, `${filename} must include reviewer and reviewed_at.`);
    batches.push({ ...batch, filename });
  }
  return batches;
}

export function assertCandidateBatchApplied(graph, batch, archivedRelationIds = new Set()) {
  const filename = batch.filename || batch.batch_id;
  const collections = [
    [graph.entities, batch.entities || [], "entity"],
    [graph.source_documents, batch.source_documents || [], "source"],
    [graph.claims, batch.claims || [], "claim"],
  ];

  for (const [published, expected, label] of collections) {
    const byId = new Map(published.map((record) => [record.id, record]));
    for (const record of expected) {
      invariant(sameRecord(byId.get(record.id), record), `${filename}: applied ${label} ${record.id} differs from its approved batch.`);
    }
  }

  const relationsById = new Map(graph.relations.map((relation) => [relation.id, relation]));
  for (const relation of batch.relations || []) {
    if (archivedRelationIds.has(relation.id)) {
      invariant(!relationsById.has(relation.id), `${filename}: archived relation ${relation.id} is still published.`);
      continue;
    }
    invariant(
      sameRecord(relationsById.get(relation.id), publishedRelation(relation, batch.batch_id)),
      `${filename}: applied relation ${relation.id} differs from its approved batch.`,
    );
  }
  for (const withdrawal of batch.withdrawn_relations || []) {
    invariant(!relationsById.has(withdrawal.relation.id), `${filename}: withdrawn relation ${withdrawal.relation.id} is still published.`);
  }
}

export function applyCandidateBatch(graph, batch) {
  const filename = batch.filename || batch.batch_id;
  const pendingEntities = batch.entities || [];
  const pendingSources = batch.source_documents || [];
  const pendingClaims = batch.claims || [];
  const pendingRelations = batch.relations || [];
  const withdrawals = batch.withdrawn_relations || [];
  const entityTypes = new Map(graph.entities.map((entity) => [entity.id, entity.entity_type]));
  const existingEntities = new Map(graph.entities.map((entity) => [entity.id, entity]));

  for (const entity of pendingEntities) {
    invariant(entity?.id && NEW_ENTITY_TYPES.has(entity.entity_type), `${filename}: new entities must be issuers or securities.`);
    invariant(!existingEntities.has(entity.id) || sameRecord(existingEntities.get(entity.id), entity), `${filename}: entity ${entity.id} conflicts with the existing snapshot.`);
    invariant(!entityTypes.has(entity.id) || entityTypes.get(entity.id) === entity.entity_type, `${filename}: entity ${entity.id} changes type.`);
    if (entity.entity_type === "issuer") {
      invariant(entity.id.startsWith("issuer:") && entity.name && entity.country, `${filename}: issuer ${entity.id} needs a name and country.`);
    } else {
      invariant(entity.id.startsWith("security:") && entity.name && entity.symbol && entity.stock_code && entity.exchange, `${filename}: security ${entity.id} needs listing identifiers.`);
      invariant(entity.listing_status === "active", `${filename}: newly imported security ${entity.id} must be active.`);
      invariant(entity.security_type && entity.currency, `${filename}: security ${entity.id} needs security_type and currency.`);
    }
    entityTypes.set(entity.id, entity.entity_type);
  }

  const knownSourceIds = new Set(graph.source_documents.map((source) => source.id).concat(pendingSources.map((source) => source.id)));
  const knownClaimIds = new Set(graph.claims.map((claim) => claim.id).concat(pendingClaims.map((claim) => claim.id)));
  const sourcesById = new Map(graph.source_documents.concat(pendingSources).map((source) => [source.id, source]));
  const claimsById = new Map(graph.claims.concat(pendingClaims).map((claim) => [claim.id, claim]));

  for (const source of pendingSources) {
    invariant(/^https:\/\//.test(source.url || ""), `${filename}: source ${source.id} must use HTTPS.`);
    invariant(source.publish_date && source.issuer_id, `${filename}: source ${source.id} needs publish_date and issuer_id.`);
    invariant(entityTypes.get(source.issuer_id) === "issuer", `${filename}: source ${source.id} references an unknown issuer.`);
  }
  for (const claim of pendingClaims) {
    invariant(knownSourceIds.has(claim.source_document_id), `${filename}: claim ${claim.id} references an unknown source.`);
    invariant(claim.excerpt && claim.reviewed_at, `${filename}: claim ${claim.id} needs excerpt and reviewed_at.`);
  }
  for (const relation of pendingRelations) {
    invariant(entityTypes.has(relation.from_id) && entityTypes.has(relation.to_id), `${filename}: relation ${relation.id} references an unknown entity.`);
    invariant(relation.claim_ids?.length > 0, `${filename}: relation ${relation.id} needs at least one claim.`);
    invariant(relation.claim_ids.every((claimId) => knownClaimIds.has(claimId)), `${filename}: relation ${relation.id} references an unknown claim.`);

    if (relation.relation_type === "security_issued_by") {
      invariant(entityTypes.get(relation.from_id) === "security", `${filename}: issuance ${relation.id} must start at a security.`);
      invariant(entityTypes.get(relation.to_id) === "issuer", `${filename}: issuance ${relation.id} must end at an issuer.`);
      invariant(relation.evidence_level === "L1", `${filename}: issuance ${relation.id} must use L1 exchange evidence.`);
      continue;
    }

    const targetType = entityTypes.get(relation.to_id);
    invariant(SPECIFIC_RELATION_TYPES.has(relation.relation_type), `${filename}: relation ${relation.id} must use a specific issuer action.`);
    invariant(entityTypes.get(relation.from_id) === "issuer", `${filename}: relation ${relation.id} must start at an issuer.`);
    invariant(!["domain", "chain", "segment", "issuer", "security"].includes(targetType), `${filename}: relation ${relation.id} must target a typed industry element.`);
    invariant(["L1", "L2"].includes(relation.evidence_level), `${filename}: relation ${relation.id} must use L1 or L2 evidence.`);
    invariant(relation.claim_ids.every((claimId) => sourcesById.get(claimsById.get(claimId)?.source_document_id)?.issuer_id === relation.from_id), `${filename}: relation ${relation.id} must cite evidence for its issuer.`);
  }
  const withdrawnIds = new Set();
  for (const withdrawal of withdrawals) {
    const relation = withdrawal.relation;
    const current = graph.relations.find((item) => item.id === relation?.id);
    invariant(relation?.id && !withdrawnIds.has(relation.id), `${filename}: withdrawn relations need unique ids.`);
    invariant(current && sameRecord(current, relation), `${filename}: withdrawn relation ${relation.id} must match the published record.`);
    invariant(relation.relation_type.startsWith("issuer_") && entityTypes.get(relation.from_id) === "issuer", `${filename}: only issuer mappings can be withdrawn.`);
    invariant(withdrawal.reason && withdrawal.source_document_id, `${filename}: withdrawal ${relation.id} needs a reason and review source.`);
    invariant(sourcesById.get(withdrawal.source_document_id)?.issuer_id === relation.from_id, `${filename}: withdrawal ${relation.id} needs a source for its issuer.`);
    invariant(relation.claim_ids?.some((claimId) => claimsById.get(claimId)?.source_document_id === withdrawal.source_document_id), `${filename}: withdrawal ${relation.id} must review its original evidence.`);
    invariant(!pendingRelations.some((item) => item.replaces_relation_id === relation.id), `${filename}: relation ${relation.id} cannot be replaced and withdrawn together.`);
    withdrawnIds.add(relation.id);
  }

  const newIssuers = pendingEntities.filter((entity) => entity.entity_type === "issuer");
  const newSecurities = pendingEntities.filter((entity) => entity.entity_type === "security");
  for (const issuer of newIssuers) {
    invariant(pendingRelations.some((relation) => relation.from_id === issuer.id && SPECIFIC_RELATION_TYPES.has(relation.relation_type)), `${filename}: new issuer ${issuer.id} needs a specific industry mapping.`);
  }
  for (const security of newSecurities) {
    invariant(pendingRelations.some((relation) => relation.from_id === security.id && relation.relation_type === "security_issued_by"), `${filename}: new security ${security.id} needs an issuance relation.`);
  }

  let entitiesAdded = 0;
  let issuersAdded = 0;
  let securitiesAdded = 0;
  let sourcesAdded = 0;
  let claimsAdded = 0;
  let relationsAdded = 0;
  let relationsWithdrawn = 0;
  for (const entity of pendingEntities) {
    const added = addOrConfirm(graph.entities, entity, "entity");
    entitiesAdded += Number(added);
    issuersAdded += Number(added && entity.entity_type === "issuer");
    securitiesAdded += Number(added && entity.entity_type === "security");
  }
  for (const source of pendingSources) sourcesAdded += Number(addOrConfirm(graph.source_documents, source, "source"));
  for (const claim of pendingClaims) claimsAdded += Number(addOrConfirm(graph.claims, claim, "claim"));
  for (const relation of pendingRelations) {
    if (relation.replaces_relation_id) {
      graph.relations = graph.relations.filter((existing) => existing.id !== relation.replaces_relation_id);
    }
    relationsAdded += Number(addOrConfirm(graph.relations, publishedRelation(relation, batch.batch_id), "relation"));
  }
  if (withdrawnIds.size) {
    graph.relations = graph.relations.filter((relation) => {
      if (!withdrawnIds.has(relation.id)) return true;
      relationsWithdrawn += 1;
      return false;
    });
  }
  return { entitiesAdded, issuersAdded, securitiesAdded, sourcesAdded, claimsAdded, relationsAdded, relationsWithdrawn };
}
