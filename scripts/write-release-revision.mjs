import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createReleaseRevision } from "./lib/release-revision.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const revision = createReleaseRevision({
  commit: git("rev-parse", "HEAD"),
  dirty: Boolean(git("status", "--porcelain", "--untracked-files=normal")),
  snapshot: readFileSync(resolve(dist, "snapshots/transmission-v1.1.json")),
  status: readFileSync(resolve(dist, "snapshots/update-status.json")),
});

writeFileSync(resolve(dist, "release-revision.json"), `${JSON.stringify(revision, null, 2)}\n`);
console.log(`Release revision: ${revision.commit.slice(0, 7)}${revision.dirty ? " (uncommitted build)" : ""}`);
