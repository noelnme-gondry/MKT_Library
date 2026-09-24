import { expect, test } from "@playwright/test";
import { measureDesignRules } from "./support/designRules";

// 사이트 전역 디자인 규칙(2026-09-24). 규칙과 사유는 e2e/support/designRules.js 머리 주석.
// 정적 화면과, 예시 데이터로 실제 결과를 그린 도구 화면을 같이 본다 — 결과 화면에서만
// 생기는 겹침·상자 안 상자는 빈 업로드 화면으로는 절대 안 잡힌다.
const STATIC_PAGES = [
  "/", "/start", "/blog", "/blog/ad-performance-diagnosis", "/blog/ios-att-skan-guide",
  "/guide/kpi-analysis", "/glossary", "/templates", "/compare",
  "/en", "/en/blog/ad-performance-diagnosis", "/en/start",
  // 2026-09-24 점검에서 눈금 막대·상자 안 상자·작은 라벨이 남아 있던 화면.
  "/calculator", "/calculator/target-cpa", "/diagnose", "/subscription", "/contact", "/privacy", "/terms", "/projects", "/weekly-review",
  "/compare/incrementality-methods", "/templates/dashboard", "/tools/mmm-contribution", "/tools/cannibalization-diagnosis",
  // 결론 카드가 수동 입력 뒤에야 그려지는 도구는 입력 화면을 본다.
  "/tools/budget-allocation", "/tools/experiment-analysis", "/tools/incrementality",
];
const RESULT_PAGES = [
  "/dashboard", "/tools/campaign-variance", "/tools/campaign-saturation",
  "/tools/aha-moment", "/tools/vif-multicollinearity",
  "/tools/aso-store-conversion", "/tools/marketing-trend", "/tools/segment-composition-change", "/content/freshness",
  "/tools/asa-keyword-finder", "/tools/brand-campaign-incrementality", "/tools/subscription-survival",
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
  // 예시 안내 대화상자가 뜨면 나머지 화면이 보조기술에서 숨겨져 분석 버튼을 못 찾는다 — 먼저 닫는다.
  const later = page.getByRole("button", { name: /^(나중에|Not now)$/ }).first();
  await expect(async () => {
    if (await example.isVisible()) await example.click();
    if (await later.isVisible()) await later.click();
    await expect(card.or(analyze)).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 60_000 });
  if (await later.isVisible()) await later.click();
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
  expect(result.smallHeadings, "heading smaller than body text").toEqual([]);
  expect(result.horizontalOverflow, "page scrolls sideways").toBeLessThanOrEqual(1);
  expect(result.emoji, "pictographic emoji (status marks like ✓ ⚠ are fine)").toEqual([]);
  expect(result.caps, "all-caps labels").toEqual([]);
  expect(result.monoNumbers, "numbers in a monospace font").toEqual([]);
}

test("the scanner flags what it claims to flag", async ({ page }) => {
  await page.setContent(`<main id="main-content">
    <div style="background:#eee;border:1px solid #999;border-radius:8px;padding:12px">
      <div style="background:#ddd;border:1px solid #999;border-radius:8px;height:60px">inner box</div>
    </div>
    <p style="font-size:12px;margin:0">EYEBROW</p><h2 style="font-size:24px;margin:0">Heading</h2>
    <h3 style="font-size:12px">tiny heading</h3>
    <p>🎯 emoji label</p><p style="text-transform:uppercase;letter-spacing:2px">start here</p><p style="font-family:monospace">1,234</p>
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
  expect(result.smallHeadings.length).toBeGreaterThan(0);
  expect(result.emoji.length).toBeGreaterThan(0);
  expect(result.caps.length).toBeGreaterThan(0);
  expect(result.monoNumbers.length).toBeGreaterThan(0);
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
    // 결과가 나왔으면 매핑 선택상자는 결론 카드 위에 하나도 없어야 한다 — 매핑은 한 줄 요약으로 접힌다.
    const mappingAbove = await page.evaluate(() => {
      const card = [...document.querySelectorAll(".result-action-card")].find((el) => el.checkVisibility());
      const top = card.getBoundingClientRect().top;
      return [...document.querySelectorAll(".mapping-grid select, .segment-role-mapper select, #s-aha-map select, #brand-its-setup select")]
        .filter((el) => el.checkVisibility() && el.getBoundingClientRect().top < top).length;
    });
    expect(mappingAbove).toBe(0);
  });
}

// 예시 버튼만으로는 결론 카드까지 가지 않는 도구(5-3 예산 · 5-4 판독 · 5-23 홀드아웃)는 실제 입력을 밟아
// 결과 화면을 연다. 입력 화면만 재면 결과에서만 생기는 상자·글자 문제를 영영 못 본다(2026-09-24).
const MANUAL_RESULTS = {
  "/tools/budget-allocation": async (page) => {
    await expect(page.locator('.csv-uploader input[type="file"]').first()).toBeEnabled();
    await page.locator('.csv-uploader input[type="file"]').first().setInputFiles("e2e/fixtures/efficiency.csv");
    await expect(page.locator(".csv-uploader .file-state")).toContainText("efficiency.csv");
    // 원본 통화를 묻는 도구는 선언해야 분석이 열린다(환산하지 않는 단위 선언).
    const currency = page.locator('.csv-uploader [data-currency-scope="declare"]').first();
    if (await currency.count()) await currency.getByRole("button", { name: /^원 ₩$/ }).click();
    const confirmations = page.getByRole("button", { name: "확인", exact: true });
    while (await confirmations.count()) await confirmations.first().click();
    await page.locator(".csv-uploader").getByRole("button", { name: "데이터 분석하기", exact: true }).click();
  },
  "/tools/experiment-analysis": async (page) => {
    await expect(async () => {
      await page.getByRole("tab", { name: /A\/B 판독/ }).click();
      await expect(page.getByRole("button", { name: /예시 데이터로 결과 바로 보기/ }).first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await openExampleResult(page);
  },
  "/tools/incrementality": async (page) => {
    await expect(page.locator('#tab-incr[data-hydrated="true"]')).toBeVisible();
    const rows = Array.from({ length: 16 }, (_, index) => {
      const date = `2026-08-${String(index + 1).padStart(2, "0")}`;
      return `${date},exposed,${index < 8 ? 100 : 150},1000,100,200\r\n${date},holdout,100,1000,0,100`;
    });
    await page.locator('#tab-incr input[type="file"]').setInputFiles({ name: "holdout-design.csv", mimeType: "text/csv", buffer: Buffer.from(`date,holdout_group,numerator,denominator,spend,revenue_d7\r\n${rows.join("\r\n")}`) });
    await page.getByLabel("홀드아웃 시작일").selectOption("2026-08-09");
    await page.getByLabel("홀드아웃 종료일").selectOption("2026-08-16");
  },
};

for (const [path, open] of Object.entries(MANUAL_RESULTS)) {
  test(`design rules hold on the ${path} result after real input`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(path);
    await open(page);
    await expect(page.locator(".result-action-card").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);
    expectClean(await measureDesignRules(page));
  });
}
