import { expect, test } from "@playwright/test";

// 시안 C: 도치 브리지(가운데 팝업) 대신 아래에 붙는 한 줄 바. 글의 35%를 넘기면 뜨고,
// 이어 줄 대상이 화면에 보이는 동안은 숨고, 닫으면 그 방문에서는 어느 글에서도 다시 뜨지 않는다.
// 예시가 화면 바로 아래에 있는 지점 — 글은 35% 넘게 읽었고 예시는 아직 안 보인다.
// 부드러운 스크롤이 끝나기 전에 부르면 덮어써지므로, 예시가 화면 아래로 빠질 때까지 다시 건다.
const scrollPastTarget = (page) => expect.poll(() => page.evaluate(() => {
  const target = document.getElementById("blog-practice").getBoundingClientRect();
  const ready = target.top > window.innerHeight && target.top < window.innerHeight + 200;
  if (!ready) window.scrollTo({ top: target.top + window.scrollY - window.innerHeight - 8, behavior: "instant" });
  return ready;
})).toBe(true);

for (const locale of ["ko", "en"]) {
  test(`reading bar leads to the example and stays closed for the visit (${locale})`, async ({ page }) => {
    const en = locale === "en", prefix = en ? "/en" : "";
    const bar = page.locator(".blog-reading-bar");
    await page.goto(`${prefix}/blog/budget-marginal-efficiency`);
    await expect(page.getByText(en ? "Run this on my CSV" : "내 CSV로 같은 분석 보기", { exact: true })).toBeVisible();
    await expect(bar).toHaveCount(0);
    await scrollPastTarget(page);
    await expect(bar).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // 본문을 덮지 않는 높이 — 전면 오버레이가 아니다.
    expect((await bar.boundingBox()).height).toBeLessThan(page.viewportSize().height * 0.2);
    await bar.getByRole("button", { name: en ? "View" : "보기", exact: true }).click();
    await expect(page.locator("#blog-practice")).toBeInViewport();
    await expect(bar).toHaveCount(0);
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
