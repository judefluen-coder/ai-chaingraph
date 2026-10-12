import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertReleaseRevision, createReleaseRevision, sha256 } from "./lib/release-revision.mjs";

const mode = process.argv[2];
if (!["--preflight", "--deployed"].includes(mode)) {
  throw new Error("Use --preflight before publishing Sites or --deployed after publishing.");
}

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const git = (...args) => execFileSync("git", args, {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
}).trim();
const commit = git("rev-parse", "HEAD");
if (git("branch", "--show-current") !== "main") throw new Error("Publish only from the main branch.");
if (git("status", "--porcelain", "--untracked-files=normal")) throw new Error("Publish only from a clean worktree.");

const remoteCommit = git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0];
if (remoteCommit !== commit) throw new Error("Local main does not match GitHub main; push and wait for Pages first.");

const expected = createReleaseRevision({
  commit,
  dirty: false,
  snapshot: readFileSync(resolve(dist, "snapshots/transmission-v1.1.json")),
  status: readFileSync(resolve(dist, "snapshots/update-status.json")),
});
assertReleaseRevision(JSON.parse(readFileSync(resolve(dist, "release-revision.json"), "utf8")), expected, "Local build");
const archived = execFileSync("tar", ["-xOzf", resolve(root, ".sites/ai-chaingraph-sites.tar.gz"), "dist/client/release-revision.json"]);
assertReleaseRevision(JSON.parse(archived.toString("utf8")), expected, "Sites archive");

async function fetchPublished(base, path) {
  const url = new URL(path, base);
  url.searchParams.set("revision", commit);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`${url.origin}${url.pathname} returned ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}

async function verifyPublished(label, base) {
  const revision = JSON.parse((await fetchPublished(base, "release-revision.json")).toString("utf8"));
  assertReleaseRevision(revision, expected, label);
  const status = await fetchPublished(base, "snapshots/update-status.json");
  const snapshot = await fetchPublished(base, "snapshots/transmission-v1.1.json");
  if (sha256(status) !== expected.status_sha256 || sha256(snapshot) !== expected.snapshot_sha256) {
    throw new Error(`${label} snapshot files do not match the release revision.`);
  }
  console.log(`${label}: ${commit.slice(0, 7)} and snapshot hashes match.`);
}

await verifyPublished("GitHub Pages", "https://judefluen-coder.github.io/ai-chaingraph/");
if (mode === "--deployed") {
  await verifyPublished("OpenAI Sites", "https://ai-chaingraph.judefluen.chatgpt.site/");
}
