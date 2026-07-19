export const dependencyRelationTypes = new Set([
  "material_for",
  "component_of",
  "equipment_for",
  "input_to",
  "process_outputs",
  "tests",
  "used_in",
  "enables",
  "deployed_in",
  "complements",
  "substitutes",
]);

export const issuerRelationTypes = new Set([
  "issuer_produces",
  "issuer_provides",
  "issuer_develops",
  "issuer_operates",
  "issuer_distributes",
  "issuer_integrates",
]);

const shockRules = {
  price_up: { direction: "downstream", effect: "input_cost_pressure" },
  price_down: { direction: "downstream", effect: "input_cost_relief" },
  supply_up: { direction: "downstream", effect: "capacity_release" },
  supply_down: { direction: "downstream", effect: "capacity_bottleneck" },
  demand_up: { direction: "upstream", effect: "demand_pull" },
  demand_down: { direction: "upstream", effect: "demand_pressure" },
  capacity_up: { direction: "downstream", effect: "capacity_release" },
  capacity_down: { direction: "downstream", effect: "capacity_bottleneck" },
  policy_change: { direction: "both", effect: "policy_exposure" },
  technology_shift: { direction: "both", effect: "effect_unknown" },
};

const effectLabels = {
  input_cost_pressure: ["成本压力", "Input-cost pressure"],
  input_cost_relief: ["成本缓释", "Input-cost relief"],
  demand_pull: ["需求拉动", "Demand pull"],
  demand_pressure: ["需求承压", "Demand pressure"],
  capacity_bottleneck: ["供给或产能瓶颈", "Supply or capacity bottleneck"],
  capacity_release: ["供给或产能释放", "Supply or capacity release"],
  substitution_opportunity: ["替代机会", "Substitution opportunity"],
  complementary_demand: ["互补需求", "Complementary demand"],
  deployment_opportunity: ["部署需求", "Deployment opportunity"],
  policy_exposure: ["政策暴露", "Policy exposure"],
  technology_displacement: ["技术替代风险", "Technology displacement"],
  effect_unknown: ["影响方向待确认", "Effect direction unconfirmed"],
};

const indexCache = new WeakMap();

export function createTransmissionIndex(graph) {
  const cached = indexCache.get(graph);
  if (cached) return cached;

  const entitiesById = new Map((graph.entities || []).map((entity) => [entity.id, entity]));
  const relationsById = new Map((graph.relations || []).map((relation) => [relation.id, relation]));
  const outgoing = new Map();
  const incoming = new Map();
  const elementIdsBySegment = new Map();
  const segmentIdsByElement = new Map();
  const segmentIdsByChain = new Map();
  const chainIdsByDomain = new Map();
  const chainIdBySegment = new Map();
  const directIssuerRelationsByElement = new Map();
  const fallbackIssuerRelationsBySegment = new Map();
  const securityRelationsByIssuer = new Map();

  for (const relation of graph.relations || []) {
    if (dependencyRelationTypes.has(relation.relation_type) && isAccepted(relation)) {
      addToMapArray(outgoing, relation.from_id, relation);
      addToMapArray(incoming, relation.to_id, relation);
    }
    if (relation.relation_type === "segment_has_element" && isAccepted(relation)) {
      addToMapArray(elementIdsBySegment, relation.from_id, relation.to_id);
      addToMapArray(segmentIdsByElement, relation.to_id, relation.from_id);
    }
    if (relation.relation_type === "chain_has_segment" && isAccepted(relation)) {
      addToMapArray(segmentIdsByChain, relation.from_id, relation.to_id);
      chainIdBySegment.set(relation.to_id, relation.from_id);
    }
    if (relation.relation_type === "domain_has_chain" && isAccepted(relation)) {
      addToMapArray(chainIdsByDomain, relation.from_id, relation.to_id);
    }
    if (issuerRelationTypes.has(relation.relation_type) && isAccepted(relation)) {
      addToMapArray(directIssuerRelationsByElement, relation.to_id, relation);
    }
    if (relation.relation_type === "issuer_participates_in_segment" && isAccepted(relation)) {
      addToMapArray(fallbackIssuerRelationsBySegment, relation.to_id, relation);
    }
    if (relation.relation_type === "security_issued_by" && isAccepted(relation)) {
      addToMapArray(securityRelationsByIssuer, relation.to_id, relation);
    }
  }

  const index = {
    entitiesById,
    relationsById,
    outgoing,
    incoming,
    elementIdsBySegment,
    segmentIdsByElement,
    segmentIdsByChain,
    chainIdsByDomain,
    chainIdBySegment,
    directIssuerRelationsByElement,
    fallbackIssuerRelationsBySegment,
    securityRelationsByIssuer,
  };
  indexCache.set(graph, index);
  return index;
}

