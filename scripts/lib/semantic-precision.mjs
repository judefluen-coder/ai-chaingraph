const PHYSICAL_TARGET_TYPES = new Set(["component", "equipment", "material", "product"]);
const USAGE_ONLY = /用于|应用于|\b(?:used in|used for|for use in|applied to)\b/i;
const DIRECT_INTEGRATION = /集成|融合|嵌入|部署|采用|使用|落地应用|依赖|整合|结合|纳入|引入|接入|\b(?:integrat(?:e|es|ed|ing|ion)|embed(?:s|ded|ding)?|deploy(?:s|ed|ing)?|adopt(?:s|ed|ing)?)\b/i;

export function findAmbiguousPhysicalIntegrations(graph) {
  const entitiesById = new Map((graph.entities || []).map((entity) => [entity.id, entity]));
  const claimsById = new Map((graph.claims || []).map((claim) => [claim.id, claim]));

  return (graph.relations || [])
    .filter((relation) => relation.relation_type === "issuer_integrates" && PHYSICAL_TARGET_TYPES.has(entitiesById.get(relation.to_id)?.entity_type))
    .map((relation) => ({
      relation,
      excerpt: (relation.claim_ids || []).map((id) => claimsById.get(id)?.excerpt || claimsById.get(id)?.excerpt_en || "").join(" "),
    }))
    .filter(({ excerpt }) => USAGE_ONLY.test(excerpt) && !DIRECT_INTEGRATION.test(excerpt))
    .sort((left, right) => left.relation.id.localeCompare(right.relation.id));
}

export function findNewSemanticCandidates(candidates, unresolvedRelationIds) {
  const known = new Set(unresolvedRelationIds);
  return candidates.filter(({ relation }) => !known.has(relation.id));
}
