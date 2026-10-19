import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`company comparison, shared link and evidence at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("ai-chaingraph-disclaimer", "ack");
      localStorage.setItem("ai-chaingraph-locale", "zh");
    });
    await page.goto("./");
    await page.getByRole("combobox", { name: "搜索图谱" }).fill("鸿富诚");
    await page.getByRole("option", { name: /鸿富诚/ }).click();
    await page.getByRole("button", { name: "公司对比", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "公司对比" });
    await expect(dialog).toBeVisible();
    const search = dialog.getByRole("searchbox");
    await search.fill("英伟达");
    await dialog.getByRole("button", { name: /英伟达/ }).click();
    await expect(dialog.locator(".txComparisonCompany")).toHaveCount(2);
    const sharedUrl = page.url();
    await page.reload();
    await expect(dialog.locator(".txComparisonCompany")).toHaveCount(2);
    expect(page.url()).toBe(sharedUrl);
    await dialog.getByRole("checkbox").check();
    await expect(dialog.locator(".txComparisonCompany")).toHaveCount(2);
    await dialog.getByRole("checkbox").uncheck();
    const overflow = await dialog.evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`comparison-${width}.png`), fullPage: true });
    await dialog.getByRole("button", { name: "核验证据" }).first().click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "逐边证据" })).toBeVisible();
    await page.getByRole("button", { name: "公司对比", exact: true }).click();
    await dialog.getByRole("button", { name: /移除 英伟达/ }).click();
    await expect(dialog.locator(".txComparisonCompany")).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "复制对比链接" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}

test("comparison enforces four companies and offers a copy fallback", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } });
  });
  await page.goto("./?compare=issuer%3Amissing&q=private-search");
  const dialog = page.getByRole("dialog", { name: "公司对比" });
  await expect(dialog.getByText("部分公司在当前快照中不存在，请重新选择。")).toBeVisible();
  for (const name of ["鸿富诚", "英伟达", "AMD", "长鑫"]) {
    await dialog.getByRole("searchbox").fill(name);
    await dialog.locator(".txComparisonResults button").first().click();
  }
  await expect(dialog.locator(".txComparisonCompany")).toHaveCount(4);
  await expect(dialog.getByRole("searchbox")).toBeDisabled();
  await dialog.getByRole("button", { name: "复制对比链接" }).click();
  const link = await dialog.getByRole("textbox", { name: "对比链接" }).inputValue();
  const params = new URL(link).searchParams;
  expect(params.getAll("compare")).toHaveLength(4);
  expect(params.has("q")).toBe(false);
  await page.goto(link);
  await expect(dialog.locator(".txComparisonCompany")).toHaveCount(4);
  await dialog.locator(".txComparisonCompanyHeader button").first().click();
  await expect(dialog.getByRole("searchbox")).toBeEnabled();
});