export function resolveTransmissionStartIds(graph, targetId, index = createTransmissionIndex(graph)) {
  const targetIds = Array.isArray(targetId) ? targetId : [targetId];
  const resolved = new Set();

  for (const id of targetIds.filter(Boolean)) {
    const entity = index.entitiesById.get(id);
    if (!entity) continue;
    if (isElement(entity)) {
      resolved.add(id);
      continue;
    }
    if (entity.entity_type === "segment") {
      for (const elementId of index.elementIdsBySegment.get(id) || []) resolved.add(elementId);
      continue;
    }
    if (entity.entity_type === "chain") {
      for (const segmentId of index.segmentIdsByChain.get(id) || []) {
        for (const elementId of index.elementIdsBySegment.get(segmentId) || []) resolved.add(elementId);
      }
      continue;
    }
    if (entity.entity_type === "domain") {
      for (const chainId of index.chainIdsByDomain.get(id) || []) {
        for (const segmentId of index.segmentIdsByChain.get(chainId) || []) {
          for (const elementId of index.elementIdsBySegment.get(segmentId) || []) resolved.add(elementId);
        }
      }
      continue;
    }
    if (entity.entity_type === "security") {
      const issuance = (graph.relations || []).find((relation) => relation.relation_type === "security_issued_by" && relation.from_id === id);
      if (issuance) addIssuerStarts(issuance.to_id, resolved, index);
      continue;
    }
    if (entity.entity_type === "issuer") addIssuerStarts(id, resolved, index);
  }

  return [...resolved].sort();
}

export function traverseTransmissionGraph(graph, targetId, options = {}) {
  const index = options.index || createTransmissionIndex(graph);
  const direction = options.direction || "downstream";
  const maxDepth = Math.max(0, options.maxDepth ?? 6);
  const allowedTypes = options.relationTypes ? new Set(options.relationTypes) : dependencyRelationTypes;
  const allowedEvidence = options.evidenceLevels ? new Set(options.evidenceLevels) : null;
  const startIds = resolveTransmissionStartIds(graph, targetId, index);
  const queue = startIds.map((id) => ({ id, depth: 0 }));
  const records = new Map(startIds.map((id) => [id, {
    id,
    depth: 0,
    parent_id: null,
    via_relation_id: null,
    traversal_direction: null,
  }]));
  const traversedRelations = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const step of relationSteps(index, current.id, direction)) {
      const relation = step.relation;
      if (!allowedTypes.has(relation.relation_type)) continue;
      if (allowedEvidence && !allowedEvidence.has(relation.evidence_level)) continue;
      if (!isAccepted(relation)) continue;
      const nextId = step.next_id;
      if (records.has(nextId)) continue;
      const record = {
        id: nextId,
        depth: current.depth + 1,
        parent_id: current.id,
        via_relation_id: relation.id,
        traversal_direction: step.traversal_direction,
      };
      records.set(nextId, record);
      queue.push({ id: nextId, depth: record.depth });
      traversedRelations.push({
        relation,
        from_id: current.id,
        to_id: nextId,
        from_depth: current.depth,
        to_depth: record.depth,
        traversal_direction: step.traversal_direction,
      });
    }
  }

  const nodes = [...records.values()]
    .map((record) => ({ ...record, entity: index.entitiesById.get(record.id) }))
    .filter((record) => record.entity)
    .sort((left, right) => left.depth - right.depth || left.id.localeCompare(right.id));
  const result = {
    target_id: Array.isArray(targetId) ? null : targetId,
    start_ids: startIds,
    direction,
    max_depth: maxDepth,
    nodes,
    relations: traversedRelations,
  };
  result.stats = buildTransmissionStats(graph, result, { index, includeFallback: options.includeFallback !== false });
  return result;
}

