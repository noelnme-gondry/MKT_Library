import { expect, test } from "@playwright/test";

for (const locale of ["ko", "en"]) {
  test(`weekly spend planner uses real upload, maturity and grouping (${locale})`, async ({ page }) => {
    const en = locale === "en";
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${en ? "/en" : ""}/tools/budget-allocation`);
    const lines = ["week_start,campaign_platform,channel,cost,regs,rev_d7,snapshot_date"];
    for (let index = 0; index < 16; index += 1) {
      const date = new Date(Date.UTC(2026, 4, 4 + index * 7)).toISOString().slice(0, 10);
      for (const os of ["iOS", "Android"]) {
        const cost = 14000 + (index % 6) * 700;
        lines.push([date, os, "Meta", cost, cost / (index < 8 ? 100 : 150), cost * 0.7, "2026-09-01"].join(","));
      }
    }
    const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
    await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles({ name: "weekly-planner.csv", mimeType: "text/csv", buffer: Buffer.from(lines.join("\n")) });
    await uploader.getByRole("button", { name: en ? "Analyze data" : "데이터 분석하기", exact: true }).click();
    await expect(page.locator(".allocation-observation-note")).toContainText(en ? "Weekly totals" : "주간 합계");
    const settings = page.getByRole("button", { name: en ? "Data and curve settings" : "자료·곡선 설정", exact: true });
    await settings.click();
    const dialog = page.getByRole("dialog", { name: en ? "Data and curve settings" : "자료·곡선 설정", exact: true });
    await expect(dialog.getByLabel(en ? "Data as-of date" : "추출 기준일", { exact: true })).toHaveValue("2026-09-01");
    await dialog.getByLabel(en ? "Curve fitting period" : "곡선 사용 구간", { exact: true }).selectOption("auto");
    await dialog.getByLabel(en ? "Grouping" : "분배 단위", { exact: true }).selectOption("channel");
    await dialog.press("Escape");
    await page.getByRole("tab", { name: en ? "Budget comparison" : "예산 비교", exact: true }).click();
    await expect(page.getByRole("table", { name: en ? "Budget strategy comparison" : "예산 실행안 비교", exact: true })).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}
