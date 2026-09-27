import { expect, test } from "@playwright/test";
import { blogConversionFor } from "../src/lib/blogConversion";

// 시안 C: 도치 브리지(가운데 팝업) 대신 아래에 붙는 한 줄 바. 글의 35%를 넘기면 뜨고,
// 이어 줄 대상이 화면에 보이는 동안은 숨고, 닫으면 그 방문에서는 어느 글에서도 다시 뜨지 않는다.
// 예시는 이제 초반에 있다. 본문 중간까지 읽어 예시를 지나친 상태를 재현한다.
const scrollPastTarget = (page, targetId = "blog-practice") => expect.poll(() => page.evaluate(targetId => {
  const article = document.querySelector(".blog-prose").getBoundingClientRect();
  const target = document.getElementById(targetId).getBoundingClientRect();
  const ready = target.bottom < 0 && -article.top + innerHeight > article.height * .4;
  if (!ready) window.scrollTo({ top: Math.max(target.bottom + scrollY + 24, article.top + scrollY + article.height * .5 - innerHeight), behavior: "instant" });
  return ready;
}, targetId)).toBe(true);

for (const locale of ["ko", "en"]) {
  test(`reading bar leads to the example and stays closed for the visit (${locale})`, async ({ page }) => {
    const en = locale === "en", prefix = en ? "/en" : "";
    const bar = page.locator(".blog-reading-bar");
    await page.goto(`${prefix}/blog/budget-marginal-efficiency`);
    await expect(page.getByText(en ? "Use my CSV" : "내 CSV로 분석하기", { exact: true })).toBeVisible();
    await expect(bar).toHaveCount(0);
    await scrollPastTarget(page);
    await expect(bar).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // 본문을 덮지 않는 높이 — 전면 오버레이가 아니다.
    expect((await bar.boundingBox()).height).toBeLessThan(page.viewportSize().height * 0.2);
    await bar.getByRole("button", { name: blogConversionFor("budget-marginal-efficiency", locale).action, exact: true }).click();
    await expect(page).toHaveURL(`${prefix}/tools/budget-allocation`);
    await expect(page.locator(".result-action-card").first()).toBeVisible({ timeout: 30_000 });
    await page.goto(`${prefix}/blog/budget-marginal-efficiency`);
    await expect(page.locator("#blog-practice")).toBeAttached();
    await scrollPastTarget(page);
    await expect(bar).toBeVisible();
    await bar.getByRole("button", { name: en ? "Close" : "닫기", exact: true }).click();
    await expect(bar).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem("gop:blog:reading-bar-dismissed"))).toBe("1");
    await page.goto(`${prefix}/blog/ab-testing`);
    await expect(page.locator("#blog-practice")).toBeAttached();
    await scrollPastTarget(page);
    await page.waitForTimeout(300);
    await expect(bar).toHaveCount(0);
  });
}

for (const locale of ["ko", "en"]) {
  test(`self-check reading bar keeps one readable action (${locale})`, async ({ page }) => {
    const en = locale === "en";
    await page.goto(`${en ? "/en" : ""}/blog/ios-att-skan-guide`);
    await expect(page.locator("#blog-self-check")).toBeAttached();
    await scrollPastTarget(page, "blog-self-check");
    const bar = page.locator(".blog-reading-bar");
    await expect(bar).toBeVisible();
    expect((await bar.boundingBox()).height).toBeLessThan(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await bar.getByRole("button", { name: en ? "Check with two questions" : "두 질문으로 점검하기", exact: true }).click();
    await expect(page.locator("#blog-self-check")).toBeInViewport();
    await expect(bar).toHaveCount(0);
  });
}
