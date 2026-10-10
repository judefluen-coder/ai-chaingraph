import test from "node:test";
import assert from "node:assert/strict";
import {
  findAmbiguousPhysicalIntegrations,
  findNewSemanticCandidates,
} from "../scripts/lib/semantic-precision.mjs";

const graph = {
  entities: [
    { id: "component:sensor", entity_type: "component" },
    { id: "application:ai", entity_type: "application" },
  ],
  claims: [
    { id: "claim:usage", excerpt: "公司材料用于传感器。" },
    { id: "claim:integration", excerpt: "公司将传感器集成于设备。" },
    { id: "claim:application", excerpt: "公司将AI用于内部流程。" },
    { id: "claim:english-usage", excerpt: "Its sensor components are used in industrial robots." },
    { id: "claim:english-integration", excerpt: "The company integrates sensors into industrial robots." },
  ],
  relations: [
    { id: "relation:usage", relation_type: "issuer_integrates", to_id: "component:sensor", claim_ids: ["claim:usage"] },
    { id: "relation:integration", relation_type: "issuer_integrates", to_id: "component:sensor", claim_ids: ["claim:integration"] },
    { id: "relation:application", relation_type: "issuer_integrates", to_id: "application:ai", claim_ids: ["claim:application"] },
    { id: "relation:english-usage", relation_type: "issuer_integrates", to_id: "component:sensor", claim_ids: ["claim:english-usage"] },
    { id: "relation:english-integration", relation_type: "issuer_integrates", to_id: "component:sensor", claim_ids: ["claim:english-integration"] },
  ],
};

test("usage-only wording on a physical target enters the semantic review queue", () => {
  const candidates = findAmbiguousPhysicalIntegrations(graph);
  assert.deepEqual(candidates.map(({ relation }) => relation.id), ["relation:english-usage", "relation:usage"]);
  assert.equal(findNewSemanticCandidates(candidates, ["relation:usage", "relation:english-usage"]).length, 0);
  assert.deepEqual(findNewSemanticCandidates(candidates, []).map(({ relation }) => relation.id), ["relation:english-usage", "relation:usage"]);
});
