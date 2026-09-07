import { useCallback, useEffect, useMemo, useRef } from "react";
import ReactFlow, { Background, Controls, Handle, MarkerType, Position } from "reactflow";
import "reactflow/dist/style.css";
import { ArrowRight, GitCompareArrows, Route, X } from "lucide-react";

const nodeTypes = { transmissionNode: TransmissionNode };

export function GraphViewport({
  flow,
  title,
  subtitle,
  breadcrumbs,
  statusLabel,
  queryControls,
  activeRelationId,
  onSelect,
  onSelectRelation,
  copy,
}) {
  const canvasRef = useRef(null);
  const flowInstanceRef = useRef(null);
  const fitFrameRef = useRef(null);
  const isVertical = flow.nodes.some((node) => node.data?.layoutDirection === "TB");
  const fitViewOptions = useMemo(() => ({ padding: isVertical ? 0.1 : 0.16, minZoom: isVertical ? 0.58 : 0.2, maxZoom: 1.04 }), [isVertical]);
  const renderedEdges = useMemo(() => flow.edges.map((edge) => ({
    ...edge,
    className: `${edge.className || ""}${edge.id === activeRelationId ? " isSelected" : ""}`.trim(),
    markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
  })), [flow.edges, activeRelationId]);

  const fitGraph = useCallback(() => {
    if (!flowInstanceRef.current || flow.nodes.length === 0) return;
    if (fitFrameRef.current) cancelAnimationFrame(fitFrameRef.current);
    fitFrameRef.current = requestAnimationFrame(() => {
      fitFrameRef.current = requestAnimationFrame(() => flowInstanceRef.current?.fitView(fitViewOptions));
    });
  }, [fitViewOptions, flow.nodes.length]);

  useEffect(() => {
    fitGraph();
  }, [fitGraph, flow.nodes, flow.meta?.mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new ResizeObserver(fitGraph);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      if (fitFrameRef.current) cancelAnimationFrame(fitFrameRef.current);
    };
  }, [fitGraph]);

  return (
    <section className="txGraphViewport">
      <header className="txGraphHeader">
        <div className="txGraphHeading">
          <div className="txGraphContext">
            <span>{copy.graphEyebrow}</span>
            {statusLabel && <em>{statusLabel}</em>}
          </div>
          {breadcrumbs?.length > 0 && (
            <div className="txBreadcrumbs" aria-label={copy.industryPosition}>
              {breadcrumbs.map((item, index) => (
                <span key={`${item}-${index}`}>{index > 0 && <ArrowRight size={12} strokeWidth={1.8} />}{item}</span>
              ))}
            </div>
          )}
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <GraphQueryControls controls={queryControls} copy={copy} />
      </header>

      <GraphStats meta={flow.meta} copy={copy} />

      <div className="txGraphCanvas" ref={canvasRef}>
        {flow.nodes.length === 0 && (
          <div className="txGraphEmpty">
            <Route size={24} strokeWidth={1.6} />
            <strong>{copy.noPath}</strong>
          </div>
        )}
        <ReactFlow
          key={`${flow.meta?.mode || "graph"}-${isVertical ? "vertical" : "horizontal"}`}
          nodes={flow.nodes}
          edges={renderedEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onSelect(node.id)}
          onEdgeClick={(_, edge) => {
            const relationId = edge.data?.relationId;
            if (relationId) onSelectRelation(relationId);
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable
          fitView
          fitViewOptions={fitViewOptions}
          onInit={(instance) => {
            flowInstanceRef.current = instance;
            fitGraph();
          }}
          minZoom={0.16}
          maxZoom={1.55}
          onlyRenderVisibleElements
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 } }}
        >
          <Background color="#d8dee8" gap={24} size={1} />
          <Controls position="bottom-left" showInteractive={false} fitViewOptions={fitViewOptions} />
        </ReactFlow>
        <div className="txGraphLegend" aria-label={copy.factDirection}>
          <span><i className="isFact" />{copy.factDirection}</span>
          <span><i className="isCross" />{copy.crossChain}</span>
          {flow.meta?.mode === "shock" && <span><i className="isConditional" />{copy.conditionalLayer}</span>}
        </div>
      </div>
    </section>
  );
}

