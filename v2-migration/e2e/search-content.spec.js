import { expect, test } from "@playwright/test";

const pages = ["blog/ios-att-skan-guide", "blog/audience-broad-vs-narrow", "blog/performance-marketing-analysis-order", "glossary/cac", "glossary/uplift", "glossary/incrementality"];

for (const locale of ["ko", "en"]) for (const theme of ["dark", "light"]) {
  test(`revised search content remains readable (${locale}/${theme})`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem("mkt-library-theme", value), theme);
    await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const path of pages) {
      await page.goto(`/${locale === "en" ? "en/" : ""}${path}`);
      await expect(page.locator("main h1")).toBeVisible();
      await page.evaluate(async () => { await document.fonts.ready; });
      expect(await page.locator("body").evaluate(node => node.classList.contains("light-mode"))).toBe(theme === "light");
      if (path.startsWith("blog/")) {
        const sources = page.locator(".editorial-trust--compact");
        await sources.locator("summary").focus();
        await page.keyboard.press("Enter");
        await expect(sources).toHaveAttribute("open");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
      const table = page.locator(".blog-prose .table-scroll").first();
      await table.focus();
      await expect(table).toBeFocused();
      expect(errors, path).toEqual([]);
    }
  });
}
