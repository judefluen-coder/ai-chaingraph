import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const workflows = resolve(import.meta.dirname, "../.github/workflows");

test("CI, weekly review, and Pages share the Sites release gate", async () => {
  for (const filename of ["ci.yml", "weekly-data-quality.yml", "pages.yml"]) {
    const workflow = await readFile(resolve(workflows, filename), "utf8");
    assert.match(workflow, /run: npm run build:sites/, `${filename} must validate the Sites package.`);
  }

  const pages = await readFile(resolve(workflows, "pages.yml"), "utf8");
  assert.ok(pages.indexOf("run: npm run build:sites") < pages.indexOf("VITE_BASE_PATH: /ai-chaingraph/"), "Pages must pass the shared gate before its subpath build.");
  assert.match(pages, /PLAYWRIGHT_BASE_PATH: \/ai-chaingraph\//);
});
