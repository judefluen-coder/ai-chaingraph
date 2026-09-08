import dagre from "@dagrejs/dagre";
import {
  createTransmissionIndex,
  dependencyRelationTypes,
  issuerRelationTypes,
} from "./transmissionGraph.js";

const A_SHARE_EXCHANGES = new Set(["SH", "SZ", "BJ"]);
const US_EXCHANGES = new Set(["NASDAQ", "NYSE", "AMEX"]);
const STAGE_ORDER = { upstream: 10, core: 20, downstream: 30 };
const viewIndexCache = new WeakMap();

const relationLabels = {
  zh: {
    material_for: "材料供给",
    component_of: "组成部件",
    equipment_for: "设备支撑",
    input_to: "生产输入",
    process_outputs: "加工产出",
    tests: "测试验证",
    used_in: "用于",
    enables: "技术使能",
    deployed_in: "部署于",
    complements: "互补",
    substitutes: "替代",
    issuer_produces: "生产",
    issuer_provides: "提供",
    issuer_develops: "研发",
    issuer_operates: "运营",
    issuer_distributes: "分销",
    issuer_integrates: "集成",
    issuer_participates_in_segment: "宽口径关联",
  },
  en: {
    material_for: "Material for",
    component_of: "Component of",
    equipment_for: "Equipment for",
    input_to: "Input to",
    process_outputs: "Outputs",
    tests: "Tests",
    used_in: "Used in",
    enables: "Enables",
    deployed_in: "Deployed in",
    complements: "Complements",
    substitutes: "Substitutes",
    issuer_produces: "Produces",
    issuer_provides: "Provides",
    issuer_develops: "Develops",
    issuer_operates: "Operates",
    issuer_distributes: "Distributes",
    issuer_integrates: "Integrates",
    issuer_participates_in_segment: "Broad mapping",
  },
};

const entityTypeLabels = {
  zh: {
    domain: "能力域",
    chain: "产业链",
    segment: "产业环节",
    material: "材料",
    component: "部件",
    equipment: "设备",
    product: "产品",
    technology: "技术",
    service: "服务",
    application: "应用",
    facility: "基础设施",
    issuer: "上市公司",
    security: "证券",
  },
  en: {
    domain: "Domain",
    chain: "Industry chain",
    segment: "Segment",
    material: "Material",
    component: "Component",
    equipment: "Equipment",
    product: "Product",
    technology: "Technology",
    service: "Service",
    application: "Application",
    facility: "Facility",
    issuer: "Listed company",
    security: "Security",
  },
};

const stageLabels = {
  zh: { upstream: "上游", core: "核心", downstream: "下游" },
  en: { upstream: "Upstream", core: "Core", downstream: "Downstream" },
};

