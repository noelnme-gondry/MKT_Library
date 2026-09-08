import path from "node:path";
import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
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

  // 효율 CSV의 금액 숫자는 통화를 품지 않는다. 실제 사용자 경로처럼 원본
  // 통화를 선언해야 분석 버튼이 열리며, 비금액 도구에는 이 컨트롤이 없다.
  const sourceCurrency = page.locator('.csv-uploader [data-currency-scope="declare"]').first();
  if (await sourceCurrency.count()) {
    await expect(sourceCurrency).toBeVisible();
    await sourceCurrency.getByRole("button", { name: /^(원 ₩|KRW ₩)$/ }).click();
  }
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

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.use.colorScheme === "light" ? "light" : "dark";
  await page.addInitScript((initialTheme) => {
    window.localStorage.clear();
    window.localStorage.setItem("mkt-library-theme", initialTheme);
  }, theme);
});

async function verifyHoldoutDesign(page, locale) {
  const en = locale === "en";
  await page.goto(`${en ? "/en" : ""}/tools/incrementality`);
  await expect(page.locator('#tab-incr[data-hydrated="true"]')).toBeVisible();
  // Confirm the custom uploader's client handlers are attached before injecting a file.
  await page.getByRole("tab", { name: en ? /New launch/ : /신규 켜기/ }).click();
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "incrementality-tab-on");
  await page.getByRole("tab", { name: en ? /Control group/ : /통제군/ }).click();
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "incrementality-tab-suppression");
  const rows = Array.from({ length: 16 }, (_, index) => {
    const date = `2026-08-${String(index + 1).padStart(2, "0")}`;
    return `${date},exposed,${index < 8 ? 100 : 150},1000,100,200\r\n${date},holdout,100,1000,0,100`;
  });
  await page.locator('#tab-incr input[type="file"]').setInputFiles({ name: "holdout-design.csv", mimeType: "text/csv", buffer: Buffer.from(`date,holdout_group,numerator,denominator,spend,revenue_d7\r\n${rows.join("\r\n")}`) });
  await expect(page.locator("#tab-incr").getByText("holdout-design.csv", { exact: true })).toBeVisible();
  await page.getByLabel(en ? "Holdout start date" : "홀드아웃 시작일").selectOption("2026-08-09");
  await page.getByLabel(en ? "Holdout end date" : "홀드아웃 종료일").selectOption("2026-08-16");
  const action = page.getByLabel(en ? "What will change?" : "무엇을 바꿀까요?");
  await expect(action).toHaveCount(0);
  const declarationValues = ["person", "randomized", "planned", "none", "unique"];
  const declarationLabels = en
    ? ["Assignment / observation unit", "Comparison design", "Window and stopping rule", "Tracking, promotion, seasonality or other concurrent changes", "Independent counts across the full window"]
    : ["배정·관측 단위", "비교 설계", "기간·중단 규칙", "추적 정책·프로모션·계절성 등 동시 변경", "전체 기간의 독립 단위 집계"];
  for (const [index, label] of declarationLabels.entries()) {
    const select = page.getByLabel(label);
    await select.focus();
    await expect(select).toBeFocused();
    // Native menu arrow events are not supported by the local macOS Chromium harness.
    // selectOption checks the DOM interaction; Tab checks keyboard focus separately.
    await select.selectOption(declarationValues[index]);
    await select.press("Tab");
    await expect(select).not.toBeFocused();
    await expect(select).not.toHaveValue("");
  }
  await openDetails(page.locator(".decision-review"));
  await expect(action).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await page.getByLabel(en ? "Window and stopping rule" : "기간·중단 규칙").selectOption("changed");
  await expect(action).toHaveCount(0);
}

test("홀드아웃 설계 선언과 포커스·중단 변경 시 행동 보류를 확인한다", async ({ page }) => verifyHoldoutDesign(page, "ko"));
test("@light-en Holdout design declarations retain focus and withhold changed stopping", async ({ page }) => verifyHoldoutDesign(page, "en"));

