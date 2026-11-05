import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { measureDesignRules } from "./support/designRules";

for (const locale of ["ko", "en"]) {
  test(`mobile sample entry and readable evidence (${locale})`, { tag: "@mobile-only" }, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const prefix = locale === "en" ? "/en" : "";
    await page.goto(prefix || "/");
    // 폰에서도 운영 플래너 예시를 첫 진입으로 제공하고 다른 분석은 이어서 찾는다.
    await expect(page.locator(".home-entry__situations")).toBeVisible();
    const mobile = page.locator(".mobile-quick-start").first();
    const sample = page.locator(".home-planner-entry .primary");
    await expect(sample).toBeVisible();
    await expect(page.locator(".dc-hero .mobile-quick-start")).toHaveCount(0);
    await expect(page.locator(".home-result-preview > h2")).toBeVisible();
    await expect(mobile.locator(`a[href="${prefix}/calculator"]`)).toBeVisible();
    await expect(mobile.locator(`a[href="${prefix}/templates"]`)).toBeVisible();
    await expect(page.locator(".operations-sample-preview__budget")).toBeVisible();
    await page.getByRole("tab", { name: locale === "en" ? "Campaigns" : "캠페인 근거", exact: true }).click();
    await expect(page.getByRole("figure", { name: locale === "en" ? "Campaign daily CPI trend and period comparison" : "캠페인 일별 CPI 추세와 직전·최근 비교" })).toBeVisible();
    await expect(page.locator(".operations-sample-campaigns > li")).toHaveCount(4);
    const currentCpi = (await page.locator(".operations-sample-preview__metric strong").textContent()).split("→").at(-1).trim();
    await page.getByRole("tab", { name: locale === "en" ? "Budget actions" : "예산 액션", exact: true }).click();
    await expect(page.locator(".operations-sample-budget__metrics")).toBeVisible();
    const forecast = await page.locator(".operations-sample-budget__metrics dd b").textContent();
    await page.getByRole("tab", { name: locale === "en" ? "New creatives" : "새 소재 확인", exact: true }).click();
    await expect(page.locator(".operations-sample-creatives")).toBeVisible();
    const creatives = await page.locator(".operations-sample-creative__name > strong").allTextContents();
    expect(creatives).toHaveLength(2);
    for (const light of [locale === "en"]) {
      await page.evaluate(value => document.body.classList.toggle("light-mode", value), light);
      await page.getByRole("tab", { name: locale === "en" ? "Campaigns" : "캠페인 근거", exact: true }).click();
      await page.waitForTimeout(300);
      await expect(page.locator(".home-result-preview h2")).toHaveCSS("font-size", "20px");
      expect((await sample.boundingBox()).height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await sample.click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/tools/operations-planner$`));
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".operations-planner__context")).toContainText(locale === "en" ? "Fictional sample" : "가상 예시");
    await expect(page.locator(".ops-plan-impact")).toBeVisible();
    await expect(page.locator(".operations-queue")).toBeVisible();
    await page.getByRole("tab", { name: locale === "en" ? "Detailed data & export" : "상세 데이터·내보내기", exact: true }).click();
    await expect(page.locator(".result-action-card__stats")).toContainText(currentCpi);
    await expect(page.locator(".ops-plan-impact")).toContainText(forecast);
    for (const creative of creatives) await expect(page.locator(".ops-creatives")).toContainText(creative);
    // 홈에서 가져온 데이터가 액션, 전체 변화, 근거를 한 플래너에서 지원한다.
    await page.getByRole("tab", { name: locale === "en" ? "Full change history" : "전체 변화 이력", exact: true }).click();
    await expect(page.getByRole("table", { name: locale === "en" ? "Full change list" : "전체 변화 목록", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: locale === "en" ? "Execution & next review" : "실행과 다음 검토", exact: true }).click();
    await expect(page.locator(".operations-queue__group > h3")).toContainText(locale === "en" ? "Adjust budget" : "예산 조정");
    await expect(page.locator(".operations-queue__pagination")).toHaveCount(0);
  });

  test(`operations home preview uses the full width for entry and evidence (${locale})`, async ({ page }, testInfo) => {
    // Cover desktop, mobile and the changed intermediate breakpoint once each,
    // distributing locales/themes instead of repeating their Cartesian product.
    const representative = locale === "ko"
      ? ["mobile-320", "desktop-1440"].includes(testInfo.project.name)
      : testInfo.project.name === "tablet-768";
    test.skip(!representative, "Covered by the representative home-preview environments");
    if (testInfo.project.use.viewport.width === 768) await page.setViewportSize({ width: 980, height: 1000 });
    await page.goto(locale === "en" ? "/en" : "/");
    await expect(page.locator(".home-result-preview")).toBeVisible();
    await expect(page.locator(".home-result-preview > h2")).toHaveText(locale === "en" ? "Planner preview" : "운영 플래너 미리보기");
    await page.evaluate(() => document.fonts.ready);
    for (const light of [testInfo.project.name !== "mobile-320"]) {
      await page.evaluate(value => document.body.classList.toggle("light-mode", value), light);
      await page.getByRole("tab", { name: locale === "en" ? "Campaigns" : "캠페인 근거", exact: true }).click();
      await page.waitForTimeout(300);
      const copy = await page.locator(".dc-hero__intro").boundingBox();
      const preview = await page.locator(".home-result-preview").boundingBox();
      // Wide screens pair the introduction and working preview; narrow screens stack them.
      if (page.viewportSize().width > 1100) {
        expect(preview.x).toBeGreaterThan(copy.x + copy.width);
        expect(Math.abs(preview.y - copy.y)).toBeLessThanOrEqual(1);
      } else {
        expect(Math.abs(copy.width - preview.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(copy.x - preview.x)).toBeLessThanOrEqual(1);
        expect(preview.y).toBeGreaterThanOrEqual(copy.y + copy.height);
      }
      // 상황 칸은 누르기 쉬운 높이이되 설명 카드가 되지 않는다.
      for (const action of await page.locator(".home-entry__situations li a").all()) {
        const box = await action.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeLessThanOrEqual(72);
      }
      await expect(page.locator(".operations-sample-preview__body > section")).toHaveCount(4);
      await expect(page.getByRole("tabpanel")).toHaveCount(1);
      await expect(page.locator(".operations-sample-budget__moves > div")).toHaveCount(4);
      await expect(page.locator(".operations-sample-creatives > li")).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.locator(".operations-sample-campaigns > li")).toHaveCount(4);
      await expect(page.locator(".operations-sample-chart__legend")).toContainText("09.30–10.06");
      const canvas = page.locator(".home-operations-trend canvas");
      await expect(canvas).toHaveAttribute("data-chart-ready", "true");
      await expect(canvas).toHaveAttribute("data-point-count", "28");
      for (const row of await page.locator(".operations-sample-campaigns > li").all()) {
        await expect(row.locator(".operations-sample-campaigns__comparison")).toContainText("→");
        const name = await row.locator(".operations-sample-campaigns__name").textContent();
        if (page.viewportSize().width <= 480) await page.getByRole("combobox", { name: locale === "en" ? "Campaign to compare" : "비교할 캠페인" }).selectOption({ label: name });
        else await row.getByRole("button").click();
        await expect(canvas).toHaveAttribute("aria-label", `${name}${locale === "en" ? " observed daily CPI trend" : " 일별 실측 CPI 추세"}`);
        await expect(page.locator(".home-trend-heading > strong")).toHaveText(name);
      }
      if (page.viewportSize().width <= 480) await page.getByRole("combobox", { name: locale === "en" ? "Campaign to compare" : "비교할 캠페인" }).selectOption({ index: 0 });
      else await page.locator(".operations-sample-campaigns button").first().click();
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
      await expect(page.locator(".operations-sample-preview__campaigns")).toBeVisible();
      await page.keyboard.press("End");
      await expect(tabs.nth(3)).toBeFocused();
      await expect(page.locator(".home-action-preview")).toBeVisible();
      await page.keyboard.press("Home");
      await expect(tabs.first()).toBeFocused();
      const stablePreview = await page.locator(".operations-sample-preview").boundingBox();
      const entryDocumentTop = () => page.locator(".home-entry").evaluate(node => node.getBoundingClientRect().top + scrollY);
      const stableEntryTop = await entryDocumentTop();
      for (let index = 0; index < 4; index++) {
        await tabs.nth(index).click();
        await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
        await expect(page.getByRole("tabpanel")).toHaveCount(1);
        // Measure the settled layout, not the reveal's translated intermediate frame.
        await page.getByRole("tabpanel").evaluate(node => Promise.all(
          node.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))
        ));
        // Switching the preview must not push the upload/situation entry down.
        expect((await page.locator(".operations-sample-preview").boundingBox()).height).toBe(stablePreview.height);
        expect(Math.abs(await entryDocumentTop() - stableEntryTop)).toBeLessThanOrEqual(1);
        // Stable size must contain useful evidence, not a large empty tail or a clipped list.
        const panelFit = await page.getByRole("tabpanel").evaluate(node => {
          const box = node.getBoundingClientRect(), last = node.lastElementChild.getBoundingClientRect();
          return { overflow: node.scrollHeight - node.clientHeight, tail: box.bottom - last.bottom };
        });
        expect(panelFit.overflow).toBeLessThanOrEqual(1);
        expect(panelFit.tail).toBeLessThanOrEqual(16);
        await expect(page.locator(".operations-sample-preview__footer")).toBeVisible();
        const audit = await new AxeBuilder({ page }).include(".dc-hero").withTags(["wcag2a", "wcag2aa"]).analyze();
        expect(audit.violations).toEqual([]);
        const design = await measureDesignRules(page);
        expect(design.overlaps).toEqual([]);
        expect(design.hugging).toEqual([]);
        expect(design.smallHeadings).toEqual([]);
        expect(design.nested).toEqual([]);
        expect(design.horizontalOverflow).toBeLessThanOrEqual(1);
        if (index === 2 && page.viewportSize().width <= 720) {
          const region = page.locator(".operations-sample-creatives");
          const box = await region.boundingBox();
          const cost = await page.locator(".operations-sample-creative__result strong").first().boundingBox();
          expect(cost.x).toBeGreaterThanOrEqual(box.x);
          expect(cost.x + cost.width).toBeLessThanOrEqual(box.x + box.width + 1);
          const scroll = await region.evaluate(node => ({ full: node.scrollWidth, visible: node.clientWidth }));
          expect(scroll.full).toBeLessThanOrEqual(scroll.visible + 1);
        }
      }
    }
  });
}
