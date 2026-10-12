import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertReadmeSnapshotSummary,
  renderSnapshotSummary,
  syncReadmeSnapshotSummary,
} from "../scripts/lib/readme-snapshot-summary.mjs";

const graph = {
  meta: {
    data_version: "1.2.0",
    counts: { issuers: 4551, chains: 12, segments: 111, issuer_mappings: 6623, source_documents: 4643 },
    quality: { specific_relations: 5998, specific_issuer_rate: 0.9332 },
    refresh: {
      last_checked_at: "2026-10-10T12:34:44.135Z",
      last_changed_at: "2026-10-09T12:34:44.135Z",
      source_cutoff_date: "2026-10-08",
      a_share_listing_reconciled_through: "2026-10-10",
    },
  },
};

test("README summaries distinguish check, change, source, and listing dates", () => {
  for (const locale of ["zh", "en"]) {
    const summary = renderSnapshotSummary(graph, locale);
    assert.match(summary, /4,551/);
    assert.match(summary, /5,998(?:（| \()93\.3%/);
    assert.match(summary, /2026-10-10/);
    assert.match(summary, /2026-10-09/);
    assert.match(summary, /2026-10-08/);
    const readme = `Before\n<!-- snapshot-summary:start -->\nold\n<!-- snapshot-summary:end -->\nAfter\n`;
    const updated = syncReadmeSnapshotSummary(readme, graph, locale);
    assert.match(updated, /^Before\n/);
    assert.match(updated, /\nAfter\n$/);
    assert.doesNotThrow(() => assertReadmeSnapshotSummary(updated, graph, locale));
    assert.throws(() => assertReadmeSnapshotSummary(readme, graph, locale), /stale/);
  }
});

test("README summary sync refuses missing or duplicate markers", () => {
  assert.throws(() => syncReadmeSnapshotSummary("plain text", graph, "zh"), /marker pair/);
  assert.throws(() => syncReadmeSnapshotSummary("<!-- snapshot-summary:start --><!-- snapshot-summary:start --><!-- snapshot-summary:end -->", graph, "en"), /marker pair/);
});
