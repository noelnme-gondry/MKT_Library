import { test, expect } from "@playwright/test";
import path from "node:path";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";
import { toolIndexEntry } from "../src/lib/toolIndex";
import { idToSlug, publishedToolIds } from "../src/lib/routeMap";

for (const locale of ["ko", "en"]) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const tag = en ? " @light-en" : "";
  test(`shared typography and interior layouts (${locale})${tag}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of ["/dashboard", "/weekly-review", "/blog", "/guide", "/guide/dev-collaboration", "/subscription"]) {
      await page.goto(`${prefix}${route}`);
      const heading = page.locator("h1").first();
      await expect(heading).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(heading).toHaveCSS("font-family", /GOP Heading/i);
      expect(await page.evaluate(() => [...document.fonts].some((font) => /GOP Heading/i.test(font.family) && font.status === "loaded")), route).toBe(true);
      // Long SOP code tokens must wrap without making the entire page scroll.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBe(true);
    }
    expect(errors).toEqual([]);
  });
  test(`library question entry and persistent navigation (${locale})${tag}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await expect(page.locator('.dc-action-route--primary')).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
    // Legacy centered-hero rules must not distort the approved card layout.
    await expect(page.locator(".dc-hero__copy")).toHaveCSS("text-align", "left");
    const hero = await page.locator(".dc-hero").boundingBox();
    // Sample is the primary entry; the question path remains available below.
    const primary = await page.locator(".dc-action-route--sample").boundingBox();
    expect(Math.abs(primary.x - hero.x)).toBeLessThan(1);
    expect(primary.height).toBeLessThanOrEqual(56);
    await page.locator(`.dc-tool-shortcuts a[href="${prefix}/diagnose"]`).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/diagnose$`));
    await expect(page.locator("main h1")).toBeVisible();
    await page.goto(prefix || "/");
    await expect(page.locator(".home-tool-finder__purposes button")).toHaveCount(7);
    await expect(page.locator("#dochi-upload")).toBeHidden();
    await expect(page.locator(".library-reading__grid a")).toHaveCount(4);
    await expectNoSeriousAccessibilityViolations(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const toggle = page.locator(".header-sidebar-toggle");
    const mobile = await toggle.getAttribute("aria-haspopup") === "dialog";
    if (mobile) {
      await toggle.click();
      await expect(page.getByRole("dialog", { name: en ? "Site navigation" : "사이트 메뉴" })).toBeVisible();
      await expectNoSeriousAccessibilityViolations(page);
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      await toggle.click();
    }
    for (const path of ["/blog", "/guide", "/weekly-review", "/subscription", "/start", "/start?view=methods"]) {
      await expect(page.locator(`.library-nav-item[href="${prefix}${path}"]`)).toBeVisible();
    }
    await page.locator(`.library-nav-item[href="${prefix}/blog"]`).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/blog$`));
    await expect(page.locator("main h1")).toBeVisible();
    if (mobile) await expect(page.getByRole("dialog")).toBeHidden();
  });

  test(`home sample opens computed results and retains weekly handoff (${locale})${tag}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await expect(page.locator('.dc-action-route--primary')).toBeVisible();
    await page.locator(".dc-action-route--sample").click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/dochi-result$`));
    await expect(page.locator('.dochi-result-workspace[data-phase="results"]')).toBeVisible();
    await expect(page.locator(".sample-journey-scope")).toContainText(en ? "Sample data" : "샘플 데이터");
    await expect(page.locator('[data-queue-settled="true"]')).toBeAttached();
    await expect(page.locator(".workspace-next-action")).toBeVisible();
    await page.getByRole("button", { name: en ? "Make it my next marketing project" : "다음 마케팅 프로젝트로 만들기", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/weekly-review#weekly-performance$`));
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("#wr-verdict")).toBeVisible();
    await expect(page.locator(".header-data-context")).toContainText("demo_efficiency.csv");
  });

  // 샘플 하나로 모든 도구를 돌릴 수는 없다 — 샘플이 못 채우는 도구는 그 도구의 예시 데이터로
  // 연다. 연 도구는 곧장 결과다(2026-09-24). 단 목록은 정직해야 한다: "이 파일로 되는 분석"에는
  // 이 파일로 실제 계산된 것만 있고, 나머지는 필요한 값 한 줄(또는 판정 못 한 사유)과 함께
  // 아래 묶음에 있다. 그 줄에 예시 결과를 섞지 않는다 — 이 파일의 결과로 오해된다(2026-09-25).
  test(`home sample opens every analysis straight to a result (${locale})${tag}`, async ({ page }, testInfo) => {
    // 도구 20개를 차례로 연다 — 폭마다 반복할 이유가 없어 데스크톱 한 번만 잰다.
    test.skip(!/desktop/.test(testInfo.project.name), "one width is enough for the per-tool walk");
    test.setTimeout(600_000);
    await page.goto(prefix || "/");
    await page.locator(".dc-action-route--sample").click();
    await expect(page.locator('[data-queue-settled="true"]')).toBeAttached();
    const readyNames = await page.locator(".tool-index__stage--ready .tool-index__q").allInnerTexts();
    expect(readyNames).toEqual(expect.arrayContaining(["5-2", "5-21", "5-3"].map((id) => toolIndexEntry(id, locale).name)));
    const blockedRows = page.locator(".tool-index__stage--blocked .tool-index__chip");
    expect(await blockedRows.count()).toBe(publishedToolIds().length - readyNames.length);
    for (const text of await blockedRows.allInnerTexts()) {
      expect(text).toMatch(/\S/);
      expect(text).not.toMatch(en ? /Example result/ : /예시 결과/);
    }
    await expect(page.locator(".tool-index__stage--blocked .tool-index__need")).toHaveCount(await blockedRows.count());
    const stuck = [];
    for (const toolId of publishedToolIds()) {
      // 샘플은 메모리에만 있다 — 도구마다 홈에서 샘플을 새로 연다.
      await page.goto(prefix || "/");
      await page.locator(".dc-action-route--sample").click();
      await expect(page.locator('[data-queue-settled="true"]')).toBeAttached();
      await page.getByRole("button", { name: toolIndexEntry(toolId, locale).name }).first().click();
      await page.getByRole("button", { name: en ? /Open analysis/ : /분석 열기/ }).first().click();
      await expect(page).toHaveURL(new RegExp(`${prefix}${idToSlug[toolId]}$`), { timeout: 30_000 });
      const reached = await page.locator(".result-action-card").first().waitFor({ state: "visible", timeout: 30_000 }).then(() => true, () => false);
      if (!reached || await page.getByRole("dialog").count()) stuck.push(toolId);
    }
    expect(stuck).toEqual([]);
  });

  // 분석마다 핵심 그림이 달라야 한다 — 예전에는 전부 같은 가로 막대였다(2026-09-25).
  test(`each computed sample analysis shows its own chart (${locale})${tag}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await page.locator(".dc-action-route--sample").click();
    await expect(page.locator('[data-queue-settled="true"]')).toBeAttached();
    const expected = { "5-2": ".dochi-workspace__period-comparison", "5-21": ".result-mix-rate", "5-22": ".result-gap", "5-3": ".result-shift" };
    for (const [toolId, selector] of Object.entries(expected)) {
      const chip = page.locator(".tool-index__stage--ready .tool-index__chip").filter({ hasText: toolIndexEntry(toolId, locale).name });
      await chip.click();
      await expect(page.locator(`.tool-index__panel ${selector}`)).toBeVisible();
      await expect(page.locator(".tool-index__panel .dochi-workspace__result-bars")).toHaveCount(0);
      await chip.click();
    }
  });

  // 도구를 열었다가 뒤로 오면 결과가 그대로여야 한다 — 예전에는 컬럼 확인부터 다시 물었다(2026-09-24).
  test(`back from a tool keeps the sample results (${locale})${tag}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await page.locator(".dc-action-route--sample").click();
    await expect(page.locator('[data-queue-settled="true"]')).toBeAttached();
    for (const toolId of ["5-2", "5-20"]) {
      await page.getByRole("button", { name: toolIndexEntry(toolId, locale).name }).first().click();
      await page.getByRole("button", { name: en ? /Open analysis/ : /분석 열기/ }).first().click();
      await expect(page).toHaveURL(new RegExp(`${prefix}${idToSlug[toolId]}$`), { timeout: 30_000 });
      await expect(page.locator(".result-action-card").first()).toBeVisible({ timeout: 30_000 });
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`${prefix}/dochi-result$`));
      await expect(page.locator('.dochi-result-workspace[data-phase="results"]')).toBeVisible();
      await expect(page.locator(".sample-journey-scope")).toBeVisible();
    }
  });

  test(`home CSV upload reaches unified analysis (${locale})${tag}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await expect(page.locator('.dc-action-route--primary')).toBeVisible();
    await page.locator(".dc-action-route--primary").click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/start$`));
    await page.locator('.csv-uploader input[type="file"]').first().setInputFiles(path.resolve("e2e/fixtures/efficiency.csv"));
    await expect(page.locator(".header-data-context")).toContainText("efficiency.csv");
    // 원본 통화는 묻지 않고 기본값(최근 선택 → 화면 언어)으로 채운다. 바꾸는 버튼만 남는다.
    await expect(page.getByRole("button", { name: en ? "USD $" : "원 ₩", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".dochi-workspace")).toHaveCount(0);
    await page.locator(".csv-analysis-action").click();
    await expect(page.locator(".workspace-next-action")).toBeVisible();
    await expect(page.locator(".workspace-input-summary")).toContainText("efficiency.csv");
    await expect(page.locator(".workspace-input-summary")).not.toContainText("demo_");
  });
}
