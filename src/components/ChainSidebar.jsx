import { ChevronDown, ChevronRight } from "lucide-react";
import { getPublishedMappingEdges, searchItems } from "../lib/graphViewModel";

export function ChainSidebar({
  data,
  activeId,
  query,
  onlyChain,
  onSelect,
  onScope,
}) {
  return (
    <aside className="chainSidebar">
      <section className="sidebarIntro">
        <span className="eyebrow">产业链导航</span>
        <h2>从产业链开始</h2>
        <p>先选择产业方向，再沿上游、核心环节和下游应用发现公司。</p>
      </section>

      <button
        className={`chainRoot ${activeId === "overview" ? "isActive" : ""}`}
        aria-current={activeId === "overview" ? "page" : undefined}
        onClick={() => onScope(null)}
      >
        <span>AI 产业链总览</span>
        <b>{data.nodes.length} 节点</b>
      </button>

      <div className="chainList">
        {data.chains.map((chain) => (
          <ChainGroup
            key={chain.id}
            chain={chain}
            data={data}
            activeId={activeId}
            query={query}
            scoped={onlyChain === chain.id}
            onSelect={onSelect}
            onScope={() => onScope(chain.id)}
          />
        ))}
      </div>
    </aside>
  );
}

function ChainGroup({ chain, data, activeId, query, scoped, onSelect, onScope }) {
  const nodes = data.nodes.filter((node) => node.chain === chain.id);
  const direct = nodes.filter((node) => node.level === 2);
  const publishedMappings = getPublishedMappingEdges(data);
  const chainNodeIds = new Set(nodes.map((node) => node.id));
  const chainCompanyCount = new Set(
    publishedMappings.filter((edge) => chainNodeIds.has(edge.from_id)).map((edge) => edge.to_id),
  ).size;
  const matched = new Set(searchItems(data, query).map((item) => item.id));
  const expanded = scoped || nodes.some((node) => node.id === activeId || matched.has(node.id));

  const companyCountForNode = (nodeId) => new Set(
    publishedMappings.filter((edge) => edge.from_id === nodeId).map((edge) => edge.to_id),
  ).size;

  return (
    <section className={`chainGroup ${scoped ? "isScoped" : ""}`}>
      <button
        className={`chainButton ${activeId === chain.id || scoped ? "isActive" : ""}`}
        aria-current={activeId === chain.id ? "page" : undefined}
        aria-expanded={expanded}
        onClick={onScope}
      >
        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span>{chain.name}</span>
        <small>{chainCompanyCount} 家</small>
        {matched.has(chain.id) && <b>命中</b>}
      </button>
      {expanded && direct.map((node) => (
        <div key={node.id} className="chainBranch">
          <button className={`nodeButton ${activeId === node.id ? "isActive" : ""}`} aria-current={activeId === node.id ? "page" : undefined} onClick={() => onSelect(node.id)}>
            <span>{node.name}</span>
            <small>{companyCountForNode(node.id)} 家</small>
            {matched.has(node.id) && <b>命中</b>}
          </button>
          {nodes.filter((child) => child.parent_id === node.id).map((child) => (
            <button
              key={child.id}
              className={`nodeButton child ${activeId === child.id ? "isActive" : ""}`}
              aria-current={activeId === child.id ? "page" : undefined}
              onClick={() => onSelect(child.id)}
            >
              <span>{child.name}</span>
              <small>{companyCountForNode(child.id)} 家</small>
              {matched.has(child.id) && <b>命中</b>}
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
