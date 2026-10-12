import assert from "node:assert/strict";
import { test } from "node:test";
import { assertReleaseRevision, createReleaseRevision, sha256 } from "../scripts/lib/release-revision.mjs";

const commit = "a".repeat(40);

test("release revision binds a commit and the exact published snapshot bytes", () => {
  const revision = createReleaseRevision({ commit, dirty: false, snapshot: Buffer.from("graph"), status: Buffer.from("status") });
  assert.equal(revision.commit, commit);
  assert.equal(revision.snapshot_sha256, sha256(Buffer.from("graph")));
  assert.doesNotThrow(() => assertReleaseRevision(revision, { ...revision }, "Test build"));
  assert.throws(() => assertReleaseRevision(revision, { ...revision, snapshot_sha256: sha256("other") }, "Test build"), /does not match/);
  assert.throws(() => assertReleaseRevision(revision, { ...revision, dirty: true }, "Test build"), /does not match/);
});

test("release revision rejects missing Git identity", () => {
  assert.throws(() => createReleaseRevision({ commit: "unknown", dirty: false, snapshot: "graph", status: "status" }), /Git commit/);
});
