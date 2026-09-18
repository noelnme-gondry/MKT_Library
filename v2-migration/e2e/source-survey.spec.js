import { test, expect } from "@playwright/test";

import { SOURCE_SURVEY_ANSWERED_KEY, SOURCE_SURVEY_SEEN_KEY } from "./support/sourceSurvey.js";

// 유입 경로 서베이는 `playwright.config.js`가 모든 스펙에서 "이미 답함"으로 시드해
// 둔다(카드가 화면 가운데라 다른 스펙의 클릭을 가로챈다). 그래서 서베이를 실제로
// 보는 곳은 여기 하나뿐이다 — 시드가 기능을 통째로 가리지 않도록 붙잡는 역할이다.
//
// jsdom 스모크가 못 보는 것만 본다: 실제 박스가 화면 가운데 있는가, 그리고 카드가
// 뒤 콘텐츠를 잠그지 않는가.
const clearSeed = async (page) => {
  await page.addInitScript(([answeredKey, seenKey]) => {
    try {
      localStorage.removeItem(answeredKey);
      sessionStorage.removeItem(seenKey);
      // 도치 인사가 떠 있으면 서베이는 그 뒤로 미뤄진다 — 여기서는 서베이만 본다.
      localStorage.setItem("mkt-library-dochi-welcome-dismissed", "1");
    } catch { /* 저장소가 막히면 노출 쪽으로 떨어진다(그래도 테스트는 성립한다). */ }
  }, [SOURCE_SURVEY_ANSWERED_KEY, SOURCE_SURVEY_SEEN_KEY]);
};

test("유입 경로 서베이는 가운데 뜨고 뒤를 잠그지 않는다", async ({ page }) => {
  await clearSeed(page);
  await page.goto("/");

  const card = page.locator(".source-survey");
  await expect(card).toBeVisible();

  // ① 실제로 가운데인가 — jsdom은 좌표를 못 재므로 여기서만 확인할 수 있다.
  const centered = await page.evaluate(() => {
    const rect = document.querySelector(".source-survey").getBoundingClientRect();
    return {
      dx: Math.abs((rect.left + rect.right) / 2 - innerWidth / 2),
      dy: Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2),
      width: rect.width,
    };
  });
  expect(centered.width).toBeGreaterThan(0);
  expect(centered.dx).toBeLessThanOrEqual(2);
  expect(centered.dy).toBeLessThanOrEqual(2);

  // ② 백드롭이 없다 — 카드 밖 아무 지점이나 hit-test하면 카드가 아니어야 한다.
  //    전면 오버레이를 깔면 이 단언이 먼저 깨진다.
  const outsideIsAlive = await page.evaluate(() => {
    const hit = document.elementFromPoint(8, 8);
    return !hit?.closest(".source-survey");
  });
  expect(outsideIsAlive).toBe(true);

  // ③ 닫으면 사라지고 다시 뜨지 않는다.
  await page.getByRole("button", { name: "나중에" }).click();
  await expect(card).toHaveCount(0);
});
