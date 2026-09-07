const SPECIFIC_RELATION_TYPES = new Set([
  "issuer_develops",
  "issuer_distributes",
  "issuer_integrates",
  "issuer_operates",
  "issuer_produces",
  "issuer_provides",
]);

const ACTION_RULES = [
  {
    id: "distribution-action-v1",
    relationType: "issuer_distributes",
    pattern: /(?:分销|经销|代理销售|渠道销售|distribut(?:e|es|ed|ing)|resell(?:s|ing)?)/i,
  },
  {
    id: "production-action-v1",
    relationType: "issuer_produces",
    pattern: /(?:量产|生产|制造|产能|产线|工厂|产品组合|批量出货|规模销售|manufactur(?:e|es|ed|ing)|produc(?:e|es|ed|ing|tion)|fabricat(?:e|es|ed|ing|ion)|mass[- ]produc)/i,
  },
  {
    id: "operation-action-v1",
    relationType: "issuer_operates",
    pattern: /(?:运营|运行|经营|上线运营|operate(?:s|d|ing|ion)|runs?\s|in operation)/i,
  },
  {
    id: "provision-action-v1",
    relationType: "issuer_provides",
    pattern: /(?:提供|供应|服务于|交付|签约落地|offers?|provides?|suppl(?:y|ies|ied)|serves?|delivers?)/i,
  },
  {
    id: "development-action-v2",
    relationType: "issuer_develops",
    pattern: /(?:研发|开发|研制|自主设计|推出|完成样机|research and development|develop(?:s|ed|ing)?|designed?|launch(?:es|ed|ing)?|prototype)/i,
  },
  {
    id: "integration-action-v1",
    relationType: "issuer_integrates",
    pattern: /(?:集成|融合|嵌入|部署|采用|使用|应用于|用于|落地应用|integrat|embed|deploy|uses?|adopt|appl(?:y|ies|ied))/i,
  },
];

function roundRate(numerator, denominator) {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function inferSpecificRelation(text, targetType = null) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const rule = ACTION_RULES.find(({ pattern }) => pattern.test(normalized));
  if (rule) return { relationType: rule.relationType, ruleId: rule.id };

  if (targetType === "service" && /(?:渠道|门店|零售|销售)[^。；]{0,24}(?:终端|设备|硬件|眼镜|手机|PC)|(?:终端|设备|硬件|眼镜|手机|PC)[^。；]{0,24}(?:渠道|门店|零售|销售)/i.test(normalized)) {
    return { relationType: "issuer_distributes", ruleId: "channel-sales-v1" };
  }
  if (["component", "equipment", "material", "product"].includes(targetType)
    && /(?:主要产品|产品(?:包括|覆盖|矩阵|谱系|线)|主营[^。；]{0,24}产品|材料业务覆盖|设备包括|部件包括)/i.test(normalized)) {
    return { relationType: "issuer_produces", ruleId: "product-ownership-v1" };
  }
  if (["application", "product", "service", "technology"].includes(targetType)
    && /(?:构建|打造|搭建|自研|建成|上线(?!线)|已发布|形成[^。；]{0,24}(?:平台|系统|模型|产品|能力))/i.test(normalized)) {
    return { relationType: "issuer_develops", ruleId: "solution-build-v1" };
  }
  if (/(?:依赖|整合|结合|纳入|引入|接入|投入[^。；]{0,20}(?:AI|人工智能)|(?:AI|人工智能)[^。；]{0,24}(?:应用|落地))/i.test(normalized)) {
    return { relationType: "issuer_integrates", ruleId: "technology-adoption-v1" };
  }
  if (/(?:服务覆盖|服务[^。；]{0,24}客户|取得收入|实现收入|贡献收入)/i.test(normalized)) {
    return { relationType: "issuer_provides", ruleId: "commercial-provision-v1" };
  }
  return null;
}

