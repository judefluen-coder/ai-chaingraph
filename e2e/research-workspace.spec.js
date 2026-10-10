import { expect, test } from "@playwright/test";

const MAX_BROWSER_READY_AFTER_SNAPSHOT_MS = 2_500;

test("desktop and mobile directories become usable promptly after the snapshot arrives", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
    const observer = new MutationObserver(() => {
      if (document.querySelector(".txScopeInspector")) {
        window.graphReadyAt = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await expect(page.locator(".txScopeInspector")).toBeVisible();
    const readyAfterSnapshotMs = await page.evaluate(() => {
      const snapshot = performance.getEntriesByType("resource").find((entry) => entry.name.endsWith("/snapshots/transmission-v1.1.json"));
      return window.graphReadyAt - snapshot?.responseEnd;
    });
    console.log(`${viewport.width}px graph ready ${readyAfterSnapshotMs.toFixed(1)} ms after snapshot response`);
    expect(readyAfterSnapshotMs, `${viewport.width}px graph readiness`).toBeGreaterThanOrEqual(0);
    expect(readyAfterSnapshotMs, `${viewport.width}px graph readiness`).toBeLessThan(MAX_BROWSER_READY_AFTER_SNAPSHOT_MS);
  }
});

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

test("graph relationship edges describe evidence and open it from the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./?chain=chain%3Aai_chips_ip");

  const edge = page.locator(".react-flow__edge[role='button']").first();
  await expect(edge).toHaveAttribute("aria-label", / · .* · 逐边证据$/);
  await expect(edge).not.toHaveAttribute("aria-label", /relation:|component:|product:/);
  await edge.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "逐边证据" })).toBeVisible();

  await page.goto("./?chain=chain%3Aai_chips_ip");
  const spaceEdge = page.locator(".react-flow__edge[role='button']").first();
  await spaceEdge.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "逐边证据" })).toBeVisible();

  await page.getByRole("button", { name: "产业全景" }).click();
  await expect(page.locator(".react-flow__edge[role='button']")).toHaveCount(0);
  await expect(page.locator(".react-flow__edge[role='img']").first()).toHaveAttribute("aria-label", / · \d+ 条依赖 · /);
});

test("closed search results cannot be activated by Enter", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./");

  const search = page.getByRole("combobox", { name: "搜索图谱" });
  await search.fill("鸿富诚");
  await expect(page.getByRole("option", { name: /鸿富诚/ })).toBeVisible();
  await search.press("Escape");
  await expect(page.getByRole("option", { name: /鸿富诚/ })).toBeHidden();
  await search.press("Enter");
  await expect(page.locator(".txDetailPanel").getByRole("heading", { name: "鸿富诚" })).toHaveCount(0);

  await search.press("ArrowDown");
  await expect(page.getByRole("option", { name: /鸿富诚/ })).toBeVisible();
  await search.press("Enter");
  await expect(page.locator(".txDetailPanel").getByRole("heading", { name: "鸿富诚" })).toBeVisible();
});

test("resizing the workspace preserves a manually chosen graph zoom", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./");

  const viewport = page.locator(".react-flow__viewport");
  await expect(viewport).toBeVisible();
  await page.locator(".react-flow__controls-zoomin").click();
  await page.locator(".react-flow__controls-zoomin").click();
  await page.waitForTimeout(350);
  const zoomBefore = await viewport.evaluate((element) => Number(element.style.transform.match(/scale\(([^)]+)\)/)?.[1]));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(350);
  const zoomAfter = await viewport.evaluate((element) => Number(element.style.transform.match(/scale\(([^)]+)\)/)?.[1]));
  expect(zoomAfter).toBeCloseTo(zoomBefore, 2);
});

test("mobile directory, search, and detail remain reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("ai-chaingraph-locale", "zh"));
  await page.goto("./");

  await page.getByRole("button", { name: "进入图谱" }).click();
  const directory = page.locator(".txScopeInspector");
  await expect(directory).toBeVisible();
  const freshness = directory.locator(".txScopeFreshness");
  await expect(freshness.locator("small").first()).toHaveText("最近核验");
  await expect(freshness.locator("strong").first()).toHaveText(/\d{4}-\d{2}-\d{2}/);
  await expect(freshness.locator("small").last()).toHaveText("已收录来源截止");
  await expect(freshness.locator("strong").last()).toHaveText(/\d{4}-\d{2}-\d{2}/);
  await freshness.click();
  await expect(page.getByRole("dialog", { name: "数据版本与更新" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "数据版本与更新" })).toHaveCount(0);
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

test("mobile workspace navigation keeps keyboard focus on visible controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./");

  const menu = page.getByRole("button", { name: "打开研究工作区" });
  const sidebar = page.locator(".txSidebar");
  await expect(sidebar).toHaveAttribute("inert", "");
  await menu.click();
  await expect(sidebar).not.toHaveAttribute("inert");
  await expect(page.getByRole("dialog", { name: "研究工作区" })).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭研究工作区" })).toBeFocused();

  await sidebar.locator(".txSidebarBrand").focus();
  await page.keyboard.press("Shift+Tab");
  await expect(sidebar.locator(".txSidebarDataState")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sidebar.locator(".txSidebarBrand")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(sidebar).toHaveAttribute("inert", "");
  await expect(menu).toBeFocused();

  await menu.click();
  await sidebar.locator(".txSidebarDataState").click();
  await expect(page.getByRole("dialog", { name: "数据版本与更新" })).toBeVisible();
  await expect(sidebar).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "数据版本与更新" })).toHaveCount(0);
  await expect(sidebar).toHaveAttribute("inert", "");
  await expect(menu).toBeVisible();
});

