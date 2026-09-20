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
    const menu = page.locator(".header-utility-menu");
    expect(mediaRequests).toEqual([]);
    await menu.locator(".header-utility-menu__trigger").click();
    await page.locator(".utility-popover-panel").getByRole("button", { name: en ? "Video guide" : "영상 사용 안내", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: en ? "Video guide" : "영상 사용 안내", exact: true });
    await expect(dialog.getByRole("heading", { name: en ? "Use the dashboard and filters" : "대시보드와 필터 사용", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: en ? "Close video guide" : "영상 안내 닫기", exact: true })).toBeFocused();
    const video = dialog.locator("video");
    expect(await video.evaluate(node => node.paused)).toBe(true);
    await video.evaluate(node => node.play());
    await expect.poll(() => video.evaluate(node => node.currentTime)).toBeGreaterThan(0);
    expect(await video.evaluate(node => node.videoWidth)).toBe(1280);
    expect(await video.evaluate(node => node.duration)).toBeCloseTo(24, 1);
    await dialog.getByRole("button", { name: en ? "Fix CSV column mapping" : "CSV 컬럼 매핑 바로잡기", exact: true }).click();
    expect(await video.evaluate(node => node.paused)).toBe(true);
    await expect(dialog.locator(".tutorial-transcript li")).toHaveCount(4);
    await dialog.locator(".tutorial-transcript li button").nth(2).click();
    await expect.poll(() => video.evaluate(node => node.currentTime)).toBeCloseTo(12, 0);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await expectNoSeriousAccessibilityViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(menu.locator(".header-utility-menu__trigger")).toBeFocused();
    await page.goto(`${prefix}/weekly-review`);
    // Persistent menu access remains available when the floating entry yields
    // to a page control beneath it.
    await menu.locator(".header-utility-menu__trigger").click();
    await page.locator(".utility-popover-panel").getByRole("button", { name: en ? "Video guide" : "영상 사용 안내", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: en ? "Create a weekly review" : "주간 리뷰 만들기", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu.locator(".header-utility-menu__trigger")).toBeFocused();
    await page.getByRole("button", { name: en ? "My projects" : "내 프로젝트", exact: true }).click();
    await menu.locator(".header-utility-menu__trigger").click();
    await page.locator(".utility-popover-panel").getByRole("button", { name: en ? "Video guide" : "영상 사용 안내", exact: true }).click();
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
  test(`floating home guide opens preparation and restores focus (${locale})`, async ({ page }) => {
    await page.goto(`${prefix}/`);
    await page.evaluate(async () => { await document.fonts.ready; });
    const launcher = page.locator(".tutorial-launcher");
    await expect(launcher).toBeVisible();
    await launcher.click();
    const dialog = page.getByRole("dialog", { name: en ? "Video guide" : "영상 사용 안내", exact: true });
    await expect(dialog.getByRole("heading", { name: en ? "Prepare data and start" : "데이터 준비와 첫 분석", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(launcher).toBeFocused();
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
    await expect(mappingBlock).toBeVisible();
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

for (const locale of ["ko", "en"]) {
  test(`weekly report article opens its three-week demo and short follow-up guide (${locale})`, async ({ page }) => {
    const en = locale === "en", prefix = en ? "/en" : "";
    await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.goto(`${prefix}/blog/weekly-marketing-report-template`);
    const practice = page.locator("#blog-practice");
    await practice.getByRole("button", { name: en ? "Save and revisit · 24-second guide" : "저장·재검토 24초 가이드", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: en ? "Video guide" : "영상 사용 안내", exact: true });
    await expect(dialog.getByRole("heading", { name: en ? "Save and revisit decisions" : "결정 저장과 다음 주 재검토", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await practice.getByRole("button", { name: en ? "Open analysis with demo" : "데모로 분석 열기", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/tools/campaign-variance`));
    await expect(page.getByRole("banner")).toContainText("weekly-report-three-weeks.csv");
    await expect(page.locator(".analysis-setup__context")).toContainText(en ? "42 source rows" : "42 원본 행");
    const campaign = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "A", exact: true }) });
    await expect(campaign).toContainText("1,500");
    await expect(campaign).toContainText("1,200");
  });
}

for (const locale of ["ko", "en"]) {
  const en = locale === "en";
  test(`upload guide opens and home launcher yields to survey (${locale})`, async ({ page }) => {
    await page.goto(`${en ? "/en" : ""}/dashboard`);
    const help = page.getByRole("button", { name: en ? "How to upload" : "업로드 방법 보기" });
    await expect(help).toBeVisible();
    await help.click();
    const dialog = page.getByRole("dialog", { name: en ? "Video guide" : "영상 사용 안내", exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeFocused();
    // The uploader can occupy every candidate floating footprint on a tablet.
    // Its inline entry stays usable; test survey precedence on the clear home
    // viewport instead of requiring the launcher to cover upload controls.
    await page.goto(en ? "/en" : "/");
    const launcher = page.locator(".tutorial-launcher");
    await expect(launcher).toBeVisible();
    await page.evaluate(() => {
      const survey = document.createElement("section");
      survey.className = "source-survey";
      survey.textContent = "Survey";
      document.body.append(survey);
    });
    await expect(launcher).toBeHidden();
    await page.evaluate(() => document.querySelector(".source-survey").remove());
    await expect(launcher).toBeVisible();
  });
}

for (const en of [false, true]) {
  test(`tutorial launcher remains fixed and visible throughout scrolling (${en ? "en" : "ko"})`, async ({ page }) => {
    await page.goto(en ? "/en/" : "/");
    const launcher = page.locator(".tutorial-launcher");
    await expect(launcher).toBeVisible();
    const samples = await launcher.evaluate(async node => {
      const results = [];
      for (const top of [0, 200, 500, 1000, 2000, 100, 0]) {
        window.scrollTo(0, top);
        await new Promise(resolve => requestAnimationFrame(resolve));
        const box = node.getBoundingClientRect(), style = getComputedStyle(node);
        results.push({ top: box.top, display: style.display, visibility: style.visibility, opacity: style.opacity });
      }
      return results;
    });
    expect(samples.every(sample => sample.display !== "none" && sample.visibility === "visible" && Number(sample.opacity) > 0)).toBe(true);
    expect(Math.max(...samples.map(sample => sample.top)) - Math.min(...samples.map(sample => sample.top))).toBeLessThan(1);
  });
}
