import { expect, test } from "@playwright/test";
import { publishedToolIds, idToSlug } from "../src/lib/routeMap";
import { ALWAYS_OWN_INPUT_LINE_TOOL_IDS, SETUP_BAR_INPUT_TOOL_IDS } from "../src/lib/report/reportContextTools";

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
// 결론이 첫 화면 아래인 도구를 사유와 함께 적는 자리(빠진 것과 뺀 것을 구분, AGENTS §7).
// 4단계에서 발행 도구 전부를 첫 화면 안으로 옮겨 지금은 비어 있다(2026-10-28). 새로 적으려면 사유를 값으로 쓴다.
const KNOWN_GAPS = {};

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

// 입력(파일·행 수)은 결과 화면에 한 번만 말한다 — 맨 위 "현재 입력" 줄과 도구 자신의 입력 줄
// (접힌 업로더·맥락 줄·데이터 줄·제목 줄) 중 정확히 한쪽만 보인다. lib/report/reportContextTools의
// 두 목록이 실제 화면과 맞는지 여기서 잰다(목록만 믿으면 입력 줄이 사라진 도구가 안 보인다).
const OWN_INPUT_LINES = ".csv-uploader--collapsed, .report-context, .file-state, .dashboard-sticky-context__meta, .operations-planner__context, .csv-loaded-bar";
for (const tool of TOOLS) {
  test(`input is stated once after the result: ${tool.id}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough for presence");
    await page.goto(`${tool.path}?example=1`);
    // 무거운 엔진(MMM 등)은 예시 결과까지 10초를 넘길 수 있다.
    await expect(page.locator(".result-action-card__headline").filter({ visible: true }).first()).toBeVisible({ timeout: 30000 });
    const visible = async (selector) => page.locator(selector).evaluateAll((nodes) => nodes.some((node) => node.checkVisibility()));
    await expect.poll(async () => ({ bar: await visible(".analysis-setup__context"), own: await visible(OWN_INPUT_LINES) }))
      .toEqual(SETUP_BAR_INPUT_TOOL_IDS.includes(tool.id) ? { bar: true, own: false } : { bar: false, own: true });
  });
}

test("input-line lists name published tools only", () => {
  const unknown = [...ALWAYS_OWN_INPUT_LINE_TOOL_IDS, ...SETUP_BAR_INPUT_TOOL_IDS].filter((id) => !TOOLS.some((tool) => tool.id === id));
  expect(unknown).toEqual([]);
});
