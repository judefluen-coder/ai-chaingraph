import {
  AlertTriangle,
  BadgeInfo,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Search,
  Star,
  TimerReset,
  Trash2,
} from "lucide-react";
import {
  buildCompanyPathCompare,
  edgeTypeLabels,
  getCompanyMarket,
  getEvidenceFreshness,
  getEvidenceItems,
  getMappingEdgesForNode,
  getMarketLabel,
  getPublishedGraphStats,
  getRelationPresentation,
  getSearchTarget,
  isPublishedEdge,
  typeLabels,
} from "../lib/graphViewModel";

export function DetailDrawer({
  data,
  active,
  query,
  searchResults,
  searchCollapsed,
  onToggleSearch,
  onClearSearch,
  onSelect,
  evidenceFilter,
  marketFilter,
  watchlistRecords,
  watchlistIds,
  onToggleWatchlist,
  onUpdateWatchlist,
  onRemoveWatchlist,
  onExportWatchlist,
  notice,
}) {
  return (
    <aside className="detailDrawer">
      {query && (
        <SearchPanel
          data={data}
          results={searchResults}
          query={query}
          collapsed={searchCollapsed}
          onToggle={onToggleSearch}
          onClear={onClearSearch}
          onSelect={onSelect}
        />
      )}

      <DetailPanel
        data={data}
        active={active}
        notice={notice}
        evidenceFilter={evidenceFilter}
        marketFilter={marketFilter}
        watchlistRecords={watchlistRecords}
        watchlistIds={watchlistIds}
        onToggleWatchlist={onToggleWatchlist}
        onUpdateWatchlist={onUpdateWatchlist}
        onSelect={onSelect}
      />

      <WatchlistPanel
        data={data}
        records={watchlistRecords}
        onSelect={onSelect}
        onUpdate={onUpdateWatchlist}
        onRemove={onRemoveWatchlist}
        onExport={onExportWatchlist}
      />

    </aside>
  );
}

