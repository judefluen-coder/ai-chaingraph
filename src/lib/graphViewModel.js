export const evidenceLabels = {
  L1: "强确证",
  L2: "合理推断",
  L3: "公开线索",
};

export const typeLabels = {
  overview: "总览",
  chain: "一级链路",
  segment: "二级环节",
  subsegment: "三级节点",
  company: "上市公司",
};

export const edgeTypeLabels = {
  industry_parent: "产业层级",
  company_maps_to_industry_node: "公司映射",
};

export const dataTypeLabels = {
  demo: "演示数据",
  local_real: "本地真实",
  mixed: "混合数据",
};

export const reviewStatusLabels = {
  pending: "待处理",
  accepted: "已接受",
  needs_review: "待审核",
  rejected: "已拒绝",
  needs_more_source: "需更多来源",
  stale: "已过期",
};

export const exportDisclaimer = "导出数据仅供研究参考，重新分发时需附带 AI-ChainGraph 的免责声明。";

const aShareExchanges = new Set(["SH", "SZ", "BJ"]);
const usExchanges = new Set(["NASDAQ", "NYSE", "AMEX", "OTC"]);

export function getCompanyMarket(company) {
  if (!company) return "unknown";
  if (company.market) return company.market;
  if (aShareExchanges.has(company.exchange)) return "a_share";
  if (usExchanges.has(company.exchange)) return "us";
  return "unknown";
}

export function getMarketLabel(market) {
  return {
    all: "全部市场",
    a_share: "A股",
    us: "美股",
    unknown: "其他",
  }[market] || market;
}

export function matchesEvidenceFilter(edge, evidenceFilter) {
  return evidenceFilter === "all" || edge.edge_type === "industry_parent" || edge.evidence_level === evidenceFilter;
}

export function matchesMarketFilter(company, marketFilter) {
  return marketFilter === "all" || getCompanyMarket(company) === marketFilter;
}

export function searchItems(data, query) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return [];
  const nodeHits = data.nodes.filter((node) =>
    [node.name, node.description, node.chain, ...(node.aliases || [])].join(" ").toLowerCase().includes(keyword),
  );
  const companyHits = data.companies.filter((company) =>
    [company.name, company.stock_code, company.industry, ...(company.aliases || [])].join(" ").toLowerCase().includes(keyword),
  );
  const evidenceHits = data.evidences.filter((evidence) =>
    [evidence.title, evidence.excerpt, evidence.source_type].join(" ").toLowerCase().includes(keyword),
  );
  return [...nodeHits, ...companyHits, ...evidenceHits];
}

export function getSearchTarget(data, item) {
  if (item.target_type === "edge") {
    const edge = data.edges.find((candidate) => candidate.id === item.target_id);
    return edge?.edge_type === "company_maps_to_industry_node" ? edge.to_id : edge?.from_id || "overview";
  }
  return item.target_id || item.id;
}

export function getEntity(data, id) {
  if (!id || id === "overview") return { id: "overview", name: "AI 产业链总览", node_type: "overview" };
  return data.nodes.find((node) => node.id === id) || data.companies.find((company) => company.id === id);
}

export function getEvidenceItems(data, edges) {
  return edges.flatMap((edge) =>
    (edge.source_ids || [])
      .map((sourceId) => data.evidences.find((evidence) => evidence.id === sourceId))
      .filter(Boolean)
      .map((evidence) => ({ evidence, edge })),
  );
}

export function getEvidenceFreshness(evidence, now = new Date()) {
  if (!evidence?.publish_date) return { status: "missing", label: "无来源日期", recencyFactor: 0.1 };
  const publishTime = new Date(`${evidence.publish_date}T00:00:00`).getTime();
  if (Number.isNaN(publishTime)) return { status: "missing", label: "日期无效", recencyFactor: 0.1 };
  const ageDays = Math.max(0, Math.floor((now.getTime() - publishTime) / 86400000));
  const threshold = evidence.stale_threshold_days || 365;
  if (ageDays > threshold) return { status: "stale", label: "来源过期", recencyFactor: 0.1, ageDays };
  if (ageDays > threshold * 0.75) return { status: "expiring", label: "即将过期", recencyFactor: 0.4, ageDays };
  if (ageDays > 365) return { status: "normal", label: "正常", recencyFactor: 0.4, ageDays };
  if (ageDays > 183) return { status: "normal", label: "正常", recencyFactor: 0.7, ageDays };
  return { status: "normal", label: "正常", recencyFactor: 1, ageDays };
}