async function verifyMovementConditions(page, locale) {
  const en = locale === "en";
  await page.goto(`${en ? "/en" : ""}/tools/paid-organic-trend`);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: en ? "Choose CSV" : "CSV 선택", exact: true }).click();
  const chooser = await chooserPromise;
  const rows = Array.from({ length: 8 }, (_, i) => `${new Date(Date.UTC(2026, 1, 2 + i * 7)).toISOString().slice(0, 10)},1300,${300 + i * 35}`);
  await chooser.setFiles({ name: "movement.csv", mimeType: "text/csv", buffer: Buffer.from(`week,total_signups,paid_signups\r\n${rows.join("\r\n")}`) });
  const panel = page.getByRole("region", { name: en ? "Observational comparison conditions" : "관찰 비교 조건" });
  await expect(panel).toBeVisible();
  const review = page.locator('[data-decision-review-tool="5-18-paid-organic"]');
  await expect(review).toHaveCount(0);
  for (const [ko, english, value] of [["추적·어트리뷰션 정책", "Tracking / attribution policy", "consistent"], ["계절성·프로모션 조건", "Seasonality / promotion conditions", "reviewed"], ["광고 집행 연속성", "Ad delivery continuity", "continuous"]]) await panel.getByLabel(en ? english : ko).selectOption(value);
  await expect(review).toBeVisible();
  await panel.getByLabel(en ? "Tracking / attribution policy" : "추적·어트리뷰션 정책").selectOption("changed");
  await expect(review).toHaveCount(0);
  await expectNoSeriousAccessibilityViolations(page);
}

test("유입 변화맵의 추적 변경 조건은 실행 제안을 보류한다", async ({ page }) => verifyMovementConditions(page, "ko"));
test("@light-en Movement map withholds actions after a tracking change", async ({ page }) => verifyMovementConditions(page, "en"));

