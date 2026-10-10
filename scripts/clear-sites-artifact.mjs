import { rmSync } from "node:fs";
import { resolve } from "node:path";

rmSync(resolve(import.meta.dirname, "..", ".sites", "ai-chaingraph-sites.tar.gz"), { force: true });
