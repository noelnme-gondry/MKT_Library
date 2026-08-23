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

async function downloadBuffer(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function openDetails(details) {
  if (!await details.evaluate((node) => node.open)) {
    await details.locator("> summary").click();
  }
}

async function addVisibleResultToReport(page) {
  const card = page.locator(".result-action-card").filter({ visible: true }).first();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "보고서에 추가" }).click();
}

async function setComparableEfficiencyWindow(page) {
  await page.getByRole("button", { name: "날짜 범위" }).click();
  const fields = page.locator(".date-range-popover input[type=\"date\"]");
  await fields.nth(0).fill("2026-08-05");
  await fields.nth(1).fill("2026-08-08");
  await page.getByRole("switch", { name: "비교" }).click();
  await page.locator(".date-range-popover").getByRole("button", { name: "적용" }).click();
}

async function navigateToTool(page, href, section, query) {
  const link = page.locator(`a[href="${href}"]`).first();
  if (!await link.isVisible()) {
    const sectionButton = page.getByRole("button", { name: section });
    if (await sectionButton.isVisible()) {
      await sectionButton.click();
    } else {
      await page.getByRole("button", { name: "전체 도구" }).click();
      await page.getByRole("combobox").fill(query);
      await page.locator("#cmdk").getByRole("option").first().click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      return;
    }
  }
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
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
  const mapping = page.locator('.csv-mapping-block[aria-describedby="dochi-mapping-coach-title"]');
  await expect(mapping).toBeVisible();
  await expect(mapping).not.toHaveAttribute("open");
  await page.locator(".dochi-mapping-coach").getByRole("button", { name: "확인" }).click();

  const workspace = page.getByRole("region", { name: "도치가 찾은 분석 지도" });
  await expect(workspace).toBeVisible();
  const dashboardCard = workspace.locator(".dochi-workspace__card").filter({
    has: page.getByRole("heading", { name: "주간 성과 점검", exact: true }),
  });
  await expect(dashboardCard.getByRole("region", { name: "이 화면에서 계산한 요약" })).toBeVisible();
  await dashboardCard.getByRole("button", { name: /추가 차트·상세 분석 열기/ }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "데이터 분석하기" }).click();
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

test("프로젝트 설정은 동일 헤더를 다시 선택한 뒤에만 적용하고 분석을 자동 실행하지 않는다", async ({ page }) => {
  await page.goto("/dashboard");
  await uploadCsv(page, "efficiency.csv");

  const confirmations = page.getByRole("button", { name: "확인", exact: true });
  while (await confirmations.count()) await confirmations.first().click();

  const utilities = page.locator(".header-utility-menu");
  await openDetails(utilities);
  const projectSettings = utilities.locator(".project-settings");
  await openDetails(projectSettings);

  const downloadPromise = page.waitForEvent("download");
  await projectSettings.getByRole("button", { name: "설정 내보내기" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^growthopt-project_\d{4}-\d{2}-\d{2}\.gop\.json$/);
  const exportedProject = await downloadBuffer(download);
  const exportedText = exportedProject.toString("utf8");
  expect(exportedText).toContain('"headerFingerprint"');
  expect(exportedText).not.toContain("efficiency.csv");

  await utilities.getByRole("button", { name: "CSV 변경" }).click();
  await expect(page.locator(".header-data-context")).toHaveCount(0);

  await openDetails(utilities);
  await openDetails(projectSettings);
  const chooserPromise = page.waitForEvent("filechooser");
  await projectSettings.getByRole("button", { name: "설정 가져오기" }).click();
  const chooser = await chooserPromise;
  const importRequests = [];
  const captureImportRequest = (request) => {
    if (["fetch", "xhr"].includes(request.resourceType())) importRequests.push(request.url());
  };
  page.on("request", captureImportRequest);
  try {
    await chooser.setFiles({
      name: "growthopt-project.gop.json",
      mimeType: "application/json",
      buffer: exportedProject,
    });
    await expect(projectSettings.getByRole("status")).toHaveText("설정 파일을 확인했습니다. 분석은 자동 실행하지 않습니다.");
    await page.waitForTimeout(100);
    expect(importRequests).toEqual([]);
  } finally {
    page.off("request", captureImportRequest);
  }
  await expect(projectSettings.getByText("efficiency — CSV 재선택 필요")).toBeVisible();

  await utilities.locator("> summary").click();
  await uploadCsv(page, "efficiency.csv");
  while (await confirmations.count()) await confirmations.first().click();

  await openDetails(utilities);
  await openDetails(projectSettings);
  await expect(projectSettings.getByText("efficiency — 헤더 일치 · 적용 가능")).toBeVisible();
  await projectSettings.getByRole("button", { name: "호환 설정 적용" }).click();

  await expect(page.locator(".dashboard-briefing .result-action-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "데이터 분석하기" })).toBeVisible();
});

test("4개 핵심 도구의 결과를 한 주간 보고서로 수집한다", async ({ page }) => {
  await page.goto("/dashboard");
  await uploadCsv(page, "efficiency.csv");

  const confirmations = page.getByRole("button", { name: "확인", exact: true });
  while (await confirmations.count()) await confirmations.first().click();
  await page.getByRole("button", { name: "데이터 분석하기" }).click();
  await addVisibleResultToReport(page);
  await setComparableEfficiencyWindow(page);

  for (const { href, section, query } of [
    { href: "/tools/campaign-variance", section: "01 이번 주 점검", query: "성과 변동" },
    { href: "/tools/campaign-saturation", section: "03 예산 조정", query: "포화도" },
    { href: "/tools/budget-allocation", section: "03 예산 조정", query: "예산 배분" },
  ]) {
    await navigateToTool(page, href, section, query);
    await addVisibleResultToReport(page);
  }

  await page.getByRole("link", { name: "✓ 보고서 열기" }).click();
  await expect(page).toHaveURL(/\/weekly-report$/);
  await expect(page.locator(".weekly-review-record")).toHaveCount(4);
  await expectPageHierarchy(page, { primaryRegion: ".weekly-report-page__ledger" });
  await expectNoSeriousAccessibilityViolations(page);
});

test("입력 매핑이 바뀌면 이전 주간 보고서 블록을 stale로 표시한다", async ({ page }) => {
  await page.goto("/dashboard");
  await uploadCsv(page, "efficiency.csv");

  const confirmations = page.getByRole("button", { name: "확인", exact: true });
  while (await confirmations.count()) await confirmations.first().click();
  await page.getByRole("button", { name: "데이터 분석하기" }).click();
  await addVisibleResultToReport(page);

  await page.getByRole("link", { name: "✓ 보고서 열기" }).click();
  await expect(page).toHaveURL(/\/weekly-report$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);

  await openDetails(page.locator(".dashboard-data-disclosure"));
  const mappingBlock = page.locator(".csv-mapping-block:not(.semantic-mapping-block)");
  await openDetails(mappingBlock);
  await page.getByRole("combobox", { name: "Installs: 표준 필드" }).selectOption("actions");
  await expect(page.locator(".dashboard-briefing .result-action-card")).toHaveCount(0);

  await page.goForward();
  await expect(page).toHaveURL(/\/weekly-report$/);
  await expect(page.getByText("입력 데이터가 바뀐 뒤 만들어진 이전 결과입니다.")).toBeVisible();
});
