import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import {
  buildChainFlow,
  buildOverviewFlow,
  createGraphViewIndex,
  searchTransmissionGraph,
} from "../src/lib/transmissionViewModel.js";
import { traverseTransmissionGraph } from "../src/lib/transmissionGraph.js";
import { assertGraphPerformanceBudget, assertSearchPerformance } from "./lib/performance-budget.mjs";

const snapshotPath = resolve(import.meta.dirname, "../public/snapshots/transmission-v1.1.json");
const queries = ["AI", "光模块", "NVDA", "301716", "宇特光电"];

function measure(run) {
  const start = performance.now();
  const result = run();
  return { result, milliseconds: performance.now() - start };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

const source = await readFile(snapshotPath, "utf8");
const parse = measure(() => JSON.parse(source));
const graph = parse.result;
const index = measure(() => createGraphViewIndex(graph));
const coldSearch = measure(() => searchTransmissionGraph(graph, queries[0], { locale: "zh" }));
const warmSearchSamples = Array.from({ length: 3 }, () => measure(() => {
  for (let round = 0; round < 10; round += 1) {
    for (const query of queries) searchTransmissionGraph(graph, query, { locale: "zh" });
  }
}).milliseconds);
const warmSearchMs = median(warmSearchSamples);
const warmToFirstRatio = warmSearchMs / coldSearch.milliseconds;
const overview = measure(() => buildOverviewFlow(graph, { locale: "zh", direction: "LR" }));
const chain = measure(() => buildChainFlow(graph, "chain:network_optical_interconnect", { locale: "zh", direction: "LR" }));
const traversal = measure(() => traverseTransmissionGraph(graph, "issuer:sec-cik-0001045810", { direction: "downstream", maxDepth: 1 }));
const metrics = {
  snapshot_gzip_bytes: gzipSync(source, { level: 9 }).length,
  parse_ms: parse.milliseconds,
  index_ms: index.milliseconds,
  overview_ms: overview.milliseconds,
  chain_ms: chain.milliseconds,
  traversal_ms: traversal.milliseconds,
};

console.log(JSON.stringify({
  snapshot_bytes: Buffer.byteLength(source),
  snapshot_gzip_bytes: metrics.snapshot_gzip_bytes,
  entities: graph.entities.length,
  relations: graph.relations.length,
  parse_ms: Number(parse.milliseconds.toFixed(1)),
  index_ms: Number(index.milliseconds.toFixed(1)),
  cold_search_ms: Number(coldSearch.milliseconds.toFixed(1)),
  warm_search_50_ms: Number(warmSearchMs.toFixed(1)),
  warm_search_samples_ms: warmSearchSamples.map((value) => Number(value.toFixed(1))),
  warm_to_first_search_ratio: Number(warmToFirstRatio.toFixed(2)),
  overview_ms: Number(overview.milliseconds.toFixed(1)),
  chain_ms: Number(chain.milliseconds.toFixed(1)),
  traversal_ms: Number(traversal.milliseconds.toFixed(1)),
}, null, 2));

if (process.argv.includes("--check")) {
  assertSearchPerformance(coldSearch.milliseconds, warmSearchMs);
  assertGraphPerformanceBudget(metrics);
}