export function createGraphViewIndex(graph) {
  const cached = viewIndexCache.get(graph);
  if (cached) return cached;

  const transmission = createTransmissionIndex(graph);
  const entities = graph.entities || [];
  const relations = graph.relations || [];
  const domains = entities.filter((entity) => entity.entity_type === "domain");
  const chains = entities.filter((entity) => entity.entity_type === "chain");
  const segments = entities.filter((entity) => entity.entity_type === "segment");
  const elements = entities.filter(isElement);
  const issuers = entities.filter((entity) => entity.entity_type === "issuer");
  const securities = entities.filter((entity) => entity.entity_type === "security");
  const domainByChain = new Map();
  const domainRelationByChain = new Map();
  const chainRelationBySegment = new Map();
  const segmentRelationByElement = new Map();
  const elementsByChain = new Map();
  const issuerMappingsByIssuer = new Map();
  const issuerMappingsByTarget = new Map();
  const securitiesByIssuer = new Map();
  const issuerBySecurity = new Map();
  const issuerIdsByElement = new Map();
  const issuerIdsByChain = new Map();

  for (const relation of relations) {
    if (relation.relation_type === "domain_has_chain") {
      domainByChain.set(relation.to_id, relation.from_id);
      domainRelationByChain.set(relation.to_id, relation);
    }
    if (relation.relation_type === "chain_has_segment") chainRelationBySegment.set(relation.to_id, relation);
    if (relation.relation_type === "segment_has_element") segmentRelationByElement.set(relation.to_id, relation);
    if (issuerRelationTypes.has(relation.relation_type) || relation.relation_type === "issuer_participates_in_segment") {
      addToMapArray(issuerMappingsByIssuer, relation.from_id, relation);
      addToMapArray(issuerMappingsByTarget, relation.to_id, relation);
    }
    if (relation.relation_type === "security_issued_by") {
      addToMapArray(securitiesByIssuer, relation.to_id, transmission.entitiesById.get(relation.from_id));
      issuerBySecurity.set(relation.from_id, relation.to_id);
    }
  }

  for (const element of elements) {
    const chainId = getElementChainId(element.id, transmission);
    if (chainId) addToMapArray(elementsByChain, chainId, element);
  }

  for (const issuer of issuers) {
    for (const mapping of issuerMappingsByIssuer.get(issuer.id) || []) {
      const elementId = getMappingElementId(mapping, transmission);
      if (!elementId) continue;
      addToMapSet(issuerIdsByElement, elementId, issuer.id);
      const chainId = getElementChainId(elementId, transmission);
      if (chainId) addToMapSet(issuerIdsByChain, chainId, issuer.id);
    }
  }

  const claimsById = new Map((graph.claims || []).map((claim) => [claim.id, claim]));
  const sourcesById = new Map((graph.source_documents || []).map((source) => [source.id, source]));
  const index = {
    transmission,
    entitiesById: transmission.entitiesById,
    relationsById: transmission.relationsById,
    domains,
    chains,
    segments,
    elements,
    issuers,
    securities,
    domainByChain,
    domainRelationByChain,
    chainRelationBySegment,
    segmentRelationByElement,
    elementsByChain,
    issuerMappingsByIssuer,
    issuerMappingsByTarget,
    securitiesByIssuer,
    issuerBySecurity,
    issuerIdsByElement,
    issuerIdsByChain,
    claimsById,
    sourcesById,
  };
  viewIndexCache.set(graph, index);
  return index;
}

export function getIndustryNavigation(graph) {
  const index = createGraphViewIndex(graph);
  return index.domains
    .map((domain) => ({
      domain,
      chains: index.chains
        .filter((chain) => index.domainByChain.get(chain.id) === domain.id)
        .sort((left, right) => relationOrder(index.domainRelationByChain.get(left.id)) - relationOrder(index.domainRelationByChain.get(right.id)) || left.id.localeCompare(right.id)),
    }))
    .filter((group) => group.chains.length > 0)
    .sort((left, right) => Number(left.domain.attributes?.order || 999) - Number(right.domain.attributes?.order || 999) || left.domain.id.localeCompare(right.domain.id));
}

export function searchTransmissionGraph(graph, query, options = {}) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const index = createGraphViewIndex(graph);
  const locale = options.locale || "zh";
  const market = options.market || "all";
  const limit = options.limit || 10;
  const results = [];

  for (const issuer of index.issuers) {
    if (!issuerMatchesMarket(issuer.id, market, index)) continue;
    const securities = index.securitiesByIssuer.get(issuer.id) || [];
    const fields = [issuer.name, issuer.name_en, issuer.industry, issuer.industry_en, ...(issuer.aliases || []), ...securities.flatMap((security) => [security.stock_code, security.symbol, security.name, security.name_en, ...(security.aliases || [])])];
    const score = searchScore(normalized, fields, securities.flatMap((security) => [security.stock_code, security.symbol]));
    if (score === 0) continue;
    results.push({
      id: issuer.id,
      entity: issuer,
      kind: "issuer",
      score: score + 5,
      primary: localize(issuer, "name", locale),
      secondary: securities.map(formatSecurityCode).filter(Boolean).join(" · ") || getEntityTypeLabel("issuer", locale),
      chain_id: getEntityChainId(graph, issuer.id),
    });
  }

  for (const entity of [...index.domains, ...index.chains, ...index.elements]) {
    const fields = [entity.name, entity.name_en, ...(entity.aliases || [])];
    const score = searchScore(normalized, fields);
    if (score === 0) continue;
    const chainId = getEntityChainId(graph, entity.id);
    const chain = chainId ? index.entitiesById.get(chainId) : null;
    results.push({
      id: entity.id,
      entity,
      kind: entity.entity_type,
      score,
      primary: localize(entity, "name", locale),
      secondary: [getEntityTypeLabel(entity.entity_type, locale), localize(chain, "name", locale)].filter(Boolean).join(" · "),
      chain_id: chainId,
    });
  }

  return results
    .sort((left, right) => right.score - left.score || left.primary.localeCompare(right.primary, locale === "zh" ? "zh-CN" : "en"))
    .slice(0, limit);
}

