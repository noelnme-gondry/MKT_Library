import { expect, test } from "@playwright/test";
import { DASHBOARD_GUIDES } from "../src/lib/dashboardBlogGuides";

// Editorial figures checked against the live, rendered tab after an article handoff.
// Independent expected values catch a changed window, metric, basis or fixture.
const expected = {
  viz: ["173,282", "1,682", "14.1%"],
  scorecard: ["173,282", "62,991", "4,628"],
  seasonality: ["2023", "2024", "+50.0%"],
  pacing: ["1,056,908,727", "35,230,291", "1,092,139,018"],
  anomaly: ["2024-03-24", "41,086,193", "34,611,808", "+3.08", "+2.63"],
  ltv: ["23,556", "4,060", "4,613", "1.14×"],
  cohort: ["190,542", "1,581,463", "119,104", "1,412,968"],
  funnel: ["2.65%", "2.59%", "11.14%", "11.16%"],
  segment: ["4,302", "36,368,618", "3,924", "59,260,612"],
};

for (const locale of ["ko", "en"]) {
  for (const [slug, guide] of Object.entries(DASHBOARD_GUIDES)) {
    test(`${locale === "en" ? "@light-en " : ""}${locale}/${slug} opens the published figures and records evidence`, async ({ page }) => {
      const path = `${locale === "en" ? "/en" : ""}/blog/${slug}`;
      await page.addInitScript(() => {
        window.dataLayer ||= [];
        window.gtag = (...args) => window.dataLayer.push(args);
      });
      await page.goto(path);
      const image = page.locator(`article.blog-prose img[src$="/${guide.tab}-${locale}.webp"]`);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
      for (const value of expected[guide.tab]) {
        const articleLabels = { "2024-03-24": locale === "ko" ? "3월 24일" : "March 24", "1.14×": locale === "ko" ? "1.14배" : "1.14×" };
        const proseValue = articleLabels[value] || value;
        await expect(page.locator("article.blog-prose")).toContainText(proseValue);
      }
      const entry = locale === "en" ? "#blog-practice form" : ".blog-conversion-entry";
      await page.locator(entry).getByRole("button", { name: guide[locale].action }).click();
      await expect(page.locator(".blog-arrival__back")).toHaveAttribute("href", path);
      const tab = page.locator(`#tab-${guide.tab}`);
      await expect(tab).toBeVisible();
      for (const value of expected[guide.tab]) await expect(tab).toContainText(value);
      await page.locator(".blog-arrival__evidence").click();
      // Intersection is deliberate. A section can be taller than a phone screen.
      const result = tab.locator({
        pacing: ".ab-stat-value", anomaly: "#anomaly-chart", cohort: "#wide-ret-curve",
        seasonality: ".seasonality-summary", ltv: "tbody tr", segment: "tbody tr",
        funnel: "tbody tr", scorecard: ".ab-stat-value", viz: "#s-charts canvas",
      }[guide.tab]).first();
      await result.scrollIntoViewIfNeeded();
      const count = name => page.evaluate(({ name, slug }) =>
        Array.from(window.dataLayer || []).filter(e => e[1] === name && e[2]?.content_slug === slug).length, { name, slug });
      for (const event of ["blog_tool_cta_clicked", "blog_evidence_viewed", "blog_arrival_action"]) await expect.poll(() => count(event)).toBe(1);
      if (guide.tab === "viz") await page.locator(".result-action-card").first().scrollIntoViewIfNeeded();
      await expect.poll(() => count("blog_sample_result_viewed")).toBe(1);
      if (guide.tab === "pacing") {
        await tab.locator("#pacing-target").fill("1100000000");
        await expect(tab).toContainText("43,091,273");
      }
    });
  }
}