test("mobile graph shows an overview map and can fit off-screen nodes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./?chain=chain%3Aadvanced_packaging_memory");
  await page.getByRole("button", { name: "查看图谱" }).click();

  const miniMap = page.locator(".react-flow__minimap");
  await expect(miniMap.getByRole("img", { name: "图谱全览导航，可拖动查看屏外节点" })).toBeVisible();
  const dimensions = await miniMap.evaluate((element) => ({
    panelWidth: element.getBoundingClientRect().width,
    svgWidth: element.querySelector("svg").getBoundingClientRect().width,
  }));
  expect(dimensions.panelWidth).toBe(dimensions.svgWidth);

  const viewport = page.locator(".react-flow__viewport");
  const initialScale = await viewport.evaluate((element) => Number(element.style.transform.match(/scale\(([^)]+)\)/)?.[1]));
  await page.getByRole("button", { name: "fit view" }).click();
  await expect.poll(() => viewport.evaluate((element) => Number(element.style.transform.match(/scale\(([^)]+)\)/)?.[1]))).toBeLessThan(initialScale);
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

test("robot-skin foam research stays broad and exposes the corrected claim", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./?entity=issuer%3Acn-sz-300980&relation=relation%3Aissuer_segment_fallback%3A070a7470a5abf071a5270943");

  const panel = page.locator(".txDetailPanel");
  await expect(panel.getByRole("status")).toContainText("已被替代");
  await expect(panel.getByRole("status")).toContainText("研发项目的拟应用方向");
  await panel.getByRole("button", { name: "查看替代关系" }).click();
  await expect(panel.locator(".txEvidenceSection .txEvidenceBadge")).toContainText("宽口径映射");
  await expect(panel.locator(".txReviewReason")).toContainText("未证明灵巧手或电子皮肤部件已量产、交付");
  await expect(panel.locator(".txEvidenceList")).toContainText("已完成A轮阶段");
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
  const freshness = panel.locator(".txDetailFreshness");
  await expect(freshness).toContainText(/最近核验\s+\d{4}-\d{2}-\d{2}/);
  await expect(freshness).toContainText(/已收录来源截止\s+\d{4}-\d{2}-\d{2}/);
  expect((await freshness.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await freshness.click();
  await expect(page.getByRole("dialog", { name: "数据版本与更新" })).toBeVisible();
  await page.keyboard.press("Escape");
  const sourceLink = panel.getByRole("link", { name: /打开原始来源/ });
  await sourceLink.scrollIntoViewIfNeeded();
  await expect(sourceLink).toHaveAttribute("href", /^https:\/\//);
  expect((await sourceLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
});

test("stale mobile evidence deep links keep the review warning visible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.route("**/snapshots/transmission-v1.1.json", async (route) => {
    const response = await route.fetch();
    const graph = await response.json();
    graph.meta.refresh.last_checked_at = "2020-01-01T00:00:00.000Z";
    await route.fulfill({ response, json: graph });
  });
  await page.goto("./?entity=issuer%3Acn-sh-603330&relation=relation%3Aissuer_segment_reviewed%3Atianyang-adhesives-20261010");

  const warning = page.locator(".txDetailPanel .txDetailFreshness");
  await expect(warning).toContainText("核验已过期");
  await expect(warning).toHaveClass(/isStale/);
  await warning.click();
  await expect(page.getByRole("dialog", { name: "数据版本与更新" }).getByRole("status")).toContainText("重新核对原始来源");
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

test("a semiconductor component action correction retains its original evidence trail", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./?entity=issuer%3Acn-sz-002931&relation=relation%3Aissuer_segment_fallback%3A0207ea9e3f8da493ea0ac5aa");

  const panel = page.locator(".txDetailPanel");
  await expect(panel.getByRole("status")).toContainText("已被替代");
  await expect(panel.getByRole("status")).toContainText("动作更正为生产");
  await panel.getByRole("button", { name: "查看替代关系" }).click();
  await expect(panel.locator(".txSelectedRelation")).toContainText("生产");
  await expect(panel.locator(".txEvidenceList")).toContainText("半导体阀零部件");
  await expect(panel.getByRole("link", { name: /打开原始来源/ })).toHaveAttribute("href", "https://static.cninfo.com.cn/finalpage/2026-04-28/1225214620.PDF");
});

test("an AGV load-wheel correction preserves the production evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./?entity=issuer%3Acn-sh-603037&relation=relation%3Aissuer_segment_fallback%3A03c3a644f510370394da4687");

  const panel = page.locator(".txDetailPanel");
  await expect(panel.getByRole("status")).toContainText("已被替代");
  await expect(panel.getByRole("status")).toContainText("动作更正为生产");
  await panel.getByRole("button", { name: "查看替代关系" }).click();
  await expect(panel.locator(".txSelectedRelation")).toContainText("生产");
  await expect(panel.locator(".txEvidenceList")).toContainText("聚氨酯承载轮");
  await expect(panel.getByRole("link", { name: /打开原始来源/ })).toHaveAttribute("href", "https://static.cninfo.com.cn/finalpage/2026-03-31/1225053856.PDF");
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

test("a photomask equipment overstatement resolves to quartz-material evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  await page.goto("./?entity=issuer%3Acn-sz-300395&relation=relation%3Aissuer_segment_fallback%3Aa75c77e01783a42aedcf58ae");

  const panel = page.locator(".txDetailPanel");
  await expect(panel.getByRole("status")).toContainText("已被替代");
  await expect(panel.getByRole("status")).toContainText("误映射为掩模与量检测设备");
  await panel.getByRole("button", { name: "查看替代关系" }).click();
  await expect(panel.locator(".txSelectedRelation")).toContainText("半导体材料");
  await expect(panel.locator(".txSelectedRelation")).toContainText("生产");
  await expect(panel.locator(".txEvidenceList")).toContainText("石英玻璃材料");
  await expect(panel.getByRole("link", { name: /打开原始来源/ })).toHaveAttribute("href", "https://static.cninfo.com.cn/finalpage/2026-04-24/1225161586.PDF");
});

test("desktop and mobile flag an unresolved action without hiding its official source", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  const url = "./?entity=issuer%3Acn-sz-300543&relation=relation%3Aissuer_segment_fallback%3A024cf790930eed4b3d812388";

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

test("graph remains usable while optional update history is delayed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
  });
  let releaseHistory;
  const historyGate = new Promise((resolve) => { releaseHistory = resolve; });
  await page.route("**/snapshots/release-history.json", async (route) => {
    await historyGate;
    await route.continue();
  });
  await page.goto("./");

  await expect(page.locator(".txScopeInspector")).toBeVisible();
  await page.getByRole("combobox", { name: "搜索图谱" }).fill("鸿富诚");
  await expect(page.getByRole("option", { name: /鸿富诚/ })).toBeVisible();
  await page.locator(".txSidebarDataState").click();
  const dialog = page.getByRole("dialog", { name: "数据版本与更新" });
  await dialog.getByText("查看更新记录").click();
  await expect(dialog.getByRole("status", { name: "" })).toContainText("正在读取更新记录");

  releaseHistory();
  await expect(dialog.getByText("正在读取更新记录")).toHaveCount(0);
  await expect(dialog.locator(".txHistoryDetails .txHistoryDetails").first()).toBeVisible();
});

