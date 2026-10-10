import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCandidateBatch,
  assertCandidateBatchApplied,
} from "../scripts/lib/weekly-batches.mjs";
import { searchTransmissionGraph } from "../src/lib/transmissionViewModel.js";

function fixture() {
  return {
    entities: [{ id: "component:dram", entity_type: "component", name: "DRAM" }],
    relations: [],
    claims: [],
    source_documents: [],
  };
}

function newListingBatch() {
  return {
    batch_id: "weekly-test-listing",
    entities: [
      { id: "issuer:test", entity_type: "issuer", name: "测试科技", aliases: ["测试存储"], country: "CN" },
      { id: "security:SH:688999", entity_type: "security", name: "测试科技", stock_code: "688999.SH", symbol: "688999", exchange: "SH", security_type: "ordinary_share", listing_status: "active", currency: "CNY" },
    ],
    source_documents: [
      { id: "source:test-listing", url: "https://example.com/listing", publish_date: "2026-09-01", issuer_id: "issuer:test" },
      { id: "source:test-business", url: "https://example.com/business", publish_date: "2026-08-01", issuer_id: "issuer:test" },
    ],
    claims: [
      { id: "claim:test-listing", source_document_id: "source:test-listing", excerpt: "测试科技股票上市交易。", reviewed_at: "2026-09-01T00:00:00Z" },
      { id: "claim:test-business", source_document_id: "source:test-business", excerpt: "测试科技生产DRAM。", reviewed_at: "2026-09-01T00:00:00Z" },
    ],
    relations: [
      { id: "relation:test-listing", relation_type: "security_issued_by", from_id: "security:SH:688999", to_id: "issuer:test", evidence_level: "L1", claim_ids: ["claim:test-listing"] },
      { id: "relation:test-business", relation_type: "issuer_produces", from_id: "issuer:test", to_id: "component:dram", evidence_level: "L1", claim_ids: ["claim:test-business"] },
    ],
  };
}

test("imports a reviewed issuer and security with listing and industry evidence", () => {
  const graph = fixture();
  const result = applyCandidateBatch(graph, newListingBatch());

  assert.deepEqual(result, {
    entitiesAdded: 2,
    issuersAdded: 1,
    securitiesAdded: 1,
    sourcesAdded: 2,
    claimsAdded: 2,
    relationsAdded: 2,
    relationsWithdrawn: 0,
  });
  assert.equal(searchTransmissionGraph(graph, "测试存储")[0].id, "issuer:test");
  assert.equal(searchTransmissionGraph(graph, "688999")[0].id, "issuer:test");
});

test("rejects a new issuer without an issuance relation", () => {
  const graph = fixture();
  const batch = newListingBatch();
  batch.relations = batch.relations.filter((relation) => relation.relation_type !== "security_issued_by");

  assert.throws(() => applyCandidateBatch(graph, batch), /needs an issuance relation/);
});

test("detects drift between an approved batch and the published snapshot", () => {
  const graph = fixture();
  const batch = newListingBatch();
  const approvedBatch = structuredClone(batch);
  applyCandidateBatch(graph, batch);
  assert.doesNotThrow(() => assertCandidateBatchApplied(graph, approvedBatch));

  graph.claims.find((claim) => claim.id === "claim:test-business").excerpt = "Drifted claim";
  assert.throws(
    () => assertCandidateBatchApplied(graph, approvedBatch),
    /differs from its approved batch/,
  );
});

test("withdraws a reviewed issuer mapping without erasing its audit record", () => {
  const graph = fixture();
  const listing = newListingBatch();
  applyCandidateBatch(graph, listing);
  const relation = structuredClone(graph.relations.find((item) => item.id === "relation:test-business"));
  const withdrawal = {
    batch_id: "weekly-test-withdrawal",
    withdrawn_relations: [{
      relation,
      source_document_id: "source:test-business",
      reason: "The filing describes a component, not DRAM production.",
    }],
  };

  const result = applyCandidateBatch(graph, withdrawal);
  assert.equal(result.relationsWithdrawn, 1);
  assert.equal(graph.relations.some((item) => item.id === relation.id), false);
  assert.doesNotThrow(() => assertCandidateBatchApplied(graph, listing, new Set([relation.id])));
  assert.doesNotThrow(() => assertCandidateBatchApplied(graph, withdrawal));

  graph.relations.push(relation);
  assert.throws(() => assertCandidateBatchApplied(graph, withdrawal), /still published/);
});

test("rejects withdrawals without matching original evidence", () => {
  const graph = fixture();
  applyCandidateBatch(graph, newListingBatch());
  const relation = structuredClone(graph.relations.find((item) => item.id === "relation:test-business"));
  const originalTargetId = relation.to_id;
  const withdrawal = {
    batch_id: "weekly-test-withdrawal",
    withdrawn_relations: [{ relation, source_document_id: "source:test-business", reason: "Unsupported." }],
  };

  withdrawal.withdrawn_relations[0].relation.to_id = "component:other";
  assert.throws(() => applyCandidateBatch(graph, withdrawal), /must match the published record/);
  withdrawal.withdrawn_relations[0].relation.to_id = originalTargetId;
  withdrawal.withdrawn_relations[0].source_document_id = "source:test-listing";
  assert.throws(() => applyCandidateBatch(graph, withdrawal), /must review its original evidence/);
  withdrawal.withdrawn_relations[0].source_document_id = "source:test-business";
  withdrawal.withdrawn_relations[0].reason = "";
  assert.throws(() => applyCandidateBatch(graph, withdrawal), /needs a reason and review source/);
});
