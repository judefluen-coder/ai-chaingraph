import { createHash } from "node:crypto";

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function createReleaseRevision({ commit, dirty, snapshot, status }) {
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(commit) || typeof dirty !== "boolean") {
    throw new Error("Release revision needs a Git commit and a clean-state flag.");
  }
  return {
    schema_version: "1.0.0",
    commit,
    dirty,
    snapshot_sha256: sha256(snapshot),
    status_sha256: sha256(status),
  };
}

export function assertReleaseRevision(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match the expected release revision.`);
  }
}
