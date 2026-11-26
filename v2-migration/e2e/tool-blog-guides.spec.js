import { expect, test } from "@playwright/test";

const guides = [
  { slug: "operations-planner-guide", tool: "operations-planner", values: ["432,977", "3,238", "3,331"], figures: 2 },
  { slug: "mmm-contribution-tool-guide", tool: "mmm-contribution", values: ["6.4%", "12.5%", "9,861", "57.4", "35.0", "21.2"], figures: 1 },
  { slug: "budget-allocation-tool-guide", tool: "budget-allocation", values: ["26,429", "26,220", "1,576", "1,541"], figures: 1 },
];

for (const prefix of ["", "/en"]) {
  for (const guide of guides) {
    test(`published ${prefix || "ko"} ${guide.slug} opens the example described in the article`, async ({ page }) => {
      await page.goto(`${prefix}/blog/${guide.slug}`);
      const article = page.locator("article.blog-prose");
      await expect(article.locator("img")).toHaveCount(guide.figures);
      const path = `${prefix}/tools/${guide.tool}`;
      await expect(article.locator(`a[href="${path}?example=1"]`)).toBeVisible();
      await page.locator(".blog-conversion-entry button[type=submit]").click();
      await expect(page).toHaveURL(url => url.pathname === path);
      if (guide.tool === "mmm-contribution") {
        // Wait for the 132-week model to finish fitting before reading its estimates.
        await expect(page.locator("main canvas:visible").first()).toBeVisible({ timeout: 45_000 });
      }
      for (const value of guide.values) await expect(page.locator("main")).toContainText(value);
      if (guide.tool === "budget-allocation") {
        await page.getByRole("tab", { name: prefix ? "Curves" : "곡선", exact: true }).click();
      }
      await expect(page.locator("main canvas:visible").first()).toBeVisible();
    });
  }
}
