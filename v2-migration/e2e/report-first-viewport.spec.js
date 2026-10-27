import { expect, test } from "@playwright/test";

// 결과 보고서 틀(product-ssot §1.1c): 예시 결과를 열면 결론 문장이 첫 화면 안에 있어야 한다.
// 가드는 "지금 값"이 아니라 근거를 고정한다 — 결론 칸의 아래 끝이 뷰포트 높이 안인가.
// 아직 충족하지 못한 조합은 빼지 않고 사유와 함께 적는다(빠진 것과 뺀 것을 구분, AGENTS §7).
const TOOLS = [
  { id: "5-21", path: "/tools/campaign-variance" },
  { id: "5-22", path: "/tools/campaign-saturation" },
  { id: "5-31", path: "/tools/operations-planner" },
  { id: "5-2", path: "/dashboard" },
];
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 980, height: 900 },
  { width: 390, height: 844 },
];
const KNOWN_GAPS = {
  // 하위 분석 탭 12개가 폰에서 세 줄을 차지한다 — 탭 구조 개편은 2단계 결정 사항이다.
  "5-2@390": "dashboard sub-tabs take three rows on phones",
};

for (const locale of ["ko", "en"]) {
  for (const viewport of VIEWPORTS) {
    for (const tool of TOOLS) {
      const gap = KNOWN_GAPS[`${tool.id}@${viewport.width}`];
      test(`conclusion sits in the first screen: ${tool.id} ${viewport.width}px (${locale})`, async ({ page }) => {
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
