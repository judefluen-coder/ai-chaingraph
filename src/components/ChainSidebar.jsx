import { ChevronRight, Filter } from "lucide-react";
import { evidenceLabels, searchItems } from "../lib/graphViewModel";

export function ChainSidebar({
  data,
  activeId,
  query,
  onlyChain,
  onSelect,
  onScope,
  evidenceFilter,
  onEvidenceFilterChange,
}) {
  return (
    <aside className="chainSidebar">
      <section className="sidebarIntro">
        <span className="eyebrow">产业链导航</span>
        <h2>从环节找到股票</h2>
        <p>按 AI 上下游浏览公司映射，点击任一环节会在右侧解释关系和证据。</p>
      </section>

      <button
        className={`chainRoot ${activeId === "overview" ? "isActive" : ""}`}
        onClick={() => {
          onSelect("overview");
          onScope(null);
        }}
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
            onScope={() => onScope(onlyChain === chain.id ? null : chain.id)}
          />
        ))}
      </div>

      <section className="filterCard">
        <div className="filterTitle">
          <Filter size={15} />
          <span>证据筛选</span>
        </div>
        <div className="filterButtons">
          {["all", "L1", "L2", "L3"].map((level) => (
            <button
              key={level}
              className={evidenceFilter === level ? "isActive" : ""}
              onClick={() => onEvidenceFilterChange(level)}
            >
              {level === "all" ? "全部" : evidenceLabels[level]}
            </button>
          ))}
        </div>
        <p>产业层级始终保留；筛选只影响公司映射和证据摘要。</p>
      </section>
    </aside>
  );
}

function ChainGroup({ chain, data, activeId, query, scoped, onSelect, onScope }) {
  const nodes = data.nodes.filter((node) => node.chain === chain.id);
  const direct = nodes.filter((node) => node.level === 2);
  const matched = new Set(searchItems(data, query).map((item) => item.id));

  return (
    <section className={`chainGroup ${scoped ? "isScoped" : ""}`}>
      <div className="chainGroupHead">
        <button onClick={onScope}>{scoped ? "查看全部" : "聚焦链路"}</button>
        <span>{chain.company_count} 家</span>
      </div>
      <button className={`chainButton ${activeId === chain.id ? "isActive" : ""}`} onClick={() => onSelect(chain.id)}>
        <ChevronRight size={15} />
        <span>{chain.name}</span>
        {matched.has(chain.id) && <b>命中</b>}
      </button>
      {direct.map((node) => (
        <div key={node.id} className="chainBranch">
          <button className={`nodeButton ${activeId === node.id ? "isActive" : ""}`} onClick={() => onSelect(node.id)}>
            <span>{node.name}</span>
            <small>{node.company_ids.length} 家</small>
            {matched.has(node.id) && <b>命中</b>}
          </button>
          {nodes.filter((child) => child.parent_id === node.id).map((child) => (
            <button
              key={child.id}
              className={`nodeButton child ${activeId === child.id ? "isActive" : ""}`}
              onClick={() => onSelect(child.id)}
            >
              <span>{child.name}</span>
              <small>{child.company_ids.length} 家</small>
              {matched.has(child.id) && <b>命中</b>}
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