export function buildOverviewFlow(graph, options = {}) {
  const index = createGraphViewIndex(graph);
  const locale = options.locale || "zh";
  const direction = options.direction || "LR";
  const market = options.market || "all";
  const aggregates = new Map();

  for (const relation of graph.relations || []) {
    if (!dependencyRelationTypes.has(relation.relation_type)) continue;
    const fromChain = getElementChainId(relation.from_id, index.transmission);
    const toChain = getElementChainId(relation.to_id, index.transmission);
    if (!fromChain || !toChain || fromChain === toChain) continue;
    const key = `${fromChain}|${toChain}`;
    const aggregate = aggregates.get(key) || { from_id: fromChain, to_id: toChain, relation_ids: [], relation_types: new Set() };
    aggregate.relation_ids.push(relation.id);
    aggregate.relation_types.add(relation.relation_type);
    aggregates.set(key, aggregate);
  }

  const rawNodes = index.chains.map((chain) => {
    const domain = index.entitiesById.get(index.domainByChain.get(chain.id));
    const segmentCount = index.transmission.segmentIdsByChain.get(chain.id)?.length || 0;
    const companyCount = countMarketIssuers(index.issuerIdsByChain.get(chain.id), market, index);
    return {
      id: chain.id,
      type: "transmissionNode",
      data: {
        kind: "chain",
        title: localize(chain, "name", locale),
        eyebrow: localize(domain, "name", locale),
        subtitle: locale === "en" ? `${segmentCount} segments · ${companyCount} companies` : `${segmentCount} 个环节 · ${companyCount} 家公司`,
        entityTypeLabel: getEntityTypeLabel("chain", locale),
        layoutDirection: direction,
      },
      className: "txFlowNode txChainNode",
    };
  });
  const rawEdges = [...aggregates.values()].map((aggregate) => ({
    id: `overview:${aggregate.from_id}:${aggregate.to_id}`,
    source: aggregate.from_id,
    target: aggregate.to_id,
    label: locale === "en" ? `${aggregate.relation_ids.length} links` : `${aggregate.relation_ids.length} 条依赖`,
    data: {
      kind: "chainDependency",
      relationIds: aggregate.relation_ids,
      relationTypes: [...aggregate.relation_types],
    },
    className: "txFlowEdge txOverviewEdge",
  }));
  const laidOut = layoutFlow(rawNodes, rawEdges, { direction, nodeWidth: 226, nodeHeight: 92, nodeSep: 38, rankSep: direction === "TB" ? 74 : 116 });
  return {
    ...laidOut,
    meta: {
      mode: "overview",
      chain_count: index.chains.length,
      domain_count: index.domains.length,
      cross_chain_link_count: rawEdges.length,
      dependency_relation_count: [...aggregates.values()].reduce((sum, item) => sum + item.relation_ids.length, 0),
    },
  };
}

