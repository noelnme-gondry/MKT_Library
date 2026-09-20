import path from "node:path";
import { expect, test } from "@playwright/test";

// 결과 화면에는 원본 행 수를 한 번만 보여준다. 매핑·미리보기는 별도 편집창에서 확인한다.
// checkVisibility로 실제 표시 여부를 검사하고 편집 진입 경로도 함께 검증한다.
const VISIBLE_ROW_MENTIONS = 1;

const fixture = (name) => path.join(process.cwd(), "e2e", "fixtures", name);

test("대시보드는 행 수를 한 번 표시하고 데이터 편집창을 제공한다", async ({ page }) => {
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

  await expect(page.locator(".csv-uploader")).toHaveCount(0);
  await page.getByRole("button", { name: "데이터·매핑 편집" }).click();
  const editor = page.getByRole("dialog", { name: "데이터·매핑 편집" });
  await expect(editor.locator(".csv-uploader .file-state")).toContainText("16");
  await expect(editor.locator(".csv-preview-table-wrap")).toBeVisible();
});
