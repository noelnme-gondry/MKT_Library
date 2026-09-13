import { expect, test } from "@playwright/test";

for (const [locale, tag] of [["ko", ""], ["en", ""], ["en", " @light-en"]]) {
  test(`sample continuity and responsive review (${locale})${tag}`, async ({ page }) => {
    const en = locale === "en";
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    // Synthetic local scenario only; no production analytics or external requests.
    await page.route("**/*", route => {
      const hostname = new URL(route.request().url()).hostname;
      return ["localhost", "127.0.0.1"].includes(hostname) ? route.continue() : route.abort();
    });
    await page.goto(en ? "/en" : "/");
    const preview = await page.locator(".home-result-preview__kpis div:last-child dd").innerText();
    await page.locator(".dc-action-route--sample").click();
    await expect(page.locator(".dochi-result-workspace")).toHaveAttribute("data-phase", "results");
    await expect(page.locator('[data-queue-settled="true"]')).toBeAttached();
    const focus = page.locator(".dochi-workspace__decision-focus");
    await expect(focus.locator(".dochi-workspace__decision-tape")).toContainText(preview);
    await expect(focus.locator(".dochi-workspace__decision-tape")).toContainText("CPA");
    const stats = focus.locator(".dochi-workspace__result-evidence > dl");
    expect(await stats.evaluate(node => getComputedStyle(node).display)).toBe("grid");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: en ? "Build weekly review" : "주간 리뷰 만들기" }).click();
    await expect(page.locator(".wr-verdict__big")).toContainText(preview);
    const copy = page.getByRole("button", { name: en ? "Copy summary" : "요약 복사", exact: true });
    await expect(copy).toBeVisible();
    await copy.focus();
    await expect(copy).toBeFocused();
    await page.getByRole("link", { name: en ? "Record the next decision" : "다음 결정 기록", exact: true }).click();
    await expect(page.getByLabel(en ? "Review date" : "검토일", { exact: true })).toBeVisible();
    const criteria = page.locator(".wr-decision-conditions");
    await expect(criteria).not.toHaveAttribute("open");
    await criteria.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel(en ? "Guardrail value" : "가드레일 값")).toBeVisible();
    await page.evaluate(() => { location.hash = "wr-upload"; });
    await expect(page.locator("#wr-upload")).toHaveAttribute("open");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
