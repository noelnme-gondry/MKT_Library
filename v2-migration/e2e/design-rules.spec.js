import { expect, test } from "@playwright/test";
import { measureDesignRules } from "./support/designRules";

// 사이트 전역 디자인 규칙(2026-09-24). 규칙과 사유는 e2e/support/designRules.js 머리 주석.
// 정적 화면과, 예시 데이터로 실제 결과를 그린 도구 화면을 같이 본다 — 결과 화면에서만
// 생기는 겹침·상자 안 상자는 빈 업로드 화면으로는 절대 안 잡힌다.
const STATIC_PAGES = [
  "/", "/start", "/blog", "/blog/ad-performance-diagnosis", "/blog/ios-att-skan-guide",
  "/guide/kpi-analysis", "/glossary", "/templates", "/compare",
  "/en", "/en/blog/ad-performance-diagnosis", "/en/start",
  // 결론 카드가 수동 입력 뒤에야 그려지는 도구는 입력 화면을 본다.
  "/tools/budget-allocation", "/tools/experiment-analysis", "/tools/incrementality",
];
const RESULT_PAGES = [
  "/dashboard", "/tools/campaign-variance", "/tools/campaign-saturation",
  "/tools/aha-moment", "/tools/vif-multicollinearity",
  "/tools/aso-store-conversion", "/tools/marketing-trend", "/tools/segment-composition-change", "/content/freshness",
  "/en/tools/campaign-variance",
];

// 도구마다 예시가 자동으로 실리기도 하고 버튼으로 실리기도 한다 — 상태를 보고 필요한 단계만 밟는다.
async function openExampleResult(page) {
  // 도구 본문은 동적으로 늦게 붙는다 — 버튼이 "있는지" 바로 세면 아직 없어서 건너뛴다.
  // 예시 버튼·분석 버튼·결과 카드 중 하나가 뜰 때까지 기다린 뒤 필요한 단계만 밟는다.
  const example = page.getByRole("button", { name: /예시 데이터로 결과 바로 보기|Run the example/ }).first();
  const analyze = page.getByRole("button", { name: /^(▶ )?(데이터 )?분석하기$|^Analyze data$/ }).first();
  const card = page.locator(".result-action-card").first();
  await expect(example.or(analyze).or(card)).toBeVisible({ timeout: 30_000 });
  // 빌드본은 버튼이 서버 렌더로 먼저 보이고 하이드레이션은 뒤에 붙는다 — 그 사이의 클릭은
  // 사라지므로, 결과나 분석 버튼이 나타날 때까지 클릭을 다시 건다.
  await expect(async () => {
    if (await example.isVisible()) await example.click();
    await expect(card.or(analyze)).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 60_000 });
  const later = page.getByRole("button", { name: /^(나중에|Not now)$/ });
  if (await later.count()) await later.first().click();
  if (!(await card.isVisible())) await analyze.click();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(500);
}

function expectClean(result) {
  expect(result.textCount, "the scanner must see the page").toBeGreaterThan(20);
  expect(result.overlaps, "text overlapping other text").toEqual([]);
  expect(result.covering, "fixed or sticky element covering content").toEqual([]);
  expect(result.offWeights, "font weights outside 400/600/700").toEqual([]);
  expect(result.nested, "box inside a box").toEqual([]);
  expect(result.eyebrows, "small label stuck above a heading").toEqual([]);
  expect(result.misaligned, "stacked sibling boxes with different edges").toEqual([]);
  expect(result.accents, "left color bar on a filled box").toEqual([]);
}

test("the scanner flags what it claims to flag", async ({ page }) => {
  await page.setContent(`<main id="main-content">
    <div style="background:#eee;border:1px solid #999;border-radius:8px;padding:12px">
      <div style="background:#ddd;border:1px solid #999;border-radius:8px;height:60px">inner box</div>
    </div>
    <p style="font-size:12px;margin:0">EYEBROW</p><h2 style="font-size:24px;margin:0">Heading</h2>
    <p style="font-weight:800">heavy</p>
    <div style="border-left:4px solid blue;background:#eef;height:40px">accent</div>
    <section style="border-top:1px solid #999;height:60px;margin:0 20px 0 0">a</section><section style="border-top:1px solid #999;height:60px">b</section>
    <p style="position:relative;margin:0">overlap one</p><p style="position:relative;top:-18px;margin:0">overlap two</p>
    ${"<p>filler text</p>".repeat(20)}
  </main>`);
  const result = await measureDesignRules(page);
  expect(result.nested.length).toBeGreaterThan(0);
  expect(result.eyebrows.length).toBeGreaterThan(0);
  expect(result.offWeights.length).toBeGreaterThan(0);
  expect(result.accents.length).toBeGreaterThan(0);
  expect(result.misaligned.length).toBeGreaterThan(0);
  expect(result.overlaps.length).toBeGreaterThan(0);
});

for (const path of STATIC_PAGES) {
  test(`design rules hold on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.waitForLoadState("networkidle");
    expectClean(await measureDesignRules(page));
  });
}

for (const path of RESULT_PAGES) {
  test(`design rules hold on the ${path} example result`, async ({ page }) => {
    // 9-6은 소재 480개를 분석해 그리는 데만 1분 가까이 걸린다(빌드본 기준).
    test.setTimeout(150_000);
    await page.goto(path);
    await openExampleResult(page);
    expectClean(await measureDesignRules(page));
  });
}
