import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import {
  buildChainFlow,
  buildOverviewFlow,
  createGraphViewIndex,
  searchTransmissionGraph,
} from "../src/lib/transmissionViewModel.js";
import { traverseTransmissionGraph } from "../src/lib/transmissionGraph.js";

const snapshotPath = resolve(import.meta.dirname, "../public/snapshots/transmission-v1.1.json");
const queries = ["AI", "光模块", "NVDA", "301716", "宇特光电"];

function measure(run) {
  const start = performance.now();
  const result = run();
  return { result, milliseconds: performance.now() - start };
}

const source = await readFile(snapshotPath, "utf8");
const parse = measure(() => JSON.parse(source));
const graph = parse.result;
const index = measure(() => createGraphViewIndex(graph));
const coldSearch = measure(() => searchTransmissionGraph(graph, queries[0], { locale: "zh" }));
const warmSearch = measure(() => {
  for (let round = 0; round < 10; round += 1) {
    for (const query of queries) searchTransmissionGraph(graph, query, { locale: "zh" });
  }
});
const overview = measure(() => buildOverviewFlow(graph, { locale: "zh", direction: "LR" }));
const chain = measure(() => buildChainFlow(graph, "chain:network_optical_interconnect", { locale: "zh", direction: "LR" }));
const traversal = measure(() => traverseTransmissionGraph(graph, "issuer:sec-cik-0001045810", { direction: "downstream", maxDepth: 1 }));

console.log(JSON.stringify({
  snapshot_bytes: Buffer.byteLength(source),
  entities: graph.entities.length,
  relations: graph.relations.length,
  parse_ms: Number(parse.milliseconds.toFixed(1)),
  index_ms: Number(index.milliseconds.toFixed(1)),
  cold_search_ms: Number(coldSearch.milliseconds.toFixed(1)),
  warm_search_50_ms: Number(warmSearch.milliseconds.toFixed(1)),
  overview_ms: Number(overview.milliseconds.toFixed(1)),
  chain_ms: Number(chain.milliseconds.toFixed(1)),
  traversal_ms: Number(traversal.milliseconds.toFixed(1)),
}, null, 2));