export function buildChainFlow(graph, chainId, options = {}) {
  const index = createGraphViewIndex(graph);
  const locale = options.locale || "zh";
  const direction = options.direction || "LR";
  const market = options.market || "all";
  const chainElementIds = new Set((index.elementsByChain.get(chainId) || []).map((entity) => entity.id));
  const dependencyRelations = (graph.relations || []).filter((relation) => dependencyRelationTypes.has(relation.relation_type));
  const relations = dependencyRelations.filter((relation) => (
    chainElementIds.has(relation.from_id) && chainElementIds.has(relation.to_id)
  ));
  const boundaryRelations = dependencyRelations.filter((relation) => (
    chainElementIds.has(relation.from_id) !== chainElementIds.has(relation.to_id)
  ));
  const externalElementIds = new Set(boundaryRelations.map((relation) => (
    chainElementIds.has(relation.from_id) ? relation.to_id : relation.from_id
  )));
  const visibleEntities = [...chainElementIds].map((id) => index.entitiesById.get(id)).filter(Boolean);
  const rawNodes = visibleEntities.map((entity) => buildElementNode(entity, {
    graph,
    index,
    locale,
    direction,
    market,
    external: false,
  }));
  const rawEdges = relations.map((relation) => buildRelationEdge(relation, locale));
  const laidOut = layoutFlow(rawNodes, rawEdges, { direction, nodeWidth: 220, nodeHeight: 90, nodeSep: 34, rankSep: direction === "TB" ? 76 : 112 });
  return {
    ...laidOut,
    meta: {
      mode: "chain",
      chain_id: chainId,
      element_count: chainElementIds.size,
      external_element_count: externalElementIds.size,
      relation_count: relations.length,
      cross_chain_relation_count: boundaryRelations.length,
      issuer_count: countMarketIssuers(index.issuerIdsByChain.get(chainId), market, index),
    },
  };
}

export function buildTraversalFlow(graph, traversal, options = {}) {
  const index = createGraphViewIndex(graph);
  const locale = options.locale || "zh";
  const direction = options.layoutDirection || "LR";
  const market = options.market || "all";
  const maxNodes = options.maxNodes || (direction === "TB" ? 26 : 44);
  const effectByEntity = new Map((options.shockOverlay?.conditional_impacts || []).map((impact) => [impact.entity_id, impact]));
  const sortedTraversalNodes = [...(traversal?.nodes || [])].sort((left, right) => left.depth - right.depth || left.id.localeCompare(right.id));
  const visibleTraversalNodes = sortedTraversalNodes.slice(0, maxNodes);
  const visibleIds = new Set(visibleTraversalNodes.map((node) => node.id));
  const depthById = new Map(visibleTraversalNodes.map((node) => [node.id, node.depth]));
  const rawNodes = visibleTraversalNodes.map((record) => buildElementNode(record.entity, {
    graph,
    index,
    locale,
    direction,
    market,
    depth: record.depth,
    selected: traversal.start_ids.includes(record.id),
    conditionalImpact: effectByEntity.get(record.id),
  }));

  const dependencyRelations = (graph.relations || []).filter((relation) => (
    dependencyRelationTypes.has(relation.relation_type)
    && visibleIds.has(relation.from_id)
    && visibleIds.has(relation.to_id)
  ));
  const rawEdges = dependencyRelations.map((relation) => buildRelationEdge(relation, locale, {
    crossChain: getElementChainId(relation.from_id, index.transmission) !== getElementChainId(relation.to_id, index.transmission),
    conditional: Boolean(options.shockOverlay),
  }));

  const targetEntity = index.entitiesById.get(options.targetId);
  const issuer = resolveIssuer(targetEntity, index);
  if (issuer) {
    const securities = index.securitiesByIssuer.get(issuer.id) || [];
    rawNodes.push({
      id: issuer.id,
      type: "transmissionNode",
      data: {
        kind: "issuer",
        title: localize(issuer, "name", locale),
        eyebrow: getEntityTypeLabel("issuer", locale),
        subtitle: securities.map(formatSecurityCode).filter(Boolean).join(" · "),
        entityTypeLabel: getEntityTypeLabel("issuer", locale),
        selected: true,
        layoutDirection: direction,
      },
      className: "txFlowNode txIssuerNode isSelected",
    });
    for (const mapping of index.issuerMappingsByIssuer.get(issuer.id) || []) {
      const elementId = getMappingElementId(mapping, index.transmission);
      if (!visibleIds.has(elementId)) continue;
      rawEdges.push(buildRelationEdge(mapping, locale, { targetOverride: elementId, mapping: true }));
    }
  }

  const laidOut = layoutFlow(rawNodes, rawEdges, { direction, nodeWidth: 220, nodeHeight: 92, nodeSep: 38, rankSep: direction === "TB" ? 82 : 118 });
  return {
    ...laidOut,
    meta: {
      mode: options.shockOverlay ? "shock" : "traversal",
      direction: traversal?.direction,
      hidden_node_count: Math.max(0, sortedTraversalNodes.length - visibleTraversalNodes.length),
      ...getMarketTraversalStats(traversal, market, index),
    },
  };
}

