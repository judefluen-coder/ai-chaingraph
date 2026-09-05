import dagre from "@dagrejs/dagre";

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
  product_upstream_material: "上游材料",
  product_downstream_application: "流向下游",
  industry_contains_product: "包含产品",
  company_belongs_industry: "所属行业",
  company_main_product: "主营产品",
  company_maps_to_industry_node: "公司产品关系",
  company_supplies_product: "产品供应",
};

export const relationBasisLabels = {
  official_disclosure: "官方披露",
  product_fact: "产品事实",
  industry_inference: "产业推导",
};

export const stageLabels = {
  upstream: "上游",
  core: "核心环节",
  downstream: "下游应用",
};

const stageOrder = ["upstream", "core", "downstream"];
const officialDisclosureSources = new Set(["annual_report", "announcement", "irm_qa"]);
const productFactSources = new Set(["official_site", "patent"]);

export const dataTypeLabels = {
  demo: "演示数据",
  local_real: "真实快照",
  mixed: "混合数据",
};

export const dataSourceLabels = {
  api: "API 数据",
  public_snapshot: "公开快照",
  demo: "内置演示",
  local_snapshot: "本地快照",
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

export function isPublishedEdge(edge) {
  return !edge.review_status || edge.review_status === "accepted";
}

export function getPublishedMappingEdges(data, marketFilter = "all") {
  return (data.edges || []).filter((edge) => {
    if (edge.edge_type !== "company_maps_to_industry_node" || !isPublishedEdge(edge)) return false;
    const company = data.companies.find((item) => item.id === edge.to_id);
    return company && matchesMarketFilter(company, marketFilter);
  });
}

export function getPublishedGraphStats(data, marketFilter = "all") {
  const mappings = getPublishedMappingEdges(data, marketFilter);
  return {
    mappingCount: mappings.length,
    companyCount: new Set(mappings.map((edge) => edge.to_id)).size,
    sourceCount: new Set(mappings.flatMap((edge) => edge.source_ids || [])).size,
  };
}

export function buildPublishedGraph(data) {
  const publishedMappings = getPublishedMappingEdges(data);
  const companyIds = new Set(publishedMappings.map((edge) => edge.to_id));
  const companies = data.companies.filter((company) => companyIds.has(company.id));
  const stockCodes = new Set(companies.map((company) => company.stock_code));
  const publishedCompanyIdsByNode = publishedMappings.reduce((byNode, edge) => {
    const ids = byNode.get(edge.from_id) || new Set();
    ids.add(edge.to_id);
    byNode.set(edge.from_id, ids);
    return byNode;
  }, new Map());
  const publishedCompanyIdsByChain = publishedMappings.reduce((byChain, edge) => {
    const chainId = data.nodes.find((node) => node.id === edge.from_id)?.chain;
    if (!chainId) return byChain;
    const ids = byChain.get(chainId) || new Set();
    ids.add(edge.to_id);
    byChain.set(chainId, ids);
    return byChain;
  }, new Map());
  const edges = data.edges
    .filter(isPublishedEdge)
    .filter((edge) => !String(edge.from_id).startsWith("company:") || companyIds.has(edge.from_id))
    .filter((edge) => !String(edge.to_id).startsWith("company:") || companyIds.has(edge.to_id));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const quoteSnapshots = (data.quote_snapshots || []).filter((quote) => stockCodes.has(quote.stock_code));
  const quoteIds = new Set(quoteSnapshots.map((quote) => quote.id));
  const evidences = data.evidences.filter((evidence) => {
    if (evidence.target_type === "company") return companyIds.has(evidence.target_id);
    if (evidence.target_type === "edge") return edgeIds.has(evidence.target_id);
    if (evidence.target_type === "quote") return quoteIds.has(evidence.target_id);
    if (evidence.target_type === "signal") return false;
    return true;
  });
  const evidenceIds = new Set(evidences.map((evidence) => evidence.id));

  return {
    ...data,
    nodes: data.nodes.map((node) => ({
      ...node,
      company_ids: [...(
        node.node_type === "chain"
          ? publishedCompanyIdsByChain.get(node.id)
          : publishedCompanyIdsByNode.get(node.id)
      ) || []],
    })),
    companies: companies.map((company) => ({
      ...company,
      source_ids: (company.source_ids || []).filter((sourceId) => evidenceIds.has(sourceId)),
    })),
    edges,
    evidences,
    quote_snapshots: quoteSnapshots,
    market_signals: [],
    review_queue: [],
    import_jobs: [],
  };
}

export function searchItems(data, query) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return [];
  const publishedMappings = getPublishedMappingEdges(data);
  const publishedCompanyIds = new Set(publishedMappings.map((edge) => edge.to_id));
  const publishedEdgeIds = new Set(
    data.edges.filter(isPublishedEdge).map((edge) => edge.id),
  );
  const nodeHits = data.nodes.filter((node) =>
    [node.name, node.name_en, node.description, node.description_en, node.chain, ...(node.aliases || [])].join(" ").toLowerCase().includes(keyword),
  );
  const companyHits = data.companies
    .filter((company) => publishedCompanyIds.has(company.id))
    .filter((company) =>
      [company.name, company.name_en, company.stock_code, company.industry, company.industry_en, ...(company.aliases || [])].join(" ").toLowerCase().includes(keyword),
    );
  const evidenceHits = data.evidences
    .filter((evidence) => {
      if (evidence.target_type === "company") return publishedCompanyIds.has(evidence.target_id);
      if (evidence.target_type === "edge") return publishedEdgeIds.has(evidence.target_id);
      return true;
    })
    .filter((evidence) =>
      [evidence.title, evidence.title_en, evidence.excerpt, evidence.excerpt_en, evidence.source_type].join(" ").toLowerCase().includes(keyword),
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
  const items = edges.flatMap((edge) =>
    (edge.source_ids || [])
      .map((sourceId) => data.evidences.find((evidence) => evidence.id === sourceId))
      .filter(Boolean)
      .map((evidence) => ({ evidence, edge })),
  );
  return [...new Map(items.map((item) => [item.evidence.id, item])).values()];
}

export function getNodeStage(node) {
  if (node?.stage && stageOrder.includes(node.stage)) return node.stage;
  if (node?.node_type === "chain") return "overview";
  return node?.level === 3 ? "upstream" : "core";
}

export function getRelationPresentation(data, edge) {
  const evidences = (edge?.source_ids || [])
    .map((sourceId) => data.evidences.find((evidence) => evidence.id === sourceId))
    .filter(Boolean)
    .sort((a, b) => (b.publish_date || "").localeCompare(a.publish_date || ""));
  const sourceTypes = new Set(evidences.map((evidence) => evidence.source_type));
  const inferredBasis = [...sourceTypes].some((sourceType) => officialDisclosureSources.has(sourceType))
    ? "official_disclosure"
    : [...sourceTypes].some((sourceType) => productFactSources.has(sourceType))
      ? "product_fact"
      : "industry_inference";
  const basis = edge?.relation_basis || inferredBasis;
  const primaryEvidence = evidences[0];
  return {
    basis,
    label: relationBasisLabels[basis] || relationBasisLabels.industry_inference,
    summary: edge?.relation_summary || primaryEvidence?.excerpt || "该关系来自公开产业资料，等待补充更具体的事实说明。",
    summaryEn: edge?.relation_summary_en || primaryEvidence?.excerpt_en || "",
    lastVerifiedAt: edge?.last_verified_at || edge?.updated_at || primaryEvidence?.reviewed_at || primaryEvidence?.mapped_at || primaryEvidence?.publish_date || null,
    evidences,
  };
}

export function buildIndustryAtlas(data, marketFilter = "all") {
  return data.chains.map((chain) => {
    const chainNodes = data.nodes.filter((node) => node.chain === chain.id && node.node_type !== "chain");
    const nodeIds = new Set(chainNodes.map((node) => node.id));
    const mappings = data.edges
      .filter((edge) => edge.edge_type === "company_maps_to_industry_node" && nodeIds.has(edge.from_id) && isPublishedEdge(edge))
      .map((edge) => ({ edge, company: data.companies.find((company) => company.id === edge.to_id) }))
      .filter((item) => item.company && matchesMarketFilter(item.company, marketFilter));
    const companyIds = new Set(mappings.map((item) => item.company.id));
    const sourceIds = new Set(mappings.flatMap((item) => item.edge.source_ids || []));
    const marketCompanyIds = { a_share: new Set(), us: new Set(), unknown: new Set() };
    for (const { company } of mappings) {
      const market = getCompanyMarket(company);
      (marketCompanyIds[market] || marketCompanyIds.unknown).add(company.id);
    }
    const lastVerifiedAt = mappings
      .map(({ edge }) => getRelationPresentation(data, edge).lastVerifiedAt)
      .filter(Boolean)
      .sort()
      .at(-1) || chain.updated_at;

    return {
      chain,
      companyCount: companyIds.size,
      sourceCount: sourceIds.size,
      lastVerifiedAt,
      marketCounts: {
        a_share: marketCompanyIds.a_share.size,
        us: marketCompanyIds.us.size,
        unknown: marketCompanyIds.unknown.size,
      },
      stages: stageOrder.map((stage) => ({
        id: stage,
        label: stageLabels[stage],
        nodes: chainNodes
          .filter((node) => getNodeStage(node) === stage)
          .map((node) => {
            const nodeMappings = mappings.filter((item) => item.edge.from_id === node.id);
            return {
              node,
              companies: nodeMappings.map((item) => item.company),
              relationCount: nodeMappings.length,
            };
          }),
      })),
    };
  });
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

function evidenceRank(level) {
  return { L1: 3, L2: 2, L3: 1 }[level] || 0;
}

function strongestEvidenceLevel(evidences) {
  return evidences.reduce((best, evidence) => (
    evidenceRank(evidence.level) > evidenceRank(best) ? evidence.level : best
  ), "L3");
}

function sortQualityAlerts(alerts) {
  const severityOrder = { critical: 4, important: 3, watch: 2, info: 1 };
  return alerts.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));
}

