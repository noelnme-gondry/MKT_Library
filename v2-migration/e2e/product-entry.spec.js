import { test, expect } from "@playwright/test";

for (const locale of ["ko", "en"]) {
  test(`mobile sample entry and readable evidence (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const prefix = locale === "en" ? "/en" : "";
    await page.goto(prefix || "/");
    await expect(page.locator('.dc-action-route--primary')).toBeVisible();
    const mobile = page.locator(".mobile-quick-start").first();
    const sample = page.locator(".dc-hero__actions .dc-action-route--sample");
    await expect(sample).toBeVisible();
    await expect(page.locator(".dc-hero .mobile-quick-start")).toHaveCount(0);
    await expect(page.locator(".home-result-preview > h2")).toBeVisible();
    await expect(mobile.locator(`a[href="${prefix}/calculator"]`)).toBeVisible();
    await expect(mobile.locator(`a[href="${prefix}/templates"]`)).toBeVisible();
    await expect(page.getByRole("img", { name: locale === "en" ? "98 days of observed portfolio and selected campaign CPI" : "98일의 전체·선택 캠페인 실측 CPI 추세" })).toBeVisible();
    await expect(page.locator(".operations-sample-campaigns > div")).toHaveCount(4);
    const currentCpi = (await page.locator(".operations-sample-preview__metric strong").textContent()).split("→").at(-1).trim();
    for (const light of [true, false]) {
      await page.evaluate(value => document.body.classList.toggle("light-mode", value), light);
      await expect(page.locator(".home-result-preview h2")).toHaveCSS("font-size", "20px");
      await expect(sample.locator("strong")).toHaveCSS("font-size", "14px");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await sample.click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/tools/operations-planner$`));
    const conditions = page.locator(".operations-planner__conditions");
    await expect(conditions).not.toHaveAttribute("open", "");
    await expect(conditions.locator("summary")).toBeVisible();
    await expect(conditions.locator("summary")).toContainText(locale === "en" ? "Fictional sample" : "가상 예시");
    await expect(page.locator(".result-action-card__stats")).toContainText(currentCpi);
    // 제품 계약의 예산·캠페인·소재·주간 리뷰 행동이 실제 근거 영역으로 연결된다.
    const actions = page.getByRole("navigation", { name: locale === "en" ? "Results and next actions" : "결과와 다음 행동" });
    await expect(actions.getByRole("link")).toHaveCount(4);
    for (const [index, target] of ["#ops-budget-title", "#ops-campaign", "#ops-new-title", "#ops-review-title"].entries()) {
      await expect(actions.getByRole("link").nth(index)).toHaveAttribute("href", target);
      await expect(page.locator(target)).toBeVisible();
    }
  });
}
