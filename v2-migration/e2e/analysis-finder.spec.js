import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { finderCards, finderSituations } from "../src/lib/finder/analysisFinder";
import { measureDesignRules } from "./support/designRules";

// 분석 찾기(/start) — 홈 목록·내 데이터로 시작·분석 방법 둘러보기·/data-guide를 합친 화면(product-ssot §1.1c).
// 옛 data-guide e2e의 의도(홈 → 데이터 준비 → 양식 → 도구, 테마·접근성, 비교 방식 유지)를 그대로 옮겼다.
for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "";
  const budget = finderSituations(locale).find((item) => item.id === "budget");
  const allocation = finderCards(locale).find((card) => card.id === "5-3");

  test(`home situation to preparation, CSV and analysis (${locale})`, async ({ page }) => {
    const events = [];
    await page.exposeFunction("collectFinderEvent", (args) => events.push(args));
    await page.addInitScript(() => {
      window.dataLayer = [];
      const push = window.dataLayer.push.bind(window.dataLayer);
      window.dataLayer.push = (...items) => {
        for (const item of items) if (item?.[0] === "event") window.collectFinderEvent(Array.from(item));
        return push(...items);
      };
      window.gtag = (...args) => window.dataLayer.push(args);
    });
    await page.goto(prefix || "/");
    await expect(page.locator(".home-entry__situations li:not(.home-entry__all-tile) a")).toHaveCount(7);
    await page.waitForLoadState("networkidle");
    await page.locator(".home-entry__situations li:not(.home-entry__all-tile) a", { hasText: budget.title }).click();
    await expect(page).toHaveURL(`${prefix}/start?situation=budget#finder`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en ? "Find an analysis" : "분석 찾기");
    // 그 상황의 분석만, 결론 예시·필요한 파일과 함께.
    await expect(page.locator(".finder-card")).toHaveCount(budget.count);
    await expect(page.getByRole("button", { name: new RegExp(budget.title) })).toHaveAttribute("aria-pressed", "true");
    // 상황 고르기로 왔으면 카드가 첫 화면 안에서 시작한다.
    const finderTop = await page.locator("#finder").evaluate((node) => node.getBoundingClientRect().top);
    expect(finderTop).toBeLessThan(200);
    const card = page.locator('.finder-card[data-tool-id="5-3"]');
    await expect(card.locator("h3")).toHaveText(allocation.name);
    await expect(card.locator(".finder-card__data")).toContainText(allocation.source.file);
    await card.getByRole("button", { name: en ? "How to prepare" : "준비 방법" }).click();
    const dialog = page.getByRole("dialog", { name: en ? `How to prepare · ${allocation.name}` : `준비 방법 · ${allocation.name}` });
    await expect(dialog.locator(".analysis-data-guide__preparation")).toContainText(en ? "day" : "하루");
    await expect(dialog.locator(".analysis-data-guide__checks")).toContainText(en ? /Spend needs to vary/ : "지출 변동");
    const pending = page.waitForEvent("download");
    await dialog.getByRole("button", { name: en ? "Download blank CSV" : "빈 CSV 양식 받기" }).click();
    const csv = await readFile(await (await pending).path(), "utf8");
    expect(csv).toContain("date");
    expect(csv).toContain("cost");
    expect(csv).toContain("installs");
    expect(csv.trim().split(/\r?\n/)).toHaveLength(1);
    await expect(dialog.locator(`a[href="${prefix}/templates/budget-allocation"]`)).toBeVisible();
    for (const name of ["landing_situation_clicked", "finder_prep_opened", "data_guide_template_downloaded"]) await expect.poll(() => events.some((row) => row[1] === name), { message: name }).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/file_name|raw_value|fileName/);
    await dialog.getByRole("link", { name: en ? "Use my file" : "내 파일로 하기", exact: true }).click();
    await expect(page).toHaveURL(`${prefix}/tools/budget-allocation`);
  });

  test(`finder layout, themes and accessibility (${locale})`, async ({ page }, testInfo) => {
    if (testInfo.project.name === "tablet-768") await page.setViewportSize({ width: 980, height: 1024 });
    await page.goto(`${prefix}/start`);
    await expect(page.locator(".finder-card").first()).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; });
    for (const light of [true, false]) {
      await page.evaluate((value) => document.body.classList.toggle("light-mode", value), light);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      // 분석 카드는 페이지와 구분되는 콘텐츠 면이다(design.md §2). 위 두 칸은 열린 열이라 칸 자체가 면이 아니다.
      for (const selector of [".finder-card", ".analysis-finder__situations button"]) {
        const styles = await page.locator(selector).first().evaluate((el) => ({ surface: getComputedStyle(el).backgroundColor, page: getComputedStyle(document.body).backgroundColor, padding: parseFloat(getComputedStyle(el).paddingLeft) }));
        expect(styles.surface, selector).not.toBe(styles.page);
        expect(styles.padding, selector).toBeGreaterThanOrEqual(selector === ".finder-card" ? 16 : 10);
      }
      const audit = await new AxeBuilder({ page }).include(".analysis-finder").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(audit.violations).toEqual([]);
    }
  });

  test(`pre/post template and tool keep the chosen comparison method (${locale})`, async ({ page }) => {
    // 첫 방문 설문 창이 함께 뜨면 이름 없는 dialog가 그 창을 잡는다 — 설문을 끄고 창은 이름으로 찾는다.
    await page.addInitScript(() => localStorage.setItem("mkt-library-source-survey-answered", "1"));
    await page.goto(`${prefix}/start?situation=proof`);
    const card = page.locator('.finder-card[data-tool-id="5-23"]');
    const incrementality = finderCards(locale).find((item) => item.id === "5-23");
    const dialog = page.getByRole("dialog", { name: en ? `How to prepare · ${incrementality.name}` : `준비 방법 · ${incrementality.name}` });
    // 하이드레이션 전의 클릭은 창을 열지 못한다 — 창이 열릴 때까지 다시 누른다.
    await expect(async () => {
      await card.getByRole("button", { name: en ? "How to prepare" : "준비 방법" }).click();
      await expect(dialog).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await dialog.getByRole("button", { name: en ? "Before and after ads started" : "광고를 켠 전후 비교" }).click();
    const pending = page.waitForEvent("download");
    await dialog.getByRole("button", { name: en ? "Download blank CSV" : "빈 CSV 양식 받기" }).click();
    const csv = await readFile(await (await pending).path(), "utf8");
    expect(csv).toContain("conversions");
    expect(csv).not.toContain("holdout_group");
    await dialog.getByRole("link", { name: en ? "Use my file" : "내 파일로 하기", exact: true }).click();
    await expect(page).toHaveURL(`${prefix}/tools/incrementality?method=on`);
    await expect(page.getByRole("tab", { selected: true })).toContainText(en ? "New launch" : "신규 켜기");
  });

  test(`old data guide address lands on the finder (${locale})`, async ({ page }) => {
    await page.goto(`${prefix}/data-guide`);
    await expect(page).toHaveURL(`${prefix}/start`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en ? "Find an analysis" : "분석 찾기");
  });

  // 3단계 데이터 준비: 파일을 놓으면 "바로 가능 · 조금만 더 · 다른 파일 필요"로 나눠 말한다(product-ssot §1.1c).
  test(`dropped file splits analyses into ready, almost and other files (${locale})`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("mkt-library-source-survey-answered", "1"));
    await page.goto(`${prefix}/start`);
    const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
    await uploader.locator('input[type="file"]').first().setInputFiles("public/examples/weekly-report-three-weeks.csv");
    await uploader.locator(".csv-analysis-action").click();
    // 올린 파일 한 줄: 행 수와 실제 기간.
    const summary = page.locator(".workspace-input-summary");
    await expect(summary).toContainText("weekly-report-three-weeks.csv");
    await expect(summary).toContainText(en ? "42 rows · 2026-08-31 – 2026-09-20" : "42행 · 2026-08-31 – 2026-09-20");
    const workspace = page.locator(".dochi-workspace");
    await expect(workspace).toHaveAttribute("data-queue-settled", "true", { timeout: 30000 });
    await expect(workspace.locator(".tool-index__stage--ready .tool-index__chip").first()).toBeVisible();
    // 조금만 더: 소재 피로도는 소재 ID 열 하나와 그 열이 보통 있는 파일을 말한다.
    const near = workspace.locator(".tool-index__stage--near");
    const creative = near.locator(".tool-index__chip", { hasText: en ? "Add Creative ID to open this." : "소재ID 열을 더하면 열립니다." });
    await expect(creative).toContainText(en ? "Daily ad performance by creative" : "광고 일별 성과 (소재 단위)");
    // 다른 파일 필요: 접혀 있고, 펴면 파일 이름이 소제목이다.
    const other = workspace.locator(".tool-index__stage--other details");
    await expect(other).not.toHaveAttribute("open", "");
    await other.locator("summary").click();
    await expect(other.locator(".tool-index__file-name", { hasText: en ? "Order line items" : "주문별 상품 내역" })).toBeVisible();
    const rules = await measureDesignRules(page);
    expect(rules.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(rules.overlaps).toEqual([]);
  });

  test(`file type entry groups analyses by the file they read (${locale})`, async ({ page }) => {
    await page.goto(`${prefix}/start`);
    const nav = page.getByRole("navigation", { name: en ? "Which files do you have?" : "어떤 파일을 갖고 계세요?" });
    await nav.getByRole("button", { name: en ? /Orders, customers and sales records/ : /주문·고객·영업 기록/ }).click();
    await expect(page).toHaveURL(/[?&]file=commerce/);
    await expect(page.locator(".analysis-finder__group-head h2")).toContainText([en ? "Purchase and refund ledger" : "구매·환불 거래 원장"]);
    await expect(page.locator('.finder-card[data-tool-id="5-41"]')).toBeVisible();
    await expect(page.locator('.finder-card[data-tool-id="5-2"]')).toHaveCount(0);
  });
}
