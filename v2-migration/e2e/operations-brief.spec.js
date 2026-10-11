import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import Papa from "papaparse";
import { enableReviewLogin, confirmReviewDialog } from "./support/reviewSave";
import { measureDesignRules } from "./support/designRules";

function csvFixture({ gap = false } = {}) {
  const lines = ["Date,Country,Platform,Channel,Campaign,Creative,Cost,Installs,Impressions,Clicks"];
  for (let day = 0; day < 70; day++) for (let campaign = 0; campaign < 2; campaign++) {
    const date = new Date(Date.UTC(2026, 6, 1 + day)).toISOString().slice(0, 10);
    if (gap && day === 67 && campaign === 1) continue;
    const cost = 100000 + day % 11 * 14000;
    const installs = cost / ((campaign ? 1800 : 600) + cost * (campaign ? 0.006 : 0.001));
    const name = campaign ? "리타기팅 · 기존 구매자 재방문" : "신규 유입 · 제품 사용 장면";
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
  await expect(page.locator("#ops-budget-title")).toBeVisible();
}

for (const locale of ["ko", "en"]) {
  test(`operations planner: home demo, computed evidence and original CSV (${locale})`, async ({ page }, testInfo) => {
    const en = locale === "en", errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(theme => localStorage.setItem("mkt-library-theme", theme), en ? "light" : "dark");
    await page.goto(en ? "/en" : "/");
    const actions = page.locator(".dc-action-route");
    await expect(actions.first()).toHaveAttribute("href", `${en ? "/en" : ""}/tools/operations-planner`);
    const previewCpi = (await page.locator(".operations-sample-preview__metric strong").textContent()).split("→").at(-1).trim();
    await page.screenshot({ path: testInfo.outputPath("operations-home.png") });
    await page.getByRole("link", { name: en ? /Try the operations planner/ : /운영 플래너 데모 보기/ }).click();
    await expect(page.locator("#ops-budget-title")).toBeVisible();
    await expect(page.locator(".operations-planner__demo")).toContainText(en ? "98 days" : "98일");
    await expect(page.locator(".result-action-card__stats")).toContainText(previewCpi);
    await expect(page.locator(".operations-new-creatives")).toContainText(en ? "Customer review video" : "고객 후기 영상");
    await expect(page.locator(".operations-workbench canvas")).toHaveCount(6);
    if (testInfo.project.use.viewport.width > 1100) {
      const budgetHeading = await page.locator("#ops-budget-title").boundingBox();
      const trendHeading = await page.locator("#ops-trend-title").boundingBox();
      expect(Math.abs(budgetHeading.y - trendHeading.y), "paired task headings share a top edge").toBeLessThanOrEqual(1);
      const figureHeads = await page.locator(".operations-decomposition-grid .section-head").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().bottom));
      expect(Math.abs(figureHeads[0] - figureHeads[1]), "stage and mix plots start below aligned figure headers").toBeLessThanOrEqual(1);
    }
    await expect(page.locator(".operations-brief__forecast")).toContainText("3.5%");
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
    await page.getByRole("button", { name: en ? /Follow up on this creative next week/ : /이 소재를 다음 주에도 확인/ }).click();
    await expect(page.locator(".operations-review-plan")).toContainText(en ? "Customer review video" : "고객 후기 영상");
    await expect(page.locator(".operations-review-plan")).toContainText("₩841");
    await expect(page.locator(".operations-review-demo")).toBeVisible();
    await expect(page.locator(".decision-review-launch")).toHaveCount(0);
    await page.locator("#ops-review").evaluate(node => node.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.screenshot({ path: testInfo.outputPath("operations-review.png") });
    await page.locator(".operations-planner__conditions > summary").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: en ? "Download demo CSV" : "데모 원본 CSV", exact: true }).click();
    const download = await downloadPromise;
    const csv = Papa.parse(await readFile(await download.path(), "utf8"), { header: true, skipEmptyLines: true });
    expect(csv.errors).toEqual([]);
    expect(new Set(csv.data.map(row => row.Date)).size).toBe(98);
    expect(new Set(csv.data.map(row => row["Campaign ID"])).size).toBe(4);
    expect(csv.data.length).toBe(406);
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

  test(`operations planner: chart decision saved and opened in weekly review (${locale})`, async ({ page }) => {
    const en = locale === "en";
    await enableReviewLogin(page);
    await openOperations(page, en);
    await page.getByRole("button", { name: en ? /Review this campaign next week/ : /이 캠페인 점검을 주간 리뷰로/ }).click();
    await page.locator(".decision-review-launch").click();
    const editor = page.getByRole("dialog", { name: en ? "Make it my next marketing project" : "다음 마케팅 프로젝트로 만들기", exact: true });
    await expect(editor.getByLabel(en ? "Target" : "대상", { exact: true })).toHaveValue(/리타기팅/);
    await expect(editor).toContainText(en ? "no automatic outcome match" : "자동 실제값 대조는 제공하지 않습니다");
    await editor.getByRole("switch", { name: en ? "Store source files and decision records on this device" : "원본 파일과 결정 기록을 이 기기에 저장", exact: true }).check();
    await editor.getByRole("button", { name: en ? "Create it" : "이대로 만들기", exact: true }).click();
    await confirmReviewDialog(page, en);
    await page.getByRole("link", { name: en ? "Open Weekly review" : "주간 리뷰 열기", exact: true }).click();
    await expect(page).toHaveURL(/weekly-review#wr-history$/);
    await expect(page.locator("#wr-history")).toContainText("리타기팅");
    await expect(page.locator(".header-data-context")).toContainText("synthetic-operations.csv");
    await page.locator("#wr-history").getByRole("button", { name: /2026-09-15.*리타기팅/ }).click();
    const review = page.getByRole("dialog", { name: /리타기팅/ });
    await expect(review).toContainText("2026-09-08");
    await expect(review).toContainText("CPI");
    await expect(review.getByRole("link", { name: en ? /Operations planner/ : /운영 플래너/ })).toHaveAttribute("href", /tools\/operations-planner/);
  });

  test(`operations planner: results first, editable scope and keyboard actions (${locale})`, async ({ page }, testInfo) => {
    const en = locale === "en";
    await page.goto(`${en ? "/en" : ""}/tools/operations-planner?example=1`);
    const settings = page.locator(".operations-planner__conditions");
    const summary = settings.locator(":scope > summary");
    await expect(page.locator("#ops-budget-title")).toBeVisible();
    await expect(settings).not.toHaveAttribute("open");
    await expect(summary).toContainText("2026-09-30");
    await expect(summary).toContainText("2026-09-23");
    await expect(summary).toContainText(en ? "Fictional sample" : "가상 예시");
    await expect(summary).toContainText("CPI · KRW");
    await expect(settings.getByRole("button", { name: en ? /^Comparison period/ : /^비교 기간/ })).toBeHidden();
    await expect(page.locator(".operations-data")).not.toHaveAttribute("open");
    await expect(page.locator(".operations-workbench canvas")).toHaveCount(6);
    const nav = page.getByRole("navigation", { name: en ? "Results and next actions" : "결과와 다음 행동" });
    for (const [name, id] of [[en ? /Inspect budget plan/ : /예산안 확인/, "ops-budget-title"], [en ? /Inspect campaign changes/ : /캠페인 변화 확인/, "ops-campaign"], [en ? /Compare new creatives/ : /새 소재 비교/, "ops-new-title"], [en ? /Prepare weekly review/ : /주간 리뷰 준비/, "ops-review-title"]]) {
      await nav.getByRole("link", { name }).press("Enter");
      await expect(page.locator(`#${id}`)).toBeFocused();
    }
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
    await summary.press("Enter");
    await expect(settings).not.toHaveAttribute("open");
    await expect(summary).toBeFocused();
    await expect(page.locator(".result-action-card__stats")).toContainText("₩10,688,000");
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
    await nav.getByRole("link", { name: en ? /Inspect budget plan/ : /예산안 확인/ }).press("Enter");
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
