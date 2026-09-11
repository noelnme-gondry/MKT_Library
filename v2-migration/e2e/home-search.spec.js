import { test, expect } from "@playwright/test";
for (const locale of ["ko", "en"]) {
  test(`metric search is visible beside its input (${locale})${locale === "en" ? " @light-en" : ""}`, async ({ page }) => {
    await page.goto(locale === "en" ? "/en" : "/");
    const input = page.getByRole("searchbox", { name: locale === "en" ? "Find an analysis" : "필요한 분석 찾기" });
    await input.fill("CPA");
    const results = page.locator("#home-tool-results");
    await expect(results).toBeVisible();
    await expect(results.getByRole("link").first()).toBeAttached();
    await expect(page.locator(".home-tool-finder__purposes")).toBeHidden();
    const gap = await page.evaluate(() => document.querySelector("#home-tool-results").getBoundingClientRect().top - document.querySelector(".home-tool-finder__search").getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(45);
    await input.press("Enter");
    await expect(input).toHaveValue("CPA");
    await page.getByRole("button", { name: locale === "en" ? "Clear search" : "검색 지우기", exact: true }).click();
    await expect(input).toHaveValue("");
    await expect(page.locator(".home-tool-finder__purposes")).toBeVisible();
  });
}
