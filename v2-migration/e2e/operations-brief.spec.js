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
  await expect(page.locator("#ops-plan-title")).toBeVisible();
}

for (const locale of ["ko", "en"]) {
  test(`operations planner: home demo, computed evidence and original CSV (${locale})`, async ({ page }, testInfo) => {
    const en = locale === "en", errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(theme => localStorage.setItem("mkt-library-theme", theme), en ? "light" : "dark");
    await page.goto(en ? "/en" : "/");
    // The primary CTA opens the real planner, with the forecast above execution tabs.
    const entry = page.locator(".home-planner-entry .primary");
    await expect(entry).toHaveAttribute("href", `${en ? "/en" : ""}/tools/operations-planner?example=1`);
    const previewCpi = (await page.locator(".operations-sample-preview__metric strong").textContent()).split("→").at(-1).trim();
    await entry.click();
    await expect(page.locator("#ops-plan-title")).toBeVisible();
    await expect(page.locator(".ops-plan-impact")).toHaveText(/\+[\d.]+%/);
    await expect(page.locator(".ops-creative-choices button")).toHaveCount(6);
    const summary = await page.locator(".ops-plan-summary").boundingBox();
    const execution = await page.locator("#ops-execution-title").boundingBox();
    expect(summary.y + summary.height).toBeLessThan(execution.y);
    if (testInfo.project.use.viewport.width > 1100) {
      const sides = await page.locator(".ops-transfer__side").evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect();
        return { x: box.x, right: box.right, width: box.width, rows: [...node.querySelectorAll("button")].map(button => ({ top: button.getBoundingClientRect().top, height: button.getBoundingClientRect().height })) };
      }));
      expect(Math.abs(sides[0].width - sides[1].width)).toBeLessThanOrEqual(1);
      const arrow = await page.locator(".ops-transfer__arrow").boundingBox();
      expect(Math.abs(arrow.x + arrow.width / 2 - (sides[0].right + sides[1].x) / 2)).toBeLessThanOrEqual(1);
      expect(sides[0].rows).toEqual(sides[1].rows);
    }
    await page.getByRole("button", { name: en ? /Inspect observations over time/ : /날짜 흐름으로 관측 확인/ }).click();
    const trendDialog = page.getByRole("dialog", { name: en ? "Observation details" : "관측 근거 상세", exact: true });
    const figureHeader = trendDialog.locator(".figure-head");
    const titleBounds = await figureHeader.locator("h3").boundingBox();
    const pngButton = figureHeader.getByRole("button", { name: en ? "Download PNG" : "PNG 받기", exact: true });
    const pngBounds = await pngButton.boundingBox();
    expect(pngBounds.x - titleBounds.x - titleBounds.width).toBeGreaterThanOrEqual(11);
    await pngButton.scrollIntoViewIfNeeded();
    await pngButton.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("tooltip")).toContainText(en ? "Purchased pass required" : "구매 이용권 필요");
    await page.keyboard.press("Escape");
    const trendControls = trendDialog.getByRole("radiogroup", { name: en ? "Trend metric" : "추세 지표" });
    await trendControls.getByRole("radio", { name: "CPI", exact: true }).press("ArrowRight");
    await expect(trendDialog.locator("canvas")).toHaveAttribute("aria-label", en ? "Observed Spend by interval" : "기간별 실측 광고비");
    await trendControls.getByRole("radio", { name: en ? "Spend" : "광고비", exact: true }).press("Home");
    await expect(trendControls.getByRole("radio", { name: "CPI", exact: true })).toBeFocused();
    await trendDialog.getByRole("button", { name: en ? "Close" : "닫기", exact: true }).click();
    await page.locator(".ops-creative-choices button").filter({ hasText: en ? "Customer review video" : "고객 후기 영상" }).click();
    const baseline = await page.locator(".ops-creative-metric strong").textContent();
    await expect(page.locator(".ops-creative-detail")).toContainText("2026-09-30 – 2026-10-06");
    await page.getByRole("button", { name: en ? /Plan the next action for this creative/ : /이 소재의 다음 액션 정하기/ }).click();
    const action = page.getByRole("dialog", { name: en ? "Define an operating action" : "운영 액션 정하기", exact: true });
    await expect(action.getByLabel(en ? "Creative name / ID" : "소재 이름 / ID", { exact: true })).toHaveValue(en ? "Customer review video" : "고객 후기 영상");
    await expect(action.getByRole("button", { name: en ? "Save action" : "액션 저장", exact: true })).toBeDisabled();
    await expect(action.getByRole("combobox", { name: en ? "Action" : "할 일", exact: true })).toHaveValue("investigate");
    await action.getByRole("button", { name: en ? "Close" : "닫기", exact: true }).click();
    await page.getByRole("button", { name: en ? "File, scope & metric" : "파일·대상·지표 변경", exact: true }).click();
    await expect(page.locator(".operations-planner__demo")).toContainText(en ? "98 days" : "98일");
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
    await page.getByRole("button", { name: en ? "Back to results" : "결과로 돌아가기", exact: true }).click();
    await page.getByRole("tab", { name: en ? "Detailed data & export" : "상세 데이터·내보내기", exact: true }).click();
    await expect(page.locator(".result-action-card__stats")).toContainText(previewCpi);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect((await new AxeBuilder({ page }).include(".operations-planner").withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
    await page.locator(".ops-plan").screenshot({ path: testInfo.outputPath("operations-demo.png") });
  });

  test(`operations planner: real upload, budget cap, evidence and accessibility (${locale})`, async ({ page }, testInfo) => {
    const en = locale === "en", errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await openOperations(page, en);
    await page.getByRole("tab", { name: en ? "Detailed data & export" : "상세 데이터·내보내기", exact: true }).click();
    await expect(page.getByRole("region", { name: en ? "Budget and efficiency by entity" : "대상별 예산과 효율", exact: true })).toBeVisible();
    await expect(page.locator(".ops-allocation")).toContainText("CPI");
    await expect(page.locator(".ops-allocation")).not.toContainText("CPA");
    await expect(page.getByRole("textbox", { name: en ? "Total for this period" : "기간 전체 예산", exact: true })).toHaveValue("2,324,000");
    const cap = page.getByRole("slider", { name: en ? "Change limit per campaign" : "캠페인별 변경 한도", exact: true });
    await cap.fill("0");
    await expect(page.locator(".ops-plan-impact")).toHaveText("0.0%");
    const table = page.getByRole("table", { name: en ? "Budget and efficiency by entity" : "대상별 예산과 효율", exact: true });
    for (const row of await table.locator("tbody tr").all()) {
      const cells = await row.locator("td").allTextContents();
      expect(cells[1]).toBe(cells[2]);
    }
    await page.getByRole("combobox", { name: en ? "Select campaign" : "캠페인 선택", exact: true }).selectOption({ label: "신규 유입 · 제품 사용 장면 · KR · iOS · Meta" });
    await expect(page.locator("#ops-diagnosis-title")).toContainText("신규 유입");
    await expect(page.locator(".pvm-stage-analysis")).toBeVisible();
    const creative = page.getByRole("table", { name: en ? "Recent efficiency by creative" : "소재별 최근 효율", exact: true });
    await expect(creative).toContainText("이번 주 추가로 관측된 후기 소재");
    await expect(creative).toContainText("2026-09-02");
    await page.getByRole("button", { name: en ? /^Comparison period/ : /^비교 기간/ }).click();
    const dialog = page.getByRole("dialog", { name: en ? "Comparison period" : "비교 기간", exact: true });
    await dialog.getByLabel(en ? "Start date" : "시작일").fill("2026-08-19");
    await dialog.getByLabel(en ? "End date" : "종료일").fill("2026-08-25");
    await dialog.getByRole("button", { name: en ? "Apply" : "적용", exact: true }).click();
    await expect(page.getByRole("button", { name: en ? /^Comparison period/ : /^비교 기간/ })).toContainText("2026-08-19");
    await expect(page.locator(".dashboard-filter-bar .result-period-picker")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect((await new AxeBuilder({ page }).include(".operations-planner").withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
    await cap.fill("20");
    await expect(page.locator(".ops-plan-impact")).not.toHaveText("0.0%");
    await page.locator(".ops-plan").screenshot({ path: testInfo.outputPath("operations-layout.png") });
  });

  test(`operations planner: gaps keep observations and withhold forecasts (${locale})`, async ({ page }) => {
    const en = locale === "en";
    await openOperations(page, en, { gap: true });
    await expect(page.locator(".ops-plan-held")).toContainText(en ? "No budget proposal" : "예산 제안을 보류");
    await expect(page.locator(".ops-creative-choices button")).toHaveCount(3);
    await expect(page.locator(".ops-plan-impact")).toHaveCount(0);
    await page.getByRole("tab", { name: en ? "Detailed data & export" : "상세 데이터·내보내기", exact: true }).click();
    await expect(page.getByRole("table", { name: en ? "Recent efficiency by creative" : "소재별 최근 효율", exact: true })).toBeVisible();
  });

  test(`operations planner: short history withholds predictions and retains observed evidence (${locale})`, async ({ page }) => {
    const en = locale === "en";
    // 업로드 자격(14일)을 통과한 뒤 초기 2일만 분석한다. 뒤의 12일은 학습에 쓰면 안 된다.
    await openOperations(page, en, { days: 14 });
    await page.getByRole("button", { name: en ? /^Analysis period/ : /^분석 기간/ }).click();
    const dialog = page.getByRole("dialog", { name: en ? "Analysis period" : "분석 기간", exact: true });
    await dialog.getByLabel(en ? "Start date" : "시작일").fill("2026-07-01");
    await dialog.getByLabel(en ? "End date" : "종료일").fill("2026-07-02");
    await dialog.getByRole("button", { name: en ? "Apply" : "적용", exact: true }).click();
    await expect(page.locator(".ops-plan-held")).toContainText(en ? "observations or model fit are insufficient" : "관측 수 또는 모형 적합도가 부족");
    await expect(page.locator(".ops-plan-impact, .ops-allocation")).toHaveCount(0);
    await expect(page.locator(".ops-evidence")).toContainText("2026-07-01 – 2026-07-02");
    await page.getByRole("button", { name: en ? "Inspect inputs and detailed data" : "입력·상세 데이터 확인", exact: true }).click();
    await expect(page.locator("#ops-input-detail")).toContainText(en ? "Complete total" : "유효한 합계");
    await page.getByRole("dialog").getByRole("button", { name: en ? "Close" : "닫기", exact: true }).click();
    await expect(page.getByRole("button", { name: en ? /^Save selected plan/ : /^선택한 계획 저장/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test(`operations planner: saved plan, execution, review, follow-up and home (${locale})`, async ({ page }) => {
    const en = locale === "en";
    await enableReviewLogin(page);
    await openOperations(page, en);
    await page.getByRole("button", { name: en ? /Plan an action for this campaign/ : /이 캠페인의 액션 정하기/ }).click();
    const editor = page.getByRole("dialog", { name: en ? "Define an operating action" : "운영 액션 정하기", exact: true });
    await expect(editor.getByRole("combobox", { name: en ? "Target" : "대상", exact: true }).locator("option:checked")).toContainText("리타겟팅");
    await editor.getByLabel(en ? "Planned date" : "계획일", { exact: true }).fill("2026-08-20");
    await editor.getByRole("button", { name: en ? "Save action" : "액션 저장", exact: true }).click();
    // 기기 저장은 기본으로 켜져 있다. 실제 저장 대화상자의 확인과 완료를 밟는다.
    await confirmReviewDialog(page, en);
    await page.getByRole("tab", { name: en ? "Execution & next review" : "실행과 다음 검토", exact: true }).click();
    const queue = page.locator(".operations-queue");
    await queue.getByRole("button", { name: en ? /^In progress/ : /^진행 중/ }).click();
    await expect(queue.locator(".operations-queue__choice")).toHaveCount(1);
    await queue.getByRole("button", { name: en ? "Record execution" : "실행 기록", exact: true }).click();
    await editor.getByRole("combobox", { name: en ? "State" : "상태", exact: true }).selectOption("executed");
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
    const navigation = page.locator(".header-sidebar-toggle");
    if (await navigation.getAttribute("aria-haspopup") === "dialog") await navigation.click();
    await page.locator(`.library-nav-item[href="${en ? "/en" : "/"}"]`).click();
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
    const settingsButton = page.getByRole("button", { name: en ? "File, scope & metric" : "파일·대상·지표 변경", exact: true });
    const context = page.locator(".ops-analysis-context");
    await expect(page.locator(".operations-queue")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(context).toContainText("2026-09-30");
    await expect(context).toContainText("2026-09-23");
    await expect(context).toContainText(en ? "Fictional sample" : "가상 예시");
    await expect(context).toContainText("CPI · KRW");
    const tabs = page.getByRole("tablist", { name: en ? "Operations planner views" : "운영 플래너 보기", exact: true });
    await tabs.getByRole("tab", { name: en ? "Execution & next review" : "실행과 다음 검토", exact: true }).press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: en ? "Full change history" : "전체 변화 이력", exact: true })).toBeFocused();
    await expect(page.getByRole("table", { name: en ? "Full change list" : "전체 변화 목록", exact: true })).toBeVisible();
    await tabs.getByRole("tab", { name: en ? "Full change history" : "전체 변화 이력", exact: true }).press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: en ? "Detailed data & export" : "상세 데이터·내보내기", exact: true })).toBeFocused();
    await expect(page.getByRole("table", { name: en ? "Recent efficiency by creative" : "소재별 최근 효율", exact: true })).toBeVisible();
    await settingsButton.press("Enter");
    const settings = page.getByRole("dialog", { name: en ? "File and analysis scope" : "파일·분석 대상 설정", exact: true });
    await expect(settings).toBeVisible();
    await settings.getByRole("button", { name: en ? "Back to results" : "결과로 돌아가기", exact: true }).click();
    await expect(settings).toBeHidden();
    await expect(settingsButton).toBeFocused();
    await page.getByRole("radio", { name: en ? "14 days" : "14일", exact: true }).click();
    await expect(context).toContainText("2026-09-23 – 10-06");
    await expect(context).toContainText("2026-09-09 – 09-22");
    const channels = page.getByRole("group", { name: en ? "Channels included in the analysis" : "분석에 포함할 매체", exact: true });
    await channels.getByRole("button", { name: /Google/ }).click();
    await channels.getByRole("button", { name: /TikTok/ }).click();
    await expect(page.getByRole("combobox", { name: en ? "Select campaign" : "캠페인 선택", exact: true }).locator("option")).toHaveCount(2);
    await channels.getByRole("button", { name: en ? "Include all" : "전체 포함", exact: true }).click();
    await expect(page.getByRole("combobox", { name: en ? "Select campaign" : "캠페인 선택", exact: true }).locator("option")).toHaveCount(4);
    await settingsButton.click();
    const originalPromise = page.waitForEvent("download");
    await settings.getByRole("button", { name: en ? "Download demo CSV" : "데모 원본 CSV", exact: true }).click();
    const original = await originalPromise;
    const exported = Papa.parse(await readFile(await original.path(), "utf8"), { header: true, skipEmptyLines: true });
    expect(exported.errors).toEqual([]);
    const recentSpend = exported.data.filter(row => row.Date >= "2026-09-23" && row.Date <= "2026-10-06").reduce((sum, row) => sum + Number(row.Cost), 0);
    await settings.getByRole("button", { name: en ? "Back to results" : "결과로 돌아가기", exact: true }).click();
    await expect(page.locator(".result-action-card__stats")).toContainText(`₩${recentSpend.toLocaleString("en-US")}`);
    const expanded = await measureDesignRules(page);
    expect(expanded.nested).toEqual([]);
    expect(expanded.overlaps).toEqual([]);
    expect(expanded.hugging).toEqual([]);
    expect(expanded.misaligned).toEqual([]);
    expect(expanded.figureCrowding).toEqual([]);
    await tabs.getByRole("tab", { name: en ? "Detailed data & export" : "상세 데이터·내보내기", exact: true }).press("Home");
    await expect(page.locator(".operations-queue")).toBeVisible();
    if (testInfo.project.name === "desktop-1440") await page.locator(".ops-plan").screenshot({ path: testInfo.outputPath("operations-result-first.png") });
    expect((await new AxeBuilder({ page }).include(".operations-planner").withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  });
}

test("operations planner daily chart exports a real PNG with paid access", async ({ page }) => {
  const entitlement = { plan: "paid", account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 };
  await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, account: { id: "planner-test", email: "planner@example.com" }, entitlement } }));
  await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement } }));
  await page.goto("/tools/operations-planner?example=1");
  await page.getByRole("button", { name: /날짜 흐름으로 관측 확인/ }).click();
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
