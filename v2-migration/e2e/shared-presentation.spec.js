import { expect, test } from "@playwright/test";
import { measureDesignRules } from "./support/designRules";
import { chooseDashboardView } from "./support/dashboardView.js";

for (const locale of ["ko", "en"]) {
  test(`shared title, named progress and uncrowded PNG controls (${locale})`, async ({ page }, testInfo) => {
    await page.goto(`${locale === "en" ? "/en" : ""}/tools/operations-planner?example=1`);
    await expect(page.locator(".operations-workbench canvas")).toHaveCount(6);
    const inset = await page.locator(".page-sticky-bar:has(h1)").evaluate(node => {
      const title = node.querySelector("h1").getBoundingClientRect(), box = node.getBoundingClientRect();
      return { left: title.left - box.left, right: box.right - title.right };
    });
    expect(inset.left, "a filled title surface must have an inner gutter").toBeGreaterThanOrEqual(16);
    const progress = page.locator(".journey-progress");
    expect(await progress.evaluate(node => getComputedStyle(node).borderTopStyle)).toBe("solid");
    for (const step of await progress.locator("li").all()) {
      const size = await step.locator(".journey-progress__label, a").boundingBox();
      expect(size.width, "all four step names remain legible on a phone").toBeGreaterThan(40);
      expect(size.height).toBeGreaterThan(14);
    }
    const result = await measureDesignRules(page);
    expect(result.figureExports).toBe(6);
    expect(result.figureCrowding).toEqual([]);
    expect(result.titleInsets).toEqual([]);
    const periods = page.locator(".operations-trend .operations-chart__caption").first();
    await expect(periods).toContainText("2026-09-23 – 2026-09-29");
    await expect(periods).toContainText("2026-09-30 – 2026-10-06");
    if (testInfo.project.name === "desktop-1440" && locale === "ko") {
      await page.screenshot({ path: testInfo.outputPath("shared-title-progress.png") });
      // 긴 작업 면을 캡처할 때 스티키 헤더가 제목을 가리지 않도록 충분한 높이를 확보한다.
      await page.setViewportSize({ width: 1440, height: 1600 });
      await page.locator(".operations-workbench__group--budget").screenshot({ path: testInfo.outputPath("budget-trend-export.png") });
      await page.locator(".operations-panel--campaign").screenshot({ path: testInfo.outputPath("campaign-separated-points.png") });
    }
  });

  test(`shared progress remains named on Start and Weekly review (${locale})`, async ({ page }) => {
    for (const path of ["/start", "/weekly-review"]) {
      await page.goto(`${locale === "en" ? "/en" : ""}${path}`);
      if (path === "/weekly-review") await page.getByRole("button", { name: locale === "en" ? "Compare weekly performance" : "주간 성과 비교", exact: true }).click();
      const progress = page.locator(".journey-progress");
      if (path === "/start") {
        // 분석 찾기는 파일을 넣기 전엔 진행 단계 대신 상황·검색 목록을 먼저 보여 준다(product-ssot §5.1.1).
        await expect(page.locator("#finder")).toBeVisible();
        await expect(progress).toHaveCount(0);
        expect((await measureDesignRules(page)).horizontalOverflow).toBeLessThanOrEqual(1);
        continue;
      }
      await expect(progress.locator("li")).toHaveCount(4);
      for (const step of await progress.locator("li").all()) {
        const name = await step.locator(".journey-progress__label, a").boundingBox();
        expect(name.height).toBeGreaterThan(14);
      }
      expect((await measureDesignRules(page)).horizontalOverflow).toBeLessThanOrEqual(1);
    }
  });

  test(`PNG layout holds across all dashboard tabs (${locale})`, async ({ page }) => {
    await page.goto(`${locale === "en" ? "/en" : ""}/dashboard?example=1`);
    await expect(page.locator(".result-action-card")).toBeVisible();
    const tabs = await page.locator('[role="tab"][id^="dashboard-tab-"]').all();
    expect(tabs.length).toBeGreaterThan(6);
    let exports = 0;
    for (const tab of tabs) {
      const id = await tab.getAttribute("id");
      await chooseDashboardView(page, id);
      const presentation = await measureDesignRules(page);
      exports += presentation.figureExports;
      expect(presentation.figureCrowding, `${id}: PNG must not displace chart titles`).toEqual([]);
      expect(presentation.titleInsets).toEqual([]);
      expect(presentation.horizontalOverflow).toBeLessThanOrEqual(1);
    }
    expect(exports, "the test must reach exported figures, not only tab buttons").toBeGreaterThan(8);
  });
}