export function getEdgeRecency(data, edge) {
  const states = (edge.source_ids || [])
    .map((sourceId) => data.evidences.find((evidence) => evidence.id === sourceId))
    .filter(Boolean)
    .map((evidence) => getEvidenceFreshness(evidence));
  if (states.length === 0) return { status: "missing", label: "缺少证据", recencyFactor: 0.1 };
  if (states.some((state) => state.status === "stale")) {
    return { status: "stale", label: "来源过期", recencyFactor: Math.min(...states.map((state) => state.recencyFactor)) };
  }
  if (states.some((state) => state.status === "expiring")) {
    return { status: "expiring", label: "即将过期", recencyFactor: Math.min(...states.map((state) => state.recencyFactor)) };
  }
  return { status: "normal", label: "正常", recencyFactor: Math.min(...states.map((state) => state.recencyFactor)) };
}

export function getAdjustedRelevance(edge, recencyFactor) {
  return Math.max(0, Math.min(1, 0.5 * edge.relevance_score + 0.3 * edge.purity_score + 0.2 * recencyFactor));
}

export function getDataStatus(data, localReviewRecords = []) {
  const evidences = data.evidences || [];
  const freshness = evidences.map((evidence) => getEvidenceFreshness(evidence));
  const staleCount = freshness.filter((item) => item.status === "stale").length;
  const expiringCount = freshness.filter((item) => item.status === "expiring").length;
  const feedbackPendingCount = localReviewRecords.filter((item) => item.status === "pending").length;
  const mappingReviewCount = (data.edges || []).filter(
    (edge) => edge.edge_type === "company_maps_to_industry_node" && edge.review_status === "needs_review",
  ).length;
  const datasetType = data.meta.dataset_type || "demo";
  const tone = staleCount > 0
    ? "danger"
    : expiringCount > 0 || feedbackPendingCount > 0 || mappingReviewCount > 0
      ? "amber"
      : datasetType === "demo" ? "muted" : "ok";
  return {
    datasetType,
    label: dataTypeLabels[datasetType] || datasetType,
    tone,
    staleCount,
    expiringCount,
    feedbackPendingCount,
    mappingReviewCount,
  };
}

export function getMappingEdgesForNode(data, active, evidenceFilter, marketFilter = "all") {
  if (!active || active.node_type === "overview") return [];
  const mappingEdges = data.edges.filter((edge) => {
    if (edge.edge_type !== "company_maps_to_industry_node" || !matchesEvidenceFilter(edge, evidenceFilter)) return false;
    const company = data.companies.find((item) => item.id === edge.to_id);
    return matchesMarketFilter(company, marketFilter);
  });
  if (active.node_type === "chain") {
    return mappingEdges.filter((edge) => data.nodes.find((node) => node.id === edge.from_id)?.chain === active.id);
  }
  const directEdges = mappingEdges.filter((edge) => edge.from_id === active.id);
  if (directEdges.length > 0) return directEdges;
  return mappingEdges.filter((edge) => active.company_ids?.includes(edge.to_id));
}

export function buildListRows(data, evidenceFilter, onlyChain, query, marketFilter = "all") {
  const keyword = query.trim().toLowerCase();
  return data.edges
    .filter((edge) => edge.edge_type === "company_maps_to_industry_node" && matchesEvidenceFilter(edge, evidenceFilter))
    .map((edge) => {
      const node = data.nodes.find((item) => item.id === edge.from_id);
      const company = data.companies.find((item) => item.id === edge.to_id);
      const chain = data.chains.find((item) => item.id === node?.chain);
      const evidence = (edge.source_ids || [])
        .map((sourceId) => data.evidences.find((item) => item.id === sourceId))
        .filter(Boolean);
      const recency = getEdgeRecency(data, edge);
      return { edge, node, company, chain, evidence, recency };
    })
    .filter((row) => row.company && row.node)
    .filter((row) => !onlyChain || row.node?.chain === onlyChain)
    .filter((row) => matchesMarketFilter(row.company, marketFilter))
    .filter((row) => {
      if (!keyword) return true;
      return [
        row.node?.name,
        row.company?.name,
        row.company?.stock_code,
        row.company?.industry,
        row.chain?.name,
        ...row.evidence.map((item) => `${item.title} ${item.excerpt}`),
      ].join(" ").toLowerCase().includes(keyword);
    })
    .sort((a, b) => {
      const aScore = getAdjustedRelevance(a.edge, a.recency.recencyFactor);
      const bScore = getAdjustedRelevance(b.edge, b.recency.recencyFactor);
      return bScore - aScore;
    });
}

export function getPathSummary(data, active, marketFilter = "all") {
  const marketLabel = getMarketLabel(marketFilter);
  if (!active || active.node_type === "overview") {
    return `${marketLabel} · ${data.chains.length} 条链路 · ${data.nodes.length} 个节点 · ${data.companies.length} 家公司`;
  }
  if (active.stock_code) {
    const mappingEdges = data.edges.filter((edge) => edge.to_id === active.id);
    const nodes = mappingEdges.map((edge) => data.nodes.find((node) => node.id === edge.from_id)?.name).filter(Boolean);
    return `${active.name} · ${active.stock_code} · ${nodes.join(" / ") || "未绑定产业节点"}`;
  }
  const chain = data.chains.find((item) => item.id === active.id || item.id === active.chain);
  const mappings = getMappingEdgesForNode(data, active, "all", marketFilter);
  const upstream = data.edges.filter((edge) => edge.to_id === active.id && edge.edge_type === "industry_parent").length;
  const downstream = data.edges.filter((edge) => edge.from_id === active.id && edge.edge_type === "industry_parent").length;
  return `${chain?.name || "产业链"} · ${active.name} · 上游 ${upstream} · 下游 ${downstream} · 公司 ${mappings.length}`;
}

