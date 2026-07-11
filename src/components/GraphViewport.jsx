import React, { useMemo } from "react";
import ReactFlow, { Background, Controls, Handle, MarkerType, Position } from "reactflow";
import "reactflow/dist/style.css";
import { GitBranch } from "lucide-react";

const nodeTypes = {
  mapNode: MapNode,
};

export function GraphViewport({ flow, pathSummary, onSelect }) {
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
      <div className="graphCanvas">
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onSelect(node.id)}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.16, minZoom: 0.5, maxZoom: 1.05 }}
          minZoom={0.28}
          maxZoom={1.6}
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } }}
        >
          <Background color="#263126" gap={22} size={1} />
          <Controls position="bottom-left" showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
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
