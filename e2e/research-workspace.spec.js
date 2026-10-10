import { expect, test } from "@playwright/test";

test("desktop search opens a source-backed relation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./");

  await expect(page.locator(".txScopeInspector")).toBeVisible();
  await expect(page.locator(".txSidebarDataState small span").first()).toContainText(/最近核验\s+\d{4}-\d{2}-\d{2}/);
  await expect(page.locator(".txSidebarDataState small span").last()).toContainText(/已收录来源截止\s+\d{4}-\d{2}-\d{2}/);
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
  await page.goto("./");

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
  await page.getByRole("button", { name: "打开研究工作区" }).click();
  const dataState = page.locator(".txSidebarDataState");
  await dataState.scrollIntoViewIfNeeded();
  await expect(dataState.locator("small span").first()).toContainText(/最近核验\s+\d{4}-\d{2}-\d{2}/);
  await expect(dataState.locator("small span").last()).toContainText(/已收录来源截止\s+\d{4}-\d{2}-\d{2}/);
});

test("withdrawn mapping remains inspectable but clearly marked as invalid", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./?entity=issuer%3Acn-sh-688519&relation=relation%3Aissuer_element%3A5ed7eaa20385b11e10b938c5");

  const panel = page.locator(".txDetailPanel");
  await expect(panel.getByRole("heading", { name: "南亚新材" })).toBeVisible();
  await expect(panel.getByRole("status")).toContainText("已撤回");
  await expect(panel.getByRole("status")).toContainText("不能据此认定公司生产AI PC或智能手机");
});

test("reviewed broad mapping explains why the narrower claim was rejected", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./?entity=issuer%3Acn-sh-603330&relation=relation%3Aissuer_segment_reviewed%3Atianyang-adhesives-20261010");

  const panel = page.locator(".txDetailPanel");
  await expect(panel.getByRole("heading", { name: "天洋新材" })).toBeVisible();
  await expect(panel.locator(".txReviewReason")).toContainText("未证明公司生产传感器");
  await expect(panel.locator(".txEvidenceSection .txEvidenceBadge")).toContainText("宽口径映射");
});

test("mobile evidence source remains readable and touch-sized", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./?entity=issuer%3Acn-sh-603330&relation=relation%3Aissuer_segment_reviewed%3Atianyang-adhesives-20261010");

  const panel = page.locator(".txDetailPanel");
  await expect(panel.locator(".txReviewReason")).toContainText("未证明公司生产传感器");
  const sourceLink = panel.getByRole("link", { name: /打开原始来源/ });
  await sourceLink.scrollIntoViewIfNeeded();
  await expect(sourceLink).toHaveAttribute("href", /^https:\/\//);
  expect((await sourceLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
});

test("a corrected relationship links its archived claim to the replacement evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./?entity=issuer%3Acn-sz-000997&relation=relation%3Aissuer_element%3A5e704f96cb7afaf2414fc8a9");

  const panel = page.locator(".txDetailPanel");
  await expect(panel.getByRole("status")).toContainText("已被替代");
  await expect(panel.getByRole("status")).toContainText("动作由“集成”更正为“研发”");
  await panel.getByRole("button", { name: "查看替代关系" }).click();
  await expect(panel.locator(".txSelectedRelation")).toContainText("研发");
  await expect(panel.locator(".txEvidenceList")).toContainText("LAND大模型一体机");
  await expect(panel.getByRole("status")).toHaveCount(0);
  await expect(panel.getByRole("link", { name: /打开原始来源/ })).toHaveAttribute("href", /^https:\/\//);
});

test("a corrected relationship can move from equipment to battery-cell evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./?entity=issuer%3Acn-sz-002245&relation=relation%3Aissuer_segment_fallback%3A037ea00a618bb820035503c6");

  const panel = page.locator(".txDetailPanel");
  await expect(panel.getByRole("status")).toContainText("已被替代");
  await expect(panel.getByRole("status")).toContainText("不能证明公司集成UPS或备用电源设备");
  await panel.getByRole("button", { name: "查看替代关系" }).click();
  await expect(panel.locator(".txSelectedRelation")).toContainText("储能电芯与电池包");
  await expect(panel.locator(".txSelectedRelation")).toContainText("研发");
  await expect(panel.locator(".txEvidenceList")).toContainText("在研");
  await expect(panel.getByRole("link", { name: /打开原始来源/ })).toHaveAttribute("href", /^https:\/\//);
});

test("desktop and mobile flag an unresolved action without hiding its official source", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  const url = "./?entity=issuer%3Acn-sz-002931&relation=relation%3Aissuer_segment_fallback%3A0207ea9e3f8da493ea0ac5aa";

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(url);
    if (width === 1440) {
      await expect(page.locator(".react-flow__edge.isPending").first()).toBeVisible();
      await expect(page.locator(".txGraphLegend")).toContainText("动作待复核");
    }
    const panel = page.locator(".txDetailPanel");
    await expect(panel.locator(".txEvidenceSection .txEvidenceBadge")).toHaveText("动作待复核");
    const notice = panel.getByRole("status");
    await notice.scrollIntoViewIfNeeded();
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("这不是错误判定");
    await expect(notice).toContainText("L1 官方披露");
    await expect(panel.getByRole("link", { name: /打开原始来源/ })).toHaveAttribute("href", /^https:\/\//);
  }
});