export function promoteEvidenceBackedFallbacks(graph) {
  const claimsById = new Map(graph.claims.map((claim) => [claim.id, claim]));
  const sourcesById = new Map(graph.source_documents.map((source) => [source.id, source]));
  const entityTypesById = new Map(graph.entities.map((entity) => [entity.id, entity.entity_type]));
  const anchorBySegment = new Map(
    graph.relations
      .filter((relation) => relation.relation_type === "segment_has_element")
      .map((relation) => [relation.from_id, relation.to_id]),
  );
  const promotionsByType = {};
  let promotedRelations = 0;
  let reclassifiedRelations = 0;
  let revertedRelations = 0;

  graph.relations = graph.relations.map((relation) => {
    const isBroadMapping = relation.relation_type === "issuer_participates_in_segment";
    const isRulePromoted = relation.attributes?.promoted_from_relation_type === "issuer_participates_in_segment"
      && relation.attributes?.promoted_from_target_id;
    if (!isBroadMapping && !isRulePromoted) return relation;

    const claims = (relation.claim_ids || []).map((claimId) => claimsById.get(claimId)).filter(Boolean);
    const hasReviewableEvidence = claims.length > 0 && claims.every((claim) => {
      const source = sourcesById.get(claim.source_document_id);
      return source && /^https:\/\//.test(source.url || "");
    });
    const sourceSegmentId = isRulePromoted ? relation.attributes.promoted_from_target_id : relation.to_id;
    const targetId = anchorBySegment.get(sourceSegmentId);
    if (!hasReviewableEvidence || !targetId) return relation;

    const action = inferSpecificRelation(
      claims.map((claim) => claim.excerpt || claim.excerpt_en || "").join(" "),
      entityTypesById.get(targetId),
    );
    if (!action) {
      if (!isRulePromoted) return relation;
      const {
        promoted_from_relation_type: promotedFromRelationType,
        promoted_from_target_id: promotedFromTargetId,
        promotion_rule: promotionRule,
        promotion_version: promotionVersion,
        ...baseAttributes
      } = relation.attributes;
      revertedRelations += 1;
      return {
        ...relation,
        relation_type: promotedFromRelationType,
        to_id: promotedFromTargetId,
        attributes: {
          ...baseAttributes,
          mapping_precision: "segment_fallback",
          migration_resolution: "segment_fallback",
        },
      };
    }

    const promoted = {
      ...relation,
      relation_type: action.relationType,
      to_id: targetId,
      attributes: {
        ...relation.attributes,
        mapping_precision: "evidence_typed_anchor",
        migration_resolution: "evidence_action_resolved",
        promoted_from_relation_type: "issuer_participates_in_segment",
        promoted_from_target_id: sourceSegmentId,
        promotion_rule: action.ruleId,
        promotion_version: "2",
      },
    };
    const changed = promoted.relation_type !== relation.relation_type
      || promoted.to_id !== relation.to_id
      || promoted.attributes.promotion_rule !== relation.attributes?.promotion_rule
      || promoted.attributes.promotion_version !== relation.attributes?.promotion_version;
    if (changed) {
      if (isBroadMapping) promotedRelations += 1;
      else reclassifiedRelations += 1;
      promotionsByType[action.relationType] = (promotionsByType[action.relationType] || 0) + 1;
    }
    return promoted;
  });

  return { promotedRelations, reclassifiedRelations, revertedRelations, promotionsByType };
}

export function buildRelationshipQuality(graph) {
  const entitiesById = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const segmentByElement = new Map(
    graph.relations
      .filter((relation) => relation.relation_type === "segment_has_element")
      .map((relation) => [relation.to_id, relation.from_id]),
  );
  const issuerIds = new Set(
    graph.entities.filter((entity) => entity.entity_type === "issuer").map((entity) => entity.id),
  );
  const issuerMappings = graph.relations.filter((relation) => relation.relation_type.startsWith("issuer_"));
  const specificRelations = issuerMappings.filter((relation) => SPECIFIC_RELATION_TYPES.has(relation.relation_type));
  const genericRelations = issuerMappings.filter((relation) => relation.relation_type === "issuer_participates_in_segment");
  const mappedIssuerIds = new Set(issuerMappings.map((relation) => relation.from_id));
  const specificIssuerIds = new Set(specificRelations.map((relation) => relation.from_id));
  const segmentCounts = new Map(
    graph.entities
      .filter((entity) => entity.entity_type === "segment")
      .map((segment) => [segment.id, 0]),
  );

  for (const relation of issuerMappings) {
    const segmentId = relation.to_id.startsWith("segment:")
      ? relation.to_id
      : segmentByElement.get(relation.to_id)
        || (relation.attributes?.legacy_segment_id ? `segment:${relation.attributes.legacy_segment_id}` : null);
    if (segmentId && segmentCounts.has(segmentId)) {
      segmentCounts.set(segmentId, segmentCounts.get(segmentId) + 1);
    }
  }

  const segmentCoverage = [...segmentCounts.entries()]
    .map(([segmentId, mappingCount]) => ({
      segment_id: segmentId,
      name: entitiesById.get(segmentId)?.name || segmentId,
      mapping_count: mappingCount,
    }))
    .sort((a, b) => a.mapping_count - b.mapping_count || a.segment_id.localeCompare(b.segment_id));
  const mappingCounts = segmentCoverage.map((segment) => segment.mapping_count);
  const evidenceLevels = Object.groupBy(issuerMappings, (relation) => relation.evidence_level || "unknown");

  return {
    issuers_total: issuerIds.size,
    issuers_mapped: mappedIssuerIds.size,
    issuers_unmapped: issuerIds.size - mappedIssuerIds.size,
    issuers_with_specific_relations: specificIssuerIds.size,
    issuers_generic_only: mappedIssuerIds.size - specificIssuerIds.size,
    specific_issuer_rate: roundRate(specificIssuerIds.size, issuerIds.size),
    issuer_relations_total: issuerMappings.length,
    specific_relations: specificRelations.length,
    generic_relations: genericRelations.length,
    specific_relation_rate: roundRate(specificRelations.length, issuerMappings.length),
    evidence_levels: Object.fromEntries(
      Object.entries(evidenceLevels).map(([level, relations]) => [level, relations.length]),
    ),
    segments_total: segmentCoverage.length,
    segments_covered: segmentCoverage.filter((segment) => segment.mapping_count > 0).length,
    median_mappings_per_segment: median(mappingCounts),
    sparse_segments: segmentCoverage.filter((segment) => segment.mapping_count < 5),
    largest_segments: segmentCoverage.slice(-5).reverse(),
  };
}

export function maxSourceDate(graph) {
  return graph.source_documents
    .map((source) => source.publish_date)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}

export { SPECIFIC_RELATION_TYPES };
