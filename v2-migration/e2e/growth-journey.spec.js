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
    await expect(page.locator(".workspace-next-action")).toContainText(preview);
    // 결론 밑에 핵심 그림이 바로 있다 — 누르지 않아도 보인다.
    await expect(page.locator(".workspace-next-action .workspace-next-action__figure")).toBeVisible();
    await page.locator(".tool-index__chip", { hasText: en ? "Weekly check" : "주간 성과 점검" }).click();
    const focus = page.locator(".tool-index__panel");
    await expect(focus.locator(".dochi-workspace__decision-tape")).toContainText("CPA");
    // 기간 비교 그림(지표 고르기 포함)은 결론 밑에 한 번만 있다 — 펼친 카드에서 다시 그리지 않는다.
    const stats = page.locator(".workspace-next-action .analysis-metric-picker");
    expect(await stats.evaluate(node => getComputedStyle(node).display)).toBe("grid");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: en ? "Make it my next marketing project" : "다음 마케팅 프로젝트로 만들기" }).click();
    await expect(page.locator(".wr-verdict__big")).toContainText(preview);
    const copy = page.getByRole("button", { name: en ? "Copy summary" : "요약 복사", exact: true });
    await expect(copy).toBeVisible();
    await copy.focus();
    await expect(copy).toBeFocused();
    await page.getByRole("link", { name: en ? "Record the next decision" : "다음 결정 기록", exact: true }).click();
    await expect(page.getByLabel(en ? "Review date" : "검토일", { exact: true })).toBeVisible();
    const criteria = page.locator(".wr-decision-conditions");
    await expect(page.getByLabel(en ? "Guardrail value" : "가드레일 값")).toBeVisible();
    // 결과 화면의 상시 접기는 없앴지만 `#wr-upload` 딥링크는 살아 있어야 한다 —
    // 구독 CTA와 보관함 안내가 실제로 그 주소를 쓴다.
    await page.evaluate(() => { location.hash = "wr-upload"; });
    await expect(page.locator("#wr-upload")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
