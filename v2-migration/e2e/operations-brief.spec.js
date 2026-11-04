import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import Papa from "papaparse";
import { enableReviewLogin, confirmReviewDialog } from "./support/reviewSave";
import { measureDesignRules } from "./support/designRules";

function csvFixture({ gap = false, days = 70 } = {}) {
  const lines = ["Date,Country,Platform,Channel,Campaign,Creative,Cost,Installs,Impressions,Clicks"];
  for (let day = 0; day < days; day++) for (let campaign = 0; campaign < 2; campaign++) {
    const date = new Date(Date.UTC(2026, 6, 1 + day)).toISOString().slice(0, 10);
    if (gap && day === 67 && campaign === 1) continue;
    const cost = 100000 + day % 11 * 14000;
    const installs = cost / ((campaign ? 1800 : 600) + cost * (campaign ? 0.006 : 0.001));
    const name = campaign ? "리타겟팅 · 기존 구매자 재방문" : "신규 유입 · 제품 사용 장면";
    const parts = campaign === 0 && day >= 63 ? [["사용 장면 영상", 0.7], ["이번 주 추가로 관측된 후기 소재", 0.3]] : [["사용 장면 영상", 1]];
    for (const [creative, share] of parts) lines.push([date, "KR", "iOS", "Meta", name, creative, cost * share, installs * share, installs * 200 * share, installs * 10 * share].join(","));
  }
  return Buffer.from(lines.join("\r\n"));
}

async function openOperations(page, en, options = {}) {
  await page.goto(`${en ? "/en" : ""}/tools/operations-planner`);
  const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
  await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles({ name: "synthetic-operations.csv", mimeType: "text/csv", buffer: csvFixture(options) });
  await uploader.getByRole("button", { name: en ? "KRW ₩" : "원 ₩", exact: true }).click();
  await uploader.getByRole("button", { name: en ? "Analyze data" : "데이터 분석하기", exact: true }).click();
  await page.getByRole("tab", { name: en ? "Explore evidence" : "근거 살펴보기", exact: true }).click();
  await expect(page.locator("#ops-budget-title")).toBeVisible();
}

