import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Database, RefreshCw } from "lucide-react";
import { loadGraphData } from "./data/loadGraphData.js";
import { ChainNavigator } from "./components/ChainNavigator.jsx";
import { GraphDetailPanel } from "./components/GraphDetailPanel.jsx";
import { GraphViewport } from "./components/GraphViewport.jsx";
import { TopBar } from "./components/TopBar.jsx";
import {
  buildChainFlow,
  buildDetailModel,
  buildOverviewFlow,
  buildPathFlow,
  buildRelationDetailModel,
  buildTraversalFlow,
  createGraphViewIndex,
  getEntityChainId,
  getEntityContext,
  getEntityTypeLabel,
  getIndustryNavigation,
  localize,
  searchTransmissionGraph,
} from "./lib/transmissionViewModel.js";
import {
  buildShockOverlay,
  findShortestTransmissionPath,
  traverseTransmissionGraph,
} from "./lib/transmissionGraph.js";
import { getCopy, translations } from "./lib/i18n.js";
import "./transmission.css";

const eventCopyKeys = {
  price_up: "eventPriceUp",
  price_down: "eventPriceDown",
  supply_up: "eventSupplyUp",
  supply_down: "eventSupplyDown",
  demand_up: "eventDemandUp",
  demand_down: "eventDemandDown",
  capacity_up: "eventCapacityUp",
  capacity_down: "eventCapacityDown",
  policy_change: "eventPolicy",
  technology_shift: "eventTechnology",
};