export function buildPathFlow(graph, pathResult, options = {}) {
  const index = createGraphViewIndex(graph);
  const locale = options.locale || "zh";
  const direction = options.layoutDirection || "LR";
  if (!pathResult?.found) {
    return { nodes: [], edges: [], meta: { mode: "path", found: false } };
  }
  const rawNodes = pathResult.entities.map((entity, pathIndex) => buildElementNode(entity, {
    graph,
    index,
    locale,
    direction,
    market: options.market || "all",
    depth: pathIndex,
    selected: pathIndex === 0 || pathIndex === pathResult.entities.length - 1,
    path: true,
  }));
  const rawEdges = pathResult.relations.map((step) => buildRelationEdge(step.relation, locale, { path: true }));
  const fromEntity = index.entitiesById.get(pathResult.from_id);
  const issuer = resolveIssuer(fromEntity, index);
  if (issuer && pathResult.entities[0]) {
    const securities = index.securitiesByIssuer.get(issuer.id) || [];
    rawNodes.push({
      id: issuer.id,
      type: "transmissionNode",
      data: {
        kind: "issuer",
        title: localize(issuer, "name", locale),
        eyebrow: getEntityTypeLabel("issuer", locale),
        subtitle: securities.map(formatSecurityCode).filter(Boolean).join(" · "),
        entityTypeLabel: getEntityTypeLabel("issuer", locale),
        selected: true,
        path: true,
        layoutDirection: direction,
      },
      className: "txFlowNode txIssuerNode isSelected isPath",
    });
    const mapping = (index.issuerMappingsByIssuer.get(issuer.id) || []).find((relation) => getMappingElementId(relation, index.transmission) === pathResult.entities[0].id);
    if (mapping) rawEdges.push(buildRelationEdge(mapping, locale, { targetOverride: pathResult.entities[0].id, mapping: true, path: true }));
  }
  const laidOut = layoutFlow(rawNodes, rawEdges, { direction, nodeWidth: 220, nodeHeight: 92, nodeSep: 32, rankSep: direction === "TB" ? 80 : 118 });
  return {
    ...laidOut,
    meta: {
      mode: "path",
      found: true,
      hops: pathResult.hops,
      cross_chain_hops: pathResult.cross_chain_hops,
    },
  };
}

export function buildDetailModel(graph, entityId, options = {}) {
  const index = createGraphViewIndex(graph);
  const locale = options.locale || "zh";
  const market = options.market || "all";
  const rawEntity = index.entitiesById.get(entityId);
  const issuer = resolveIssuer(rawEntity, index);
  const entity = issuer || rawEntity;
  if (!entity) return null;

  if (entity.entity_type === "issuer") {
    const securities = (index.securitiesByIssuer.get(entity.id) || []).filter((security) => market === "all" || getSecurityMarket(security) === market);
    const mappings = (index.issuerMappingsByIssuer.get(entity.id) || []).map((relation) => {
      const elementId = getMappingElementId(relation, index.transmission);
      const element = index.entitiesById.get(elementId);
      return {
        relation,
        element,
        context: getEntityContext(graph, elementId),
        precision: relation.relation_type === "issuer_participates_in_segment" ? "segment_fallback" : "typed_element",
        evidence: getRelationEvidence(graph, relation.id),
      };
    }).sort((left, right) => localize(left.element, "name", locale).localeCompare(localize(right.element, "name", locale), locale === "zh" ? "zh-CN" : "en"));
    return {
      kind: "issuer",
      entity,
      originalEntity: rawEntity,
      securities,
      mappings,
      context: mappings[0]?.context || null,
    };
  }

  const incoming = (index.transmission.incoming.get(entity.id) || []).map((relation) => relationModel(graph, relation, "upstream"));
  const outgoing = (index.transmission.outgoing.get(entity.id) || []).map((relation) => relationModel(graph, relation, "downstream"));
  const issuerIds = index.issuerIdsByElement.get(entity.id) || new Set();
  const relatedIssuers = [...issuerIds]
    .filter((id) => issuerMatchesMarket(id, market, index))
    .map((id) => ({
      issuer: index.entitiesById.get(id),
      securities: index.securitiesByIssuer.get(id) || [],
      mapping: findIssuerElementMapping(id, entity.id, index),
    }))
    .sort((left, right) => localize(left.issuer, "name", locale).localeCompare(localize(right.issuer, "name", locale), locale === "zh" ? "zh-CN" : "en"));
  return {
    kind: "element",
    entity,
    context: getEntityContext(graph, entity.id),
    incoming,
    outgoing,
    relatedIssuers,
  };
}

