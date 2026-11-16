import { expect, test } from "@playwright/test";
import { ADVANCED_BY_ID } from "../src/lib/advanced-marketing/registry";
import { buildAdvancedDemo, advancedDemoOptions } from "../src/lib/advanced-marketing/demo";
import { csvBody } from "../src/utils/download";

for (const locale of ["ko", "en"]) {
  test(`template to actual tool entry (${locale})`, async ({ page }, testInfo) => {
    const en = locale === "en", prefix = en ? "/en" : "";
    if (en) await page.addInitScript(() => localStorage.setItem("mkt-library-theme", "light"));
    for (const slug of ["user-funnel-retention", "b2b-pipeline"]) {
      await page.goto(`${prefix}/templates/${slug}`);
      await expect(page.locator(".template-detail__rules").last()).toContainText("2026-01-01T09:00:00+09:00");
      await expect(page.locator("#template-preparation-heading")).toBeVisible();
      const user = page.locator(".template-detail__table tbody tr").filter({ has: page.locator("code", { hasText: /^user_id$/ }) });
      if (slug === "user-funnel-retention") {
        await expect(user).toContainText(en ? "Required" : "필수");
        await expect(user).not.toContainText(en ? "optional" : "선택");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.getByRole("link", { name: en ? "Open tool →" : "도구 열기 →", exact: true }).click();
      await expect(page.locator("[data-worked-example]")).toBeVisible();
      await expect(page.locator('[data-advanced-result="ready"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (process.env.CONTENT_REVIEW_CAPTURE && slug === "user-funnel-retention" && ((en && testInfo.project.name === "mobile-320") || (!en && testInfo.project.name === "desktop-1440"))) {
        await page.locator("[data-worked-example]").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${process.env.CONTENT_REVIEW_CAPTURE}/library-${locale}-${testInfo.project.name}.png` });
      }
    }
  });
}

for (const id of ["5-33", "5-38"]) {
  test(`date-only event upload is visibly rejected (${id})`, async ({ page }) => {
    const tool = ADVANCED_BY_ID[id], demo = buildAdvancedDemo(id), options = advancedDemoOptions(id);
    const timeHeader = demo.headers.find((header) => demo.mapping[header] === "event_time");
    const raw = demo.raw.map((row) => ({ ...row, [timeHeader]: row[timeHeader].slice(0, 10) }));
    await page.goto(`/en${tool.slug}`);
    const root = page.locator(".advanced-analysis");
    await expect(root.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    await root.locator('input[type="file"]').first().setInputFiles({ name: "date-only-events.csv", mimeType: "text/csv", buffer: Buffer.from(csvBody(demo.headers, raw.map((row) => demo.headers.map((header) => row[header])))) });
    await expect(root.locator(".csv-loaded-stats")).toBeVisible();
    for (const option of tool.options) {
      const input = ["textarea", "select"].includes(option.type) ? root.getByRole(option.type === "select" ? "combobox" : "textbox", { name: option.label.en, exact: true }) : root.getByLabel(option.label.en, { exact: true });
      if (option.type === "checkbox") await input.setChecked(Boolean(options[option.key]));
      else if (option.type === "select") await input.selectOption(String(options[option.key]));
      else await input.fill(String(options[option.key]));
    }
    await root.getByRole("button", { name: "Analyze data", exact: true }).click();
    await expect(root.locator('[data-advanced-result="blocked"]')).toContainText("Events require an exact time and timezone");
    await expect(root.locator('[data-advanced-result="ready"]')).toHaveCount(0);
  });
}