function App() {
  const [graphState, setGraphState] = useState({ data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [activeRelationId, setActiveRelationId] = useState(null);
  const [selectedChainId, setSelectedChainId] = useState(null);
  const [marketFilter, setMarketFilter] = useState("all");
  const [direction, setDirection] = useState("downstream");
  const [depth, setDepth] = useState(3);
  const [pathStartId, setPathStartId] = useState(null);
  const [pathTargetId, setPathTargetId] = useState(null);
  const [shockSpec, setShockSpec] = useState(null);
  const [locale, setLocale] = useState(() => localStorage.getItem("ai-chaingraph-locale") || (navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en"));
  const [acknowledged, setAcknowledged] = useState(() => localStorage.getItem("ai-chaingraph-disclaimer") === "ack");
  const isNarrow = useMediaQuery("(max-width: 760px)");
  const graph = graphState.data;
  const copy = getCopy(locale);
  const layoutDirection = isNarrow ? "TB" : "LR";

  useEffect(() => {
    localStorage.setItem("ai-chaingraph-locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = locale === "zh" ? "AI产业传导研究地图 / AI-ChainGraph" : "AI Industry Transmission Map / AI-ChainGraph";
  }, [locale]);

  useEffect(() => {
    let alive = true;
    setGraphState({ data: null, error: null });
    loadGraphData()
      .then((data) => {
        if (alive) setGraphState({ data, error: null });
      })
      .catch((error) => {
        if (alive) setGraphState({ data: null, error });
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const index = useMemo(() => graph ? createGraphViewIndex(graph) : null, [graph]);
  const navigation = useMemo(() => graph ? getIndustryNavigation(graph) : [], [graph]);
  const searchResults = useMemo(() => graph ? searchTransmissionGraph(graph, query, { locale, market: marketFilter, limit: 10 }) : [], [graph, query, locale, marketFilter]);
  const activeEntity = activeId ? index?.entitiesById.get(activeId) : null;
  const selectedChain = selectedChainId ? index?.entitiesById.get(selectedChainId) : null;
  const detail = useMemo(() => graph && activeId ? buildDetailModel(graph, activeId, { locale, market: marketFilter }) : null, [graph, activeId, locale, marketFilter]);
  const relationDetail = useMemo(() => graph && activeRelationId ? buildRelationDetailModel(graph, activeRelationId) : null, [graph, activeRelationId]);

  const shockOverlay = useMemo(() => {
    if (!graph || !shockSpec) return null;
    try {
      return buildShockOverlay(graph, shockSpec, { maxDepth: depth });
    } catch (error) {
      console.warn("Unable to build conditional transmission overlay.", error);
      return null;
    }
  }, [graph, shockSpec, depth]);

  const traversal = useMemo(() => {
    if (!graph || !activeId || pathTargetId) return null;
    if (shockOverlay) return shockOverlay.fact_traversal;
    return traverseTransmissionGraph(graph, activeId, { direction, maxDepth: depth });
  }, [graph, activeId, direction, depth, pathTargetId, shockOverlay]);

  const pathResult = useMemo(() => {
    if (!graph || !pathStartId || !pathTargetId) return null;
    return findShortestTransmissionPath(graph, pathStartId, pathTargetId, { direction, maxDepth: 12 });
  }, [graph, pathStartId, pathTargetId, direction]);

  const flow = useMemo(() => {
    if (!graph) return { nodes: [], edges: [], meta: null };
    if (pathResult) return buildPathFlow(graph, pathResult, { locale, market: marketFilter, layoutDirection });
    if (traversal) return buildTraversalFlow(graph, traversal, {
      locale,
      market: marketFilter,
      layoutDirection,
      targetId: activeId,
      shockOverlay,
    });
    if (selectedChainId) return buildChainFlow(graph, selectedChainId, { locale, market: marketFilter, direction: layoutDirection });
    return buildOverviewFlow(graph, { locale, market: marketFilter, direction: layoutDirection });
  }, [graph, pathResult, traversal, selectedChainId, locale, marketFilter, layoutDirection, activeId, shockOverlay]);

  const presentation = useMemo(() => graph ? getScopePresentation({
    graph,
    index,
    locale,
    copy,
    activeId,
    activeEntity,
    detail,
    selectedChain,
    pathStartId,
    pathTargetId,
    pathResult,
    shockSpec,
  }) : null, [graph, index, locale, copy, activeId, activeEntity, detail, selectedChain, pathStartId, pathTargetId, pathResult, shockSpec]);

  function resetWorkspace() {
    setQuery("");
    setActiveId(null);
    setActiveRelationId(null);
    setSelectedChainId(null);
    setMarketFilter("all");
    setDirection("downstream");
    setDepth(3);
    setPathStartId(null);
    setPathTargetId(null);
    setShockSpec(null);
  }

  function selectChain(chainId) {
    setSelectedChainId(chainId);
    setActiveId(null);
    setActiveRelationId(null);
    setPathStartId(null);
    setPathTargetId(null);
    setShockSpec(null);
    setQuery("");
  }

  function selectEntity(entityId) {
    const entity = index?.entitiesById.get(entityId);
    if (!entity) return;
    if (pathStartId && !pathTargetId && entityId !== pathStartId) {
      setPathTargetId(entityId);
      setActiveRelationId(null);
      setQuery("");
      return;
    }
    if (entity.entity_type === "chain") {
      selectChain(entity.id);
      return;
    }
    if (pathTargetId) {
      setPathStartId(null);
      setPathTargetId(null);
    }
    setActiveId(entityId);
    setActiveRelationId(null);
    setShockSpec(null);
    const chainId = getEntityChainId(graph, entityId);
    if (chainId) setSelectedChainId(chainId);
  }

  function selectSearchResult(item) {
    if (pathStartId && !pathTargetId && item.id !== pathStartId) {
      setPathTargetId(item.id);
      setActiveRelationId(null);
      setQuery("");
      return;
    }
    selectEntity(item.id);
    setQuery("");
  }

  function selectRelation(relationId) {
    const relation = index?.relationsById.get(relationId);
    if (!relation) return;
    setActiveRelationId(relationId);
    if (!activeId) {
      setActiveId(relation.from_id);
      const chainId = getEntityChainId(graph, relation.from_id);
      if (chainId) setSelectedChainId(chainId);
    }
  }

  function exploreDirection(value) {
    setDirection(value);
    setPathStartId(null);
    setPathTargetId(null);
    setShockSpec(null);
  }

  function startPath(entityId) {
    setActiveId(entityId);
    setPathStartId(entityId);
    setPathTargetId(null);
    setActiveRelationId(null);
    setShockSpec(null);
  }

  function runShock(shockType) {
    if (!graph || !activeId) return;
    const entity = index.entitiesById.get(activeId);
    const copyKey = eventCopyKeys[shockType];
    setPathStartId(null);
    setPathTargetId(null);
    setActiveRelationId(null);
    setShockSpec({
      id: `event:ui:${shockType}:${activeId}`,
      target_id: activeId,
      shock_type: shockType,
      title: `${localize(entity, "name", "zh")}：${translations.zh[copyKey]}`,
      title_en: `${localize(entity, "name", "en")}: ${translations.en[copyKey]}`,
      observed_at: graph.meta.updated_at,
      status: "scenario",
    });
  }

  function closeDetail() {
    setActiveId(null);
    setActiveRelationId(null);
    setPathStartId(null);
    setPathTargetId(null);
    setShockSpec(null);
  }

  function acknowledgeDisclaimer() {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    setAcknowledged(true);
  }

  if (!graph) {
    return (
      <div className="txLoadingShell">
        <Database size={26} strokeWidth={1.7} />
        <strong>{graphState.error ? copy.loadFailed : copy.loading}</strong>
        <span>{graphState.error ? graphState.error.message : copy.loadingData}</span>
        {graphState.error && <button type="button" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw size={16} strokeWidth={1.8} />{copy.retry}</button>}
      </div>
    );
  }

  const pathStartLabel = pathStartId ? getEntityLabel(index, pathStartId, locale) : "";
  const pathTargetLabel = pathTargetId ? getEntityLabel(index, pathTargetId, locale) : "";
  const queryControls = {
    showDirection: Boolean(activeId) && !shockOverlay,
    showDepth: Boolean(activeId) && !pathTargetId && !shockOverlay,
    direction,
    depth,
    onDirectionChange: (value) => {
      setDirection(value);
      setShockSpec(null);
    },
    onDepthChange: setDepth,
    path: pathStartId ? {
      startLabel: pathStartLabel,
      targetLabel: pathTargetLabel,
      onCancel: () => {
        setPathStartId(null);
        setPathTargetId(null);
      },
    } : null,
    shock: shockOverlay ? {
      label: localize(shockOverlay.event, "title", locale),
      onClear: () => setShockSpec(null),
    } : null,
  };

  return (
    <div className="txAppShell">
      {!acknowledged && <DisclaimerModal copy={copy} onAccept={acknowledgeDisclaimer} />}
      <TopBar
        query={query}
        onQueryChange={setQuery}
        searchResults={searchResults}
        onSelectSearchResult={selectSearchResult}
        marketFilter={marketFilter}
        onMarketFilterChange={setMarketFilter}
        dataVersion={graph.meta.data_version}
        dataStatus={graph.meta.status}
        onReset={resetWorkspace}
        locale={locale}
        onLocaleChange={setLocale}
        searchPlaceholder={pathStartId && !pathTargetId ? copy.pathTargetPlaceholder : copy.searchPlaceholder}
        copy={copy}
      />
      <ChainNavigator
        navigation={navigation}
        activeChainId={selectedChainId}
        onOverview={() => selectChain(null)}
        onSelect={selectChain}
        locale={locale}
        copy={copy}
      />
      <main className={`txWorkspace ${detail ? "hasDetail" : ""}`}>
        <GraphViewport
          flow={flow}
          title={presentation.title}
          subtitle={presentation.subtitle}
          breadcrumbs={presentation.breadcrumbs}
          statusLabel={graph.meta.status === "building" ? copy.coverageBuilding : null}
          queryControls={queryControls}
          activeRelationId={activeRelationId}
          onSelect={selectEntity}
          onSelectRelation={selectRelation}
          copy={copy}
        />
        {detail && (
          <GraphDetailPanel
            detail={detail}
            relationDetail={relationDetail}
            locale={locale}
            copy={copy}
            pathStartId={pathStartId}
            shockOverlay={shockOverlay}
            onSelectEntity={selectEntity}
            onSelectRelation={selectRelation}
            onExploreDirection={exploreDirection}
            onSetPathStart={startPath}
            onRunShock={runShock}
            onClearShock={() => setShockSpec(null)}
            onClose={closeDetail}
          />
        )}
      </main>
    </div>
  );
}

function getScopePresentation({ graph, index, locale, copy, activeEntity, detail, selectedChain, pathStartId, pathTargetId, pathResult, shockSpec }) {
  if (pathStartId && pathTargetId) {
    const start = getEntityLabel(index, pathStartId, locale);
    const target = getEntityLabel(index, pathTargetId, locale);
    return {
      title: `${start} → ${target}`,
      subtitle: pathResult?.found
        ? locale === "en" ? `${pathResult.hops} factual hops across ${pathResult.cross_chain_hops} chain boundaries.` : `${pathResult.hops} 跳事实关系，跨越 ${pathResult.cross_chain_hops} 次产业链边界。`
        : copy.noPath,
      breadcrumbs: [copy.path],
    };
  }
  if (activeEntity && detail) {
    const context = detail.context || getEntityContext(graph, activeEntity.id);
    const breadcrumbs = [context?.domain, context?.chain, context?.segment].filter(Boolean).map((entity) => localize(entity, "name", locale));
    const entity = detail.entity;
    return {
      title: shockSpec ? localize(shockSpec, "title", locale) : localize(entity, "name", locale),
      subtitle: detail.kind === "issuer"
        ? localize(entity, "industry", locale) || `${detail.mappings.length} ${copy.companyPositions}`
        : [getEntityTypeLabel(entity.entity_type, locale), localize(context?.chain, "name", locale)].filter(Boolean).join(" · "),
      breadcrumbs,
    };
  }
  if (selectedChain) {
    const domainId = index.domainByChain.get(selectedChain.id);
    const domain = index.entitiesById.get(domainId);
    return {
      title: localize(selectedChain, "name", locale),
      subtitle: localize(selectedChain, "description", locale),
      breadcrumbs: [localize(domain, "name", locale)],
    };
  }
  return { title: copy.overviewTitle, subtitle: copy.overviewSubtitle, breadcrumbs: [] };
}

function getEntityLabel(index, entityId, locale) {
  const entity = index?.entitiesById.get(entityId);
  if (!entity) return entityId;
  if (entity.entity_type === "security") {
    const issuer = index.entitiesById.get(index.issuerBySecurity.get(entity.id));
    return localize(issuer || entity, "name", locale);
  }
  return localize(entity, "name", locale);
}

function DisclaimerModal({ copy, onAccept }) {
  return (
    <div className="txModalBackdrop" role="presentation">
      <section className="txDisclaimer" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
        <Database size={24} strokeWidth={1.7} />
        <h1 id="disclaimer-title">{copy.disclaimerTitle}</h1>
        <p>{copy.disclaimerBody}</p>
        <ul>
          <li>{copy.disclaimerFact}</li>
          <li>{copy.disclaimerInference}</li>
          <li>{copy.disclaimerVerify}</li>
        </ul>
        <button type="button" className="txPrimaryButton" autoFocus onClick={onAccept}>{copy.disclaimerAccept}</button>
      </section>
    </div>
  );
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [query]);
  return matches;
}

const rootElement = document.getElementById("root");
const appRoot = rootElement.__aiChainGraphRoot || createRoot(rootElement);
rootElement.__aiChainGraphRoot = appRoot;
appRoot.render(<App />);