export function buildRelationDetailModel(graph, relationId) {
  if (!relationId) return null;
  const index = createGraphViewIndex(graph);
  const relation = index.relationsById.get(relationId);
  if (!relation) return null;
  return {
    relation,
    from: index.entitiesById.get(relation.from_id),
    to: index.entitiesById.get(relation.to_id),
    evidence: getRelationEvidence(graph, relation.id),
  };
}

export function getRelationEvidence(graph, relationId) {
  const index = createGraphViewIndex(graph);
  const relation = index.relationsById.get(relationId);
  return (relation?.claim_ids || []).map((claimId) => {
    const claim = index.claimsById.get(claimId);
    return claim ? { claim, source: index.sourcesById.get(claim.source_document_id) } : null;
  }).filter(Boolean);
}

export function getEntityContext(graph, entityId) {
  const index = createGraphViewIndex(graph);
  const entity = index.entitiesById.get(entityId);
  if (!entity) return null;
  let element = isElement(entity) ? entity : null;
  let segmentId = element ? index.transmission.segmentIdsByElement.get(element.id)?.[0] : null;
  if (entity.entity_type === "segment") segmentId = entity.id;
  const segment = segmentId ? index.entitiesById.get(segmentId) : null;
  const chainId = entity.entity_type === "chain" ? entity.id : segmentId ? index.transmission.chainIdBySegment.get(segmentId) : null;
  const chain = chainId ? index.entitiesById.get(chainId) : null;
  const domain = chainId ? index.entitiesById.get(index.domainByChain.get(chainId)) : entity.entity_type === "domain" ? entity : null;
  const segmentRelation = element ? index.segmentRelationByElement.get(element.id) : segment ? index.chainRelationBySegment.get(segment.id) : null;
  return {
    domain,
    chain,
    segment,
    element,
    stage: segmentRelation?.stage_role || null,
  };
}

export function getEntityChainId(graph, entityId) {
  const index = createGraphViewIndex(graph);
  const entity = index.entitiesById.get(entityId);
  if (!entity) return null;
  if (entity.entity_type === "chain") return entity.id;
  if (entity.entity_type === "segment") return index.transmission.chainIdBySegment.get(entity.id) || null;
  if (isElement(entity)) return getElementChainId(entity.id, index.transmission);
  const issuer = resolveIssuer(entity, index);
  if (issuer) {
    const mapping = index.issuerMappingsByIssuer.get(issuer.id)?.[0];
    const elementId = mapping ? getMappingElementId(mapping, index.transmission) : null;
    return elementId ? getElementChainId(elementId, index.transmission) : null;
  }
  return null;
}

export function getEntityTypeLabel(type, locale = "zh") {
  return entityTypeLabels[locale]?.[type] || entityTypeLabels.zh[type] || type;
}

export function getRelationLabel(type, locale = "zh") {
  return relationLabels[locale]?.[type] || relationLabels.zh[type] || type;
}

export function getStageLabel(stage, locale = "zh") {
  return stageLabels[locale]?.[stage] || stageLabels.zh[stage] || stage;
}

export function getMarketLabel(market, locale = "zh") {
  const labels = locale === "en"
    ? { all: "All", a_share: "A-shares", us: "US" }
    : { all: "全部", a_share: "A股", us: "美股" };
  return labels[market] || market;
}

export function getSecurityMarket(security) {
  if (A_SHARE_EXCHANGES.has(security?.exchange)) return "a_share";
  if (US_EXCHANGES.has(security?.exchange)) return "us";
  return "other";
}

