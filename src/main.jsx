import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Database, RefreshCw } from "lucide-react";
import { loadGraphData } from "./data/loadGraphData.js";
import { ChainNavigator } from "./components/ChainNavigator.jsx";
import { GraphDetailPanel } from "./components/GraphDetailPanel.jsx";
import { GraphViewport } from "./components/GraphViewport.jsx";
import { ScopeInspector } from "./components/ScopeInspector.jsx";
import { TopBar } from "./components/TopBar.jsx";
import {
  buildChainFlow,
  buildDetailModel,
  buildOverviewFlow,
  buildPathFlow,
  buildRelationDetailModel,
  buildTraversalFlow,
  createGraphViewIndex,
  formatSecurityCode,
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
import { parseWorkspaceSearch, serializeWorkspaceSearch } from "./lib/workspaceState.js";
import { createWatchlistRecord, downloadWatchlist, readWatchlist, writeWatchlist } from "./lib/watchlist.js";
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

const initialWorkspaceState = parseWorkspaceSearch(typeof window === "undefined" ? "" : window.location.search);

function App() {
  const [graphState, setGraphState] = useState({ data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState(initialWorkspaceState.query);
  const [activeId, setActiveId] = useState(initialWorkspaceState.activeId);
  const [activeRelationId, setActiveRelationId] = useState(initialWorkspaceState.activeRelationId);
  const [selectedChainId, setSelectedChainId] = useState(initialWorkspaceState.selectedChainId);
  const [marketFilter, setMarketFilter] = useState(initialWorkspaceState.marketFilter);
  const [direction, setDirection] = useState(initialWorkspaceState.direction);
  const [depth, setDepth] = useState(initialWorkspaceState.depth);
  const [pathStartId, setPathStartId] = useState(initialWorkspaceState.pathStartId);
  const [pathTargetId, setPathTargetId] = useState(initialWorkspaceState.pathTargetId);
  const [shockType, setShockType] = useState(initialWorkspaceState.shockType);
  const [locale, setLocale] = useState(() => initialWorkspaceState.locale || localStorage.getItem("ai-chaingraph-locale") || (navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en"));
  const [acknowledged, setAcknowledged] = useState(() => localStorage.getItem("ai-chaingraph-disclaimer") === "ack");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [watchlistRecords, setWatchlistRecords] = useState(readWatchlist);
  const [notice, setNotice] = useState("");
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
    writeWatchlist(watchlistRecords);
  }, [watchlistRecords]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

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

  useEffect(() => {
    const handlePopState = () => {
      const next = parseWorkspaceSearch(window.location.search);
      setQuery(next.query);
      setActiveId(next.activeId);
      setActiveRelationId(next.activeRelationId);
      setSelectedChainId(next.selectedChainId);
      setMarketFilter(next.marketFilter);
      setDirection(next.direction);
      setDepth(next.depth);
      setPathStartId(next.pathStartId);
      setPathTargetId(next.pathTargetId);
      setShockType(next.shockType);
      if (next.locale) setLocale(next.locale);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const search = serializeWorkspaceSearch({
      query,
      activeId,
      activeRelationId,
      selectedChainId,
      marketFilter,
      direction,
      depth,
      pathStartId,
      pathTargetId,
      shockType,
      locale,
    });
    const nextUrl = `${window.location.pathname}${search}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState(window.history.state, "", nextUrl);
  }, [query, activeId, activeRelationId, selectedChainId, marketFilter, direction, depth, pathStartId, pathTargetId, shockType, locale]);

  const index = useMemo(() => graph ? createGraphViewIndex(graph) : null, [graph]);
  const navigation = useMemo(() => graph ? getIndustryNavigation(graph) : [], [graph]);
  const searchResults = useMemo(() => graph ? searchTransmissionGraph(graph, query, { locale, market: marketFilter, limit: 10 }) : [], [graph, query, locale, marketFilter]);
  const activeEntity = activeId ? index?.entitiesById.get(activeId) : null;
  const selectedChain = selectedChainId ? index?.entitiesById.get(selectedChainId) : null;
  const chainElements = selectedChainId ? index?.elementsByChain.get(selectedChainId) || [] : [];
  const detail = useMemo(() => graph && activeId ? buildDetailModel(graph, activeId, { locale, market: marketFilter }) : null, [graph, activeId, locale, marketFilter]);
  const relationDetail = useMemo(() => graph && activeRelationId ? buildRelationDetailModel(graph, activeRelationId) : null, [graph, activeRelationId]);
  const watchRecord = detail?.kind === "issuer" ? watchlistRecords.find((record) => record.issuer_id === detail.entity.id) || null : null;

  const shockSpec = useMemo(() => {
    if (!graph || !activeId || !shockType) return null;
    const entity = index?.entitiesById.get(activeId);
    const copyKey = eventCopyKeys[shockType];
    if (!entity || !copyKey) return null;
    return {
      id: `event:ui:${shockType}:${activeId}`,
      target_id: activeId,
      shock_type: shockType,
      title: `${localize(entity, "name", "zh")}：${translations.zh[copyKey]}`,
      title_en: `${localize(entity, "name", "en")}: ${translations.en[copyKey]}`,
      observed_at: graph.meta.updated_at,
      status: "scenario",
    };
  }, [graph, index, activeId, shockType]);

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
    setShockType(null);
  }

  function selectChain(chainId) {
    setSelectedChainId(chainId);
    setActiveId(null);
    setActiveRelationId(null);
    setPathStartId(null);
    setPathTargetId(null);
    setShockType(null);
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
    setShockType(null);
    if (entity.entity_type === "issuer" || entity.entity_type === "security") {
      setSelectedChainId(null);
      setDepth(1);
    } else {
      const chainId = getEntityChainId(graph, entityId);
      if (chainId) setSelectedChainId(chainId);
    }
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
    setShockType(null);
  }

  function startPath(entityId) {
    setActiveId(entityId);
    setPathStartId(entityId);
    setPathTargetId(null);
    setActiveRelationId(null);
    setShockType(null);
  }

  function runShock(shockType) {
    if (!graph || !activeId || !eventCopyKeys[shockType]) return;
    setPathStartId(null);
    setPathTargetId(null);
    setActiveRelationId(null);
    setShockType(shockType);
  }

  function closeDetail() {
    setActiveId(null);
    setActiveRelationId(null);
    setPathStartId(null);
    setPathTargetId(null);
    setShockType(null);
  }

  function acknowledgeDisclaimer() {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    setAcknowledged(true);
  }

  function toggleWatchlist() {
    if (detail?.kind !== "issuer") return;
    const issuerId = detail.entity.id;
    if (watchRecord) {
      setWatchlistRecords((records) => records.filter((record) => record.issuer_id !== issuerId));
      setNotice(copy.removedFromWatchlist);
      return;
    }
    const codes = detail.securities.map(formatSecurityCode).filter(Boolean).join(" · ");
    setWatchlistRecords((records) => records.concat(createWatchlistRecord({ issuer: detail.entity, codes })));
    setNotice(copy.addedToWatchlist);
  }

  function updateWatchlistRecord(patch) {
    if (!watchRecord) return;
    setWatchlistRecords((records) => records.map((record) => (
      record.issuer_id === watchRecord.issuer_id
        ? { ...record, ...patch, updated_at: new Date().toISOString() }
        : record
    )));
  }

  async function copyResearchLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice(copy.linkCopied);
    } catch {
      setNotice(copy.linkCopyFailed);
    }
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
      setShockType(null);
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
      onClear: () => setShockType(null),
    } : null,
  };

  return (
    <div className="txAppShell">
      {!acknowledged && <DisclaimerModal copy={copy} onAccept={acknowledgeDisclaimer} />}
      {notice && <p className="txStatusToast" role="status" aria-live="polite">{notice}</p>}
      <TopBar
        query={query}
        onQueryChange={setQuery}
        searchResults={searchResults}
        onSelectSearchResult={selectSearchResult}
        onOpenNavigation={() => setSidebarOpen((value) => !value)}
        navigationOpen={sidebarOpen}
        searchPlaceholder={pathStartId && !pathTargetId ? copy.pathTargetPlaceholder : copy.searchPlaceholder}
        copy={copy}
      />
      <ChainNavigator
        navigation={navigation}
        activeChainId={selectedChainId}
        activeEntityId={activeId}
        onOverview={() => selectChain(null)}
        onSelect={selectChain}
        locale={locale}
        onLocaleChange={setLocale}
        marketFilter={marketFilter}
        onMarketFilterChange={setMarketFilter}
        dataVersion={graph.meta.data_version}
        dataStatus={graph.meta.status}
        onReset={resetWorkspace}
        onCopyLink={copyResearchLink}
        watchlistRecords={watchlistRecords}
        onSelectWatchlist={selectEntity}
        onExportWatchlist={() => downloadWatchlist(watchlistRecords)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        copy={copy}
      />
      <main className={`txWorkspace hasInspector ${detail ? "hasDetail" : ""}`}>
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
        {detail ? (
          <GraphDetailPanel
            detail={detail}
            relationDetail={relationDetail}
            locale={locale}
            copy={copy}
            pathStartId={pathStartId}
            shockOverlay={shockOverlay}
            watchRecord={watchRecord}
            onToggleWatchlist={toggleWatchlist}
            onUpdateWatchlist={updateWatchlistRecord}
            onSelectEntity={selectEntity}
            onSelectRelation={selectRelation}
            onExploreDirection={exploreDirection}
            onSetPathStart={startPath}
            onRunShock={runShock}
            onClearShock={() => setShockType(null)}
            onClose={closeDetail}
          />
        ) : (
          <ScopeInspector
            selectedChain={selectedChain}
            chainElements={chainElements}
            navigation={navigation}
            meta={flow.meta}
            locale={locale}
            copy={copy}
            onSelectChain={selectChain}
            onSelectEntity={selectEntity}
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
    const entity = detail.entity;
    if (detail.kind === "issuer") {
      return {
        title: shockSpec ? localize(shockSpec, "title", locale) : localize(entity, "name", locale),
        subtitle: [localize(entity, "industry", locale), `${detail.mappings.length} ${copy.companyPositions}`].filter(Boolean).join(" · "),
        breadcrumbs: [copy.multiChainCompany],
      };
    }
    const context = detail.context || getEntityContext(graph, activeEntity.id);
    const breadcrumbs = [context?.domain, context?.chain, context?.segment].filter(Boolean).map((item) => localize(item, "name", locale));
    return {
      title: shockSpec ? localize(shockSpec, "title", locale) : localize(entity, "name", locale),
      subtitle: [getEntityTypeLabel(entity.entity_type, locale), localize(context?.chain, "name", locale)].filter(Boolean).join(" · "),
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
