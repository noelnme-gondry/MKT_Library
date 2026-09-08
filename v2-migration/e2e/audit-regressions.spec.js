import { expect, test } from "@playwright/test";
import path from "node:path";

for (const locale of ["ko", "en"]) {
  const prefix = locale === "en" ? "/en" : "";
  const tag = locale === "en" ? " @light-en" : "";
  test(`template hub links every sitemap template (${locale})${tag}`, async ({ page, request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(match => new URL(match[1]).pathname)
      .filter(path => path.startsWith(`${prefix}/templates/`));
    expect(paths.length).toBeGreaterThan(10);
    await page.goto(`${prefix}/templates`);
    for (const path of paths) await expect(page.locator(`main a[href="${path}"]`)).toBeVisible();
  });
  test(`home fits tablet in both themes (${locale})${tag}`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    for (const theme of ["light", "dark"]) {
      await page.addInitScript(value => localStorage.setItem("mkt-library-theme", value), theme);
      await page.goto(prefix || "/");
      await expect(page.locator(".dc-questions")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
    }
  });
  test(`sparse channels never receive a steady verdict (${locale})${tag}`, async ({ page }) => {
    await page.goto(`${prefix}/tools/campaign-saturation`);
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    await page.locator('input[type=file][accept*=csv]').first().setInputFiles(path.resolve("public/examples/saturation-sparse.csv"));
    await page.locator(".csv-uploader").getByRole("button", { name: locale === "en" ? "KRW ₩" : "원 ₩", exact: true }).click();
    const confirmations = page.getByRole("button", { name: locale === "en" ? "Got it" : "확인", exact: true });
    while (await confirmations.count()) await confirmations.first().click();
    await page.locator(".csv-analysis-action").click();
    await expect(page.getByText(locale === "en" ? "Abstain — no analyzable items" : "판단 보류 — 분석 가능한 항목 없음", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Mostly in the steady zone|대부분 적정 구간/)).toHaveCount(0);
  });
}
