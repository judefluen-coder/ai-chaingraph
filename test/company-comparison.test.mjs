import assert from "node:assert/strict";
import test from "node:test";
import { buildCompanyComparison, comparisonSearch, normalizeComparisonIds } from "../src/lib/companyComparison.js";
import { parseWorkspaceSearch, serializeWorkspaceSearch } from "../src/lib/workspaceState.js";

const graph = {
  entities: [
    { id: "issuer:a", entity_type: "issuer", name: "A" },
    { id: "issuer:b", entity_type: "issuer", name: "B" },
    { id: "product:chip", entity_type: "product", name: "Chip" },
  ],
  relations: ["a", "b"].map((id) => ({ id: `relation:${id}`, from_id: `issuer:${id}`, to_id: "product:chip", relation_type: "issuer_develops", evidence_claim_ids: [] })),
  claims: [], sources: [],
};

test("comparison IDs are unique, bounded and restricted to issuers", () => {
  assert.deepEqual(normalizeComparisonIds([null, "product:x", "issuer:a", "issuer:a", "issuer:b", "issuer:c", "issuer:d", "issuer:e"]), ["issuer:a", "issuer:b", "issuer:c", "issuer:d"]);
});

test("comparison ignores missing companies and identifies shared positions", () => {
  const result = buildCompanyComparison(graph, ["issuer:a", "issuer:missing", "issuer:b"]);
  assert.equal(result.companies.length, 2);
  assert.deepEqual([...result.sharedElementIds], ["product:chip"]);
  assert.equal(buildCompanyComparison(graph, ["issuer:a"]).sharedElementIds.size, 0);
});

test("comparison deep links round trip without private notes or searches", () => {
  const ids = ["issuer:a", "issuer:b"];
  const search = comparisonSearch(ids, "en");
  assert.deepEqual(parseWorkspaceSearch(search).comparisonIds, ids);
  assert.equal(parseWorkspaceSearch(search).locale, "en");
  assert.equal(new URLSearchParams(search).has("q"), false);
  assert.deepEqual(parseWorkspaceSearch(serializeWorkspaceSearch({ comparisonIds: ids })).comparisonIds, ids);
  assert.deepEqual(parseWorkspaceSearch("").comparisonIds, []);
});