function SearchPanel({ data, results, query, collapsed, onToggle, onClear, onSelect }) {
  return (
    <section className="sideCard searchContext">
      <div className="sideCardHead">
        <PanelTitle icon={<Search size={17} />} title={`搜索：${query}`} label={`${results.length} 条命中`} />
        <div className="contextActions">
          <button onClick={onToggle}>{collapsed ? "展开" : "折叠"}</button>
          <button onClick={onClear}>清除</button>
        </div>
      </div>
      {!collapsed && (
        <>
          <p className="smallNote">搜索只帮助定位，不代表投资价值排序。</p>
          <div className="resultList">
            {results.length === 0 && <p className="muted">未命中，可尝试“光模块”“液冷”“300801”。</p>}
            {results.map((item) => (
              <button key={item.id} onClick={() => onSelect(getSearchTarget(data, item))}>
                <span>{item.title || item.name}</span>
                <small>{item.stock_code || item.source_type || typeLabels[item.node_type]}</small>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function DetailPanel({ data, active, notice, evidenceFilter, marketFilter, watchlistRecords, watchlistIds, onToggleWatchlist, onUpdateWatchlist, onSelect }) {
  if (active?.node_type === "overview") {
    const publishedStats = getPublishedGraphStats(data, marketFilter);
    return (
      <section className="sideCard detailPanel">
        <PanelTitle icon={<BadgeInfo size={17} />} title="AI 产业链总览" label={data.meta.data_version} />
        <p className="muted">从产业链选择方向，沿上游、核心环节和下游应用发现公司。每条关系都应能回到公开来源。</p>
        <div className="metricGrid">
          <Metric value={data.chains.length} label="覆盖链路" />
          <Metric value={data.nodes.length} label="产业节点" />
          <Metric value={publishedStats.companyCount} label="上市公司" />
          <Metric value={publishedStats.sourceCount} label="公开来源" />
        </div>
        <div className="basisGuide">
          <span className="basisBadge basis-official_disclosure">官方披露</span>
          <span className="basisBadge basis-product_fact">产品事实</span>
          <span className="basisBadge basis-industry_inference">产业推导</span>
        </div>
        <RiskNote />
      </section>
    );
  }

  if (active?.stock_code) {
    const mappings = data.edges.filter((edge) => edge.to_id === active.id && edge.edge_type === "company_maps_to_industry_node" && isPublishedEdge(edge));
    const filteredMappings = mappings.filter((edge) => edge.evidence_level === evidenceFilter || evidenceFilter === "all");
    const evidenceItems = getEvidenceItems(data, filteredMappings);
    const firstMapping = filteredMappings[0] || mappings[0];
    const firstRelation = firstMapping ? getRelationPresentation(data, firstMapping) : null;
    const market = getCompanyMarket(active);
    const isWatched = watchlistIds?.has(active.id);
    const watchRecord = watchlistRecords?.find((record) => record.company_id === active.id);
    const pathCompare = buildCompanyPathCompare(data, active, evidenceFilter, marketFilter);
    return (
      <section className="sideCard detailPanel">
        <PanelTitle icon={<CheckCircle2 size={17} />} title={active.name} label={active.stock_code} />
        <button className={`watchButton ${isWatched ? "isActive" : ""}`} aria-pressed={isWatched} onClick={() => onToggleWatchlist(active)}>
          <Star size={15} />
          {isWatched ? "已加入观察" : "加入观察"}
        </button>
        <div className="quoteBox">
          <span>市场：{getMarketLabel(market)}</span>
          <span>交易所：{active.exchange}</span>
          <span>行业：{active.industry || "待补"}</span>
          <span>关系：{mappings.length} 条</span>
        </div>
        <section className="whyBox">
          <div className="whyHead">
            <h3>为什么相关</h3>
            {firstRelation && <span className={`basisBadge basis-${firstRelation.basis}`}>{firstRelation.label}</span>}
          </div>
          <p>{firstRelation?.summary || "暂无已绑定产业链映射。"}</p>
          {firstRelation?.lastVerifiedAt && <small>最后核验：{String(firstRelation.lastVerifiedAt).slice(0, 10)}</small>}
        </section>
        <PathComparePanel data={data} compare={pathCompare} onSelect={onSelect} />
        {isWatched && (
          <WatchlistMemo
            record={watchRecord}
            onChange={(patch) => onUpdateWatchlist(active.id, patch)}
          />
        )}
        <EvidenceTimeline items={evidenceItems} />
        <EvidenceList items={evidenceItems} />
        <RiskNote />
        {notice && <p className="noticeText">{notice}</p>}
      </section>
    );
  }

  const chain = data.chains.find((item) => item.id === active?.id || item.id === active?.chain);
  const mappingEdges = getMappingEdgesForNode(data, active, evidenceFilter, marketFilter);
  const filteredEdges = data.edges
    .filter((edge) => edge.from_id === active.id || edge.to_id === active.id)
    .filter((edge) => edge.edge_type === "industry_parent" || edge.evidence_level === evidenceFilter || evidenceFilter === "all");
  const evidenceItems = getEvidenceItems(data, filteredEdges.concat(mappingEdges));

  return (
    <section className="sideCard detailPanel">
      <PanelTitle icon={<GitBranch size={17} />} title={active.name} label={typeLabels[active.node_type]} />
      <p className="muted">{active.description || chain?.description}</p>
      <div className="pathBox">{chain?.name} / {active.name}</div>
      <CompanyList data={data} mappings={mappingEdges} />
      <EvidenceTimeline items={evidenceItems} />
      <EvidenceList items={evidenceItems} />
      <RiskNote />
      {notice && <p className="noticeText">{notice}</p>}
    </section>
  );
}

function PathComparePanel({ data, compare, onSelect }) {
  if (!compare?.paths?.length) return null;
  return (
    <section className="infoBlock pathCompare" aria-label="产业链路径对比">
      <h3><GitBranch size={14} />产业链路径对比</h3>
      <div className="pathChipRow">
        {compare.paths.map((path) => {
          const relation = getRelationPresentation(data, path.edge);
          return (
            <span className={`pathChip basis-${relation.basis}`} key={path.edge.id}>
              {path.chain.name} / {path.node.name}
              <small>{relation.label} · 核验 {String(relation.lastVerifiedAt || "待补").slice(0, 10)}</small>
            </span>
          );
        })}
      </div>
      {compare.peers.length === 0 ? <p className="muted">当前筛选下暂无同链路可比公司。</p> : (
        <div className="pathPeerList">
          {compare.peers.map((peer) => (
            <button className="pathPeerCard" key={peer.company.id} onClick={() => onSelect(peer.company.id)}>
              <strong>{peer.company.name}</strong>
              <span>{peer.company.stock_code} · {getMarketLabel(getCompanyMarket(peer.company))}</span>
              <small>
                {peer.sharedNodeNames.length > 0
                  ? `共享节点：${peer.sharedNodeNames.join(" / ")}`
                  : `同链路：${peer.sharedChainNames.join(" / ")}`}
              </small>
              {peer.uniqueNodeNames.length > 0 && <small>差异节点：{peer.uniqueNodeNames.join(" / ")}</small>}
              <em>{peer.paths.length} 条产业路径</em>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function WatchlistPanel({ data, records, onSelect, onUpdate, onRemove, onExport }) {
  return (
    <section className="sideCard watchlistPanel">
      <div className="queueHead">
        <PanelTitle icon={<Star size={17} />} title="观察列表" label={`${records.length} 家公司`} />
      </div>
      <p className="smallNote">只保存在当前浏览器，用于整理待跟踪公司。</p>
      <div className="exportActions">
        <button disabled={records.length === 0} onClick={() => onExport("json")}>导出 JSON</button>
        <button disabled={records.length === 0} onClick={() => onExport("csv")}>导出 CSV</button>
      </div>
      {records.length === 0 ? <p className="muted">暂无观察公司。进入公司详情后可加入观察。</p> : (
        <div className="watchList">
          {records.slice().reverse().map((record) => {
            const company = data.companies.find((item) => item.id === record.company_id);
            const name = record.name || company?.name || record.company_id;
            const stockCode = record.stock_code || company?.stock_code || "代码待补";
            const market = record.market || getCompanyMarket(company);
            return (
              <article className="watchItem" key={record.company_id}>
                <button className="watchInfo" onClick={() => onSelect(record.company_id)}>
                  <strong>{name}</strong>
                  <span>{stockCode} · {getMarketLabel(market)}</span>
                  <small>{record.industry || company?.industry || "行业待补"}</small>
                </button>
                <button className="iconButton" aria-label={`移除 ${name}`} onClick={() => onRemove(record.company_id)}>
                  <Trash2 size={15} />
                </button>
                <WatchlistMemo
                  record={record}
                  compact
                  onChange={(patch) => onUpdate(record.company_id, patch)}
                />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WatchlistMemo({ record, compact = false, onChange }) {
  if (!record) return null;
  return (
    <section className={`watchMemo ${compact ? "isCompact" : ""}`} aria-label="观察备注">
      <div className="watchMemoHead">
        <strong>观察备注</strong>
        <span>{record.updated_at ? `更新 ${record.updated_at.slice(0, 10)}` : "本地保存"}</span>
      </div>
      <div className="watchMemoGrid">
        <label>
          优先级
          <select value={record.priority || "medium"} onChange={(event) => onChange({ priority: event.target.value })}>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </label>
        <label>
          标签
          <input value={record.tags || ""} onChange={(event) => onChange({ tags: event.target.value })} placeholder="光模块;数据中心" />
        </label>
        <label>
          下次复核
          <input type="date" value={record.next_review_at || ""} onChange={(event) => onChange({ next_review_at: event.target.value })} />
        </label>
      </div>
      <label>
        研究假设
        <textarea value={record.thesis || ""} onChange={(event) => onChange({ thesis: event.target.value })} placeholder="记录关注理由、待验证证据或触发条件" />
      </label>
    </section>
  );
}

function CompanyList({ data, mappings }) {
  return (
    <section className="infoBlock">
      <h3>相关公司</h3>
      {mappings.length === 0 ? <p className="muted">当前筛选下暂无公司映射。</p> : mappings.map((edge) => {
        const company = data.companies.find((item) => item.id === edge.to_id);
        const relation = getRelationPresentation(data, edge);
        return (
          <div key={edge.id} className="companyCard">
            <div className="companyCardHead">
              <strong>{company?.name}</strong>
              <span className={`basisBadge basis-${relation.basis}`}>{relation.label}</span>
            </div>
            <span>{company?.stock_code} · {company?.industry}</span>
            <div className="mappingMeta">
              <span>{edgeTypeLabels[edge.edge_type]}</span>
              <span>核验 {String(relation.lastVerifiedAt || "待补").slice(0, 10)}</span>
              <b>{edge.source_ids?.length || 0} 个来源</b>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function EvidenceList({ items }) {
  return (
    <section className="infoBlock">
      <h3>证据摘要</h3>
      {items.length === 0 ? <p className="muted">当前筛选下暂无已绑定证据。</p> : items.map(({ evidence, edge }) => (
        <EvidenceCard key={`${edge.id}:${evidence.id}`} evidence={evidence} edge={edge} />
      ))}
    </section>
  );
}

function EvidenceTimeline({ items }) {
  const timeline = items
    .slice()
    .sort((a, b) => (b.evidence.publish_date || "").localeCompare(a.evidence.publish_date || ""))
    .slice(0, 6);
  const staleCount = timeline.filter(({ evidence }) => getEvidenceFreshness(evidence).status !== "normal").length;
  return (
    <section className="infoBlock evidenceTimeline" aria-label="证据时间线">
      <div className="timelineHead">
        <h3><TimerReset size={14} />证据时间线</h3>
        <span>{timeline.length} 条 · {staleCount} 条需关注</span>
      </div>
      {timeline.length === 0 ? <p className="muted">当前筛选下暂无可排序证据。</p> : (
        <ol>
          {timeline.map(({ evidence, edge }) => {
            const freshness = getEvidenceFreshness(evidence);
            const relation = getRelationPresentation({ evidences: [evidence] }, edge);
            return (
              <li key={`${edge.id}:${evidence.id}`}>
                <time>{evidence.publish_date || "日期待补"}</time>
                <div>
                  <strong>{evidence.title}</strong>
                  <span>
                    <b className={`freshness-${freshness.status}`}>{freshness.label}</b>
                    <em>{relation.label}</em>
                    <small>{edgeTypeLabels[edge.edge_type]}</small>
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function EvidenceCard({ evidence, edge }) {
  const freshness = getEvidenceFreshness(evidence);
  const relation = getRelationPresentation({ evidences: [evidence] }, edge);
  return (
    <article className={`evidenceCard level-${evidence.level} freshness-${freshness.status}`}>
      <div><span>{relation.label}</span><strong>{evidence.title}</strong></div>
      <p>{evidence.excerpt}</p>
      <div className="evidenceMeta">
        <span>{edgeTypeLabels[edge.edge_type]}</span>
        <b className={`freshness-${freshness.status}`}>{freshness.label}</b>
      </div>
      <small>{evidence.source_type} · {evidence.publish_date} · 核验 {String(relation.lastVerifiedAt || "待补").slice(0, 10)}</small>
      {evidence.url && <a href={evidence.url} target="_blank" rel="noreferrer"><ExternalLink size={13} />打开公开来源</a>}
    </article>
  );
}

function PanelTitle({ icon, title, label }) {
  return (
    <div className="panelTitle">
      <span className="titleIcon">{icon}</span>
      <div>
        <h2>{title}</h2>
        <small>{label}</small>
      </div>
    </div>
  );
}

function Metric({ value, label }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>;
}

function RiskNote() {
  return (
    <div className="riskNote">
      <AlertTriangle size={16} />
      本工具只做信息组织与产业研究辅助，不构成投资建议、买卖建议或交易策略。
    </div>
  );
}
