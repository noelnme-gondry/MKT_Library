import { test, expect } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "";
  for (const theme of ["dark", "light"]) {
  test(`contextual tutorial playback, keyboard and transcript (${locale}/${theme})`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem("mkt-library-theme", value), theme);
    const mediaRequests = [];
    await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    page.on("request", request => { if (/\/tutorials\//.test(request.url())) mediaRequests.push(request.url()); });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${prefix}/dashboard`);
    const launcher = page.getByRole("button", { name: en ? "Video guide" : "영상 사용 안내", exact: true });
    await expect(launcher).toBeVisible();
    expect(mediaRequests).toEqual([]);
    await launcher.click();
    const dialog = page.getByRole("dialog", { name: en ? "Video guide" : "영상 사용 안내", exact: true });
    await expect(dialog.getByRole("heading", { name: en ? "Use the dashboard and filters" : "대시보드와 필터 사용", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: en ? "Close video guide" : "영상 안내 닫기", exact: true })).toBeFocused();
    const video = dialog.locator("video");
    expect(await video.evaluate(node => node.paused)).toBe(true);
    await video.evaluate(node => node.play());
    await expect.poll(() => video.evaluate(node => node.currentTime)).toBeGreaterThan(0);
    expect(await video.evaluate(node => node.videoWidth)).toBe(1280);
    await dialog.getByRole("button", { name: en ? "Fix CSV column mapping" : "CSV 컬럼 매핑 바로잡기", exact: true }).click();
    expect(await video.evaluate(node => node.paused)).toBe(true);
    await dialog.locator(".tutorial-transcript summary").click();
    await expect(dialog.locator(".tutorial-transcript li")).toHaveCount(4);
    await dialog.locator(".tutorial-transcript li button").nth(2).click();
    await expect.poll(() => video.evaluate(node => node.currentTime)).toBeCloseTo(18, 0);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await expectNoSeriousAccessibilityViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(launcher).toBeFocused();
    await page.goto(`${prefix}/weekly-review`);
    await launcher.click();
    await expect(dialog.getByRole("heading", { name: en ? "Create a weekly review" : "주간 리뷰 만들기", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: en ? "My projects" : "내 프로젝트", exact: true }).click();
    await launcher.click();
    await expect(dialog.getByRole("heading", { name: en ? "Manage projects and backups" : "프로젝트 관리와 백업", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
  }
  test(`hero uses available width and keeps semantic phrases together (${locale})`, async ({ page }) => {
    await page.goto(`${prefix}/`);
    await page.evaluate(async () => { await document.fonts.ready; });
    const deck = page.locator(".dc-hero__deck");
    const width = await page.locator(".dc-hero__copy").evaluate(node => node.clientWidth);
    expect(await deck.evaluate(node => node.clientWidth)).toBeGreaterThanOrEqual(width - 1);
    const conditions = page.locator(".dc-hero__assurance > span");
    await expect(conditions).toHaveCount(3);
    for (const phrase of await conditions.all()) {
      const size = await phrase.evaluate(node => ({ height: node.getBoundingClientRect().height, line: parseFloat(getComputedStyle(node).lineHeight) }));
      expect(size.height).toBeLessThanOrEqual(size.line + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "";
  test(`inline mapping help preserves the imported file (${locale})`, async ({ page }) => {
    await page.goto(`${prefix}/dashboard`);
    const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
    await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles("public/examples/weekly-report-campaigns.csv");
    await expect(uploader.locator(".file-state")).toContainText("weekly-report-campaigns.csv");
    const mappingBlock = uploader.locator(".csv-mapping-block").filter({ has: page.locator(".mapping-grid") });
    if (!await mappingBlock.evaluate(node => node.open)) await mappingBlock.locator(":scope > summary").click();
    const button = mappingBlock.locator(".tutorial-inline");
    await expect(button).toBeVisible();
    await button.click();
    const dialog = page.getByRole("dialog", { name: en ? "Video guide" : "영상 사용 안내", exact: true });
    await expect(dialog.getByRole("heading", { name: en ? "Fix CSV column mapping" : "CSV 컬럼 매핑 바로잡기", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();
    await expect(uploader.locator(".file-state")).toContainText("weekly-report-campaigns.csv");
    await expect(uploader.locator('.mapping-grid [data-mapping-target]')).not.toHaveCount(0);
  });
}
