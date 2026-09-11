import test from "node:test";
import assert from "node:assert/strict";
import { relationEvents, issuerEvents, historicalRelation } from "../src/lib/releaseHistory.js";
import { buildRelationDetailModel } from "../src/lib/transmissionViewModel.js";

test("history links both sides of a replacement and keeps unrelated issuers separate", () => {
  const history = { events: [
    { id: "1", relation_id: "old", issuer_id: "a", recorded_at: "2026-09-01" },
    { id: "2", relation_id: "new", replaces_relation_id: "old", issuer_id: "a", recorded_at: "2026-09-02" },
    { id: "3", relation_id: "other", issuer_id: "b", recorded_at: "2026-09-03" },
  ] };
  assert.deepEqual(relationEvents(history, "old").map((e) => e.id), ["2", "1"]);
  assert.equal(issuerEvents(history, "a").length, 2);
  assert.deepEqual(relationEvents(null, "missing"), []);
});

test("an archived relation resolves its original evidence without entering current relations", () => {
  const archived = { id: "old", from_id: "issuer:a", to_id: "product:a", relation_type: "issuer_produces", claim_ids: ["claim:a"], lifecycle_status: "withdrawn" };
  const graph = { entities: [{ id: "issuer:a", entity_type: "issuer" }, { id: "product:a", entity_type: "product" }], relations: [], claims: [{ id: "claim:a", source_document_id: "source:a" }], source_documents: [{ id: "source:a", title: "Original filing" }], release_history: { archived_relations: [archived] } };
  const detail = buildRelationDetailModel(graph, "old");
  assert.equal(detail.relation.lifecycle_status, "withdrawn");
  assert.equal(detail.evidence[0].source.title, "Original filing");
  assert.equal(graph.relations.length, 0);
  assert.equal(historicalRelation(graph.release_history, "missing"), null);
});
