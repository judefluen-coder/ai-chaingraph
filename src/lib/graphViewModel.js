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
    .filter((edge) => edge.edge_type === "company_maps_to_industry_node" && edge.to_id === companyId && matchesEvidenceFilter(edge, evidenceFilter))
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
