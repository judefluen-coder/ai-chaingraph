import React, { useMemo } from "react";
import ReactFlow, { Background, Controls, Handle, MiniMap, Position } from "reactflow";
import "reactflow/dist/style.css";
import { GitBranch } from "lucide-react";

const nodeTypes = {
  mapNode: MapNode,
};

export function GraphViewport({ flow, activeId, pathSummary, onSelect, compact = false }) {
  return (
    <section className={compact ? "graphViewport compact" : "graphViewport"}>
      {!compact && (
        <div className="graphHeader">
          <div>
            <span className="eyebrow">关系图谱</span>
            <h2>上下游逻辑图</h2>
            <p>{pathSummary}</p>
          </div>
          <span className="graphBadge"><GitBranch size={14} />点击节点查看证据</span>
        </div>
      )}
      <div className="graphCanvas">
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onSelect(node.id)}
          nodesDraggable={!compact}
          fitView
          minZoom={compact ? 0.22 : 0.34}
          maxZoom={1.6}
        >
          <Background color="#263126" gap={compact ? 18 : 22} size={1} />
          {!compact && <Controls position="bottom-left" />}
          {!compact && <MiniMap pannable zoomable nodeStrokeWidth={3} />}
        </ReactFlow>
      </div>
    </section>
  );
}

function MapNode({ data }) {
  const subtitle = useMemo(() => data.subtitle || "", [data.subtitle]);
  return (
    <div className={`flowNodeInner ${data.kind === "company" ? "companyNodeInner" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <span>{data.title}</span>
      <small>{subtitle}</small>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