function uniqueAlerts(alerts) {
  const seen = new Set();
  return sortQualityAlerts(alerts).filter((alert) => {
    const key = `${alert.type}:${alert.target_id || ""}:${alert.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getMappingQualityAlerts(data, edge) {
  if (!edge || edge.edge_type !== "company_maps_to_industry_node") return [];
  const node = data.nodes.find((item) => item.id === edge.from_id);
  const company = data.companies.find((item) => item.id === edge.to_id);
  const evidences = (edge.source_ids || [])
    .map((sourceId) => data.evidences.find((evidence) => evidence.id === sourceId))
    .filter(Boolean);
  const alerts = [];

  if (edge.review_status !== "accepted") {
    alerts.push({
      type: "needs_review",
      severity: "important",
      title: "映射待审核",
      body: `${company?.name || edge.to_id} 与 ${node?.name || edge.from_id} 的关联尚未人工确认。`,
      target_id: edge.id,
    });
  }

  if (evidences.length === 0) {
    alerts.push({
      type: "missing_source",
      severity: "critical",
      title: "缺少证据来源",
      body: "这条映射没有可复核的证据摘要，建议先补来源再用于研究。",
      target_id: edge.id,
    });
    return alerts;
  }

  const freshness = getEdgeRecency(data, edge);
  if (freshness.status !== "normal") {
    alerts.push({
      type: freshness.status === "missing" ? "missing_date" : "stale_source",
      severity: freshness.status === "stale" ? "important" : "watch",
      title: freshness.label,
      body: `${company?.name || edge.to_id} 的证据时效需要复核，避免旧材料影响相关性判断。`,
      target_id: edge.id,
    });
  }

  const levels = new Set(evidences.map((evidence) => evidence.level).filter(Boolean));
  if (levels.size > 1) {
    alerts.push({
      type: "mixed_evidence",
      severity: "info",
      title: "证据强弱不一",
      body: `同一映射包含 ${[...levels].sort().join("/")} 多种证据等级，建议查看时间线确认主证据。`,
      target_id: edge.id,
    });
  }

  const strongestLevel = strongestEvidenceLevel(evidences);
  if (evidenceRank(edge.evidence_level) < evidenceRank(strongestLevel)) {
    alerts.push({
      type: "level_mismatch",
      severity: "watch",
      title: "边等级低于来源",
      body: `来源中存在 ${strongestLevel} 证据，但映射边当前标为 ${edge.evidence_level}。`,
      target_id: edge.id,
    });
  }
  if (evidenceRank(edge.evidence_level) > evidenceRank(strongestLevel)) {
    alerts.push({
      type: "evidence_level_conflict",
      severity: "critical",
      title: "证据冲突：边等级高于来源",
      body: `${company?.name || edge.to_id} 当前映射标为 ${edge.evidence_level}，但底层来源最强只有 ${strongestLevel}。`,
      target_id: edge.id,
    });
  }

  return uniqueAlerts(alerts);
}

export function buildEvidenceConflictAlerts(data, evidenceFilter = "all", marketFilter = "all") {
  return uniqueAlerts((data.edges || [])
    .filter((edge) => edge.edge_type === "company_maps_to_industry_node" && matchesEvidenceFilter(edge, evidenceFilter))
    .filter((edge) => {
      const company = data.companies.find((item) => item.id === edge.to_id);
      return matchesMarketFilter(company, marketFilter);
    })
    .flatMap((edge) => getMappingQualityAlerts(data, edge))
    .filter((alert) => alert.type === "evidence_level_conflict"));
}

function buildCompanyPaths(data, companyId, evidenceFilter) {
  return (data.edges || [])
    .filter((edge) => edge.edge_type === "company_maps_to_industry_node" && edge.to_id === companyId && matchesEvidenceFilter(edge, evidenceFilter) && isPublishedEdge(edge))
    .map((edge) => {
      const node = data.nodes.find((item) => item.id === edge.from_id);
      const chain = data.chains.find((item) => item.id === node?.chain);
      const recency = getEdgeRecency(data, edge);
      return {
        edge,
        node,
        chain,
        recency,
        score: getAdjustedRelevance(edge, recency.recencyFactor),
      };
    })
    .filter((path) => path.node && path.chain)
    .sort((a, b) => b.score - a.score);
}

function strongestEdgeLevel(paths) {
  return paths.reduce((best, path) => (
    evidenceRank(path.edge.evidence_level) > evidenceRank(best) ? path.edge.evidence_level : best
  ), "L3");
}

export function buildCompanyPathCompare(data, company, evidenceFilter = "all", marketFilter = "all") {
  if (!company?.id) return { company: null, paths: [], peers: [] };
  const paths = buildCompanyPaths(data, company.id, evidenceFilter);
  const chainIds = new Set(paths.map((path) => path.chain.id));
  const nodeIds = new Set(paths.map((path) => path.node.id));

  const peers = data.companies
    .filter((candidate) => candidate.id !== company.id && matchesMarketFilter(candidate, marketFilter))
    .map((candidate) => {
      const peerPaths = buildCompanyPaths(data, candidate.id, evidenceFilter)
        .filter((path) => chainIds.has(path.chain.id));
      const sharedNodeNames = peerPaths
        .filter((path) => nodeIds.has(path.node.id))
        .map((path) => path.node.name);
      const sharedChainNames = [...new Set(peerPaths.map((path) => path.chain.name))];
      const uniqueNodeNames = peerPaths
        .filter((path) => !nodeIds.has(path.node.id))
        .map((path) => path.node.name);
      const score = peerPaths.reduce((sum, path) => sum + path.score, 0) / Math.max(1, peerPaths.length);
      return {
        company: candidate,
        paths: peerPaths,
        sharedNodeNames,
        sharedChainNames,
        uniqueNodeNames,
        strongestEvidenceLevel: strongestEdgeLevel(peerPaths),
        reviewCount: peerPaths.filter((path) => path.edge.review_status !== "accepted").length,
        score,
      };
    })
    .filter((peer) => peer.paths.length > 0)
    .sort((a, b) => (
      b.sharedNodeNames.length - a.sharedNodeNames.length
      || b.paths.length - a.paths.length
      || evidenceRank(b.strongestEvidenceLevel) - evidenceRank(a.strongestEvidenceLevel)
      || b.score - a.score
    ))
    .slice(0, 4);

  return { company, paths, peers };
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
  const source = data.meta.source || (datasetType === "demo" ? "demo" : "local_snapshot");
  const issueCount = staleCount + expiringCount + feedbackPendingCount + mappingReviewCount;
  const tone = staleCount > 0
    ? "danger"
    : expiringCount > 0 || feedbackPendingCount > 0 || mappingReviewCount > 0
      ? "amber"
      : datasetType === "demo" ? "muted" : "ok";
  return {
    datasetType,
    label: dataTypeLabels[datasetType] || datasetType,
    source,
    sourceLabel: dataSourceLabels[source] || source,
    tone,
    issueCount,
    staleCount,
    expiringCount,
    feedbackPendingCount,
    mappingReviewCount,
  };
}

export function getMappingEdgesForNode(data, active, evidenceFilter, marketFilter = "all") {
  if (!active || active.node_type === "overview") return [];
  const mappingEdges = data.edges.filter((edge) => {
    if (edge.edge_type !== "company_maps_to_industry_node" || !matchesEvidenceFilter(edge, evidenceFilter) || !isPublishedEdge(edge)) return false;
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
    .filter((edge) => edge.edge_type === "company_maps_to_industry_node" && matchesEvidenceFilter(edge, evidenceFilter) && isPublishedEdge(edge))
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
    .sort((a, b) => (
      data.chains.findIndex((chain) => chain.id === a.chain?.id) - data.chains.findIndex((chain) => chain.id === b.chain?.id)
      || stageOrder.indexOf(getNodeStage(a.node)) - stageOrder.indexOf(getNodeStage(b.node))
      || a.node.name.localeCompare(b.node.name, "zh-CN")
      || a.company.name.localeCompare(b.company.name, "zh-CN")
    ));
}

export function buildCoverageMatrix(data, evidenceFilter = "all", marketFilter = "all") {
  const rows = data.chains.map((chain) => {
    const nodeIds = new Set(data.nodes.filter((node) => node.chain === chain.id).map((node) => node.id));
    const edges = data.edges
      .filter((edge) => edge.edge_type === "company_maps_to_industry_node" && matchesEvidenceFilter(edge, evidenceFilter))
      .map((edge) => ({
        edge,
        company: data.companies.find((company) => company.id === edge.to_id),
        node: data.nodes.find((node) => node.id === edge.from_id),
      }))
      .filter((item) => item.company && item.node && nodeIds.has(item.node.id) && matchesMarketFilter(item.company, marketFilter));

    const companyIds = new Set(edges.map((item) => item.company.id));
    const marketCompanyIds = { a_share: new Set(), us: new Set(), unknown: new Set() };
    const evidenceCounts = { L1: 0, L2: 0, L3: 0 };
    const nodeCounts = new Map();
    let acceptedCount = 0;
    let normalFreshnessCount = 0;
    let weightedEvidence = 0;

    for (const { edge, company, node } of edges) {
      const market = getCompanyMarket(company);
      (marketCompanyIds[market] || marketCompanyIds.unknown).add(company.id);
      evidenceCounts[edge.evidence_level] = (evidenceCounts[edge.evidence_level] || 0) + 1;
      nodeCounts.set(node.id, (nodeCounts.get(node.id) || 0) + 1);
      if (edge.review_status === "accepted") acceptedCount += 1;
      if (getEdgeRecency(data, edge).status === "normal") normalFreshnessCount += 1;
      weightedEvidence += { L1: 1, L2: 0.7, L3: 0.35 }[edge.evidence_level] || 0.2;
    }

    const mappingCount = edges.length;
    const topNodeId = [...nodeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const topNode = data.nodes.find((node) => node.id === topNodeId);
    const qualityScore = mappingCount === 0 ? 0 : Math.round(100 * (
      0.55 * (weightedEvidence / mappingCount)
      + 0.25 * (acceptedCount / mappingCount)
      + 0.2 * (normalFreshnessCount / mappingCount)
    ));

    return {
      chain,
      companyCount: companyIds.size,
      mappingCount,
      publishedCount: acceptedCount,
      marketCounts: {
        a_share: marketCompanyIds.a_share.size,
        us: marketCompanyIds.us.size,
        unknown: marketCompanyIds.unknown.size,
      },
      evidenceCounts,
      reviewCount: edges.filter((item) => item.edge.review_status !== "accepted").length,
      topNodeName: topNode?.name || "暂无覆盖",
      qualityScore,
    };
  });

  const rowsWithAlerts = rows.map((row) => ({
    ...row,
    alerts: buildCoverageRowAlerts(row, marketFilter),
  }));
  const evidenceConflictAlerts = buildEvidenceConflictAlerts(data, evidenceFilter, marketFilter);

  return {
    rows: rowsWithAlerts,
    insights: uniqueAlerts(rowsWithAlerts.flatMap((row) => row.alerts).concat(evidenceConflictAlerts)).slice(0, 6),
    totals: rowsWithAlerts.reduce((acc, row) => ({
      companyCount: acc.companyCount + row.companyCount,
      mappingCount: acc.mappingCount + row.mappingCount,
      publishedCount: acc.publishedCount + row.publishedCount,
      reviewCount: acc.reviewCount + row.reviewCount,
      marketCounts: {
        a_share: acc.marketCounts.a_share + row.marketCounts.a_share,
        us: acc.marketCounts.us + row.marketCounts.us,
        unknown: acc.marketCounts.unknown + row.marketCounts.unknown,
      },
      evidenceCounts: {
        L1: acc.evidenceCounts.L1 + row.evidenceCounts.L1,
        L2: acc.evidenceCounts.L2 + row.evidenceCounts.L2,
        L3: acc.evidenceCounts.L3 + row.evidenceCounts.L3,
      },
    }), {
      companyCount: 0,
      mappingCount: 0,
      publishedCount: 0,
      reviewCount: 0,
      marketCounts: { a_share: 0, us: 0, unknown: 0 },
      evidenceCounts: { L1: 0, L2: 0, L3: 0 },
    }),
  };
}

function buildCoverageRowAlerts(row, marketFilter) {
  const alerts = [];
  if (row.mappingCount === 0) {
    alerts.push({
      type: "coverage_gap",
      severity: "critical",
      title: `${row.chain.name} 暂无公司映射`,
      body: "当前筛选下没有公司覆盖，适合优先补产业节点和证据。",
      target_id: row.chain.id,
    });
  }
  if (marketFilter === "all") {
    const missingMarkets = [
      row.marketCounts.a_share === 0 ? "A股" : null,
      row.marketCounts.us === 0 ? "美股" : null,
    ].filter(Boolean);
    if (missingMarkets.length > 0 && row.mappingCount > 0) {
      alerts.push({
        type: "market_gap",
        severity: "watch",
        title: `${row.chain.name} 缺少${missingMarkets.join("/")}覆盖`,
        body: "跨市场覆盖不完整，横向比较时需要谨慎。",
        target_id: row.chain.id,
      });
    }
  }
  if (row.reviewCount > 0) {
    alerts.push({
      type: "review_load",
      severity: "important",
      title: `${row.chain.name} 有 ${row.reviewCount} 条待审核`,
      body: "待审核映射应先复核来源，再进入正式研究结论。",
      target_id: row.chain.id,
    });
  }
  if (row.mappingCount > 0 && row.qualityScore < 60) {
    alerts.push({
      type: "low_quality",
      severity: "watch",
      title: `${row.chain.name} 证据质量偏低`,
      body: "当前链路的证据等级、审核状态或时效仍需补强。",
      target_id: row.chain.id,
    });
  }
  return sortQualityAlerts(alerts);
}

export function buildEntityQualityAlerts(data, active, evidenceFilter = "all", marketFilter = "all") {
  if (!active || active.node_type === "overview") {
    return buildCoverageMatrix(data, evidenceFilter, marketFilter).insights.slice(0, 4);
  }

  if (active.stock_code) {
    const mappings = data.edges.filter((edge) =>
      edge.edge_type === "company_maps_to_industry_node"
      && edge.to_id === active.id
      && matchesEvidenceFilter(edge, evidenceFilter),
    );
    if (mappings.length === 0) {
      return [{
        type: "coverage_gap",
        severity: "watch",
        title: "暂无产业映射",
        body: `${active.name} 当前筛选下没有可展示的 AI 产业链位置。`,
        target_id: active.id,
      }];
    }
    return uniqueAlerts(mappings.flatMap((edge) => getMappingQualityAlerts(data, edge))).slice(0, 4);
  }

  const mappings = getMappingEdgesForNode(data, active, evidenceFilter, marketFilter);
  const alerts = [];
  if (mappings.length === 0) {
    alerts.push({
      type: "coverage_gap",
      severity: "watch",
      title: "当前筛选下无公司覆盖",
      body: `${active.name} 还需要补充公司映射或放宽筛选条件。`,
      target_id: active.id,
    });
  }

  if (marketFilter === "all" && mappings.length > 0) {
    const markets = new Set(mappings.map((edge) => getCompanyMarket(data.companies.find((company) => company.id === edge.to_id))));
    const missingMarkets = [markets.has("a_share") ? null : "A股", markets.has("us") ? null : "美股"].filter(Boolean);
    if (missingMarkets.length > 0) {
      alerts.push({
        type: "market_gap",
        severity: "watch",
        title: `缺少${missingMarkets.join("/")}映射`,
        body: `${active.name} 的跨市场覆盖仍不完整。`,
        target_id: active.id,
      });
    }
  }

  return uniqueAlerts(alerts.concat(mappings.flatMap((edge) => getMappingQualityAlerts(data, edge)))).slice(0, 4);
}

export function getPathSummary(data, active, marketFilter = "all") {
  const marketLabel = getMarketLabel(marketFilter);
  if (!active || active.node_type === "overview") {
    const { companyCount } = getPublishedGraphStats(data, marketFilter);
    return `${marketLabel} · ${data.chains.length} 条链路 · ${data.nodes.length} 个节点 · ${companyCount} 家公司`;
  }
  if (active.stock_code) {
    const mappingEdges = getPublishedMappingEdges(data, marketFilter).filter((edge) => edge.to_id === active.id);
    const nodes = mappingEdges.map((edge) => data.nodes.find((node) => node.id === edge.from_id)?.name).filter(Boolean);
    return `${active.name} · ${active.stock_code} · ${nodes.join(" / ") || "未绑定产业节点"}`;
  }
  const chain = data.chains.find((item) => item.id === active.id || item.id === active.chain);
  const mappings = getMappingEdgesForNode(data, active, "all", marketFilter);
  if (active.node_type === "chain") {
    const nodes = data.nodes.filter((node) => node.chain === active.id && node.node_type !== "chain");
    const counts = Object.fromEntries(stageOrder.map((stage) => [stage, nodes.filter((node) => getNodeStage(node) === stage).length]));
    const companyCount = new Set(mappings.map((edge) => edge.to_id)).size;
    return `${chain?.name || active.name} · 上游 ${counts.upstream} · 核心 ${counts.core} · 下游 ${counts.downstream} · 公司 ${companyCount}`;
  }
  const upstream = data.edges.filter((edge) => edge.to_id === active.id && edge.edge_type !== "industry_parent" && edge.edge_type !== "company_maps_to_industry_node").length;
  const downstream = data.edges.filter((edge) => edge.from_id === active.id && edge.edge_type !== "industry_parent" && edge.edge_type !== "company_maps_to_industry_node").length;
  return `${chain?.name || "产业链"} · ${active.name} · 上游连接 ${upstream} · 下游连接 ${downstream} · 公司 ${mappings.length}`;
}

export function buildScopedData(data, onlyChain, marketFilter = "all") {
  const companyIdsForMarket = new Set(getPublishedMappingEdges(data, marketFilter).map((edge) => edge.to_id));
  if (!onlyChain) {
    const edges = data.edges.filter((edge) => edge.edge_type !== "company_maps_to_industry_node" || (companyIdsForMarket.has(edge.to_id) && isPublishedEdge(edge)));
    return {
      ...data,
      edges,
      companies: data.companies.filter((company) => companyIdsForMarket.has(company.id)),
    };
  }
  const nodeIds = new Set(data.nodes.filter((node) => node.chain === onlyChain).map((node) => node.id));
  const edges = data.edges.filter((edge) =>
    (nodeIds.has(edge.from_id) || nodeIds.has(edge.to_id))
    && (edge.edge_type !== "company_maps_to_industry_node" || (companyIdsForMarket.has(edge.to_id) && isPublishedEdge(edge))),
  );
  const companyIds = new Set(edges.map((edge) => edge.to_id).filter((id) => id.startsWith("company:")));
  return {
    ...data,
    nodes: data.nodes.filter((node) => nodeIds.has(node.id)),
    edges,
    companies: data.companies.filter((company) => companyIds.has(company.id)),
  };
}

export function buildFlow(data, activeId, query, evidenceFilter, direction = "LR") {
  const matched = new Set(searchItems(data, query).map((item) => item.id));
  const eligibleEdges = data.edges.filter((edge) => matchesEvidenceFilter(edge, evidenceFilter) && isPublishedEdge(edge));
  const hasProductFlow = eligibleEdges.some((edge) => edge.edge_type !== "industry_parent" && edge.edge_type !== "company_maps_to_industry_node");
  const explicitEdges = hasProductFlow ? eligibleEdges.filter((edge) => edge.edge_type !== "industry_parent") : eligibleEdges;
  const implicitHierarchyEdges = hasProductFlow ? [] : data.nodes
    .filter((node) => node.parent_id)
    .filter((node) => !explicitEdges.some((edge) => edge.edge_type === "industry_parent" && edge.from_id === node.parent_id && edge.to_id === node.id))
    .map((node) => ({
      id: `implicit_parent_${node.parent_id}_${node.id}`,
      from_id: node.parent_id,
      to_id: node.id,
      edge_type: "industry_parent",
      source_ids: [],
    }));
  const visibleEdges = explicitEdges.concat(implicitHierarchyEdges);
  const visibleCompanyIds = new Set(
    visibleEdges
      .filter((edge) => edge.edge_type === "company_maps_to_industry_node")
      .map((edge) => edge.to_id),
  );
  const visibleMappings = getPublishedMappingEdges(data);
  const visibleCompanyCountByNode = visibleMappings.reduce((counts, edge) => {
    const companyIds = counts.get(edge.from_id) || new Set();
    companyIds.add(edge.to_id);
    counts.set(edge.from_id, companyIds);
    return counts;
  }, new Map());
  const visibleCompanyCountByChain = visibleMappings.reduce((counts, edge) => {
    const chainId = data.nodes.find((node) => node.id === edge.from_id)?.chain;
    if (!chainId) return counts;
    const companyIds = counts.get(chainId) || new Set();
    companyIds.add(edge.to_id);
    counts.set(chainId, companyIds);
    return counts;
  }, new Map());

  const visibleIndustryIds = new Set(visibleEdges.flatMap((edge) => [edge.from_id, edge.to_id]).filter((id) => !String(id).startsWith("company:")));
  const industryNodes = data.nodes.filter((node) => !hasProductFlow || visibleIndustryIds.has(node.id)).map((node) => ({
      id: node.id,
      type: "mapNode",
      position: { x: 0, y: 0 },
      data: {
        title: node.name,
        subtitle: node.node_type === "chain"
          ? `${typeLabels[node.node_type]} · ${visibleCompanyCountByChain.get(node.id)?.size || 0} 家`
          : `${stageLabels[getNodeStage(node)]} · ${visibleCompanyCountByNode.get(node.id)?.size || 0} 家`,
        kind: "industry",
        layoutDirection: direction,
      },
      className: [
        "flowNode",
        activeId === node.id ? "isActive" : "",
        matched.has(node.id) ? "isMatched" : "",
      ].join(" "),
    }));

  const companyNodes = data.companies.filter((company) => visibleCompanyIds.has(company.id)).map((company) => ({
      id: company.id,
      type: "mapNode",
      position: { x: 0, y: 0 },
      data: {
        title: company.name,
        subtitle: `${company.stock_code} · ${getMarketLabel(getCompanyMarket(company))}`,
        kind: "company",
        layoutDirection: direction,
      },
      className: [
        "flowNode",
        "companyFlowNode",
        activeId === company.id ? "isActive" : "",
        matched.has(company.id) ? "isMatched" : "",
      ].join(" "),
    }));

  const allNodes = industryNodes.concat(companyNodes);
  const visibleNodeIds = new Set(allNodes.map((node) => node.id));
  const connectedEdges = visibleEdges.filter((edge) => visibleNodeIds.has(edge.from_id) && visibleNodeIds.has(edge.to_id));
  const layout = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  layout.setGraph({ rankdir: direction, align: "UL", nodesep: 28, ranksep: 78, marginx: 24, marginy: 24 });
  for (const node of allNodes) {
    layout.setNode(node.id, { width: node.data.kind === "company" ? 168 : 184, height: 60 });
  }
  for (const edge of connectedEdges) layout.setEdge(edge.from_id, edge.to_id);
  dagre.layout(layout);
  const nodes = allNodes.map((node) => {
    const point = layout.node(node.id);
    const width = node.data.kind === "company" ? 168 : 184;
    return { ...node, position: { x: point.x - width / 2, y: point.y - 30 } };
  });

  const edges = connectedEdges.map((edge) => {
    const relation = getRelationPresentation(data, edge);
    return {
      id: edge.id,
      source: edge.from_id,
      target: edge.to_id,
      animated: edge.from_id === activeId || edge.to_id === activeId,
      label: edge.edge_type === "company_maps_to_industry_node"
        ? relation.label
        : edge.edge_type === "industry_parent" ? "产业层级" : edgeTypeLabels[edge.edge_type] || "产业关系",
      className: [
        "flowEdge",
        `basis-${relation.basis}`,
        edge.from_id === activeId || edge.to_id === activeId ? "isActiveEdge" : "",
        matched.has(edge.from_id) || matched.has(edge.to_id) ? "isMatchedEdge" : "",
      ].join(" "),
    };
  });

  return { nodes, edges };
}

export function getMarketOptions(data) {
  const publishedCompanyIds = new Set(getPublishedMappingEdges(data).map((edge) => edge.to_id));
  const present = new Set(data.companies.filter((company) => publishedCompanyIds.has(company.id)).map((company) => getCompanyMarket(company)));
  return ["all", "a_share", "us"].filter((market) => market === "all" || present.has(market));
}
