import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadDataset, parseDataset } from "../agent/dataset.mjs";
import { createResearch } from "../agent/research.mjs";

test("dataset identity and unavailable history are explicit", async () => {
  const original = await loadDataset();
  const text = JSON.stringify(original.graph);
  const missing = parseDataset(text);
  assert.equal(missing.historyStatus, "missing");
  assert.equal(parseDataset(text, "{").historyStatus, "invalid");
  assert.equal(parseDataset(text, "{}").historyStatus, "mismatched");
  assert.notEqual(missing.snapshotId, parseDataset(text, null, "changed").snapshotId);
  assert.throws(() => parseDataset("{}"), /Invalid/);
  const research = createResearch(missing);
  assert.throws(() => research.run("get_recorded_changes", { issuer_id: "issuer:cn-sz-300750" }), { code: "HISTORY_UNAVAILABLE" });
  assert.throws(() => research.run("get_dataset_status", { snapshot_id: "wrong" }), { code: "SNAPSHOT_MISMATCH" });
});

test("real stdio handshake and research workflow", { timeout: 30000 }, async () => {
  const client = new Client({ name: "agent-test", version: "1.0.0" });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve("agent/server.mjs")] }));
    const { tools } = await client.listTools();
    assert.equal(tools.length, 7);
    assert.ok(tools.every(tool => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint));
    async function call(name, args = {}) {
      const response = await client.callTool({ name, arguments: args });
      assert.ok(!response.isError, JSON.stringify(response));
      return response.structuredContent;
    }
    const status = await call("get_dataset_status");
    assert.equal(status.result.read_only, true);
    const pin = { snapshot_id: status.dataset.snapshot_id };
    const search = await call("search_entities", { ...pin, query: "宁德时代", kind: "issuer" });
    const issuer = search.result.items[0].id;
    assert.equal(issuer, "issuer:cn-sz-300750");
    assert.equal((await call("search_entities", { query: "300750" })).result.items[0].id, issuer);
    const profile = await call("get_company_profile", { ...pin, issuer_id: issuer, limit: 1 });
    assert.equal(profile.result.positions.items.length, 1);
    const relation = profile.result.positions.items[0];
    const evidence = await call("get_relation_evidence", { ...pin, relation_id: relation.id });
    assert.equal(evidence.result.usable_as_current_record, true);
    assert.ok(evidence.result.evidence.items.length);
    assert.ok(evidence.result.evidence.items[0].source.url.startsWith("https://"));
    const second = (await call("search_entities", { query: "比亚迪", kind: "issuer" })).result.items[0].id;
    assert.equal((await call("compare_companies", { issuer_ids: [issuer, second] })).result.companies.length, 2);
    const path = await call("trace_industry_path", { from_id: relation.to.id, to_id: relation.to.id });
    assert.equal(path.result.found, true);
    if (status.dataset.history_status === "available") {
      const changes = await call("get_recorded_changes", { issuer_id: issuer });
      assert.ok(Array.isArray(changes.result.items));
    } else {
      const changes = await client.callTool({ name: "get_recorded_changes", arguments: { issuer_id: issuer } });
      assert.equal(changes.structuredContent.error.code, "HISTORY_UNAVAILABLE");
    }
    for (const [name, args] of [
      ["search_entities", { query: "" }],
      ["search_entities", { query: "test", limit: 100000 }],
      ["search_entities", { query: "test", unexpected: true }],
      ["get_company_profile", { issuer_id: "missing" }],
      ["compare_companies", { issuer_ids: [issuer, issuer] }],
      ["get_recorded_changes", { issuer_id: issuer, since: "2026-02-30" }],
      ["get_recorded_changes", { issuer_id: issuer, since: "2026-10-10", until: "2026-01-01" }],
      ["get_dataset_status", { snapshot_id: "0".repeat(64) }],
    ]) assert.equal((await client.callTool({ name, arguments: args })).isError, true, `${name}: ${JSON.stringify(args)}`);
  } finally {
    await client.close();
  }
});

test("historical relations do not become current records", async () => {
  const dataset = await loadDataset();
  const record = dataset.graph.relations.find(item => item.from_id === "issuer:cn-sz-300750");
  const archived = { ...record, lifecycle_status: "withdrawn", withdrawal_reason: "Test withdrawal" };
  dataset.graph = { ...dataset.graph, relations: dataset.graph.relations.filter(item => item.id !== record.id) };
  dataset.history = { archived_relations: [archived], events: [], batches: [] };
  dataset.historyStatus = "available";
  const research = createResearch(dataset);
  for (const archived of dataset.history.archived_relations.slice(0, 5)) {
    const result = research.run("get_relation_evidence", { relation_id: archived.id, locale: "zh" }).result;
    assert.equal(result.usable_as_current_record, false);
    assert.ok(["superseded", "withdrawn"].includes(result.relation.lifecycle_status));
  }
});
