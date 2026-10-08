import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { enablePaidReports } from "./support/paidReports";
import { SOURCE_SURVEY_ANSWERED_KEY } from "./support/sourceSurvey";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, "1"), SOURCE_SURVEY_ANSWERED_KEY);
});
for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "";
  test(`multi-touch example filters and real worker (${locale})`, async ({ page }) => {
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${prefix}/tools/multitouch-map?example=1`);
    await expect(page.locator(".result-action-card")).toBeVisible();
    // Inclusion-exclusion: 2400*(1/3+1/4+1/5-1/12-1/15-1/20+1/60)=1440.
    await expect(page.getByRole("heading", { name: en ? "1,440 installs with recorded contributing clicks" : "추가 클릭 접촉이 기록된 설치 1,440건" })).toBeVisible();
    await expect(page).not.toHaveURL(/example=1/);
    const startInput = page.getByRole("textbox", { name: en ? "Install start date" : "설치 시작일", exact: true });
    const endInput = page.getByRole("textbox", { name: en ? "Install end date" : "설치 종료일", exact: true });
    await expect(startInput).toHaveValue("2026-09-01"); await expect(endInput).toHaveValue("2026-09-28");
    await startInput.fill("2026-08-31"); await startInput.press("Enter");
    await expect(startInput).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".result-action-card__headline")).toContainText("1,440");
    await startInput.press("Escape");
    await endInput.fill("2026-09-29"); await endInput.press("Enter");
    await expect(endInput).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".result-action-card__headline")).toContainText("1,440");
    await endInput.press("Escape");
    await expect(page.getByRole("table", { name: "CTIT", exact: true })).toHaveCount(0);
    await page.getByRole("radio", { name: en ? "Conversion timing" : "전환 시간", exact: true }).click();
    const ctit = page.getByRole("table", { name: "CTIT", exact: true }), original = await ctit.innerText();
    await page.getByRole("combobox", { name: "Probabilistic", exact: true }).selectOption("true");
    await expect(page.getByRole("heading", { name: en ? "960 installs with recorded contributing clicks" : "추가 클릭 접촉이 기록된 설치 960건" })).toBeVisible();
    expect(await ctit.innerText()).toBe(original);
    await page.getByRole("combobox", { name: en ? "Meta/TikTok placement" : "Meta·TikTok 지면", exact: true }).selectOption("true");
    await page.getByRole("radio", { name: en ? "Media & campaigns" : "매체·캠페인", exact: true }).click();
    await expect(page.getByRole("table", { name: en ? "Multi-touch by media" : "매체별 멀티터치" })).toContainText("TikTok · Pangle");
    const date = page.getByRole("textbox", { name: en ? "Install start date" : "설치 시작일", exact: true });
    await date.fill("2026-09-28"); await date.press("Enter");
    await page.getByRole("radio", { name: en ? "Conversion timing" : "전환 시간", exact: true }).click();
    await expect(page.getByRole("table", { name: "CTIT", exact: true })).toBeVisible();
    await expect(page.getByLabel(en ? "Install start date calendar" : "설치 시작일 달력", { exact: true })).toHaveAttribute("min", "2026-09-01");
    await expect(page.getByLabel(en ? "Install end date calendar" : "설치 종료일 달력", { exact: true })).toHaveAttribute("max", "2026-09-28");
    await expect(page.locator(".result-action-card__stats")).not.toContainText("2,400");
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const a11y = await new AxeBuilder({ page }).include(".report-results").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(a11y.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  });
  test(`cannibal detail preserves its CSV when switching views (${locale})`, async ({ page }) => {
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${prefix}/tools/cannibalization-diagnosis/detail?example=1`);
    await expect(page.locator(".result-action-card")).toBeVisible();
    const table = page.getByRole("table", { name: en ? "Detected stretches" : "탐지 구간", exact: true });
    await expect(table.locator("tbody tr")).toHaveCount(4);
    await table.getByRole("button", { name: en ? "Exclude stretch" : "구간 제외", exact: true }).first().click();
    await expect(table.locator("tbody tr")).toHaveCount(3);
    await page.getByRole("link", { name: en ? "Spend-based signals" : "지출 기반 신호", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("cannibalization-diagnosis$"));
    await page.getByRole("link", { name: en ? "Weekly campaign detail" : "주간 캠페인 상세", exact: true }).click();
    await expect(page.locator(".report-input")).toContainText("demo_cannibal_detail.csv");
    await expect(page.getByRole("table", { name: en ? "Detected stretches" : "탐지 구간", exact: true }).locator("tbody tr")).toHaveCount(3);
    expect(errors).toEqual([]);
    const a11y = await new AxeBuilder({ page }).include(".report-results").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(a11y.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  });
}
test("native CSV upload needs confirmation and a same-shaped replacement closes the gate", async ({ page }) => {
  await page.goto("/tools/multitouch-map");
  const headers = "AppsFlyer ID,Install Time,Attributed Touch Type,Attributed Touch Time,Media Source,Contributor 1 Media Source,Contributor 1 Touch Type,Contributor 1 Touch Time,Contributor 1 Match Type";
  const content = `${headers}\r\nprivate-fixture-id,2026-09-01 12:00:00,click,2026-09-01 11:50:00,tiktokglobal_int,facebook_int,click,2026-09-01 11:00:00,SRN\r\n`;
  const leaked = [];
  page.on("request", request => { if ((request.postData() || "").includes("private-fixture-id")) leaked.push(request.url()); });
  const input = page.locator(".report-input input[type=file]");
  await expect(input).toBeEnabled();
  await input.setInputFiles({ name: "raw.csv", mimeType: "text/csv", buffer: Buffer.from(content) });
  await expect(page.getByRole("button", { name: "데이터 분석하기", exact: true })).toBeEnabled();
  await expect(page.locator(".result-action-card")).toHaveCount(0);
  await page.getByRole("button", { name: "데이터 분석하기", exact: true }).click();
  await page.getByRole("radio", { name: "전환 시간", exact: true }).click();
  await expect(page.getByRole("table", { name: "CTIT", exact: true })).toContainText("10.0");
  await input.setInputFiles({ name: "raw.csv", mimeType: "text/csv", buffer: Buffer.from(content.replace("11:50:00", "11:40:00")) });
  await expect(page.locator(".result-action-card")).toHaveCount(0);
  await page.getByRole("button", { name: "데이터 분석하기", exact: true }).click();
  await expect(page.getByRole("table", { name: "CTIT", exact: true })).toContainText("20.0");
  await page.getByRole("button", { name: "컬럼 확인·수정", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "파일의 열 확인" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "컬럼 확인·수정", exact: true })).toBeFocused();
  expect(leaked).toEqual([]);
});
test("report previews and PNG exports are available after the example", async ({ page }) => {
  await enablePaidReports(page);
  await page.goto("/tools/multitouch-map?example=1");
  await expect(page.locator(".result-action-card")).toBeVisible();
  await page.getByRole("button", { name: "내 보고서 미리보기 · 무료", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("radio", { name: "접촉 경로", exact: true }).click();
  await page.getByRole("button", { name: /PNG 받기/ }).first().click();
  const png = await download;
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  await png.saveAs(test.info().outputPath("multitouch-flow.png"));
  await page.locator(".result-action-card").getByRole("button", { name: "결과 받기", exact: true }).click();
  const workbookDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /상세 워크북/ }).click();
  const workbook = await workbookDownload;
  const bytes = await readFile(await workbook.path()), book = XLSX.read(bytes, { type: "buffer" });
  const mediaName = book.SheetNames.find(name => name.endsWith("_MEDIA") || name === "MEDIA");
  expect(mediaName).toBeTruthy();
  const rows = XLSX.utils.sheet_to_json(book.Sheets[mediaName], { header: 1 });
  expect(rows.some(row => row.includes(600))).toBe(true);
});
test("100,000 native rows are parsed and aggregated in browser workers", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/tools/multitouch-map");
  const input = page.locator(".report-input input[type=file]");
  await expect(input).toBeEnabled();
  const header = "AppsFlyer ID,Install Time,Attributed Touch Type,Attributed Touch Time,Media Source,Contributor 1 Media Source,Contributor 1 Touch Type,Contributor 1 Touch Time,Contributor 1 Match Type";
  const records = Array.from({ length: 100000 }, (_, n) => `load-fixture-${n},2026-09-01 12:00:00,click,2026-09-01 11:50:00,tiktokglobal_int,facebook_int,click,2026-09-01 11:00:00,SRN`);
  await input.setInputFiles({ name: "large.csv", mimeType: "text/csv", buffer: Buffer.from([header, ...records].join("\r\n")) });
  await expect(page.getByRole("button", { name: "데이터 분석하기", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "데이터 분석하기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "추가 클릭 접촉이 기록된 설치 100,000건" })).toBeVisible();
  await page.getByRole("radio", { name: "전환 시간", exact: true }).click();
  await expect(page.getByRole("table", { name: "CTIT", exact: true })).toContainText("100,000");
  await expect(page.getByRole("table", { name: "CTIT", exact: true })).toContainText("10.0");
});
test("report layouts keep the page within 320, 980 and 1440 pixels", async ({ page }) => {
  for (const width of [320, 980, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["/tools/multitouch-map", "/en/tools/cannibalization-diagnosis/detail"]) {
      await page.goto(path + "?example=1");
      await expect(page.locator(".result-action-card")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} at ${width}px`).toBe(true);
      expect(await page.locator(".report-panel").first().evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgb(255, 255, 255)");
      if (path.includes("multitouch")) {
        for (const name of ["채널 겹침", "접촉 경로", "전환 시간"]) {
          await page.getByRole("radio", { name, exact: true }).click();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} at ${width}px`).toBe(true);
          const a11y = await new AxeBuilder({ page }).include(".report-results").withTags(["wcag2a", "wcag2aa"]).analyze();
          expect(a11y.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
        }
      }
    }
  }
});
test("all multi-touch views retain accessible contrast in the dark theme", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mkt-library-theme", "dark"));
  await page.goto("/en/tools/multitouch-map?example=1");
  await expect(page.locator(".result-action-card")).toBeVisible();
  for (const name of ["Media & campaigns", "Channel overlap", "Touch paths", "Conversion timing"]) {
    await page.getByRole("radio", { name, exact: true }).click();
    const a11y = await new AxeBuilder({ page }).include(".report-results").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(a11y.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  }
});
