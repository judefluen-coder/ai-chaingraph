import test from "node:test";
import assert from "node:assert/strict";
import { validateAshareReconciliations } from "../scripts/lib/listing-reconciliation.mjs";

function graphFixture() {
  return {
    meta: { refresh: { applied_batch_ids: ["weekly-test"] } },
    entities: [
      { id: "issuer:test", entity_type: "issuer", name: "测试科技" },
      { id: "security:SH:688999", entity_type: "security", name: "测试科技", exchange: "SH", symbol: "688999" },
      { id: "component:test", entity_type: "component", name: "测试部件" },
    ],
    relations: [
      { id: "relation:issuance", relation_type: "security_issued_by", from_id: "security:SH:688999", to_id: "issuer:test" },
      { id: "relation:industry", relation_type: "issuer_produces", from_id: "issuer:test", to_id: "component:test" },
    ],
  };
}

function manifestFixture() {
  return {
    manifest_id: "a-share-test",
    review_status: "approved",
    reviewer: "test",
    reviewed_at: "2026-09-08T00:00:00.000Z",
    period_start: "2026-09-01",
    reconciled_through: "2026-09-08",
    markets: ["SH", "SZ", "BJ"],
    listings: [
      {
        exchange: "SH",
        symbol: "688999",
        name: "测试科技",
        listing_date: "2026-09-02",
        source_url: "https://www.sse.com.cn/test",
        decision: "included",
        decision_reason: "存在具体产业关系。",
        batch_id: "weekly-test",
        issuer_id: "issuer:test",
        security_id: "security:SH:688999",
      },
      {
        exchange: "BJ",
        symbol: "920999",
        name: "范围外公司",
        listing_date: "2026-09-03",
        source_url: "https://www.bse.cn/test",
        decision: "excluded",
        decision_reason: "不属于当前本体。",
      },
    ],
  };
}

test("validates a complete listing decision manifest against imported graph records", () => {
  assert.deepEqual(validateAshareReconciliations([manifestFixture()], graphFixture()), {
    reconciled_through: "2026-09-08",
    reviewed_listings: 2,
    included_listings: 1,
    excluded_listings: 1,
    manifest_ids: ["a-share-test"],
  });
});

test("rejects an included listing when its approved batch was not applied", () => {
  const graph = graphFixture();
  graph.meta.refresh.applied_batch_ids = [];

  assert.throws(
    () => validateAshareReconciliations([manifestFixture()], graph),
    /references an unapplied batch/,
  );
});

test("rejects non-exchange URLs in the listing ledger", () => {
  const manifest = manifestFixture();
  manifest.listings[0].source_url = "https://example.com/listing";

  assert.throws(
    () => validateAshareReconciliations([manifest], graphFixture()),
    /own official exchange HTTPS listing source/,
  );
});

test("rejects an official URL from the wrong exchange", () => {
  const manifest = manifestFixture();
  manifest.listings[0].source_url = "https://www.szse.cn/test";
  assert.throws(() => validateAshareReconciliations([manifest], graphFixture()), /own official exchange HTTPS listing source/);
});

test("allows a continuous empty period after all exchanges were checked", () => {
  const emptyFollowUp = {
    manifest_id: "a-share-test-empty-week",
    review_status: "approved",
    reviewer: "test",
    reviewed_at: "2026-09-15T00:00:00.000Z",
    period_start: "2026-09-09",
    reconciled_through: "2026-09-15",
    markets: ["SH", "SZ", "BJ"],
    market_checks: [
      { exchange: "SH", source_url: "https://www.sse.com.cn/test", checked_at: "2026-09-15T00:00:00.000Z", method: "Checked", new_listings: 0 },
      { exchange: "SZ", source_url: "https://www.szse.cn/test", checked_at: "2026-09-15T00:00:00.000Z", method: "Checked", new_listings: 0 },
      { exchange: "BJ", source_url: "https://www.bse.cn/test", checked_at: "2026-09-15T00:00:00.000Z", method: "Checked", new_listings: 0 },
    ],
    listings: [],
  };

  assert.deepEqual(
    validateAshareReconciliations([manifestFixture(), emptyFollowUp], graphFixture()),
    {
      reconciled_through: "2026-09-15",
      reviewed_listings: 2,
      included_listings: 1,
      excluded_listings: 1,
      manifest_ids: ["a-share-test", "a-share-test-empty-week"],
    },
  );
});

test("rejects missing, mismatched, or prematurely dated exchange checks", () => {
  const followUp = {
    manifest_id: "a-share-test-new-period",
    review_status: "approved",
    reviewer: "test",
    reviewed_at: "2026-09-15T00:00:00.000Z",
    period_start: "2026-09-09",
    reconciled_through: "2026-09-15",
    markets: ["SH", "SZ", "BJ"],
    listings: [],
  };
  const validate = () => validateAshareReconciliations([manifestFixture(), followUp], graphFixture());
  assert.throws(validate, /all three exchange checks/);
  followUp.market_checks = [
    { exchange: "SH", source_url: "https://www.sse.com.cn/test", checked_at: "2026-09-15T00:00:00.000Z", method: "Checked", new_listings: 0 },
    { exchange: "SZ", source_url: "https://www.szse.cn/test", checked_at: "2026-09-15T00:00:00.000Z", method: "Checked", new_listings: 0 },
    { exchange: "BJ", source_url: "https://www.bse.cn/test", checked_at: "2026-09-15T00:00:00.000Z", method: "Checked", new_listings: 0 },
  ];
  followUp.market_checks[0].new_listings = 1;
  assert.throws(validate, /matching listing count/);
  followUp.market_checks[0].new_listings = 0;
  followUp.market_checks[0].checked_at = "2026-09-14T00:00:00.000Z";
  assert.throws(validate, /cannot predate/);
});
