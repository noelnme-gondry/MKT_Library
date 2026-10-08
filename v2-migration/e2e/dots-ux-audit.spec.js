import { test, expect } from "@playwright/test";
import { ITEM_TITLE_EN } from "../src/lib/enNavCopy";
import { blogConversionFor } from "../src/lib/blogConversion";

for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "";
  const tag = en ? " @light-en" : "";
  test.beforeEach(async ({ page }) => {
    // Keep all synthetic checks local, including anonymous account/payment state.
    await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, mailEnabled: false, account: null, entitlement: null } }));
  });
  test(`template skip target and account content (${locale})${tag}`, async ({ page }) => {
    await page.goto(`${prefix}/templates/campaign-variance`);
    await expect(page.locator("main")).toHaveCount(1);
    await page.locator(".skip-link").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await expect(page.locator("main")).toContainText(en ? "One of:" : "다음 중 하나 이상:");
    await page.goto(`${prefix}/account`);
    await expect(page.locator(".account-page")).toBeVisible();
    await expect(page.getByText(/개발 진행 중|선택하신 가이드 문서|Not available yet|isn.t available in English yet/i)).toHaveCount(0);
    await expect(page.locator(".sop-page, .sop-hero")).toHaveCount(0);
  });
  test(`result to weekly start, back and re-entry (${locale})${tag}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await page.locator(".dc-action-route--sample").click();
    await expect(page.locator('[data-queue-settled="true"]')).toBeAttached();
    const enter = () => page.getByRole("button", { name: en ? "Make it my next marketing project" : "다음 마케팅 프로젝트로 만들기", exact: true }).click();
    const checkStart = async () => {
      const section = page.locator("#weekly-performance");
      await expect(section).toBeFocused();
      await expect(page.locator("#wr-verdict")).toBeAttached();
      await expect.poll(() => section.evaluate(node => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(50);
      await expect.poll(() => section.evaluate(node => node.getBoundingClientRect().top)).toBeLessThan(170);
    };
    await enter(); await checkStart();
    await page.goBack();
    await expect(page.locator('[data-queue-settled="true"]')).toBeAttached();
    await enter(); await checkStart();
    // Anonymous in-memory data does not become a saved dataset on reload.
    await page.reload();
    await expect(page.locator("#wr-verdict")).toHaveCount(0);
    await expect(page.getByRole("button", { name: en ? "Create a project" : "새 프로젝트 만들기", exact: true })).toBeVisible();
    await page.getByRole("link", { name: en ? "Start a new analysis" : "새 분석 시작", exact: true }).click();
    await expect(page.locator(".csv-uploader").first()).toBeVisible();
  });
  test(`allocation shows both scenarios and unbroken numeric values (${locale})${tag}`, async ({ page }) => {
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(prefix || "/");
    await page.locator(".dc-action-route--sample").click();
    await expect(page.locator('[data-queue-settled="true"]')).toBeAttached();
    await page.locator(".tool-index__chip", { hasText: en ? ITEM_TITLE_EN["5-3"] : "예산 재배분" }).click();
    await expect(page.locator(".tool-index__panel .allocation-preview-explanation")).toContainText(en ? "recalculates" : "다시 계산");
    const preview = page.locator(".tool-index__panel .dochi-workspace__result");
    const previous = await preview.locator(".dochi-workspace__decision-tape").innerText();
    await page.locator(".tool-index__panel .ab-button").click();
    const notice = page.locator(".allocation-preview-notice");
    await expect(notice).toContainText(previous);
    await expect(notice).toContainText(en ? "Current settings" : "현재 조건");
    const atoms = page.locator(".result-action-card__stats .metric-value-atom");
    await expect(atoms.first()).toBeAttached();
    expect(await atoms.evaluateAll(nodes => nodes.every(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return range.getClientRects().length === 1 && node.getBoundingClientRect().right <= innerWidth + 1;
    }))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
    const direct = await page.context().newPage();
    try {
      await direct.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      await direct.goto(`${prefix}/tools/budget-allocation`);
      await expect(direct.locator(".csv-uploader").first()).toBeVisible();
      await expect(direct.locator(".allocation-preview-notice")).toHaveCount(0);
    } finally { await direct.close(); }
  });
  test(`article sample uses the written comparison periods (${locale})${tag}`, async ({ page }) => {
    const slug = "weekly-marketing-report-template";
    await page.goto(`${prefix}/blog/${slug}`);
    await page.getByRole("button", { name: blogConversionFor(slug, locale).action, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/tools/campaign-variance`));
    await expect(page.locator("#s-pvm-result")).toBeVisible();
    await expect(page.locator("main")).toContainText("2026-08-31");
    await expect(page.locator("main")).toContainText("2026-09-13");
    await expect(page.locator("#s-pvm-result")).toContainText("1,200");
  });
  test(`unsupported CSV offers mapping recovery without a ready badge (${locale})${tag}`, async ({ page }) => {
    await page.goto(`${prefix}/start`);
    const uploader = page.locator('.csv-uploader[data-hydrated="true"]');
    await expect(uploader).toBeVisible();
    await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles({ name: "unmatched.csv", mimeType: "text/csv", buffer: Buffer.from("Name,Note\r\nAlpha,Text only\r\nBeta,No metrics") });
    await expect(uploader.locator(".file-state")).toContainText("unmatched.csv");
    await uploader.locator(".csv-analysis-action").click();
    await expect(page.getByRole("heading", { name: en ? "No analysis is ready for this file" : "이 파일로 실행할 수 있는 분석이 없습니다", exact: true })).toBeVisible();
    await expect(page.locator(".journey-progress .is-done")).toHaveCount(0);
    await expect(page.locator(".workspace-input-summary")).toContainText(en ? "file loaded" : "파일 읽기 완료");
    await page.getByRole("button", { name: en ? "Fix column mapping" : "컬럼 매핑 수정", exact: true }).click();
    await expect(uploader).toBeVisible();
    await expect(uploader.getByRole("combobox").first()).toBeVisible();
  });
  test(`SOP code copy preserves code without highlight markup (${locale})${tag}`, async ({ page }) => {
    await page.addInitScript(() => { navigator.clipboard.writeText = async text => { window.__copiedCode = text; }; });
    await page.goto(`${prefix}/guide/ios-privacy-att-skan`);
    const code = page.locator(".code-block").first();
    await expect(code.locator("pre")).toBeVisible();
    const originalText = await code.locator("pre").textContent();
    expect(originalText).toContain("import");
    expect(originalText).not.toMatch(/<span|class=["']|&quot;/);
    await code.getByRole("button", { name: "Copy", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__copiedCode)).toBe(originalText);
  });
  test(`PNG condition is visible before its purchase prompt (${locale})${tag}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await page.locator(".dc-action-route--sample").click();
    const figure = page.locator(".workspace-next-action__figure");
    await expect(figure.locator(".figure-png-button__condition")).toContainText(en ? "excludes trial" : "체험 제외");
    await figure.getByRole("button", { name: en ? "Download PNG" : "PNG 받기", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("PNG");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}
