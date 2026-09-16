import path from "node:path";
import { expect, test } from "@playwright/test";

// 외부 글("바이브 코딩 대시보드가 형편없어 보이는 10가지 이유") 7번은 "데이터셋이
// 몇 건인지를 상단·막대·요약 지표에서 거듭 보여준다"였다. 우리 대시보드를 재 보니
// 행 수를 말하는 자리가 다섯인데, 그중 **셋은 닫힌 `<details>` 안**이고 밖에서
// 항상 보이던 것은 둘(sticky 칩 · 저장 설정 바)이었다.
//
// 처음엔 `getBoundingClientRect()`로 가시성을 판정해 "다섯 곳이 전부 보인다"고
// 잘못 읽었다 — 이 API는 `content-visibility`를 반영하지 않아 **접힌 내용도 0이
// 아닌 박스를 돌려준다**. 그 잘못된 실측 위에서 두 곳을 지웠고, 그 둘이 하필
// 항상 보이던 자리라 대시보드에서 행 수가 0번 보이는 회귀가 났다.
//
// 그래서 이 가드는 두 가지를 함께 지킨다:
//   ① 접기를 열지 않고도 행 수를 알 수 있다 (0이면 규모를 알 길이 없다)
//   ② 같은 사실을 여러 번 말하지 않는다 (기사 7번)
// 판정은 반드시 `checkVisibility()`로 한다 — 박스 크기로 세면 접힌 것까지 센다.
const VISIBLE_ROW_MENTIONS = 1;

const fixture = (name) => path.join(process.cwd(), "e2e", "fixtures", name);

test("대시보드는 행 수를 접기 밖에서 정확히 한 번 말한다", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
  await page.locator('.csv-uploader input[type="file"][accept*="csv"]').first().setInputFiles(fixture("efficiency.csv"));
  await expect(page.locator(".csv-uploader .file-state")).toBeVisible();
  const currency = page.locator('.csv-uploader [data-currency-scope="declare"]').first();
  if (await currency.count()) await currency.getByRole("button", { name: /^(원 ₩|KRW ₩)$/ }).click();
  const confirmations = page.getByRole("button", { name: "확인", exact: true });
  while (await confirmations.count()) await confirmations.first().click();
  await page.getByRole("button", { name: "데이터 분석하기" }).click();
  await expect(page.locator(".dashboard-briefing .result-action-card")).toBeVisible();

  const scan = await page.evaluate(() => {
    // 텍스트 **노드** 단위로 세면 안 된다: sticky 칩은 `{16}{"행"}`처럼 두 노드로
    // 렌더돼 한 노드 안에 "16행"이 없다(실제로 그렇게 썼다가 0건이 나왔다).
    // 요소의 textContent로 보되, 같은 문구를 조상까지 중복으로 세지 않도록
    // **가장 안쪽에서 일치하는 요소**만 남긴다.
    const PATTERN = /(?<!\d)16\s*(행|rows)/;
    const shown = [];
    const hidden = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (!PATTERN.test(el.textContent || "")) continue;
      const innerMatch = [...el.children].some((child) => PATTERN.test(child.textContent || ""));
      if (innerMatch) continue;
      const entry = `"${(el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48)}"`;
      if (el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) shown.push(entry);
      else hidden.push(entry);
    }
    return { shown, hidden };
  });

  console.log(`\n보임(${scan.shown.length}): ${scan.shown.join(" / ") || "(없음)"}`);
  console.log(`접힘(${scan.hidden.length}): ${scan.hidden.join(" / ") || "(없음)"}\n`);

  expect(
    scan.shown.length,
    `접기 밖에서 행 수를 말하는 자리가 ${scan.shown.length}곳이다(기대 ${VISIBLE_ROW_MENTIONS}).\n` +
    `  보임: ${scan.shown.join(" / ") || "(없음)"}\n` +
    `  접힘: ${scan.hidden.join(" / ") || "(없음)"}\n` +
    "0이면 사용자가 접기를 열기 전까지 데이터 규모를 알 수 없고, 2 이상이면 같은 사실을 " +
    "거듭 말하는 것이다(정보량은 안 늘고 화면만 찬다). 늘리려면 그 자리가 다른 질문에 " +
    "답하는지 먼저 확인할 것.",
  ).toBe(VISIBLE_ROW_MENTIONS);

  // 가드의 근거 — 접힌 자리가 실제로 있어야 이 검사가 의미를 갖는다. 접기가
  // 사라졌는데 이 숫자만 지키면 "한 번만 말한다"가 우연히 성립한 것일 수 있다.
  expect(scan.hidden.length, "접기 안의 상세가 통째로 사라졌으면 이 가드를 다시 설계할 것").toBeGreaterThan(0);
});