test("retrying update history does not reload the graph snapshot", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("ai-chaingraph-disclaimer", "ack");
    localStorage.setItem("ai-chaingraph-locale", "zh");
    window.snapshotCacheModes = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = (url, options) => {
      if (String(url).includes("/snapshots/")) window.snapshotCacheModes.push(options?.cache);
      return originalFetch(url, options);
    };
  });
  let graphRequests = 0;
  let historyRequests = 0;
  await page.route("**/snapshots/transmission-v1.1.json", async (route) => {
    graphRequests += 1;
    await route.continue();
  });
  await page.route("**/snapshots/release-history.json", async (route) => {
    historyRequests += 1;
    if (historyRequests === 1) await route.abort();
    else await route.continue();
  });
  await page.goto("./");

  await expect(page.locator(".txScopeInspector")).toBeVisible();
  await page.locator(".txSidebarDataState").click();
  const dialog = page.getByRole("dialog", { name: "数据版本与更新" });
  await dialog.getByText("查看更新记录").click();
  await expect(dialog.getByText("更新记录加载失败。")).toBeVisible();
  await dialog.getByRole("button", { name: "重试" }).click();
  await expect(dialog.getByText("更新记录加载失败。")).toHaveCount(0);
  await expect(dialog.locator(".txHistoryDetails .txHistoryDetails").first()).toBeVisible();
  expect(graphRequests).toBe(1);
  expect(historyRequests).toBe(2);
  expect(await page.evaluate(() => window.snapshotCacheModes)).toEqual(["no-cache", "no-cache", "no-cache"]);
});
