import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

const client = new Client({ name: "ai-chaingraph-demo", version: "0.1.0" });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve(import.meta.dirname, "server.mjs")] }));
  const status = (await client.callTool({ name: "get_dataset_status", arguments: {} })).structuredContent;
  const search = await client.callTool({ name: "search_entities", arguments: {
    query: process.argv[2] || "宁德时代", kind: "issuer", snapshot_id: status.dataset.snapshot_id,
  } });
  console.log(JSON.stringify(search.structuredContent, null, 2));
} finally {
  await client.close();
}
