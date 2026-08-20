import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  expectKeyboardFocusVisible,
  expectNoSeriousAccessibilityViolations,
  expectPageHierarchy,
} from "./support/quality";

const fixture = (name) => path.join(process.cwd(), "e2e", "fixtures", name);

async function uploadCsv(page, fileName) {
  await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
  const uploader = page.locator('.csv-uploader input[type="file"][accept*="csv"]').first();
  await uploader.setInputFiles(fixture(fileName));
  await expect(page.locator(".csv-uploader .file-state")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("mkt-library-theme", "dark");
  });
});

test("/start에서 실제 CSV를 올리고 운영 대시보드 결과까지 간다", async ({ page }) => {
  await page.goto("/start");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("데이터를 올리면 첫 분석을 골라드립니다");
  await expectPageHierarchy(page, { primaryRegion: ".start-upload-panel" });
  await expectKeyboardFocusVisible(page);

  await uploadCsv(page, "efficiency.csv");
  const recommendation = page.locator(".analysis-recommendations__primary");
  await expect(recommendation).toBeVisible();
  await recommendation.getByRole("button", { name: /분석 시작/ }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".result-action-card")).toBeVisible();
  await expectPageHierarchy(page, { primaryRegion: ".dashboard-briefing" });
  await expectNoSeriousAccessibilityViolations(page);
});

test("App Store Connect CSV를 5-27 결과로 연결한다", async ({ page }) => {
  await page.goto("/tools/aso-store-conversion");
  await expect(page.locator('.tool-page-shell[data-tool-id="5-27"]')).toBeVisible();
  await uploadCsv(page, "app-store-connect.csv");

  const confirmations = page.getByRole("button", { name: "확인", exact: true });
  while (await confirmations.count()) await confirmations.first().click();
  await page.getByRole("button", { name: "데이터 분석하기" }).click();

  await expect(page.locator("#aso-result .result-action-card")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /트래픽 구성|소스별 전환율|구성과 효율|의미 있는 변화|판단 보류/ })).toBeVisible();
  await expectPageHierarchy(page, { primaryRegion: "#aso-result" });
  await expectNoSeriousAccessibilityViolations(page);
});

test("Apple Ads 검색어 CSV를 5-26 권장 조치까지 연결한다", async ({ page }) => {
  await page.goto("/tools/asa-keyword-finder");
  await expect(page.locator('.tool-page-shell[data-tool-id="5-26"]')).toBeVisible();
  await uploadCsv(page, "apple-ads-search-terms.csv");

  const confirmations = page.getByRole("button", { name: "확인", exact: true });
  while (await confirmations.count()) await confirmations.first().click();
  await page.getByRole("button", { name: "데이터 분석하기" }).click();

  await expect(page.locator(".asa-tool__setup + .csv-uploader + #asa-summary .result-action-card")).toBeVisible();
  await expect(page.getByText("sample planner", { exact: true })).toBeVisible();
  await expectPageHierarchy(page, { primaryRegion: "#asa-summary" });
  await expectNoSeriousAccessibilityViolations(page);
});

test("분석 결과에서 결정을 저장하고 주간 검토에서 다시 본다", async ({ page }) => {
  await page.goto("/dashboard");
  await uploadCsv(page, "efficiency.csv");

  const confirmations = page.getByRole("button", { name: "확인", exact: true });
  while (await confirmations.count()) await confirmations.first().click();
  await page.getByRole("button", { name: "데이터 분석하기" }).click();
  await expect(page.locator(".dashboard-briefing .result-action-card")).toBeVisible();

  await page.locator(".decision-review > summary").click();
  await page.getByRole("button", { name: "다음 검토로 저장" }).click();
  await page.getByRole("link", { name: /주간 검토/ }).last().click();

  await expect(page).toHaveURL(/\/weekly-review$/);
  await expect(page.locator(".weekly-review-record")).toHaveCount(1);
  await expectPageHierarchy(page, { primaryRegion: ".weekly-review-page" });
  await expectNoSeriousAccessibilityViolations(page);
});
