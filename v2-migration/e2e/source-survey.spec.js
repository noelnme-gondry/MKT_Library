import { test, expect } from "@playwright/test";

import { SOURCE_SURVEY_ANSWERED_KEY, SOURCE_SURVEY_SEEN_KEY } from "./support/sourceSurvey.js";

// 기본 시드를 풀고 실제 결과 뒤에서 설문을 띄운다. 설문은 결과·조작과 겹치지
// 않아야 하며, 지연 노출이 읽는 위치와 포커스를 바꾸면 안 된다.
const clearSeed = async (page) => {
  await page.addInitScript(([answeredKey, seenKey]) => {
    try {
      if (sessionStorage.getItem("test:survey-seeded")) return;
      sessionStorage.setItem("test:survey-seeded", "1");
      localStorage.removeItem(answeredKey);
      sessionStorage.removeItem(seenKey);
      // 도치 인사가 떠 있으면 서베이는 그 뒤로 미뤄진다 — 여기서는 서베이만 본다.
      localStorage.setItem("mkt-library-dochi-welcome-dismissed", "1");
    } catch { /* 저장소가 막히면 노출 쪽으로 떨어진다(그래도 테스트는 성립한다). */ }
  }, [SOURCE_SURVEY_ANSWERED_KEY, SOURCE_SURVEY_SEEN_KEY]);
};

for (const locale of ["ko", "en"]) test(`유입 설문은 결과 아래에 표시하고 분석을 덮지 않는다 (${locale})`, async ({ page }) => {
  const en = locale === "en";
  await page.clock.install();
  await clearSeed(page);
  await page.goto(`${en ? "/en" : ""}/tools/operations-planner`);

  const card = page.locator(".source-survey");
  await expect(card).toHaveCount(0);
  await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
  await page.getByRole("button", { name: en ? "Run the example and see results" : "예시 데이터로 결과 바로 보기", exact: true }).click();
  await expect(page.locator("#ops-budget-title")).toBeVisible();
  const metric = page.getByRole("button", { name: /^CTR / });
  await metric.focus();
  const scrollBefore = await page.evaluate(() => scrollY);
  await expect(card).toHaveCount(0);
  await page.clock.fastForward(60_001);
  await expect(card).toBeVisible();
  await expect(metric).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
  // DOM 소속과 실제 박스를 함께 확인한다. fixed 카드도 main 안에 있을 수 있다.
  const layout = await page.evaluate(() => {
    const survey = document.querySelector(".source-survey");
    const rect = survey.getBoundingClientRect();
    const result = document.querySelector(".result-action-card").getBoundingClientRect();
    return {
      inContent: Boolean(survey.closest("#content")),
      position: getComputedStyle(survey).position,
      afterResult: rect.top >= result.bottom,
      width: rect.width,
      left: rect.left,
      right: innerWidth - rect.right,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(layout.inContent).toBe(true);
  expect(layout.position).toBe("relative");
  expect(layout.afterResult).toBe(true);
  expect(layout.width).toBeGreaterThan(0);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeGreaterThanOrEqual(0);
  expect(layout.overflow).toBeLessThanOrEqual(1);

  // ② 백드롭이 없다 — 카드 밖 아무 지점이나 hit-test하면 카드가 아니어야 한다.
  //    전면 오버레이를 깔면 이 단언이 먼저 깨진다.
  const outsideIsAlive = await page.evaluate(() => {
    const hit = document.elementFromPoint(8, 8);
    return !hit?.closest(".source-survey");
  });
  expect(outsideIsAlive).toBe(true);

  // ③ 닫으면 사라지고 다시 뜨지 않는다.
  await page.getByRole("button", { name: en ? "Later" : "나중에", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
  await page.getByRole("button", { name: en ? "Run the example and see results" : "예시 데이터로 결과 바로 보기", exact: true }).click();
  await expect(page.locator("#ops-budget-title")).toBeVisible();
  await page.clock.fastForward(60_001);
  await expect(card).toHaveCount(0);
});
