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
    await expect(page.locator(".home-sample-table tbody tr")).toHaveCount(2);
    await expect(page.locator(".home-sample-change dd")).toHaveCount(1);
    await expect(page.locator(".home-sample-table time")).toHaveCount(4);
    for (const light of [true, false]) {
      await page.evaluate(value => document.body.classList.toggle("light-mode", value), light);
      await expect(page.locator(".home-result-preview h2")).toHaveCSS("font-size", "20px");
      await expect(sample.locator("strong")).toHaveCSS("font-size", "14px");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    // 홈 카드가 지목한 채널이 결과 화면의 "어디서" 줄에 그대로 다시 나와야 한다(같은 계산 — pvmChannelDriver).
    const homeDriver = (await page.locator(".home-sample-trace strong").textContent())?.trim();
    expect(homeDriver).toBeTruthy();
    await sample.click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/dochi-result$`));
    await expect(page.locator('.dochi-result-workspace[data-phase="results"]')).toBeVisible();
    await expect(page.locator(".sample-journey-scope")).toContainText(locale === "en" ? "Sample data" : "샘플 데이터");
    await expect(page.locator('[data-queue-settled="true"]')).toBeAttached();
    await expect(page.locator(".workspace-next-action")).toBeVisible();
    // 결론 제목 바로 밑에 "어디서 · 다음" — 버튼 뒤에 숨기지 않는다.
    const trace = page.locator(".workspace-next-action__trace");
    await expect(trace.locator("dt")).toHaveText(locale === "en" ? ["Where", "Next"] : ["어디서", "다음"]);
    await expect(trace.locator("dd").first()).toContainText(homeDriver);
    await expect(page.locator(".workspace-next-action__instruction")).toHaveCount(0);
  });
}
