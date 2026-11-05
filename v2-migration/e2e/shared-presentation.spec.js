import { expect, test } from "@playwright/test";
import { measureDesignRules } from "./support/designRules";
import { chooseDashboardView } from "./support/dashboardView.js";

for (const locale of ["ko", "en"]) {
  test(`shared title, named progress and uncrowded PNG controls (${locale})`, async ({ page }, testInfo) => {
    await page.goto(`${locale === "en" ? "/en" : ""}/tools/operations-planner?example=1`);
    await expect(page.locator(".ops-plan-impact")).toBeVisible();
    // The result header is a compact, unfilled title; execution lives in this planner.
    await expect(page.locator(".journey-progress")).toHaveCount(0);
    const title = page.locator(".tool-instrument-header");
    await expect(title).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await page.getByRole("button", { name: locale === "en" ? /Inspect observations over time/ : /날짜 흐름으로 관측 확인/ }).click();
    await expect(page.locator(".operations-trend canvas")).toBeVisible();
    const result = await measureDesignRules(page);
    expect(result.figureExports).toBeGreaterThanOrEqual(1);
    expect(result.figureCrowding).toEqual([]);
    expect(result.titleInsets).toEqual([]);
    const periods = page.locator(".operations-trend .operations-chart__caption").first();
    await expect(periods).toContainText("2026-09-23 – 2026-09-29");
    await expect(periods).toContainText("2026-09-30 – 2026-10-06");
    if (testInfo.project.name === "desktop-1440" && locale === "ko") {
      await page.screenshot({ path: testInfo.outputPath("shared-title-progress.png") });
      await page.getByRole("dialog").getByRole("button", { name: locale === "en" ? "Close" : "닫기", exact: true }).click();
      await page.locator(".ops-evidence").screenshot({ path: testInfo.outputPath("campaign-separated-points.png") });
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
