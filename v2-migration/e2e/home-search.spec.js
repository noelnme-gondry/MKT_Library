import { test, expect } from "@playwright/test";
// 분석 검색은 분석 찾기(/start) 한 곳에 있다 — 홈 목록을 합쳤다(product-ssot §1.1c).
for (const locale of ["ko", "en"]) {
  test(`analysis search stays beside its input and restores the full list (${locale})${locale === "en" ? " @light-en" : ""}`, async ({ page }) => {
    await page.goto(locale === "en" ? "/en/start" : "/start");
    const input = page.getByRole("searchbox", { name: locale === "en" ? "Search analyses" : "분석 검색" });
    const cards = page.locator(".finder-card");
    await expect(cards.first()).toBeVisible();
    const all = await cards.count();
    expect(all).toBeGreaterThan(10);
    // 하이드레이션 전에 친 글자는 React가 되돌린다 — 목록이 실제로 줄 때까지 다시 친다.
    await expect(async () => {
      await input.fill("CPA");
      expect(await cards.count()).toBeLessThan(all);
    }).toPass({ timeout: 10000 });
    // 검색 결과는 상황이 섞이므로 카드가 상황을 말한다.
    await expect(cards.first().locator(".finder-card__situation")).toBeVisible();
    const gap = await page.evaluate(() => document.querySelector("#finder-results").getBoundingClientRect().top - document.querySelector(".analysis-finder__search").getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(80);
    for (const card of await cards.all()) {
      const action = await card.locator(".finder-card__actions .btn").first().boundingBox();
      expect(action.height).toBeGreaterThanOrEqual(44);
      expect(action.height).toBeLessThan(65);
      const bounds = await card.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
    }
    await input.press("Enter");
    await expect(input).toHaveValue("CPA");
    await page.getByRole("button", { name: locale === "en" ? "Clear search" : "검색 지우기", exact: true }).click();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(page.locator(".finder-card")).toHaveCount(all);
  });
}
