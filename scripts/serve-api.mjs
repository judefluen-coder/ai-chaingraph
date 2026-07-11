import { appendFile, mkdir, readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPublishedGraph,
  getEntity,
  getEvidenceItems,
  getMappingEdgesForNode,
  getPathSummary,
  getSearchTarget,
  searchItems,
} from "../src/lib/graphViewModel.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const endpointContract = ["/api/graph", "/api/search", "/api/node/:id", "/api/review"];

export function createApiServer(options = {}) {
  const context = {
    rootDir: options.rootDir || rootDir,
    dataDir: options.dataDir || path.join(options.rootDir || rootDir, "data"),
  };
  return http.createServer((request, response) => {
    handleApiRequest(request, response, context).catch((error) => {
      const status = error.statusCode || 500;
      sendJson(response, status, { error: error.message || "Internal server error" });
    });
  });
}

export async function handleApiRequest(request, response, context) {
  setCorsHeaders(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url, "http://localhost");
  if (request.method === "GET" && url.pathname === "/api/graph") {
    sendJson(response, 200, buildPublishedGraph(await readGraph(context)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/search") {
    const graph = buildPublishedGraph(await readGraph(context));
    const query = url.searchParams.get("q") || "";
    const items = searchItems(graph, query).map((item) => ({
      id: item.id,
      type: item.stock_code ? "company" : item.target_type ? "evidence" : "node",
      title: item.title || item.name,
      target_id: getSearchTarget(graph, item),
      subtitle: item.stock_code || item.source_type || item.node_type || "",
    }));
    sendJson(response, 200, { query, count: items.length, items });
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/node/")) {
    const graph = buildPublishedGraph(await readGraph(context));
    const id = decodeURIComponent(url.pathname.slice("/api/node/".length));
    const entity = getEntity(graph, id);
    if (!entity) throw httpError(404, `Entity not found: ${id}`);
    const mappingEdges = entity.node_type === "overview"
      ? []
      : entity.stock_code
        ? graph.edges.filter((edge) => edge.edge_type === "company_maps_to_industry_node" && edge.to_id === entity.id)
        : getMappingEdgesForNode(graph, entity, "all", "all");
    const evidence = getEvidenceItems(graph, mappingEdges).map((item) => ({
      ...item.evidence,
      edge_id: item.edge.id,
    }));
    sendJson(response, 200, {
      entity,
      path_summary: getPathSummary(graph, entity, "all"),
      mapping_edges: mappingEdges,
      evidence,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/review") {
    const records = await readReviewQueue(context);
    sendJson(response, 200, { count: records.length, records });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/review") {
    const body = await readRequestJson(request);
    const record = buildReviewRecord(body);
    await appendReviewRecord(context, record);
    sendJson(response, 201, { record });
    return;
  }

  sendJson(response, 404, { error: "Not found", endpoints: endpointContract });
}

export async function readGraph(context = {}) {
  const resolvedRoot = context.rootDir || rootDir;
  const resolvedDataDir = context.dataDir || path.join(resolvedRoot, "data");
  const localSnapshotPath = path.join(resolvedDataDir, "snapshots", "current.json");
  try {
    const snapshot = JSON.parse(await readFile(localSnapshotPath, "utf8"));
    return mergeReviewQueue(normalizeGraph(snapshot, "local_snapshot"), await readReviewQueue({ ...context, dataDir: resolvedDataDir }));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const demo = JSON.parse(await readFile(path.join(resolvedRoot, "src", "data", "demoGraph.json"), "utf8"));
  return mergeReviewQueue(normalizeGraph(demo, "demo"), await readReviewQueue({ ...context, dataDir: resolvedDataDir }));
}

function normalizeGraph(graph, source) {
  return {
    ...graph,
    market_signals: graph.market_signals || [],
    review_queue: graph.review_queue || [],
    import_jobs: graph.import_jobs || [],
    meta: {
      dataset_type: "demo",
      source_policy: "public_demo_only",
      ...graph.meta,
      source,
    },
  };
}

export async function readReviewQueue(context = {}) {
  const resolvedRoot = context.rootDir || rootDir;
  const resolvedDataDir = context.dataDir || path.join(resolvedRoot, "data");
  const reviewPath = path.join(resolvedDataDir, "review-queue", "local-api-review.jsonl");
  let content = "";
  try {
    content = await readFile(reviewPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function mergeReviewQueue(graph, localRecords) {
  const records = [...(graph.review_queue || []), ...localRecords];
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    ...graph,
    review_queue: [...byId.values()].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
  };
}

async function readRequestJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw httpError(413, "Request body too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "Request body must be JSON");
  }
}

function buildReviewRecord(body) {
  if (!body.target_type || !body.target_id) throw httpError(400, "target_type and target_id are required");
  return {
    id: `review:${Date.now()}`,
    target_type: body.target_type,
    target_id: body.target_id,
    issue_type: body.issue_type || "manual_review",
    payload: body.payload || {
      url: body.url || "",
      note: body.note || "",
    },
    status: "pending",
    created_by: body.created_by || "human:local-api",
    created_at: new Date().toISOString(),
    operations: [],
  };
}

async function appendReviewRecord(context, record) {
  const reviewDir = path.join(context.dataDir, "review-queue");
  await mkdir(reviewDir, { recursive: true });
  await appendFile(path.join(reviewDir, "local-api-review.jsonl"), `${JSON.stringify(record)}\n`);
}

function sendJson(response, status, payload) {
  setCorsHeaders(response);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function setCorsHeaders(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const host = process.env.CHAINGRAPH_API_HOST || "127.0.0.1";
  const port = Number(process.env.CHAINGRAPH_API_PORT || process.env.PORT || 8787);
  const server = createApiServer();
  server.listen(port, host, () => {
    const address = server.address();
    console.log(`AI-ChainGraph local API listening at http://${address.address}:${address.port}`);
    console.log(`Endpoints: ${endpointContract.join(", ")}`);
  });
}
