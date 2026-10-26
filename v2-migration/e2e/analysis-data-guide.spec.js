import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { dataGuideQuestions } from "../src/lib/analysisDataGuide";

for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "";
  test(`home to data preparation, CSV and analysis (${locale})`, async ({ page }) => {
    const events = [];
    await page.exposeFunction("collectGuideEvent", args => events.push(args));
    await page.addInitScript(() => {
      // 동의·GA 초기화가 gtag 함수를 교체해도 표준 큐에 들어간 이벤트를 확인한다.
      window.dataLayer = [];
      const push = window.dataLayer.push.bind(window.dataLayer);
      window.dataLayer.push = (...items) => {
        for (const item of items) if (item?.[0] === "event") window.collectGuideEvent(Array.from(item));
        return push(...items);
      };
      window.gtag = (...args) => window.dataLayer.push(args);
    });
    await page.goto(prefix || "/");
    await expect(page.locator(".dc-hero__actions a")).toHaveCount(3);
    const guideLink = page.locator(".dc-action-route--guide");
    await expect(guideLink).toHaveAccessibleName(en ? "Check data requirements" : "필요한 데이터 양식 확인");
    await expect(guideLink).toHaveAccessibleDescription(en ? "Check data and formats for each analysis." : "분석별 데이터와 양식을 확인합니다.");
    await page.waitForLoadState("networkidle");
    await guideLink.click();
    await expect(page).toHaveURL(`${prefix}/data-guide`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en ? "What data do you need?" : "어떤 데이터가 필요한가요?");
    await expect(page.locator(".breadcrumb")).toContainText(en ? "Data requirements" : "필요한 데이터 양식");
    await expect(page.locator(".analysis-data-guide__question-grid button")).toHaveCount(dataGuideQuestions(locale).length);
    await page.getByRole("button", { name: dataGuideQuestions(locale).find(stage => stage.id === "budget").question }).focus();
    await page.keyboard.press("Enter");
    const allocation = page.locator('.analysis-data-guide__tool-grid button[data-analysis-id="5-3"]');
    const allocationName = await allocation.locator("strong").textContent();
    await allocation.click();
    await expect(page.locator("#data-guide-detail-title")).toHaveText(allocationName);
    await expect(page.locator(".analysis-data-guide__preparation")).toContainText(en ? "day" : "하루");
    await expect(page.locator(".analysis-data-guide__checks")).toContainText(en ? /Spend needs to vary/ : "지출 변동");
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: en ? "Download blank CSV" : "빈 CSV 양식 받기" }).click();
    const download = await pending;
    const csv = await readFile(await download.path(), "utf8");
    expect(csv).toContain("date");
    expect(csv).toContain("cost");
    expect(csv).toContain("installs");
    expect(csv.trim().split(/\r?\n/)).toHaveLength(1);
    await expect(page.locator(".analysis-data-guide__actions a[href]").last()).toHaveAttribute("href", `${prefix}/templates/budget-allocation`);
    for (const name of ["landing_data_guide_clicked", "data_guide_viewed", "data_guide_question_selected", "data_guide_analysis_selected", "data_guide_template_downloaded"]) await expect.poll(() => events.some(row => row[1] === name), { message: name }).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/file_name|raw_value|fileName/);
    await page.getByRole("link", { name: en ? "Analyze my data" : "내 데이터로 분석하기", exact: true }).click();
    await expect(page).toHaveURL(`${prefix}/tools/budget-allocation`);
  });

  test(`data guide layout, themes and accessibility (${locale})`, async ({ page }, testInfo) => {
    if (testInfo.project.name === "tablet-768") await page.setViewportSize({ width: 980, height: 1024 });
    await page.goto(`${prefix}/data-guide`);
    await expect(page.locator(".analysis-data-guide__example table")).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; });
    for (const light of [true, false]) {
      await page.evaluate(value => document.body.classList.toggle("light-mode", value), light);
      // 테마 전환의 색상 전이가 끝난 상태에서 대비를 검사한다.
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      for (const selector of [".analysis-data-guide__intro", ".analysis-data-guide__questions", ".analysis-data-guide__detail"]) {
        const styles = await page.locator(selector).evaluate(el => ({ surface: getComputedStyle(el).backgroundColor, page: getComputedStyle(document.body).backgroundColor, padding: parseFloat(getComputedStyle(el).paddingLeft) }));
        expect(styles.surface).not.toBe(styles.page);
        expect(styles.padding).toBeGreaterThanOrEqual(20);
      }
      const audit = await new AxeBuilder({ page }).include(".analysis-data-guide").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(audit.violations).toEqual([]);
      if ((en && testInfo.project.name === "tablet-768" && light) || (!en && testInfo.project.name === "desktop-1440" && light) || (!en && testInfo.project.name === "mobile-320" && !light)) {
        await page.screenshot({ path: testInfo.outputPath("data-guide.png"), fullPage: true });
      }
    }
  });

  test(`pre/post template matches the method opened in the tool (${locale})`, async ({ page }) => {
    await page.goto(`${prefix}/data-guide`);
    await page.getByRole("button", { name: dataGuideQuestions(locale).find(stage => stage.id === "proof").question }).click();
    await page.locator('[data-analysis-id="5-23"]').click();
    await page.getByRole("button", { name: en ? "Before and after ads started" : "광고를 켠 전후 비교" }).click();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: en ? "Download blank CSV" : "빈 CSV 양식 받기" }).click();
    const csv = await readFile(await (await pending).path(), "utf8");
    expect(csv).toContain("conversions");
    expect(csv).not.toContain("holdout_group");
    await page.getByRole("link", { name: en ? "Analyze my data" : "내 데이터로 분석하기", exact: true }).click();
    await expect(page).toHaveURL(`${prefix}/tools/incrementality?method=on`);
    await expect(page.getByRole("tab", { selected: true })).toContainText(en ? "New launch" : "신규 켜기");
  });
}
