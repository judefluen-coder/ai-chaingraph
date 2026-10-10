import backlog from "../../scripts/semantic-review-backlog.json" with { type: "json" };

const pendingRelationIds = new Set(backlog.unresolved_relation_ids);

export function isSemanticReviewPending(relation) {
  return relation?.relation_type === "issuer_integrates"
    && (!relation.lifecycle_status || relation.lifecycle_status === "active")
    && pendingRelationIds.has(relation.id);
}
