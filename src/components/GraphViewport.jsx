import React, { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, Handle, MarkerType, Position } from "reactflow";
import "reactflow/dist/style.css";
import { ArrowRight, GitBranch, ListTree } from "lucide-react";

const nodeTypes = {
  mapNode: MapNode,
};

export function GraphViewport({ flow, pathSummary, onSelect, isMobile = false }) {
  const [mobileMode, setMobileMode] = useState("paths");

  return (
    <section className="graphViewport">
      <div className="graphHeader">
        <div>
          <span className="eyebrow">聚焦产业链</span>
          <h2>上下游关系图</h2>
          <p>{pathSummary}</p>
        </div>
        <span className="graphBadge"><GitBranch size={14} />点击节点查看事实来源</span>
      </div>
      {isMobile && (
        <div className="mobileGraphSwitch" role="group" aria-label="关系视图模式">
          <button aria-pressed={mobileMode === "paths"} className={mobileMode === "paths" ? "isActive" : ""} onClick={() => setMobileMode("paths")}>
            <ListTree size={15} />关系路径
          </button>
          <button aria-pressed={mobileMode === "graph"} className={mobileMode === "graph" ? "isActive" : ""} onClick={() => setMobileMode("graph")}>
            <GitBranch size={15} />图谱
          </button>
        </div>
      )}
      {isMobile && mobileMode === "paths" ? (
        <MobileRelationList flow={flow} onSelect={onSelect} />
      ) : <div className="graphCanvas">
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onSelect(node.id)}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: isMobile ? 0.22 : 0.16, minZoom: isMobile ? 0.42 : 0.5, maxZoom: isMobile ? 0.9 : 1.05 }}
          minZoom={0.28}
          maxZoom={1.6}
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } }}
        >
          <Background color="#263126" gap={22} size={1} />
          <Controls position={isMobile ? "top-right" : "bottom-left"} showInteractive={false} />
        </ReactFlow>
      </div>}
    </section>
  );
}

function MobileRelationList({ flow, onSelect }) {
  const nodesById = useMemo(() => new Map(flow.nodes.map((node) => [node.id, node])), [flow.nodes]);

  if (flow.edges.length === 0) {
    return <div className="emptyState"><strong>当前范围暂无可展示关系</strong><span>可以切换产业链或市场后再查看。</span></div>;
  }

  return (
    <div className="mobileRelationList" aria-label="上下游关系路径">
      {flow.edges.map((edge) => {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        if (!source || !target) return null;
        return (
          <button key={edge.id} onClick={() => onSelect(target.id)} aria-label={`查看 ${target.data.title}：${source.data.title} 到 ${target.data.title}`}>
            <span className="relationEntity">
              <strong>{source.data.title}</strong>
              <small>{source.data.subtitle}</small>
            </span>
            <span className="relationDirection"><em>{edge.label}</em><ArrowRight size={16} /></span>
            <span className="relationEntity">
              <strong>{target.data.title}</strong>
              <small>{target.data.subtitle}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MapNode({ data }) {
  const subtitle = useMemo(() => data.subtitle || "", [data.subtitle]);
  const vertical = data.layoutDirection === "TB";
  return (
    <div className={`flowNodeInner ${data.kind === "company" ? "companyNodeInner" : ""}`}>
      <Handle type="target" position={vertical ? Position.Top : Position.Left} />
      <span>{data.title}</span>
      <small>{subtitle}</small>
      <Handle type="source" position={vertical ? Position.Bottom : Position.Right} />
    </div>
  );
}