test("@light-en English start upload stays accessible in light mode", async ({ page }) => {
  await page.goto("/en/start");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload data. Get the right first analysis.");
  await expect(page.locator("body")).toHaveClass(/light-mode/);
  await expectPageHierarchy(page, { primaryRegion: ".start-upload-panel" });
  await expectKeyboardFocusVisible(page);

  await uploadCsv(page, "efficiency.csv");
  const mapping = page.locator('.csv-mapping-block[aria-describedby="dochi-mapping-coach-title"]');
  await expect(mapping).toBeVisible();
  // Check the visible coach, then wait for dismissal before auditing the next state.
  await expectNoSeriousAccessibilityViolations(page);
  await page.locator(".dochi-mapping-coach").getByRole("button", { name: "Got it" }).click();
  await expect(page.locator(".dochi-mapping-coach")).toBeHidden();

  const workspace = page.getByRole("region", { name: "The analysis map Dochi found" });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByRole("region", { name: "Summary calculated on this screen" }).first()).toBeVisible();
  const quality = workspace.getByRole("region", { name: "Detailed input quality" }).first();
  await quality.getByRole("button", { name: "Check detailed input quality" }).click();
  await expect(quality.getByText(/Input checks passed|Review input cautions/)).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  const dashboardCard = workspace.locator(".dochi-workspace__card").filter({ has: page.getByRole("heading", { name: "Weekly check", exact: true }) });
  await dashboardCard.getByRole("button", { name: "Open extra charts and details" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await expect(page.locator(".dashboard-briefing .result-action-card")).toBeVisible();
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
  const quality = dashboardCard.getByRole("region", { name: "상세 입력 품질" });
  await quality.getByRole("button", { name: "상세 입력 품질 확인" }).click();
  await expect(quality.getByText(/입력 검사 통과|입력 주의사항 확인/)).toBeVisible();
  await dashboardCard.getByRole("button", { name: /추가 차트·상세 분석 열기/ }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  // /start에서 자격 통과한 추천을 열면 도치 작업대와 같은 분석 완료 상태를
  // 넘긴다. 다시 "데이터 분석하기"를 누르게 하면 추천→결과 여정이 한 단계 끊긴다.
  await expect(page.locator(".result-action-card")).toBeVisible();
  await expectPageHierarchy(page, { primaryRegion: ".dashboard-briefing" });
  await expectNoSeriousAccessibilityViolations(page);
});

test("운영 대시보드 결과에서 원본·수식이 든 XLSX를 받는다", async ({ page }) => {
  await page.goto("/dashboard");
  await uploadCsv(page, "efficiency.csv");
  const confirmations = page.getByRole("button", { name: "확인", exact: true });
  while (await confirmations.count()) await confirmations.first().click();
  await page.getByRole("button", { name: "데이터 분석하기" }).click();

  const resultCard = page.locator(".dashboard-briefing .result-action-card");
  await expect(resultCard).toBeVisible();
  const exportRequests = [];
  const captureRequest = (request) => {
    if (["fetch", "xhr"].includes(request.resourceType())) exportRequests.push(request.url());
  };
  page.on("request", captureRequest);
  try {
    await resultCard.getByRole("button", { name: "결과 받기" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /상세 워크북 \(XLSX\)/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^5-2_analysis_workbook_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const bytes = await downloadBuffer(download);
    const workbook = XLSX.read(bytes, { type: "buffer", cellFormula: true });
    expect(workbook.SheetNames.slice(0, 9)).toEqual([
      "00_README", "01_SUMMARY", "02_RAW_DATA", "03_MAPPING", "04_SCOPE",
      "05_CALCULATIONS", "06_ENGINE_OUTPUT", "07_RESULTS", "08_METHOD_LIMITS",
    ]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets["02_RAW_DATA"], { header: 1 }).length).toBeGreaterThan(2);
    expect(workbook.Sheets["05_CALCULATIONS"].C2.f).toMatch(/^MAX\('02_RAW_DATA'!/);
    expect(workbook.Sheets.DASHBOARD_METRICS.D2.f).toContain("IFERROR");
    expect(exportRequests).toEqual([]);
  } finally {
    page.off("request", captureRequest);
  }
});

test("App Store Connect CSV를 5-27 결과로 연결한다", async ({ page }) => {
  await page.goto("/tools/aso-store-conversion");
  await expect(page.locator('.tool-page-shell[data-tool-id="5-27"]')).toBeVisible();
  await uploadCsv(page, "app-store-connect.csv");

  const confirmations = page.getByRole("button", { name: "확인", exact: true });
  while (await confirmations.count()) await confirmations.first().click();
  await page.getByRole("button", { name: "데이터 분석하기" }).click();

  const resultCard = page.locator("#aso-result .result-action-card");
  await expect(resultCard).toBeVisible();
  // 태블릿에서는 결과가 첫 화면 아래로 밀릴 수 있으므로, 사용자가 결과를
  // 읽는 위치에서 내부 제목을 검증한다.
  await resultCard.scrollIntoViewIfNeeded();
  const resultHeading = resultCard.getByRole("heading", { level: 2, name: /트래픽 구성|소스별 전환율|구성과 효율|의미 있는 변화|판단 보류/ });
  await expect(resultHeading).toBeVisible();
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

  await expect(page.locator("#asa-summary .result-action-card")).toBeVisible();
  await expect(page.getByLabel("업로드 기간의 전환 성숙도")).toHaveValue("unknown");
  await expect(page.getByText("전환 성숙도 미확인", { exact: true }).first()).toBeVisible();
  await page.getByLabel("업로드 기간의 전환 성숙도").selectOption("mature");
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
  await page.locator(".decision-review__weekly-link").click();

  await expect(page).toHaveURL(/\/weekly-review$/);
  await page.locator(".wr-history > summary").click();
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

async function verifyDirectAnalysisGates(page, en = false) {
  await page.goto(`${en ? "/en" : ""}/tools/budget-allocation`);
  await uploadCsv(page, "efficiency.csv");
  await expect(page.locator("#tab-alloc .result-action-card")).toHaveCount(0);
  const confirmations = page.getByRole("button", { name: en ? "Confirm" : "확인", exact: true });
  while (await confirmations.count()) await confirmations.first().click();
  await page.locator(".csv-uploader").getByRole("button", { name: en ? "Analyze data" : "데이터 분석하기", exact: true }).click();
  await expect(page.locator("#tab-alloc .result-action-card")).toBeVisible();

  await page.goto(`${en ? "/en" : ""}/content/freshness`);
  await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
  const rows = Array.from({ length: 120 }, (_, index) => {
    const day = Math.floor(index / 6) + 1;
    return [`2026-01-${String(day).padStart(2, "0")}`, "Meta", `creative-${index % 6}`, 5000, 100 + index % 11, 20, 10000].join(",");
  });
  await page.locator('.csv-uploader input[type="file"]').setInputFiles({ name: "creative-gate.csv", mimeType: "text/csv", buffer: Buffer.from(`date,channel,creative_id,impressions,clicks,installs,spend\r\n${rows.join("\r\n")}`) });
  await expect(page.locator("#s-fatigue")).toHaveCount(0);
  const currency = page.locator('.csv-uploader [data-currency-scope="declare"]').first();
  if (await currency.count()) await currency.getByRole("button", { name: /^(원 ₩|KRW ₩)$/ }).click();
  const creativeConfirmations = page.getByRole("button", { name: en ? "Confirm" : "확인", exact: true });
  while (await creativeConfirmations.count()) await creativeConfirmations.first().click();
  await page.locator(".csv-uploader").getByRole("button", { name: en ? "Analyze data" : "데이터 분석하기", exact: true }).click();
  await expect(page.locator("#s-fatigue")).toBeVisible();
}

test("예산·소재 직접 업로드는 분석 버튼을 누른 뒤에만 결과를 표시한다", async ({ page }) => {
  await verifyDirectAnalysisGates(page);
});
test("budget and creative uploads wait for Analyze @light-en", async ({ page }) => {
  await verifyDirectAnalysisGates(page, true);
});

async function verifyContentValidationSplit(page, en = false) {
  await page.goto(`${en ? "/en" : ""}/content/element-analysis`);
  await expect(page.locator('.csv-dropzone[data-hydrated="true"]')).toBeVisible();
  const rows = Array.from({ length: 160 }, (_, index) => {
    const hook = Math.sin(index * 1.1);
    const length = Math.cos(index * 0.7);
    const score = 10 + 2 * hook - 3 * length + Math.sin(index * 3);
    const date = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10);
    return [score, hook, length, date, `unit-${index % 20}`].join(",");
  });
  await page.locator('.csv-dropzone input[type="file"]').setInputFiles({ name: "content-validation.csv", mimeType: "text/csv", buffer: Buffer.from(`score,hook,length,date,post_id\r\n${rows.join("\r\n")}`) });
  await page.locator("#content-outcome").selectOption("score");
  await page.getByRole("button", { name: en ? "▶ Analyze" : "▶ 분석하기", exact: true }).click();
  await expect(page.locator(".result-action-card").first()).toBeVisible();
  await page.getByLabel(en ? "Future-validation date column" : "미래 검증 날짜 열").selectOption("date");
  await expect(page.getByText(en ? /Past-to-future holdout: 32 validation rows/ : /과거→미래 홀드아웃: 검증 32행/)).toBeVisible();
  await page.getByLabel(en ? "Repeated-unit column" : "반복 단위 열").selectOption("post_id");
  const help = page.locator("#s-content-webr-random-forest");
  await help.locator("summary").click();
  await expect(help.getByText(en ? /Separated validation is unavailable/ : /분리 검증 불가/)).toBeVisible();
  await expect(page.getByRole("radio", { name: /Random Forest/ })).toHaveCount(0);
  await expectNoSeriousAccessibilityViolations(page);
}

test("콘텐츠 미래 검증에서 같은 단위의 과거 행을 제외하고 부족하면 보류한다", async ({ page }) => {
  await verifyContentValidationSplit(page);
});
test("content future validation holds overlapping units @light-en", async ({ page }) => {
  await verifyContentValidationSplit(page, true);
});