for (const locale of ["ko", "en"]) {
  test(`operations planner: home demo, computed evidence and original CSV (${locale})`, async ({ page }, testInfo) => {
    const en = locale === "en", errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(theme => localStorage.setItem("mkt-library-theme", theme), en ? "light" : "dark");
    await page.goto(en ? "/en" : "/");
    // 홈의 운영 플래너 진입은 미리보기와 "데모 보기" 링크다(주 행동은 상황 고르기·파일 놓기, product-ssot §5.1.1).
    await expect(page.locator(".home-entry__more a")).toHaveAttribute("href", `${en ? "/en" : ""}/tools/operations-planner?example=1`);
    const previewCpi = (await page.locator(".operations-sample-preview__metric strong").textContent()).split("→").at(-1).trim();
    await page.screenshot({ path: testInfo.outputPath("operations-home.png") });
    await page.getByRole("link", { name: en ? /View demo/ : /데모 보기/ }).click();
    await expect(page.locator(".operations-queue")).toBeVisible();
    await page.getByRole("tab", { name: en ? "Explore evidence" : "근거 살펴보기", exact: true }).click();
    await expect(page.locator("#ops-budget-title")).toBeVisible();
    await expect(page.locator(".operations-planner__demo")).toContainText(en ? "98 days" : "98일");
    await expect(page.locator(".result-action-card__stats")).toContainText(previewCpi);
    await expect(page.locator(".operations-new-creatives")).toContainText(en ? "Customer review video" : "고객 후기 영상");
    await expect(page.locator(".operations-workbench canvas")).toHaveCount(7);
    const figureHeader = page.locator(".operations-trend .figure-head");
    const titleBounds = await figureHeader.locator("h3").boundingBox();
    const pngBounds = await figureHeader.getByRole("button", { name: en ? "Download PNG" : "PNG 받기", exact: true }).boundingBox();
    expect(Math.min(titleBounds.y + titleBounds.height, pngBounds.y + pngBounds.height) - Math.max(titleBounds.y, pngBounds.y), "PNG stays beside the chart title").toBeGreaterThan(1);
    expect(pngBounds.x - titleBounds.x - titleBounds.width, "title keeps horizontal space before PNG").toBeGreaterThanOrEqual(11);
    const pngButton = figureHeader.getByRole("button", { name: en ? "Download PNG" : "PNG 받기", exact: true });
    // Radix closes help on scroll. Focus the visible control rather than closing
    // it immediately with focus()'s automatic scroll from an off-screen panel.
    await pngButton.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await pngButton.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("tooltip")).toContainText(en ? "Purchased pass required" : "구매 이용권 필요");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    if (testInfo.project.use.viewport.width > 1100) {
      const overview = await page.locator(".operations-panel--budget").boundingBox();
      const comparisons = await page.locator(".operations-workbench__group--budget > .operations-comparison").boundingBox();
      expect(Math.abs(overview.x - comparisons.x), "shared budget summary starts at the comparison gutter").toBeLessThanOrEqual(1);
      expect(Math.abs(overview.width - comparisons.width), "shared budget summary spans both charts").toBeLessThanOrEqual(1);
      expect(overview.y + overview.height, "shared conditions and summary precede both charts").toBeLessThan(comparisons.y);
      const budgetHeading = await page.locator(".operations-panel--allocation .figure-head h3").boundingBox();
      const trendHeading = await page.locator("#ops-trend-title").boundingBox();
      expect(Math.abs(budgetHeading.y - trendHeading.y), "paired chart headings share a top edge below the summary").toBeLessThanOrEqual(1);
      const titles = await page.locator(".operations-panel--allocation .figure-head h3, #ops-trend-title").evaluateAll(nodes => nodes.map(node => ({ size: getComputedStyle(node).fontSize, color: getComputedStyle(node).color })));
      expect(titles).toHaveLength(2);
      expect(titles[0].size).toBe(titles[1].size);
      expect(titles[0].color).toBe(titles[1].color);
      const figureHeads = await page.locator(".operations-decomposition-grid .section-head").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().bottom));
      expect(Math.abs(figureHeads[0] - figureHeads[1]), "stage and mix plots start below aligned figure headers").toBeLessThanOrEqual(1);
    }
    const forecast = page.locator(".operations-brief__forecast");
    const summaryRows = await forecast.locator(":scope > div").evaluateAll(nodes => nodes.map(node => ({
      left: node.getBoundingClientRect().left,
      title: node.querySelector("dt").getBoundingClientRect().top,
      value: node.querySelector("strong").getBoundingClientRect().top,
      context: node.querySelector("dd:last-child").getBoundingClientRect().top,
    })));
    if (Math.abs(summaryRows[0].left - summaryRows[1].left) > 1) {
      for (const row of ["title", "value", "context"]) expect(Math.abs(summaryRows[0][row] - summaryRows[1][row]), `budget summary ${row} shares a baseline`).toBeLessThanOrEqual(1);
    }
    await expect(forecast.locator("b")).toHaveText(/\+[\d.]+%/);
    const modeled = (await forecast.locator("strong").nth(1).textContent()).split("→").map(value => Number(value.replace(/,/g, "")));
    expect(modeled[1]).toBeGreaterThan(modeled[0]);
    expect(Number((await forecast.locator("b").textContent()).replace(/[^\d.]/g, ""))).toBeCloseTo((modeled[1] / modeled[0] - 1) * 100, 1);
    if (testInfo.project.name === "desktop-1440") {
      await page.locator(".operations-workbench__group--creative").screenshot({ path: testInfo.outputPath("operations-creatives.png") });
      await page.locator(".operations-data > summary").click();
      await page.locator(".operations-data").screenshot({ path: testInfo.outputPath("operations-tables.png") });
      await page.locator(".operations-data > summary").click();
    }
    await expect(page.locator(".operations-trend canvas")).toBeVisible();
    const trendControls = page.getByRole("radiogroup", { name: en ? "Trend metric" : "추세 지표" });
    await trendControls.getByRole("radio", { name: "CPI", exact: true }).press("ArrowRight");
    await expect(trendControls.getByRole("radio", { name: en ? "Spend" : "광고비", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".operations-trend canvas")).toHaveAttribute("aria-label", en ? "Daily observed portfolio Spend" : "전체 일별 실측 광고비");
    await trendControls.getByRole("radio", { name: en ? "Spend" : "광고비", exact: true }).press("Home");
    await expect(trendControls.getByRole("radio", { name: "CPI", exact: true })).toBeFocused();
    await page.getByRole("button", { name: en ? "Select Customer review video" : "고객 후기 영상 선택", exact: true }).click();
    const baseline = await page.locator(".operations-creative-detail dl > div").filter({ has: page.locator("dt", { hasText: /^CPI$/ }) }).locator("dd").textContent();
    await page.getByRole("button", { name: en ? /Define an action for this creative/ : /이 소재의 액션 정하기/ }).click();
    const action = page.getByRole("dialog", { name: en ? "Define an operating action" : "운영 액션 정하기", exact: true });
    await expect(action.getByLabel(en ? "Creative name / ID" : "소재 이름 / ID", { exact: true })).toHaveValue(en ? "Customer review video" : "고객 후기 영상");
    await expect(action.getByRole("button", { name: en ? "Save action" : "액션 저장", exact: true })).toBeDisabled();
    await expect(action).toContainText(en ? "CPRR gains or losses from creative actions are not predicted" : "소재 액션의 CPRR 개선·악화 수치는 예측하지 않습니다");
    await page.screenshot({ path: testInfo.outputPath("operations-action.png") });
    await action.getByRole("button", { name: en ? "Close" : "닫기", exact: true }).click();
    await page.locator(".operations-planner__conditions > summary").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: en ? "Download demo CSV" : "데모 원본 CSV", exact: true }).click();
    const download = await downloadPromise;
    const csv = Papa.parse(await readFile(await download.path(), "utf8"), { header: true, skipEmptyLines: true });
    expect(csv.errors).toEqual([]);
    expect(new Set(csv.data.map(row => row.Date)).size).toBe(98);
    expect(new Set(csv.data.map(row => row["Campaign ID"])).size).toBe(4);
    // 다운로드한 원본의 독립 집계와 홈·주간 리뷰의 실측 기준값을 대조한다.
    const recent = csv.data.filter(row => row.Date >= "2026-09-30");
    const cpi = values => values.reduce((sum, row) => sum + Number(row.Cost), 0) / values.reduce((sum, row) => sum + Number(row.Installs), 0);
    expect(Number(previewCpi.replace(/[^\d.]/g, ""))).toBe(Math.round(cpi(recent)));
    const customerReview = recent.filter(row => row["Creative ID"] === (en ? "Customer review video" : "고객 후기 영상"));
    expect(Number(baseline.replace(/[^\d.]/g, ""))).toBe(Math.round(cpi(customerReview)));
    expect(new Set(customerReview.map(row => row.Date)).size).toBe(7);
    expect(new Set(recent.filter(row => row["Creative ID"] === (en ? "Feature comparison" : "기능 비교 이미지")).map(row => row.Date)).size).toBe(5);
    await page.locator(".operations-planner__conditions > summary").click();
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const audit = await new AxeBuilder({ page }).include(".operations-planner").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(audit.violations).toEqual([]);
    await page.locator(".result-action-card").evaluate(node => node.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -90));
    await page.screenshot({ path: testInfo.outputPath("operations-demo.png") });
    await page.locator(".operations-panel--campaign").evaluate(node => node.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -90));
    await page.screenshot({ path: testInfo.outputPath("operations-evidence.png") });
    await page.locator(".operations-brief__diagnosis").evaluate(node => node.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.evaluate(() => window.scrollBy(0, -90));
    await page.screenshot({ path: testInfo.outputPath("operations-diagnosis.png") });
  });

  test(`operations planner: real upload, budget cap, evidence and accessibility (${locale})`, async ({ page }, testInfo) => {
    const en = locale === "en", errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await openOperations(page, en);
    await page.locator(".operations-data > summary").click();
    await expect(page.getByRole("region", { name: en ? "Budget and efficiency by entity" : "대상별 예산과 효율", exact: true })).toBeVisible();
    await expect(page.locator(".operations-budget-shifts").first()).toContainText("CPI");
    await expect(page.locator(".operations-budget-shifts").first()).not.toContainText("CPA");
    await expect(page.locator(".operations-brief__forecast")).toContainText("₩332,000");
    const cap = page.getByRole("combobox", { name: en ? "Change limit" : "변경 한도" });
    await cap.selectOption("0");
    await expect(page.locator(".operations-brief__forecast")).toContainText("0.0%");
    const table = page.getByRole("table", { name: en ? "Budget and efficiency by entity" : "대상별 예산과 효율", exact: true });
    for (const row of await table.locator("tbody tr").all()) {
      const cells = await row.locator("td").allTextContents();
      expect(cells[1]).toBe(cells[2]);
    }
    await page.getByRole("combobox", { name: en ? "Select a campaign" : "캠페인 선택" }).selectOption({ label: "신규 유입 · 제품 사용 장면 · KR · iOS · Meta" });
    await expect(page.locator(".operations-brief__diagnosis header h4")).toContainText("신규 유입");
    await expect(page.locator(".pvm-stage-analysis")).toBeVisible();
    const creative = page.getByRole("table", { name: en ? "Recent efficiency by creative" : "소재별 최근 효율", exact: true });
    await expect(creative).toContainText("이번 주 추가로 관측된 후기 소재");
    await expect(creative).toContainText("2026-09-02");
    await page.locator(".operations-planner__conditions > summary").click();
    await page.getByRole("button", { name: en ? /^Comparison period/ : /^비교 기간/ }).click();
    const dialog = page.getByRole("dialog", { name: en ? "Comparison period" : "비교 기간", exact: true });
    await dialog.getByLabel(en ? "Start date" : "시작일").fill("2026-08-19");
    await dialog.getByLabel(en ? "End date" : "종료일").fill("2026-08-25");
    await dialog.getByRole("button", { name: en ? "Apply" : "적용", exact: true }).click();
    await expect(page.locator("#ops-budget-title")).toBeVisible();
    await expect(page.getByRole("button", { name: en ? /^Comparison period/ : /^비교 기간/ })).toContainText("2026-08-19");
    await expect(page.locator(".dashboard-filter-bar .result-period-picker")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const audit = await new AxeBuilder({ page }).include(".operations-planner").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(audit.violations).toEqual([]);
    expect(errors).toEqual([]);
    await cap.selectOption("0.2");
    await expect(page.locator(".operations-brief__forecast")).not.toContainText("+0.0%");
    await page.locator(".result-action-card").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -90));
    await page.screenshot({ path: testInfo.outputPath("operations-layout.png") });
  });

  test(`operations planner: gaps keep observations and withhold forecasts (${locale})`, async ({ page }) => {
    const en = locale === "en";
    await openOperations(page, en, { gap: true });
    await page.locator(".operations-data > summary").click();
    await expect(page.locator(".operations-brief")).toContainText(en ? "Budget and improvement estimates withheld" : "예산·개선치 추정 보류");
    await expect(page.getByRole("table", { name: en ? "Recent efficiency by creative" : "소재별 최근 효율", exact: true })).toBeVisible();
    await expect(page.locator(".operations-brief__forecast")).toHaveCount(0);
  });

  test(`operations planner: short history withholds predictions and retains observed evidence (${locale})`, async ({ page }) => {
    const en = locale === "en";
    // 업로드 자격(14일)을 통과한 뒤 초기 2일만 분석한다. 뒤의 12일은 학습에 쓰면 안 된다.
    await openOperations(page, en, { days: 14 });
    await page.locator(".operations-planner__conditions > summary").click();
    await page.getByRole("button", { name: en ? /^Analysis period/ : /^분석 기간/ }).click();
    const dialog = page.getByRole("dialog", { name: en ? "Analysis period" : "분석 기간", exact: true });
    await dialog.getByLabel(en ? "Start date" : "시작일").fill("2026-07-01");
    await dialog.getByLabel(en ? "End date" : "종료일").fill("2026-07-02");
    await dialog.getByRole("button", { name: en ? "Apply" : "적용", exact: true }).click();
    const budget = page.locator(".operations-workbench__group--budget");
    await expect(budget).toContainText(en ? "Budget and improvement estimates withheld" : "예산·개선치 추정 보류");
    await expect(budget).toContainText(en ? "observations or model fit are insufficient" : "관측 수 또는 모형 적합도가 부족");
    await expect(budget.locator(".operations-brief__forecast, .operations-panel--allocation")).toHaveCount(0);
    await expect(budget.locator(".operations-comparison--single > .operations-panel--trend")).toBeVisible();
    await expect(page.locator(".operations-observed-queue tbody tr")).toHaveCount(2);
    await expect(page.locator("#ops-input-detail")).toContainText(en ? "Complete total" : "유효한 합계");
    await expect(budget.getByRole("button", { name: en ? /Define a budget action/ : /예산 조정 액션 정하기/ })).toHaveCount(0);
    const grid = await budget.locator(".operations-comparison--single").boundingBox();
    const trend = await budget.locator(".operations-panel--trend").boundingBox();
    expect(Math.abs(grid.width - trend.width), "observed trend uses the full column when predictions are withheld").toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test(`operations planner: saved plan, execution, review, follow-up and home (${locale})`, async ({ page }) => {
    const en = locale === "en";
    await enableReviewLogin(page);
    await openOperations(page, en);
    await page.getByRole("button", { name: en ? /Define an action for this campaign/ : /이 캠페인의 액션 정하기/ }).click();
    const editor = page.getByRole("dialog", { name: en ? "Define an operating action" : "운영 액션 정하기", exact: true });
    await expect(editor.getByLabel(en ? "Target" : "대상", { exact: true }).locator("option:checked")).toContainText("리타겟팅");
    await editor.getByLabel(en ? "Planned date" : "계획일", { exact: true }).fill("2026-08-20");
    await editor.getByRole("button", { name: en ? "Save action" : "액션 저장", exact: true }).click();
    await page.getByRole("checkbox", { name: en ? /Enable device storage/ : /이 기기에 리뷰 보관하기/ }).check();
    await confirmReviewDialog(page, en);
    await page.getByRole("tab", { name: en ? "Actions & reviews" : "지금 할 일", exact: true }).click();
    const queue = page.locator(".operations-queue");
    await queue.getByRole("button", { name: en ? /^In progress/ : /^진행 중/ }).click();
    await expect(queue.locator(".operations-queue__choice")).toHaveCount(1);
    await queue.getByRole("button", { name: en ? "Record execution" : "실행 기록", exact: true }).click();
    await editor.getByLabel(en ? "State" : "상태", { exact: true }).selectOption("executed");
    await editor.getByLabel(en ? "Actual execution date" : "실제 실행일", { exact: true }).fill("2026-08-21");
    await editor.getByRole("button", { name: en ? "Save action" : "액션 저장", exact: true }).click();
    await confirmReviewDialog(page, en);
    await queue.getByRole("button", { name: en ? /^Review results/ : /^검토할 결과/ }).click();
    await expect(queue.locator(".operations-queue__dates")).toContainText("2026-08-28");
    await queue.getByRole("button", { name: en ? "Review before/after" : "전후 검토", exact: true }).click();
    const review = page.getByRole("dialog", { name: en ? "Review after execution" : "실행 후 검토", exact: true });
    await expect(review).toContainText("2026-08-14 – 2026-08-20 → 2026-08-21 – 2026-08-27");
    await review.getByLabel(en ? "Review note" : "검토 메모").fill("Observed with concurrent changes");
    await review.getByRole("button", { name: en ? "Save observation" : "관측 결과 저장", exact: true }).click();
    await confirmReviewDialog(page, en);
    await queue.getByRole("button", { name: en ? /^Completed/ : /^완료/ }).click();
    await expect(queue.locator(".operations-queue__detail")).toContainText("Observed with concurrent changes");
    await queue.getByRole("button", { name: en ? "Follow-up" : "후속 액션", exact: true }).click();
    await editor.getByRole("button", { name: en ? "Save action" : "액션 저장", exact: true }).click();
    await confirmReviewDialog(page, en);
    await page.goto(en ? "/en" : "/");
    await expect(page.locator(".home-operations-actions")).toBeVisible();
    await expect(page.locator(".home-operations-actions")).toContainText("리타겟팅");
    await expect(page.locator(".dc-return")).toHaveCount(0);
    await page.locator(".home-operations-actions a").click();
    await expect(page).toHaveURL(/tools\/operations-planner$/);
    await expect(page.locator(".operations-queue")).toBeVisible();
  });

  test(`operations planner: results first, editable scope and keyboard actions (${locale})`, async ({ page }, testInfo) => {
    const en = locale === "en";
    await page.goto(`${en ? "/en" : ""}/tools/operations-planner?example=1`);
    const settings = page.locator(".operations-planner__conditions");
    const summary = settings.locator(":scope > summary");
    await expect(page.locator(".operations-queue")).toBeVisible();
    await expect(settings).not.toHaveAttribute("open");
    await expect(summary).toContainText("2026-09-30");
    await expect(summary).toContainText("2026-09-23");
    await expect(summary).toContainText(en ? "Fictional sample" : "가상 예시");
    await expect(summary).toContainText("CPI · KRW");
    await expect(settings.getByRole("button", { name: en ? /^Comparison period/ : /^비교 기간/ })).toBeHidden();
    const tabs = page.getByRole("tablist", { name: en ? "Operations planner views" : "운영 플래너 보기", exact: true });
    await tabs.getByRole("tab", { name: en ? "Actions & reviews" : "지금 할 일", exact: true }).press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: en ? "Full change history" : "전체 변화 이력", exact: true })).toBeFocused();
    await expect(page.getByRole("table", { name: en ? "Full change list" : "전체 변화 목록", exact: true })).toBeVisible();
    await tabs.getByRole("tab", { name: en ? "Full change history" : "전체 변화 이력", exact: true }).press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: en ? "Explore evidence" : "근거 살펴보기", exact: true })).toBeFocused();
    await expect(page.locator(".operations-data")).not.toHaveAttribute("open");
    await expect(page.locator(".operations-workbench canvas")).toHaveCount(7);
    await summary.press("Enter");
    await expect(settings).toHaveAttribute("open", "");
    const editData = settings.getByRole("button", { name: en ? "Change data or mapping" : "데이터·매핑 바꾸기", exact: true });
    await editData.click();
    const mapping = page.getByRole("dialog", { name: en ? "Edit data and mappings" : "데이터·매핑 편집", exact: true });
    await expect(mapping).toBeVisible();
    await mapping.getByRole("button", { name: en ? "Close" : "닫기", exact: true }).click();
    await expect(mapping).toBeHidden();
    await expect(editData).toBeFocused();
    await page.getByRole("radio", { name: en ? "14 days" : "14일", exact: true }).click();
    await expect(summary).toContainText("2026-09-23 – 2026-10-06");
    await expect(summary).toContainText("2026-09-09 – 2026-09-22");
    await expect(page.locator("#ops-budget-title")).toBeVisible();
    await settings.getByRole("button", { name: en ? /^Data scope/ : /^분석 대상/ }).click();
    const scope = page.locator(".recipe-scope-panel");
    await scope.getByRole("button", { name: "Meta", exact: true }).click();
    await scope.getByRole("button", { name: en ? "Done" : "완료", exact: true }).click();
    await expect(summary).toContainText(en ? "Channel Meta" : "채널 Meta");
    await expect(page.getByRole("combobox", { name: en ? "Select a campaign" : "캠페인 선택" }).locator("option")).toHaveCount(2);
    await settings.getByRole("button", { name: en ? /^Data scope/ : /^분석 대상/ }).click();
    await scope.getByRole("button", { name: en ? "Reset scope" : "대상 초기화", exact: true }).click();
    await scope.getByRole("button", { name: en ? "Done" : "완료", exact: true }).click();
    await expect(summary).toContainText(en ? "All entities" : "전체 대상");
    const originalPromise = page.waitForEvent("download");
    await settings.getByRole("button", { name: en ? "Download demo CSV" : "데모 원본 CSV", exact: true }).click();
    const original = await originalPromise;
    const exported = Papa.parse(await readFile(await original.path(), "utf8"), { header: true, skipEmptyLines: true });
    expect(exported.errors).toEqual([]);
    const recentSpend = exported.data.filter(row => row.Date >= "2026-09-23" && row.Date <= "2026-10-06").reduce((sum, row) => sum + Number(row.Cost), 0);
    await summary.press("Enter");
    await expect(settings).not.toHaveAttribute("open");
    await expect(summary).toBeFocused();
    await expect(page.locator(".result-action-card__stats")).toContainText(`₩${recentSpend.toLocaleString("en-US")}`);
    await page.locator(".operations-data > summary").press("Enter");
    await expect(page.getByRole("table", { name: en ? "Recent efficiency by creative" : "소재별 최근 효율", exact: true })).toBeVisible();
    await summary.press("Enter");
    const expanded = await measureDesignRules(page);
    expect(expanded.nested, "expanded settings and tables must retain the shared surface hierarchy").toEqual([]);
    expect(expanded.overlaps).toEqual([]);
    expect(expanded.hugging).toEqual([]);
    expect(expanded.misaligned).toEqual([]);
    expect(expanded.figureCrowding).toEqual([]);
    await summary.press("Enter");
    await page.locator(".operations-data > summary").press("Enter");
    await tabs.getByRole("tab", { name: en ? "Explore evidence" : "근거 살펴보기", exact: true }).press("Home");
    await expect(page.locator(".operations-queue")).toBeVisible();
    if (testInfo.project.name === "desktop-1440") {
      await page.locator(".operations-planner__conditions > summary").scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("operations-result-first.png") });
    }
    expect((await new AxeBuilder({ page }).include(".operations-planner").withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  });
}

test("operations planner daily chart exports a real PNG with paid access", async ({ page }) => {
  const entitlement = { plan: "paid", account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 };
  await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, account: { id: "planner-test", email: "planner@example.com" }, entitlement } }));
  await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement } }));
  await page.goto("/tools/operations-planner?example=1");
  await page.getByRole("tab", { name: "근거 살펴보기", exact: true }).click();
  const figure = page.locator(".operations-trend");
  await expect(figure).toBeVisible();
  await expect(figure).toContainText("2026-07-01");
  await expect(figure).toContainText("2026-10-06");
  const downloadPromise = page.waitForEvent("download");
  await figure.getByRole("button", { name: "PNG 받기", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^operations_daily_unit_cost_\d{4}-\d{2}-\d{2}\.png$/);
  const png = await readFile(await download.path());
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.readUInt32BE(16)).toBeGreaterThan(200);
  expect(png.readUInt32BE(20)).toBeGreaterThan(200);
});
