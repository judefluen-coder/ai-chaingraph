import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const basePath = process.env.PLAYWRIGHT_BASE_PATH || "/";
const baseURL = `http://127.0.0.1:5175${basePath}`;
const localChrome = process.platform === "darwin" && existsSync("/Applications/Google Chrome.app");

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  globalTimeout: 5 * 60_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    channel: !process.env.CI && localChrome ? "chrome" : undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: basePath === "/" ? "npm run dev -- --port 5175 --strictPort" : "npm run preview -- --port 5175 --strictPort",
    env: basePath === "/" ? undefined : { VITE_BASE_PATH: basePath },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
