import {
  AlertTriangle,
  BadgeInfo,
  CheckCircle2,
  Database,
  GitBranch,
  Search,
  Send,
  ShieldAlert,
  Star,
  TimerReset,
  Trash2,
} from "lucide-react";
import {
  buildCompanyPathCompare,
  edgeTypeLabels,
  buildEntityQualityAlerts,
  getAdjustedRelevance,
  getCompanyMarket,
  getEdgeRecency,
  getEvidenceFreshness,
  getEvidenceItems,
  getMappingEdgesForNode,
  getMarketLabel,
  getSearchTarget,
  reviewStatusLabels,
  typeLabels,
} from "../lib/graphViewModel";
import { GraphViewport } from "./GraphViewport";

export function DetailDrawer({
  data,
  active,
  flow,
  showMiniGraph,
  query,
  searchResults,
  searchCollapsed,
  onToggleSearch,
  onClearSearch,
  onSelect,
  evidenceFilter,
  marketFilter,
  dataStatus,
  feedback,
  onFeedbackChange,
  onSaveFeedback,
  reviewRecords,
  onResolveReview,
  onExportFeedback,
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

      <DataStatusPanel data={data} status={dataStatus} />

      {showMiniGraph && (
        <section className="miniGraphCard">
          <div className="miniGraphHead">
            <GitBranch size={16} />
            <span>关系缩略图</span>
          </div>
          <GraphViewport flow={flow} activeId={active?.id} pathSummary="" onSelect={onSelect} compact />
        </section>
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

      <FeedbackPanel
        feedback={feedback}
        onFeedbackChange={onFeedbackChange}
        onSaveFeedback={onSaveFeedback}
      />

      <ReviewQueuePanel
        records={reviewRecords}
        onResolve={onResolveReview}
        onExport={onExportFeedback}
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

function DataStatusPanel({ data, status }) {
  return (
    <section className="sideCard dataStatusPanel">
      <PanelTitle icon={<Database size={17} />} title="数据状态" label={status.label} />
      <div className="statusGrid">
        <Metric value={status.staleCount} label="过期证据" />
        <Metric value={status.expiringCount} label="即将过期" />
        <Metric value={status.mappingReviewCount} label="映射待审核" />
        <Metric value={status.feedbackPendingCount} label="本地反馈" />
      </div>
      <p className="smallNote">当前数据集：{data.meta.name}。公开 demo 只用于产品体验验证。</p>
    </section>
  );
}

function DetailPanel({ data, active, notice, evidenceFilter, marketFilter, watchlistRecords, watchlistIds, onToggleWatchlist, onUpdateWatchlist, onSelect }) {
  const qualityAlerts = buildEntityQualityAlerts(data, active, evidenceFilter, marketFilter);

  if (active?.node_type === "overview") {
    const evidenceCounts = data.edges.reduce((acc, edge) => {
      acc[edge.evidence_level] = (acc[edge.evidence_level] || 0) + 1;
      return acc;
    }, {});
    return (
      <section className="sideCard detailPanel">
        <PanelTitle icon={<BadgeInfo size={17} />} title="AI 产业链总览" label="选股地图入口" />
        <p className="muted">先从产业链定位方向，再进入公司映射和证据摘要。图谱展示逻辑关系，不给买卖建议。</p>
        <div className="metricGrid">
          <Metric value={data.chains.length} label="覆盖链路" />
          <Metric value={data.nodes.length} label="产业节点" />
          <Metric value={data.companies.length} label="公司池" />
          <Metric value={`${evidenceCounts.L1 || 0}/${evidenceCounts.L2 || 0}/${evidenceCounts.L3 || 0}`} label="L1/L2/L3" />
        </div>
        <QualityAlerts alerts={qualityAlerts} />
        <RiskNote />
      </section>
    );
  }

  if (active?.stock_code) {
    const mappings = data.edges.filter((edge) => edge.to_id === active.id);
    const filteredMappings = mappings.filter((edge) => edge.evidence_level === evidenceFilter || evidenceFilter === "all");
    const quote = data.quote_snapshots.find((item) => item.stock_code === active.stock_code);
    const evidenceItems = getEvidenceItems(data, filteredMappings);
    const firstMapping = filteredMappings[0] || mappings[0];
    const firstRecency = firstMapping ? getEdgeRecency(data, firstMapping) : null;
    const firstScore = firstMapping ? getAdjustedRelevance(firstMapping, firstRecency.recencyFactor) : null;
    const market = getCompanyMarket(active);
    const marketCapUnit = market === "us" ? "亿美元" : "亿元";
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
          <span>行业：{quote?.industry || active.industry || "待补"}</span>
          <span>市值：{quote?.market_cap ? `${quote.market_cap} ${marketCapUnit}` : "待补"}</span>
          <span>PE/PB：{quote?.pe ?? "待补"} / {quote?.pb ?? "待补"}</span>
        </div>
        <section className="whyBox">
          <h3>为什么相关</h3>
          <p>
            {firstMapping
              ? `映射到 ${data.nodes.find((node) => node.id === firstMapping.from_id)?.name || "产业节点"}，当前时效调整相关性 ${Math.round(firstScore * 100)}%，证据等级 ${firstMapping.evidence_level}。`
              : "暂无已绑定产业链映射。"}
          </p>
        </section>
        <PathComparePanel compare={pathCompare} onSelect={onSelect} />
        {isWatched && (
          <WatchlistMemo
            record={watchRecord}
            onChange={(patch) => onUpdateWatchlist(active.id, patch)}
          />
        )}
        <QualityAlerts alerts={qualityAlerts} />
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
  const l3Mappings = mappingEdges.filter((edge) => edge.evidence_level === "L3");

  return (
    <section className="sideCard detailPanel">
      <PanelTitle icon={<GitBranch size={17} />} title={active.name} label={typeLabels[active.node_type]} />
      <p className="muted">{active.description || chain?.description}</p>
      <div className="pathBox">{chain?.name} / {active.name}</div>
      {mappingEdges.length > 0 && l3Mappings.length === mappingEdges.length && (
        <p className="reviewWarning">当前公司映射全部为 L3 公开线索，默认进入待审核。</p>
      )}
      <QualityAlerts alerts={qualityAlerts} />
      <CompanyList data={data} mappings={mappingEdges} />
      <EvidenceTimeline items={evidenceItems} />
      <EvidenceList items={evidenceItems} />
      <RiskNote />
      {notice && <p className="noticeText">{notice}</p>}
    </section>
  );
}

function PathComparePanel({ compare, onSelect }) {
  if (!compare?.paths?.length) return null;
  return (
    <section className="infoBlock pathCompare" aria-label="产业链路径对比">
      <h3><GitBranch size={14} />产业链路径对比</h3>
      <div className="pathChipRow">
        {compare.paths.map((path) => (
          <span className={`pathChip level-${path.edge.evidence_level}`} key={path.edge.id}>
            {path.chain.name} / {path.node.name}
            <small>{path.edge.evidence_level} · 相关 {Math.round(path.score * 100)}%</small>
          </span>
        ))}
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
              <em>{peer.paths.length} 条路径 · 最强 {peer.strongestEvidenceLevel} · {peer.reviewCount} 待审</em>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function QualityAlerts({ alerts }) {
  if (!alerts?.length) return null;
  return (
    <section className="qualityAlerts" aria-label="质量提示与证据冲突">
      <h3><AlertTriangle size={14} />质量提示 / 证据冲突</h3>
      <div>
        {alerts.map((alert) => (
          <article className={`qualityAlert severity-${alert.severity}`} key={`${alert.type}:${alert.target_id}:${alert.title}`}>
            <strong>{alert.title}</strong>
            <span>{alert.body}</span>
          </article>
        ))}
      </div>
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
          <input value={record.tags || ""} onChange={(event) => onChange({ tags: event.target.value })} placeholder="光模块;高纯度" />
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

function FeedbackPanel({ feedback, onFeedbackChange, onSaveFeedback }) {
  return (
    <section className="sideCard feedbackPanel">
      <PanelTitle icon={<ShieldAlert size={17} />} title="人工校正" label="API / 本地记录" />
      <label>
        反馈类型
        <select value={feedback.issue_type} onChange={(event) => onFeedbackChange({ ...feedback, issue_type: event.target.value })}>
          <option value="stale">证据过期</option>
          <option value="incorrect">证据有误</option>
          <option value="wrong_mapping">关联关系有误</option>
          <option value="wrong_category">分类不当</option>
          <option value="concept_pollution">存在概念污染</option>
          <option value="add_evidence">补充证据</option>
        </select>
      </label>
      <label>
        来源 URL
        <input value={feedback.url} onChange={(event) => onFeedbackChange({ ...feedback, url: event.target.value })} placeholder="可选，本地记录" />
      </label>
      <label>
        说明
        <textarea value={feedback.note} onChange={(event) => onFeedbackChange({ ...feedback, note: event.target.value })} placeholder="记录校正理由或补充线索" />
      </label>
      <button className="primaryButton" onClick={onSaveFeedback}><Send size={15} />保存到待审核</button>
    </section>
  );
}

function CompanyList({ data, mappings }) {
  return (
    <section className="infoBlock">
      <h3>相关公司</h3>
      {mappings.length === 0 ? <p className="muted">当前筛选下暂无公司映射。</p> : mappings.map((edge) => {
        const company = data.companies.find((item) => item.id === edge.to_id);
        const recency = getEdgeRecency(data, edge);
        const adjustedRelevance = getAdjustedRelevance(edge, recency.recencyFactor);
        return (
          <div key={edge.id} className="companyCard">
            <div className="companyCardHead">
              <strong>{company?.name}</strong>
              <span className={`levelPill level-${edge.evidence_level}`}>{edge.evidence_level}</span>
            </div>
            <span>{company?.stock_code} · {company?.industry}</span>
            <div className="mappingMeta">
              <span>{edgeTypeLabels[edge.edge_type]}</span>
              <span>相关 {Math.round(adjustedRelevance * 100)}%</span>
              <b className={`freshness-${recency.status}`}>{recency.label}</b>
              {edge.review_status !== "accepted" && <b>待审核</b>}
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
            return (
              <li key={`${edge.id}:${evidence.id}`}>
                <time>{evidence.publish_date || "日期待补"}</time>
                <div>
                  <strong>{evidence.title}</strong>
                  <span>
                    <b className={`freshness-${freshness.status}`}>{freshness.label}</b>
                    <em>{evidence.level}</em>
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
  const adjustedRelevance = getAdjustedRelevance(edge, freshness.recencyFactor);
  return (
    <article className={`evidenceCard level-${evidence.level} freshness-${freshness.status}`}>
      <div><span>{evidence.level}</span><strong>{evidence.title}</strong></div>
      <p>{evidence.excerpt}</p>
      <div className="evidenceMeta">
        <span>{edgeTypeLabels[edge.edge_type]}</span>
        <span>相关 {Math.round(adjustedRelevance * 100)}%</span>
        <b className={`freshness-${freshness.status}`}>{freshness.label}</b>
      </div>
      <small>{evidence.source_type} · {evidence.publish_date} · {evidence.reviewer}</small>
    </article>
  );
}

function ReviewQueuePanel({ records, onResolve, onExport }) {
  return (
    <section className="sideCard reviewQueuePanel">
      <div className="queueHead">
        <PanelTitle icon={<Database size={17} />} title="本地审核队列" label={`${records.filter((record) => record.status === "pending").length} 待处理`} />
      </div>
      <p className="smallNote">导出数据仅供研究参考，重新分发时需附带免责声明。</p>
      <div className="exportActions">
        <button onClick={() => onExport("json")}>导出 JSON</button>
        <button onClick={() => onExport("csv")}>导出 CSV</button>
      </div>
      {records.length === 0 ? <p className="muted">暂无本地反馈。</p> : records.slice().reverse().map((record) => (
        <article className="reviewCard" key={record.id}>
          <strong>{record.issue_type} · {record.target_id}</strong>
          <small>{reviewStatusLabels[record.status] || record.status} · {record.created_at}</small>
          {record.payload?.url && <small>来源：{record.payload.url}</small>}
          {record.payload?.note && <p>{record.payload.note}</p>}
          <div className="reviewActions">
            <button onClick={() => onResolve(record.id, "accepted")}>接受</button>
            <button onClick={() => onResolve(record.id, "rejected")}>拒绝</button>
            <button onClick={() => onResolve(record.id, "needs_more_source")}>需更多来源</button>
          </div>
        </article>
      ))}
    </section>
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
