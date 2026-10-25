import { expect, test } from "@playwright/test";
import { publishedToolIds } from "../src/lib/routeMap";
import { exampleHref } from "../src/lib/exampleLink";

// 결과 화면 임원 보고 형식(product-ssot §5.5, 2026-10-23 사용자 결정)을 발행 도구 전부에서 잰다.
// 손으로 쓴 목록은 새 도구를 놓친다 — routeMap에서 파생한다.
// ① 결론 문장은 숫자 1개 이상 또는 "보류" ② 핵심 수치 최대 3개 ③ "자세히 보기"는 기본 닫힘.
const TOOLS = publishedToolIds();

test("published tools are counted from the route map", () => {
  expect(TOOLS.length).toBeGreaterThan(10);
});

for (const locale of ["ko", "en"]) {
  for (const toolId of TOOLS) {
    test(`example result follows the executive format (${toolId}, ${locale})`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-1440", "형식 계약은 폭과 무관 — 데스크톱 한 번만 잰다");
      test.setTimeout(150_000);
      const en = locale === "en";
      // 예시는 링크로도 열린다(§12.8 ?example=1) — 블로그·공유와 같은 진입 경로.
      const href = exampleHref(toolId, locale);
      test.skip(!href, "EN 미지원 도구(EN_READY 게이트)");
      await page.goto(href);
      const card = page.locator(".result-action-card").first();
      await expect(card).toBeVisible({ timeout: 120_000 });

      const headline = ((await card.locator(".result-action-card__headline").first().textContent()) || "").trim();
      const holds = en ? /\bhold\b|withheld|not established|cannot|inconclusive/i : /보류/;
      expect(/\d/.test(headline) || holds.test(headline), `결론에 숫자도 보류 사유도 없다: "${headline}"`).toBe(true);

      expect(await card.locator(".result-action-card__stats > div").count()).toBeLessThanOrEqual(3);

      const toggles = page.locator("[data-result-details-toggle]");
      for (const toggle of await toggles.all()) await expect(toggle).toHaveAttribute("aria-expanded", "false");
    });
  }
}
