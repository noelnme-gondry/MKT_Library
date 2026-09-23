import { expect, test } from "@playwright/test";

for (const locale of ["ko", "en"]) {
  test(`first article offers its practice after two scroll gestures (${locale})`, async ({ page }) => {
    const scrollDown = async () => {
      await page.mouse.move(page.viewportSize().width * .75, 200);
      await page.mouse.wheel(0, 180);
    };
    await page.addInitScript(() => {
      if (sessionStorage.getItem("test:blog-helper-seeded")) return;
      sessionStorage.setItem("test:blog-helper-seeded", "1");
      localStorage.removeItem("gop:blog:bridge-off-date");
    });
    await page.goto(`${locale === "en" ? "/en" : ""}/blog/budget-marginal-efficiency`);
    await expect(page.locator(".blog-prose")).toBeVisible();
    // Wait for an interactive control so the first gesture occurs after hydration.
    await expect(page.getByRole("button", { name: locale === "en" ? "Open analysis with demo" : "데모로 분석 열기", exact: true })).toBeEnabled();
    const helper = page.locator(".blog-dochi-bridge");
    await expect(helper).toHaveCount(0);
    await scrollDown();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    // Separates two physical gestures; continuous events from one gesture count once.
    await page.waitForTimeout(250);
    await expect(helper).toHaveCount(0);
    await scrollDown();
    await expect(helper).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = await helper.boundingBox();
    const viewport = page.viewportSize();
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(2);
    await expect(helper.locator(".blog-dochi-bridge__cta")).toHaveAttribute("href", `${locale === "en" ? "/en" : ""}/tools/budget-allocation`);
    const practice = helper.locator('a[href="#blog-practice"]');
    await practice.click();
    await expect(helper).toHaveCount(0);
    await expect(page.locator("#blog-practice")).toBeInViewport();
    await page.reload();
    await scrollDown();
    await page.waitForTimeout(250);
    await scrollDown();
    await expect(helper).toHaveCount(0);
    // Closing one article must not suppress a different article's analysis.
    await page.goto(`${locale === "en" ? "/en" : ""}/blog/ab-testing`);
    await expect(page.getByRole("button", { name: locale === "en" ? "Open analysis with demo" : "데모로 분석 열기", exact: true })).toBeEnabled();
    await scrollDown();
    await page.waitForTimeout(250);
    await scrollDown();
    await expect(helper).toBeVisible();
    await expect(helper.locator(".blog-dochi-bridge__cta")).toHaveAttribute("href", `${locale === "en" ? "/en" : ""}/tools/experiment-analysis`);
    await helper.getByRole("button", { name: locale === "en" ? "Don’t show again today" : "오늘 다시 보지 않기" }).click();
    await expect(helper).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("gop:blog:bridge-off-date"))).toBeTruthy();
    await page.goto(`${locale === "en" ? "/en" : ""}/blog/apple-search-ads-guide`);
    await expect(page.getByRole("button", { name: locale === "en" ? "Open analysis with demo" : "데모로 분석 열기", exact: true })).toBeEnabled();
    await scrollDown();
    await page.waitForTimeout(250);
    await scrollDown();
    await expect(helper).toHaveCount(0);
  });
}
