import { expect, test } from "@playwright/test";
import { publishedToolIds, idToSlug } from "../src/lib/routeMap";

// 결과 보고서 틀(product-ssot §1.1c): 예시 결과를 열면 결론 문장이 첫 화면 안에 있어야 한다.
// 가드는 "지금 값"이 아니라 근거를 고정한다 — 결론 칸의 아래 끝이 뷰포트 높이 안인가.
// 아직 충족하지 못한 조합은 빼지 않고 사유와 함께 적는다(빠진 것과 뺀 것을 구분, AGENTS §7).
// 발행 도구 전체에서 파생한다 — 손으로 고른 목록은 빠진 도구를 가린다(AGENTS §7 메타 1).
const TOOLS = publishedToolIds().map((id) => ({ id, path: idToSlug[id] }));
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 980, height: 900 },
  { width: 390, height: 844 },
];
// 아직 결론이 첫 화면 아래인 도구 — 4단계에서 하나씩 지운다(2026-10-27 실측: 폰 958~2,579px).
// 도구 단위로 적는다(폭마다 따로 적지 않는다). 지운 도구는 세 폭 모두 통과해야 한다.
const REPORT_FRAME_PENDING = "보고서 틀(맥락 한 줄·결론 먼저) 미적용 — product-ssot §1.1c 4단계";
const KNOWN_GAPS = {
  "5-23": REPORT_FRAME_PENDING,
  "5-24": REPORT_FRAME_PENDING,
  "5-18-paid-organic": REPORT_FRAME_PENDING,
  "5-18-trend": REPORT_FRAME_PENDING,
  "5-18-cannibal": REPORT_FRAME_PENDING,
  "5-18-mmm": REPORT_FRAME_PENDING,
  "5-18-forecast": REPORT_FRAME_PENDING,
  "5-20": REPORT_FRAME_PENDING,
  "5-25": REPORT_FRAME_PENDING,
  "5-26": REPORT_FRAME_PENDING,
  "5-27": REPORT_FRAME_PENDING,
  "5-28": REPORT_FRAME_PENDING,
  "5-29": REPORT_FRAME_PENDING,
  "9-1": REPORT_FRAME_PENDING,
  "9-6": REPORT_FRAME_PENDING,
};

for (const locale of ["ko", "en"]) {
  for (const viewport of VIEWPORTS) {
    for (const tool of TOOLS) {
      const gap = KNOWN_GAPS[tool.id];
      test(`conclusion sits in the first screen: ${tool.id} ${viewport.width}px (${locale})`, async ({ page }, testInfo) => {
        // 폭은 이 검사가 직접 정한다 — 프로젝트(화면 조건)마다 같은 검사를 되풀이하지 않는다.
        test.skip(testInfo.project.name !== "desktop-1440", "viewport is set by this spec");
        test.skip(Boolean(gap), gap);
        await page.setViewportSize(viewport);
        await page.goto(`${locale === "en" ? "/en" : ""}${tool.path}?example=1`);
        const headline = page.locator(".result-action-card__headline").first();
        await expect(headline).toBeVisible();
        await expect(headline).not.toBeEmpty();
        const bottom = await headline.evaluate((node) => node.getBoundingClientRect().bottom + window.scrollY);
        expect(bottom, `${tool.id} conclusion ends at ${Math.round(bottom)}px`).toBeLessThanOrEqual(viewport.height);
      });
    }
  }
}

test("known gaps name published tools only", () => {
  // 낡은 예외는 예외가 아니다 — 없어진 도구를 가리키는 항목이 남으면 실패한다.
  expect(Object.keys(KNOWN_GAPS).filter((id) => !TOOLS.some((tool) => tool.id === id))).toEqual([]);
});
