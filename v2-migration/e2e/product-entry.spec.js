import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { measureDesignRules } from "./support/designRules";

for (const locale of ["ko", "en"]) {
  test(`mobile sample entry and readable evidence (${locale})`, { tag: "@mobile-only" }, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const prefix = locale === "en" ? "/en" : "";
    await page.goto(prefix || "/");
    // 폰에서도 첫 화면의 주 행동(상황 고르기)과 예시 진입이 남는다(product-ssot §5.1.1).
    await expect(page.locator(".home-entry__situations")).toBeVisible();
    const mobile = page.locator(".mobile-quick-start").first();
    const sample = page.locator(".home-entry__more a");
    await expect(sample).toBeVisible();
    await expect(page.locator(".dc-hero .mobile-quick-start")).toHaveCount(0);
    await expect(page.locator(".home-result-preview > h2")).toBeVisible();
    await expect(mobile.locator(`a[href="${prefix}/calculator"]`)).toBeVisible();
    await expect(mobile.locator(`a[href="${prefix}/templates"]`)).toBeVisible();
    await expect(page.getByRole("figure", { name: locale === "en" ? "Campaign daily CPI trend and period comparison" : "캠페인 일별 CPI 추세와 직전·최근 비교" })).toBeVisible();
    await expect(page.locator(".operations-sample-campaigns > div")).toHaveCount(4);
    const currentCpi = (await page.locator(".operations-sample-preview__metric strong").textContent()).split("→").at(-1).trim();
    await page.getByRole("tab", { name: locale === "en" ? "Budget" : "예산", exact: true }).click();
    await expect(page.locator(".operations-sample-budget__metrics")).toBeVisible();
    const forecast = (await page.locator(".operations-sample-budget__metrics dd").nth(1).textContent()).split(" ").slice(0, 3).join(" ");
    await page.getByRole("tab", { name: locale === "en" ? "Creatives" : "소재", exact: true }).click();
    await expect(page.locator(".operations-sample-preview__creatives table")).toBeVisible();
    const creatives = await page.locator(".operations-sample-creative__name > strong").allTextContents();
    expect(creatives).toHaveLength(2);
    for (const light of [true, false]) {
      await page.evaluate(value => document.body.classList.toggle("light-mode", value), light);
      await page.getByRole("tab", { name: locale === "en" ? "Campaigns" : "캠페인", exact: true }).click();
      await page.waitForTimeout(300);
      await expect(page.locator(".home-result-preview h2")).toHaveCSS("font-size", "20px");
      expect((await sample.boundingBox()).height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await sample.click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/tools/operations-planner$`));
    const conditions = page.locator(".operations-planner__conditions");
    await expect(conditions).not.toHaveAttribute("open", "");
    await expect(conditions.locator("summary")).toBeVisible();
    await expect(conditions.locator("summary")).toContainText(locale === "en" ? "Fictional sample" : "가상 예시");
    await expect(page.locator(".result-action-card__stats")).toContainText(currentCpi);
    await expect(page.locator(".operations-brief__forecast")).toContainText(forecast);
    for (const creative of creatives) await expect(page.locator(".operations-panel--creative")).toContainText(creative);
    // 제품 계약의 예산·캠페인·소재·주간 리뷰 행동이 실제 근거 영역으로 연결된다.
    const actions = page.getByRole("navigation", { name: locale === "en" ? "Results and next actions" : "결과와 다음 행동" });
    await expect(actions.getByRole("link")).toHaveCount(4);
    for (const [index, target] of ["#ops-budget-title", "#ops-campaign", "#ops-new-title", "#ops-review-title"].entries()) {
      await expect(actions.getByRole("link").nth(index)).toHaveAttribute("href", target);
      await expect(page.locator(target)).toBeVisible();
    }
  });

  test(`operations home preview uses the full width for entry and evidence (${locale})`, async ({ page }, testInfo) => {
    if (testInfo.project.use.viewport.width === 768) await page.setViewportSize({ width: 980, height: 1000 });
    await page.goto(locale === "en" ? "/en" : "/");
    await expect(page.locator(".home-result-preview")).toBeVisible();
    await expect(page.locator(".home-result-preview > h2")).toHaveText(locale === "en" ? "Operations planner preview" : "운영 플래너 미리보기");
    await page.evaluate(() => document.fonts.ready);
    for (const light of [true, false]) {
      await page.evaluate(value => document.body.classList.toggle("light-mode", value), light);
      await page.getByRole("tab", { name: locale === "en" ? "Campaigns" : "캠페인", exact: true }).click();
      await page.waitForTimeout(300);
      const copy = await page.locator(".dc-hero__copy").boundingBox();
      const preview = await page.locator(".home-result-preview").boundingBox();
      // 설명 옆에 긴 결과 열을 두지 않는다. 진입과 결과가 같은 폭을 쓰는 두 행이다.
      expect(Math.abs(copy.width - preview.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(copy.x - preview.x)).toBeLessThanOrEqual(1);
      expect(preview.y).toBeGreaterThanOrEqual(copy.y + copy.height);
      // 상황 칸은 누르기 쉬운 높이이되 설명 카드가 되지 않는다.
      for (const action of await page.locator(".home-entry__situations li a").all()) {
        const box = await action.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeLessThanOrEqual(72);
      }
      await expect(page.locator(".operations-sample-preview__body > section")).toHaveCount(3);
      await expect(page.getByRole("tabpanel")).toHaveCount(1);
      await expect(page.locator(".operations-sample-budget__moves > div")).toHaveCount(4);
      await expect(page.locator(".operations-sample-preview__creatives tbody tr")).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.locator(".operations-sample-campaigns > div")).toHaveCount(4);
      await expect(page.locator(".operations-sample-chart__legend")).toContainText("09.30–10.06");
      const canvas = page.locator(".home-operations-trend canvas");
      await expect(canvas).toHaveAttribute("data-chart-ready", "true");
      await expect(canvas).toHaveAttribute("data-point-count", "28");
      for (const row of await page.locator(".operations-sample-campaigns > div").all()) {
        await expect(row.locator("dt")).toBeVisible();
        await expect(row.locator(".operations-sample-campaigns__comparison")).toContainText("→");
        const name = await row.locator("dt").textContent();
        await row.getByRole("button").click();
        await expect(canvas).toHaveAttribute("aria-label", `${name}${locale === "en" ? " observed daily CPI trend" : " 일별 실측 CPI 추세"}`);
        await expect(page.locator(".home-trend-heading > strong")).toHaveText(name);
      }
      await page.locator(".operations-sample-campaigns button").first().click();
      await expect(page.getByRole("slider")).toHaveCount(0);
      await expect(page.locator(".home-operations-trend input, .home-operations-trend select, .home-operations-trend output")).toHaveCount(0);
      await page.getByRole("button", { name: locale === "en" ? "Full history" : "전체 이력", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-point-count", "98");
      await expect(canvas).toHaveAttribute("data-range-start", "2026-07-01");
      await page.getByRole("button", { name: locale === "en" ? "Recent 28 days" : "최근 28일", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-point-count", "28");
      expect(await canvas.evaluate(node => {
        const pixels = node.getContext("2d").getImageData(0, 0, node.width, node.height).data;
        let painted = 0; for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) painted++;
        return painted;
      }), "the real canvas must contain its drawn chart").toBeGreaterThan(1000);
      const tabs = page.locator(".operations-sample-tabs [role=tab]");
      await tabs.first().focus();
      await page.keyboard.press("ArrowRight");
      await expect(tabs.nth(1)).toBeFocused();
      await expect(page.locator(".operations-sample-preview__budget")).toBeVisible();
      await page.keyboard.press("End");
      await expect(tabs.nth(2)).toBeFocused();
      await expect(page.locator(".operations-sample-preview__creatives")).toBeVisible();
      await page.keyboard.press("Home");
      await expect(tabs.first()).toBeFocused();
      for (let index = 0; index < 3; index++) {
        await tabs.nth(index).click();
        await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
        await expect(page.getByRole("tabpanel")).toHaveCount(1);
        const audit = await new AxeBuilder({ page }).include(".dc-hero").withTags(["wcag2a", "wcag2aa"]).analyze();
        expect(audit.violations).toEqual([]);
        const design = await measureDesignRules(page);
        expect(design.overlaps).toEqual([]);
        expect(design.hugging).toEqual([]);
        expect(design.smallHeadings).toEqual([]);
        expect(design.nested).toEqual([]);
        expect(design.horizontalOverflow).toBeLessThanOrEqual(1);
        if (index === 2 && page.viewportSize().width <= 720) {
          const region = page.locator(".operations-sample-preview__creatives .table-wrap");
          const box = await region.boundingBox();
          const cost = await page.locator(".operations-sample-creative__result strong").first().boundingBox();
          expect(cost.x).toBeGreaterThanOrEqual(box.x);
          expect(cost.x + cost.width).toBeLessThanOrEqual(box.x + box.width + 1);
          const scroll = await region.evaluate(node => ({ full: node.scrollWidth, visible: node.clientWidth }));
          expect(scroll.full).toBeGreaterThan(scroll.visible);
          await region.focus();
          await page.keyboard.press("ArrowRight");
          await expect.poll(() => region.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
          await region.evaluate(node => { node.scrollLeft = 0; });
        }
        if ((locale === "ko" && testInfo.project.name === "desktop-1440" && light)
          || (locale === "ko" && testInfo.project.name === "mobile-320" && !light)
          || (locale === "en" && testInfo.project.name === "tablet-768" && light)) {
          await page.evaluate(() => scrollTo(0, 0));
          await page.evaluate(() => document.activeElement.blur());
          const clip = await page.locator(".dc-hero").boundingBox();
          await page.screenshot({ path: testInfo.outputPath(`operations-home-story-${index}.png`), fullPage: true, clip });
        }
      }
    }
  });
}