function GraphQueryControls({ controls, copy }) {
  if (!controls) return null;
  return (
    <div className="txGraphControls">
      {controls.path && (
        <div className="txPathStatus">
          <Route size={16} strokeWidth={1.8} />
          <span><small>{copy.pathStart}</small><strong>{controls.path.startLabel}</strong></span>
          <ArrowRight size={15} strokeWidth={1.8} />
          <span><small>{copy.pathTarget}</small><strong>{controls.path.targetLabel || copy.awaitingTarget}</strong></span>
          <button type="button" aria-label={copy.cancelPath} title={copy.cancelPath} onClick={controls.path.onCancel}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      )}
      {controls.shock && (
        <div className="txShockStatus">
          <GitCompareArrows size={16} strokeWidth={1.8} />
          <span>{controls.shock.label}</span>
          <button type="button" aria-label={copy.clearEvent} title={copy.clearEvent} onClick={controls.shock.onClear}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      )}
      {controls.showDirection && (
        <div className="txControlGroup">
          <span>{copy.traversalDirection}</span>
          <div className="txSegmented">
            {[
              ["upstream", copy.upstream],
              ["downstream", copy.downstream],
              ["both", copy.both],
            ].map(([value, label]) => (
              <button key={value} type="button" className={controls.direction === value ? "isActive" : ""} aria-pressed={controls.direction === value} onClick={() => controls.onDirectionChange(value)}>{label}</button>
            ))}
          </div>
        </div>
      )}
      {controls.showDepth && (
        <div className="txControlGroup">
          <span>{copy.traversalDepth}</span>
          <div className="txSegmented">
            {[
              [1, copy.direct],
              [3, copy.threeHops],
              [5, copy.fiveHops],
            ].map(([value, label]) => (
              <button key={value} type="button" className={controls.depth === value ? "isActive" : ""} aria-pressed={controls.depth === value} onClick={() => controls.onDepthChange(value)}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GraphStats({ meta, copy }) {
  if (!meta) return null;
  let items = [];
  if (meta.mode === "overview") {
    items = [[copy.domains, meta.domain_count], [copy.chains, meta.chain_count], [copy.relations, meta.dependency_relation_count]];
  } else if (meta.mode === "chain") {
    items = [[copy.elements, meta.element_count], [copy.relations, meta.relation_count], [copy.crossChain, meta.cross_chain_relation_count], [copy.companies, meta.issuer_count]];
  } else if (meta.mode === "path") {
    items = meta.found ? [[copy.pathHops, meta.hops], [copy.crossChainHops, meta.cross_chain_hops]] : [];
  } else {
    items = [[copy.directNodes, meta.direct_element_count], [copy.indirectNodes, meta.indirect_element_count], [copy.chains, meta.chain_count], [copy.companies, meta.issuer_count]];
  }
  if (items.length === 0) return null;
  return (
    <div className="txGraphStats">
      {items.map(([label, value]) => <span key={label}><strong>{Number(value || 0).toLocaleString()}</strong>{label}</span>)}
      {meta.hidden_node_count > 0 && <em>{copy.visibleLimit} · +{meta.hidden_node_count}</em>}
    </div>
  );
}

function TransmissionNode({ data }) {
  const vertical = data.layoutDirection === "TB";
  return (
    <div className="txNodeBody">
      <Handle type="target" position={vertical ? Position.Top : Position.Left} />
      <div className="txNodeEyebrow">
        <span>{data.eyebrow}</span>
        {data.external && <em>{data.chainLabel}</em>}
      </div>
      <strong>{data.title}</strong>
      <small>{data.subtitle}</small>
      {data.conditionalEffect && <b>{data.conditionalEffect}</b>}
      <Handle type="source" position={vertical ? Position.Bottom : Position.Right} />
    </div>
  );
}
