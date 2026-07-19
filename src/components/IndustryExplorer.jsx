import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  Database,
  GitBranch,
  ListFilter,
} from "lucide-react";

export function IndustryExplorer({
  atlas,
  focusedChainId,
  dataVersion,
  onFocusChain,
  onSelectNode,
  onSelectCompany,
  onViewGraph,
  onViewCompanies,
}) {
  const focused = atlas.find((item) => item.chain.id === focusedChainId);

  if (focused) {
    return (
      <section className="industryExplorer industryExplorerFocused">
        <header className="atlasHeader focusedAtlasHeader">
          <div>
            <button className="backLink" onClick={() => onFocusChain(null)}>
              <ArrowLeft size={15} />返回 AI 产业全景
            </button>
            <span className="eyebrow">产业链路径</span>
            <h1>{focused.chain.name}</h1>
            <p>{focused.chain.description}</p>
          </div>
          <div className="atlasActions">
            <button className="secondaryAction" onClick={() => onViewCompanies(focused.chain.id)}>
              <ListFilter size={16} />查看公司目录
            </button>
            <button className="primaryAction" onClick={() => onViewGraph(focused.chain.id)}>
              <GitBranch size={16} />打开关系图
            </button>
          </div>
        </header>

        <div className="chainFactBar" aria-label="当前链路数据概况">
          <Fact icon={<Building2 size={15} />} value={`${focused.companyCount} 家公司`} label={`A股 ${focused.marketCounts.a_share} · 美股 ${focused.marketCounts.us}`} />
          <Fact icon={<Database size={15} />} value={`${focused.sourceCount} 个来源`} label="每条公司关系可追溯" />
          <Fact icon={<CalendarClock size={15} />} value={formatDate(focused.lastVerifiedAt)} label="最近核验" />
        </div>

        <div className="stagePath" aria-label={`${focused.chain.name} 上下游路径`}>
          {focused.stages.map((stage, index) => (
            <div className="stagePathItem" key={stage.id}>
              <section className={`stageColumn stage-${stage.id}`}>
                <header>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{stage.label}</strong>
                    <small>{stage.nodes.length} 个产业节点</small>
                  </div>
                </header>
                <div className="stageNodeList">
                  {stage.nodes.length === 0 ? (
                    <div className="stageEmpty">当前数据尚未收录该阶段节点</div>
                  ) : stage.nodes.map(({ node, companies }) => (
                    <article className="stageNode" key={node.id}>
                      <button className="stageNodeMain" onClick={() => onSelectNode(node.id)}>
                        <strong>{node.name}</strong>
                        <span>{node.description}</span>
                      </button>
                      <div className="stageCompanies">
                        {companies.length === 0 ? (
                          <small>产业应用节点</small>
                        ) : companies.slice(0, 4).map((company) => (
                          <button key={company.id} onClick={() => onSelectCompany(company.id)}>
                            {company.name}<span>{company.stock_code}</span>
                          </button>
                        ))}
                        {companies.length > 4 && <small>另有 {companies.length - 4} 家</small>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              {index < focused.stages.length - 1 && <ArrowRight className="stageArrow" size={20} aria-hidden="true" />}
            </div>
          ))}
        </div>

        <footer className="relationLegend">
          <span><i className="legendLine isProduct" />产品与产业事实</span>
          <span><i className="legendLine isCompany" />上市公司所在位置</span>
          <small>点击节点查看定义，点击公司查看完整路径和公开来源。</small>
        </footer>
      </section>
    );
  }

  return (
    <section className="industryExplorer">
      <header className="atlasHeader">
        <div>
          <span className="eyebrow">产业发现入口</span>
          <h1>AI 产业全景</h1>
          <p>从产业链出发，沿上游、核心环节和下游应用逐层发现 A股与美股公司。</p>
        </div>
        <div className="versionNote">
          <CalendarClock size={16} />
          <span>每周更新</span>
          <small>{dataVersion}</small>
        </div>
      </header>

      <div className="atlasSummary" aria-label="产业全景概况">
        <strong>{atlas.length}</strong>
        <span>条产业链</span>
        <b>{atlas.reduce((sum, item) => sum + item.companyCount, 0)}</b>
        <span>家公司映射</span>
        <b>{atlas.reduce((sum, item) => sum + item.sourceCount, 0)}</b>
        <span>个公开来源</span>
      </div>

      <div className="chainDiscoveryGrid">
        {atlas.map((item, index) => (
          <article className="chainDiscoveryCard" key={item.chain.id}>
            <button className="chainDiscoveryMain" onClick={() => onFocusChain(item.chain.id)}>
              <span className="chainIndex">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{item.chain.name}</h2>
                <p>{item.chain.description}</p>
              </div>
              <ArrowRight size={19} />
            </button>
            <div className="chainStagePreview">
              {item.stages.map((stage) => (
                <div key={stage.id}>
                  <span>{stage.label}</span>
                  <strong>{stage.nodes.slice(0, 2).map(({ node }) => node.name).join(" / ") || "待补"}</strong>
                </div>
              ))}
            </div>
            <footer>
              <span>{item.companyCount} 家公司</span>
              <span>A股 {item.marketCounts.a_share}</span>
              <span>美股 {item.marketCounts.us}</span>
              <time dateTime={item.lastVerifiedAt || undefined}>核验 {formatDate(item.lastVerifiedAt)}</time>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function Fact({ icon, value, label }) {
  return (
    <div className="chainFact">
      {icon}
      <div><strong>{value}</strong><span>{label}</span></div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "待补";
  return String(value).slice(0, 10);
}