export function findShortestTransmissionPath(graph, fromId, toId, options = {}) {
  const index = options.index || createTransmissionIndex(graph);
  const targetIds = new Set(resolveTransmissionStartIds(graph, toId, index));
  const traversal = traverseTransmissionGraph(graph, fromId, {
    ...options,
    index,
    maxDepth: options.maxDepth ?? 12,
  });
  const targetRecord = traversal.nodes
    .filter((node) => targetIds.has(node.id))
    .sort((left, right) => left.depth - right.depth || left.id.localeCompare(right.id))[0];
  if (!targetRecord) {
    return {
      found: false,
      from_id: fromId,
      to_id: toId,
      direction: traversal.direction,
      hops: null,
      entities: [],
      relations: [],
      cross_chain_hops: 0,
    };
  }

  const recordsById = new Map(traversal.nodes.map((node) => [node.id, node]));
  const relationStepByTarget = new Map(traversal.relations.map((step) => [step.to_id, step]));
  const entityIds = [];
  const relationSteps = [];
  let current = targetRecord;
  while (current) {
    entityIds.push(current.id);
    if (current.via_relation_id) relationSteps.push(relationStepByTarget.get(current.id));
    current = current.parent_id ? recordsById.get(current.parent_id) : null;
  }
  entityIds.reverse();
  relationSteps.reverse();

  return {
    found: true,
    from_id: fromId,
    to_id: toId,
    direction: traversal.direction,
    hops: relationSteps.length,
    entities: entityIds.map((id) => index.entitiesById.get(id)),
    relations: relationSteps,
    cross_chain_hops: relationSteps.filter((step) => entityChainId(step.from_id, index) !== entityChainId(step.to_id, index)).length,
  };
}

export function buildTransmissionStats(graph, traversal, options = {}) {
  const index = options.index || createTransmissionIndex(graph);
  const includeFallback = options.includeFallback !== false;
  const issuerRecords = new Map();
  const chainIds = new Set();
  const elementsByDepth = {};

  for (const node of traversal.nodes) {
    elementsByDepth[node.depth] = (elementsByDepth[node.depth] || 0) + 1;
    const chainId = entityChainId(node.id, index);
    if (chainId) chainIds.add(chainId);
    for (const mapping of issuerMappingsForElement(node.id, index, includeFallback)) {
      const prior = issuerRecords.get(mapping.issuer_id);
      if (!prior || node.depth < prior.depth || (node.depth === prior.depth && mapping.precision === "typed_element" && prior.precision !== "typed_element")) {
        issuerRecords.set(mapping.issuer_id, {
          issuer_id: mapping.issuer_id,
          issuer: index.entitiesById.get(mapping.issuer_id),
          element_id: node.id,
          depth: node.depth,
          precision: mapping.precision,
          relation_id: mapping.relation_id,
        });
      }
    }
  }

  const issuers = [...issuerRecords.values()].sort((left, right) => left.depth - right.depth || left.issuer_id.localeCompare(right.issuer_id));
  const securityIds = new Set();
  for (const issuer of issuers) {
    for (const relation of index.securityRelationsByIssuer.get(issuer.issuer_id) || []) securityIds.add(relation.from_id);
  }

  return {
    start_element_count: traversal.start_ids.length,
    reachable_element_count: traversal.nodes.filter((node) => node.depth > 0).length,
    direct_element_count: traversal.nodes.filter((node) => node.depth === 1).length,
    indirect_element_count: traversal.nodes.filter((node) => node.depth > 1).length,
    chain_count: chainIds.size,
    issuer_count: issuers.length,
    direct_issuer_count: issuers.filter((issuer) => issuer.depth <= 1).length,
    indirect_issuer_count: issuers.filter((issuer) => issuer.depth > 1).length,
    typed_issuer_count: issuers.filter((issuer) => issuer.precision === "typed_element").length,
    fallback_issuer_count: issuers.filter((issuer) => issuer.precision === "segment_fallback").length,
    security_count: securityIds.size,
    elements_by_depth: elementsByDepth,
    issuers,
  };
}

