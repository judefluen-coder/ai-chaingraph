import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRelationshipQuality,
  inferSpecificRelation,
  promoteEvidenceBackedFallbacks,
} from "../scripts/lib/relationship-quality.mjs";

test("infers explicit issuer actions from reviewed evidence", () => {
  assert.equal(inferSpecificRelation("公司量产高速连接器").relationType, "issuer_produces");
  assert.equal(inferSpecificRelation("公司研发企业大模型").relationType, "issuer_develops");
  assert.equal(inferSpecificRelation("公司运营数据中心").relationType, "issuer_operates");
  assert.equal(inferSpecificRelation("公司向客户提供云服务").relationType, "issuer_provides");
  assert.equal(inferSpecificRelation("公司把 AI 集成到安全产品中").relationType, "issuer_integrates");
  assert.equal(inferSpecificRelation("公司从事智能终端分销").relationType, "issuer_distributes");
  assert.notEqual(inferSpecificRelation("公司提供数据中心配电设备")?.relationType, "issuer_distributes");
  assert.equal(inferSpecificRelation("公司主要产品包括高速连接器", "component").relationType, "issuer_produces");
  assert.equal(inferSpecificRelation("公司构建企业智能体平台", "service").relationType, "issuer_develops");
  assert.equal(inferSpecificRelation("公司在线上线下渠道销售智能眼镜", "service").relationType, "issuer_distributes");
  assert.equal(inferSpecificRelation("公司关注人工智能机会"), null);
});

test("promotes only a broad mapping with a public evidence chain and typed anchor", () => {
  const graph = {
    entities: [
      { id: "issuer:test", entity_type: "issuer", name: "Test" },
      { id: "segment:test", entity_type: "segment", name: "Test segment" },
      { id: "product:test", entity_type: "product", name: "Test product" },
      { id: "security:test", entity_type: "security", name: "TEST" },
    ],
    relations: [
      { id: "anchor", relation_type: "segment_has_element", from_id: "segment:test", to_id: "product:test" },
      {
        id: "mapping",
        relation_type: "issuer_participates_in_segment",
        from_id: "issuer:test",
        to_id: "segment:test",
        evidence_level: "L1",
        claim_ids: ["claim:test"],
        attributes: { legacy_segment_id: "test" },
      },
    ],
    claims: [{ id: "claim:test", source_document_id: "source:test", excerpt: "公司研发并发布测试产品。" }],
    source_documents: [{ id: "source:test", url: "https://example.com/filing", publish_date: "2026-09-01" }],
  };

  const result = promoteEvidenceBackedFallbacks(graph);

  assert.equal(result.promotedRelations, 1);
  assert.equal(graph.relations[1].relation_type, "issuer_develops");
  assert.equal(graph.relations[1].to_id, "product:test");
  assert.equal(graph.relations[1].attributes.promoted_from_target_id, "segment:test");

  const quality = buildRelationshipQuality(graph);
  assert.equal(quality.specific_issuer_rate, 1);
  assert.equal(quality.generic_relations, 0);
});

test("retains broad mappings when the claim has no explicit action", () => {
  const graph = {
    entities: [
      { id: "issuer:test", entity_type: "issuer" },
      { id: "segment:test", entity_type: "segment" },
      { id: "service:test", entity_type: "service" },
    ],
    relations: [
      { id: "anchor", relation_type: "segment_has_element", from_id: "segment:test", to_id: "service:test" },
      {
        id: "mapping",
        relation_type: "issuer_participates_in_segment",
        from_id: "issuer:test",
        to_id: "segment:test",
        claim_ids: ["claim:test"],
      },
    ],
    claims: [{ id: "claim:test", source_document_id: "source:test", excerpt: "公司关注相关行业机会。" }],
    source_documents: [{ id: "source:test", url: "https://example.com/filing" }],
  };

  assert.equal(promoteEvidenceBackedFallbacks(graph).promotedRelations, 0);
  assert.equal(graph.relations[1].relation_type, "issuer_participates_in_segment");
});
