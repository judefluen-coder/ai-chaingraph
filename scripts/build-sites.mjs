import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";

const projectRoot = resolve(import.meta.dirname, "..");
const viteDist = join(projectRoot, "dist");
const sitesRoot = join(projectRoot, ".sites");
const packageRoot = join(sitesRoot, "package");
const packageDist = join(packageRoot, "dist");
const clientDist = join(packageDist, "client");
const workerPath = join(packageDist, "server", "index.js");
const archivePath = join(sitesRoot, "ai-chaingraph-sites.tar.gz");
const hostingSource = join(projectRoot, ".openai", "hosting.json");
const requiredSnapshot = "snapshots/transmission-v1.1.json";

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath];
  });
}

function webPath(filePath) {
  return `/${relative(viteDist, filePath).split(sep).join("/")}`;
}

function cacheControl(pathname) {
  if (pathname === "/index.html") return "no-cache";
  if (pathname === `/${requiredSnapshot}`) return "no-store";
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
}

function createWorkerSource(assetRecords) {
  return `const ASSETS = ${JSON.stringify(assetRecords)};
const BYTE_CACHE = new Map();

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function assetBytes(pathname, asset) {
  if (!BYTE_CACHE.has(pathname)) BYTE_CACHE.set(pathname, decodeBase64(asset.body));
  return BYTE_CACHE.get(pathname);
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    const url = new URL(request.url);
    let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    let asset = ASSETS[pathname];

    if (!asset && !pathname.split("/").at(-1).includes(".")) {
      pathname = "/index.html";
      asset = ASSETS[pathname];
    }

    if (!asset) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
      });
    }

    const headers = new Headers({
      "cache-control": asset.cacheControl,
      "content-encoding": "gzip",
      "content-type": asset.contentType,
      etag: asset.etag,
      "referrer-policy": "strict-origin-when-cross-origin",
      vary: "Accept-Encoding",
      "x-content-type-options": "nosniff",
    });

    return new Response(request.method === "HEAD" ? null : assetBytes(pathname, asset), { headers });
  },
};
`;
}

invariant(existsSync(join(viteDist, "index.html")), "Run the Vite build before building the Sites package.");
invariant(existsSync(join(viteDist, requiredSnapshot)), `Missing ${requiredSnapshot} in the Vite build.`);
invariant(existsSync(hostingSource), "Missing .openai/hosting.json.");

const hosting = JSON.parse(readFileSync(hostingSource, "utf8"));
invariant(typeof hosting.project_id === "string" && hosting.project_id, "Sites project_id is required.");

rmSync(packageRoot, { recursive: true, force: true });
mkdirSync(join(packageDist, "server"), { recursive: true });
mkdirSync(join(packageDist, ".openai"), { recursive: true });

const includedFiles = listFiles(viteDist).filter(
  (filePath) => webPath(filePath) !== "/snapshots/current.json",
);

for (const filePath of includedFiles) {
  const targetPath = join(clientDist, relative(viteDist, filePath));
  mkdirSync(resolve(targetPath, ".."), { recursive: true });
  cpSync(filePath, targetPath);
}

const assetRecords = Object.fromEntries(
  includedFiles.map((filePath) => {
    const pathname = webPath(filePath);
    const content = readFileSync(filePath);
    const compressed = gzipSync(content, { level: 9 });
    const digest = createHash("sha256").update(content).digest("hex").slice(0, 24);
    return [
      pathname,
      {
        body: compressed.toString("base64"),
        cacheControl: cacheControl(pathname),
        contentType: CONTENT_TYPES[extname(filePath)] || "application/octet-stream",
        etag: `"${digest}"`,
      },
    ];
  }),
);

writeFileSync(workerPath, createWorkerSource(assetRecords), "utf8");
writeFileSync(
  join(packageDist, ".openai", "hosting.json"),
  `${JSON.stringify({ project_id: hosting.project_id, d1: null, r2: null }, null, 2)}\n`,
  "utf8",
);

execFileSync(process.execPath, ["--check", workerPath], { stdio: "inherit" });
rmSync(archivePath, { force: true });
execFileSync("tar", ["-C", packageRoot, "-czf", archivePath, "dist"], { stdio: "inherit" });

const workerSize = statSync(workerPath).size;
const archiveSize = statSync(archivePath).size;
invariant(workerSize < 8 * 1024 * 1024, `Generated Worker is unexpectedly large: ${workerSize} bytes.`);

console.log(
  JSON.stringify(
    {
      archive: archivePath,
      archive_bytes: archiveSize,
      assets: includedFiles.length,
      project_id: hosting.project_id,
      worker_bytes: workerSize,
    },
    null,
    2,
  ),
);