export function localize(entity, field, locale = "zh") {
  if (!entity) return "";
  return locale === "en"
    ? entity[`${field}_en`] || entity[field] || ""
    : entity[field] || entity[`${field}_en`] || "";
}

export function formatSecurityCode(security) {
  if (!security) return "";
  if (A_SHARE_EXCHANGES.has(security.exchange)) {
    const stockCode = security.stock_code || security.symbol || "";
    if (/\.(SH|SZ|BJ)$/i.test(stockCode)) return stockCode.toUpperCase();
    return stockCode ? `${stockCode}.${security.exchange}` : "";
  }
  return security.symbol || security.stock_code || "";
}

function buildElementNode(entity, options) {
  const context = getEntityContext(options.graph, entity.id);
  const chain = context?.chain;
  const companyCount = countMarketIssuers(options.index.issuerIdsByElement.get(entity.id), options.market, options.index);
  const stage = context?.stage;
  const depthLabel = Number.isInteger(options.depth)
    ? options.locale === "en" ? (options.depth === 0 ? "Focus" : `${options.depth} hop${options.depth === 1 ? "" : "s"}`) : (options.depth === 0 ? "当前节点" : `${options.depth} 跳`)
    : "";
  const classNames = [
    "txFlowNode",
    "txElementNode",
    options.external ? "isExternal" : "",
    options.selected ? "isSelected" : "",
    options.path ? "isPath" : "",
    options.conditionalImpact ? "hasConditionalImpact" : "",
    stage ? `stage-${stage}` : "",
  ].filter(Boolean).join(" ");
  return {
    id: entity.id,
    type: "transmissionNode",
    data: {
      kind: "element",
      title: localize(entity, "name", options.locale),
      eyebrow: [getStageLabel(stage, options.locale), getEntityTypeLabel(entity.entity_type, options.locale)].filter(Boolean).join(" · "),
      subtitle: options.external
        ? localize(chain, "name", options.locale)
        : options.locale === "en" ? `${companyCount} companies${depthLabel ? ` · ${depthLabel}` : ""}` : `${companyCount} 家公司${depthLabel ? ` · ${depthLabel}` : ""}`,
      entityTypeLabel: getEntityTypeLabel(entity.entity_type, options.locale),
      chainLabel: localize(chain, "name", options.locale),
      depth: options.depth,
      selected: options.selected,
      external: options.external,
      path: options.path,
      conditionalEffect: options.conditionalImpact ? localize(options.conditionalImpact, "effect_label", options.locale) : "",
      layoutDirection: options.direction,
    },
    className: classNames,
  };
}

function buildRelationEdge(relation, locale, options = {}) {
  const target = options.targetOverride || relation.to_id;
  return {
    id: relation.id,
    source: relation.from_id,
    target,
    label: getRelationLabel(relation.relation_type, locale),
    data: {
      relationId: relation.id,
      relationType: relation.relation_type,
      evidenceLevel: relation.evidence_level,
      crossChain: Boolean(options.crossChain),
      mapping: Boolean(options.mapping),
      path: Boolean(options.path),
      conditional: Boolean(options.conditional),
    },
    className: [
      "txFlowEdge",
      options.crossChain ? "isCrossChain" : "",
      options.mapping ? "isMapping" : "",
      options.path ? "isPath" : "",
      options.conditional ? "isConditional" : "",
      relation.relation_type === "issuer_participates_in_segment" ? "isFallback" : "",
    ].filter(Boolean).join(" "),
  };
}

function layoutFlow(nodes, edges, options) {
  if (nodes.length === 0) return { nodes: [], edges };
  const layout = new dagre.graphlib.Graph({ multigraph: true }).setDefaultEdgeLabel(() => ({}));
  layout.setGraph({
    rankdir: options.direction,
    align: "UL",
    nodesep: options.nodeSep,
    ranksep: options.rankSep,
    marginx: options.direction === "TB" ? 22 : 36,
    marginy: options.direction === "TB" ? 22 : 34,
  });
  for (const node of nodes) layout.setNode(node.id, { width: options.nodeWidth, height: options.nodeHeight });
  for (const edge of edges) {
    if (!layout.hasNode(edge.source) || !layout.hasNode(edge.target)) continue;
    layout.setEdge(edge.source, edge.target, {}, edge.id);
  }
  dagre.layout(layout);
  return {
    nodes: nodes.map((node) => {
      const point = layout.node(node.id);
      return { ...node, position: { x: point.x - options.nodeWidth / 2, y: point.y - options.nodeHeight / 2 } };
    }),
    edges,
  };
}

