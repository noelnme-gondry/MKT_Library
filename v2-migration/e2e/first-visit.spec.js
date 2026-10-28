import { enablePaidReports } from "./support/paidReports";
import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations, expectPageHierarchy } from "./support/quality";

for (const locale of ["ko", "en"]) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const tag = en ? " @light-en" : "";
  test(`home to demo result and workbook (${locale})${tag}`, async ({ page }) => {
    await enablePaidReports(page);
    await page.goto(prefix || "/");
    await expect(page.getByRole("button", { name: en ? "Close the welcome" : "안내 닫기", exact: true })).toBeHidden();
    // 홈의 주 행동은 상황 고르기다 — 상황을 고르면 분석 찾기가 그 상황의 카드로 열린다(product-ssot §1.1c).
    const situation = page.locator('.home-entry__situations li:not(.home-entry__all-tile) a').first();
    await expect(situation).toBeVisible();
    await situation.click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/start\\?situation=performance`));
    const card = page.locator('.finder-card[data-tool-id="5-2"]');
    await expect(card.locator(".finder-card__data")).toBeVisible();
    await card.getByRole("link", { name: en ? "View example report" : "예시 보고서 보기" }).click();
    // A demo intentionally opens analyzed results immediately; do not invent an extra Analyze step.
    const result = page.locator(".dashboard-briefing .result-action-card");
    await expect(result).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0); // 데모 안내 창은 없앴다 — 예시는 곧장 결과다
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
