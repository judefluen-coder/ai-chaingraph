import { expect, test } from "@playwright/test";

test("desktop search opens a source-backed relation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("/");

  await expect(page.locator(".txScopeInspector")).toBeVisible();
  await page.getByRole("combobox", { name: "搜索图谱" }).fill("鸿富诚");
  await page.getByRole("option", { name: /鸿富诚/ }).click();
  await expect(page.locator(".txDetailPanel").getByRole("heading", { name: "鸿富诚" })).toBeVisible();
  await page.getByRole("button", { name: /热管理材料.*生产.*L1 官方披露/ }).click();
  await expect(page.getByRole("heading", { name: "逐边证据" })).toBeVisible();
  await expect(page.getByRole("link", { name: /打开原始来源/ })).toHaveAttribute("href", /^https:\/\//);
});

test("mobile directory, search, and detail remain reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("ai-chaingraph-locale", "zh"));
  await page.goto("/");

  await page.getByRole("button", { name: "进入图谱" }).click();
  const directory = page.locator(".txScopeInspector");
  await expect(directory).toBeVisible();
  await directory.getByRole("button", { name: "AI芯片与IP" }).click();
  await expect(directory.getByRole("heading", { name: "产业环节" })).toBeVisible();
  await directory.getByRole("button", { name: "返回能力域" }).click();
  await expect(directory.getByRole("heading", { name: "能力域与产业链" })).toBeVisible();

  await page.getByRole("combobox", { name: "搜索图谱" }).fill("鸿富诚");
  const result = page.getByRole("option", { name: /鸿富诚/ });
  await expect(result).toBeVisible();
  await result.click();
  await expect(directory).toBeHidden();
  await expect(page.locator(".txDetailPanel").getByRole("heading", { name: "鸿富诚" })).toBeVisible();
  await page.getByRole("button", { name: "关闭详情" }).click();
  await page.getByRole("button", { name: "浏览产业目录" }).click();
  await expect(directory).toBeVisible();
  await directory.getByRole("button", { name: "查看图谱" }).click();
  await expect(directory).toBeHidden();
});