function relationModel(graph, relation, direction) {
  const index = createGraphViewIndex(graph);
  return {
    relation,
    direction,
    from: index.entitiesById.get(relation.from_id),
    to: index.entitiesById.get(relation.to_id),
    evidence: getRelationEvidence(graph, relation.id),
  };
}

function findIssuerElementMapping(issuerId, elementId, index) {
  return (index.issuerMappingsByIssuer.get(issuerId) || []).find((relation) => getMappingElementId(relation, index.transmission) === elementId) || null;
}

function getMappingElementId(relation, transmissionIndex) {
  if (relation.relation_type !== "issuer_participates_in_segment") return relation.to_id;
  return relation.attributes?.candidate_element_id || transmissionIndex.elementIdsBySegment.get(relation.to_id)?.[0] || null;
}

function getElementChainId(elementId, transmissionIndex) {
  const segmentId = transmissionIndex.segmentIdsByElement.get(elementId)?.[0];
  return segmentId ? transmissionIndex.chainIdBySegment.get(segmentId) || null : null;
}

function resolveIssuer(entity, index) {
  if (!entity) return null;
  if (entity.entity_type === "issuer") return entity;
  if (entity.entity_type === "security") return index.entitiesById.get(index.issuerBySecurity.get(entity.id)) || null;
  return null;
}

function getMarketTraversalStats(traversal, market, index) {
  const issuers = (traversal?.stats?.issuers || []).filter((record) => issuerMatchesMarket(record.issuer_id, market, index));
  const securityIds = new Set();
  for (const record of issuers) {
    for (const security of index.securitiesByIssuer.get(record.issuer_id) || []) {
      if (market === "all" || getSecurityMarket(security) === market) securityIds.add(security.id);
    }
  }
  return {
    start_element_count: traversal?.stats?.start_element_count || 0,
    reachable_element_count: traversal?.stats?.reachable_element_count || 0,
    direct_element_count: traversal?.stats?.direct_element_count || 0,
    indirect_element_count: traversal?.stats?.indirect_element_count || 0,
    chain_count: traversal?.stats?.chain_count || 0,
    issuer_count: issuers.length,
    security_count: securityIds.size,
  };
}

function countMarketIssuers(issuerIds, market, index) {
  if (!issuerIds) return 0;
  return [...issuerIds].filter((issuerId) => issuerMatchesMarket(issuerId, market, index)).length;
}

function issuerMatchesMarket(issuerId, market, index) {
  if (market === "all") return true;
  return (index.securitiesByIssuer.get(issuerId) || []).some((security) => getSecurityMarket(security) === market);
}

function relationOrder(relation) {
  return Number(relation?.order ?? 9999);
}

function searchScore(query, values, exactValues = []) {
  const exact = exactValues.map(normalizeSearchText).filter(Boolean);
  if (exact.includes(query)) return 140;
  let best = 0;
  for (const rawValue of values) {
    const value = normalizeSearchText(rawValue);
    if (!value) continue;
    if (value === query) best = Math.max(best, 120);
    else if (value.startsWith(query)) best = Math.max(best, 90 - Math.min(20, value.length - query.length));
    else if (value.includes(query)) best = Math.max(best, 65 - Math.min(20, value.length - query.length));
  }
  return best;
}

function normalizeSearchText(value) {
  return String(value || "").toLocaleLowerCase().replace(/[\s._\-:/()（）·]+/g, "");
}

function isElement(entity) {
  return !["domain", "chain", "segment", "issuer", "security"].includes(entity.entity_type);
}

function addToMapArray(map, key, value) {
  const values = map.get(key) || [];
  values.push(value);
  map.set(key, values);
}

function addToMapSet(map, key, value) {
  const values = map.get(key) || new Set();
  values.add(value);
  map.set(key, values);
}
