import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations, expectPageHierarchy } from "./support/quality";

for (const locale of ["ko", "en"]) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const tag = en ? " @light-en" : "";
  test(`home to demo result and workbook (${locale})${tag}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await page.getByRole("button", { name: en ? "Close the welcome" : "안내 닫기", exact: true }).click();
    const tool = page.locator(`.dc-questions a[href="${prefix}/dashboard"]`);
    await expect(tool).toBeVisible();
    await tool.click();
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    await page.getByRole("button", { name: en ? "Run the example and see results" : "예시 데이터로 결과 바로 보기", exact: true }).click();
    // A demo intentionally opens analyzed results immediately; do not invent an extra Analyze step.
    const result = page.locator(".dashboard-briefing .result-action-card");
    await expect(result).toBeVisible();
    const demoNotice = page.getByRole("dialog", { name: en ? "You're currently viewing demo data" : "지금은 데모 데이터를 이용 중입니다" });
    await demoNotice.getByRole("button", { name: en ? "Not now" : "나중에", exact: true }).click();
    await expect(demoNotice).toBeHidden();
    await expectPageHierarchy(page, { primaryRegion: ".dashboard-briefing" });
    await result.getByRole("button", { name: en ? "Download" : "결과 받기", exact: true }).click();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /상세 워크북 \(XLSX\)|Detailed workbook \(XLSX\)/ }).click();
    expect((await downloaded).suggestedFilename()).toMatch(/\.xlsx$/);
    await expectNoSeriousAccessibilityViolations(page);
  });
  test(`invalid input does not create results (${locale})${tag}`, async ({ page }) => {
    await page.goto(`${prefix}/dashboard`);
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    const result = page.locator(".dashboard-briefing .result-action-card");
    await expect(result).toHaveCount(0);
    const upload = page.locator('.csv-uploader input[type="file"]').first();
    await upload.setInputFiles({ name: "empty.csv", mimeType: "text/csv", buffer: Buffer.from("") });
    await expect(page.getByText(en ? "The file is empty." : "파일이 비어 있습니다.", { exact: true })).toBeVisible();
    await expect(result).toHaveCount(0);
    await upload.setInputFiles({ name: "unmapped.csv", mimeType: "text/csv", buffer: Buffer.from("unrelated,note\nalpha,hello\nbeta,world\n") });
    await expect(page.locator(".csv-uploader .file-state")).toBeVisible();
    await expect(page.getByText(en ? "⚠ Required columns for this tool aren't mapped yet" : "⚠ 이 도구가 필요로 하는 필수 컬럼이 매핑되지 않았습니다", { exact: true })).toBeVisible();
    await expect(page.locator(".csv-uploader .csv-analysis-action")).toHaveCount(0);
    await expect(result).toHaveCount(0);
  });
}