export function buildShockOverlay(graph, eventOrId, options = {}) {
  const event = typeof eventOrId === "string"
    ? (graph.shock_events || []).find((candidate) => candidate.id === eventOrId)
    : eventOrId;
  if (!event) throw new Error(`shock event not found: ${eventOrId}`);
  const rule = shockRules[event.shock_type];
  if (!rule) throw new Error(`unsupported shock type: ${event.shock_type}`);
  const traversal = traverseTransmissionGraph(graph, event.target_id, {
    ...options,
    direction: options.direction || rule.direction,
    maxDepth: options.maxDepth ?? 6,
  });
  const stepByTarget = new Map(traversal.relations.map((step) => [step.to_id, step]));
  const impacts = traversal.nodes
    .filter((node) => node.depth > 0)
    .map((node) => {
      const step = stepByTarget.get(node.id);
      const effect = conditionalEffectFor(event.shock_type, step?.relation?.relation_type, rule.effect);
      return {
        entity_id: node.id,
        entity: node.entity,
        depth: node.depth,
        via_relation_id: node.via_relation_id,
        conditional_effect: effect,
        effect_label: effectLabels[effect]?.[0] || effect,
        effect_label_en: effectLabels[effect]?.[1] || effect,
        inference_layer: "conditional",
        statement: `若“${event.title}”持续且其他条件不变，${node.entity.name}可能出现“${effectLabels[effect]?.[0] || effect}”。`,
        statement_en: `If “${event.title_en}” persists and other conditions remain unchanged, ${node.entity.name_en} may face ${effectLabels[effect]?.[1] || effect}.`,
      };
    });

  return {
    event,
    propagation_direction: traversal.direction,
    fact_traversal: traversal,
    conditional_impacts: impacts,
    impacted_issuers: traversal.stats.issuers,
    disclaimer: "Conditional transmission research only. Effects are not forecasts or investment advice.",
  };
}

export function getEntityChainId(graph, entityId) {
  return entityChainId(entityId, createTransmissionIndex(graph));
}

function addIssuerStarts(issuerId, resolved, index) {
  for (const relations of index.directIssuerRelationsByElement.values()) {
    for (const relation of relations) if (relation.from_id === issuerId) resolved.add(relation.to_id);
  }
  for (const [segmentId, relations] of index.fallbackIssuerRelationsBySegment) {
    if (!relations.some((relation) => relation.from_id === issuerId)) continue;
    for (const elementId of index.elementIdsBySegment.get(segmentId) || []) resolved.add(elementId);
  }
}

function relationSteps(index, entityId, direction) {
  const steps = [];
  if (direction === "downstream" || direction === "both") {
    for (const relation of index.outgoing.get(entityId) || []) {
      steps.push({ relation, next_id: relation.to_id, traversal_direction: "downstream" });
    }
  }
  if (direction === "upstream" || direction === "both") {
    for (const relation of index.incoming.get(entityId) || []) {
      steps.push({ relation, next_id: relation.from_id, traversal_direction: "upstream" });
    }
  }
  return steps.sort((left, right) => left.relation.id.localeCompare(right.relation.id));
}

function issuerMappingsForElement(elementId, index, includeFallback) {
  const mappings = (index.directIssuerRelationsByElement.get(elementId) || []).map((relation) => ({
    issuer_id: relation.from_id,
    relation_id: relation.id,
    precision: "typed_element",
  }));
  if (!includeFallback) return mappings;
  for (const segmentId of index.segmentIdsByElement.get(elementId) || []) {
    for (const relation of index.fallbackIssuerRelationsBySegment.get(segmentId) || []) {
      mappings.push({
        issuer_id: relation.from_id,
        relation_id: relation.id,
        precision: "segment_fallback",
      });
    }
  }
  return mappings;
}

function entityChainId(entityId, index) {
  const segmentId = index.segmentIdsByElement.get(entityId)?.[0];
  return segmentId ? index.chainIdBySegment.get(segmentId) || null : null;
}

function conditionalEffectFor(shockType, relationType, fallback) {
  if (relationType === "substitutes") {
    return shockType === "technology_shift" ? "technology_displacement" : "substitution_opportunity";
  }
  if (relationType === "complements" && ["demand_up", "capacity_up", "supply_up"].includes(shockType)) return "complementary_demand";
  if (relationType === "deployed_in" && ["demand_up", "capacity_up"].includes(shockType)) return "deployment_opportunity";
  return fallback;
}

function isAccepted(relation) {
  return !relation.review_status || relation.review_status === "accepted";
}

function isElement(entity) {
  return !["domain", "chain", "segment", "issuer", "security"].includes(entity.entity_type);
}

function addToMapArray(map, key, value) {
  const values = map.get(key) || [];
  values.push(value);
  map.set(key, values);
}
