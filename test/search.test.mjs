import assert from "node:assert/strict";
import test from "node:test";
import { searchTransmissionGraph } from "../src/lib/transmissionViewModel.js";

const graph = {
  entities: [
    { id: "issuer:cn", entity_type: "issuer", name: "鸿富诚", name_en: "Hongfucheng", aliases: ["导热材料公司"], industry: "热管理材料" },
    { id: "security:SZ:301716", entity_type: "security", name: "鸿富诚", stock_code: "301716.SZ", symbol: "301716", exchange: "SZ" },
    { id: "issuer:us", entity_type: "issuer", name: "英伟达", name_en: "NVIDIA", aliases: ["NVDA Corp"] },
    { id: "security:NASDAQ:NVDA", entity_type: "security", name: "NVIDIA", stock_code: "NVDA", symbol: "NVDA", exchange: "NASDAQ" },
    { id: "material:thermal", entity_type: "material", name: "热管理材料", name_en: "Thermal materials" },
  ],
  relations: [
    { id: "relation:cn-security", relation_type: "security_issued_by", from_id: "security:SZ:301716", to_id: "issuer:cn" },
    { id: "relation:us-security", relation_type: "security_issued_by", from_id: "security:NASDAQ:NVDA", to_id: "issuer:us" },
  ],
};

test("cached search preserves symbol, alias, bilingual, and market results", () => {
  assert.equal(searchTransmissionGraph(graph, "301716.SZ")[0].id, "issuer:cn");
  assert.equal(searchTransmissionGraph(graph, "导热材料公司")[0].id, "issuer:cn");
  assert.equal(searchTransmissionGraph(graph, "nvidia", { locale: "en" })[0].id, "issuer:us");
  assert.equal(searchTransmissionGraph(graph, "NVDA", { market: "a_share" }).length, 0);
  assert.equal(searchTransmissionGraph(graph, "热管理材料", { market: "us" })[0].id, "material:thermal");
  assert.equal(searchTransmissionGraph(graph, "301716", { market: "a_share" })[0].id, "issuer:cn");
});