export function buildScopedData(data, onlyChain, marketFilter = "all") {
  const companyIdsForMarket = new Set(data.companies.filter((company) => matchesMarketFilter(company, marketFilter)).map((company) => company.id));
  if (!onlyChain) {
    const edges = data.edges.filter((edge) => edge.edge_type !== "company_maps_to_industry_node" || companyIdsForMarket.has(edge.to_id));
    return {
      ...data,
      edges,
      companies: data.companies.filter((company) => companyIdsForMarket.has(company.id)),
    };
  }
  const nodeIds = new Set(data.nodes.filter((node) => node.chain === onlyChain).map((node) => node.id));
  const edges = data.edges.filter((edge) =>
    (nodeIds.has(edge.from_id) || nodeIds.has(edge.to_id))
    && (edge.edge_type !== "company_maps_to_industry_node" || companyIdsForMarket.has(edge.to_id)),
  );
  const companyIds = new Set(edges.map((edge) => edge.to_id).filter((id) => id.startsWith("company:")));
  return {
    ...data,
    nodes: data.nodes.filter((node) => nodeIds.has(node.id)),
    edges,
    companies: data.companies.filter((company) => companyIds.has(company.id)),
  };
}

export function buildFlow(data, activeId, query, evidenceFilter) {
  const matched = new Set(searchItems(data, query).map((item) => item.id));
  const chainIndex = new Map(data.chains.map((chain, index) => [chain.id, index]));
  const visibleEdges = data.edges.filter((edge) => matchesEvidenceFilter(edge, evidenceFilter));
  const visibleCompanyIds = new Set(
    visibleEdges
      .filter((edge) => edge.edge_type === "company_maps_to_industry_node")
      .map((edge) => edge.to_id),
  );

  const nodes = data.nodes.map((node) => {
    const chainOrder = chainIndex.get(node.chain) ?? 0;
    const siblings = data.nodes.filter((item) => item.chain === node.chain && item.level === node.level);
    const siblingIndex = siblings.findIndex((item) => item.id === node.id);
    const x = 70 + chainOrder * 260 + node.level * 28;
    const y = 80 + node.level * 98 + siblingIndex * 84 + (chainOrder % 2) * 22;
    return {
      id: node.id,
      type: "mapNode",
      position: { x, y },
      data: {
        title: node.name,
        subtitle: `${typeLabels[node.node_type]} · ${node.company_ids.length} 家`,
        kind: "industry",
      },
      className: [
        "flowNode",
        activeId === node.id ? "isActive" : "",
        matched.has(node.id) ? "isMatched" : "",
      ].join(" "),
    };
  });

  const companyNodes = data.companies.filter((company) => visibleCompanyIds.has(company.id)).map((company, index) => {
    const mapping = visibleEdges.find((edge) => edge.to_id === company.id);
    const parent = data.nodes.find((node) => node.id === mapping?.from_id);
    const chainOrder = chainIndex.get(parent?.chain) ?? 0;
    const x = 170 + chainOrder * 260;
    const y = 500 + (index % 4) * 68;
    return {
      id: company.id,
      type: "mapNode",
      position: { x, y },
      data: {
        title: company.name,
        subtitle: `${company.stock_code} · ${getMarketLabel(getCompanyMarket(company))}`,
        kind: "company",
      },
      className: [
        "flowNode",
        "companyFlowNode",
        activeId === company.id ? "isActive" : "",
        matched.has(company.id) ? "isMatched" : "",
      ].join(" "),
    };
  });

  const edges = visibleEdges.map((edge) => ({
    id: edge.id,
    source: edge.from_id,
    target: edge.to_id,
    animated: edge.from_id === activeId || edge.to_id === activeId,
    label: edge.edge_type === "company_maps_to_industry_node" ? "映射" : "上下游",
    className: [
      "flowEdge",
      edge.from_id === activeId || edge.to_id === activeId ? "isActiveEdge" : "",
      matched.has(edge.from_id) || matched.has(edge.to_id) ? "isMatchedEdge" : "",
    ].join(" "),
  }));

  return { nodes: nodes.concat(companyNodes), edges };
}

export function getMarketOptions(data) {
  const present = new Set(data.companies.map((company) => getCompanyMarket(company)));
  return ["all", "a_share", "us"].filter((market) => market === "all" || present.has(market));
}
