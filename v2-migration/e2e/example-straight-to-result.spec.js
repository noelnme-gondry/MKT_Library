import { expect, test } from "@playwright/test";
import { idToSlug, publishedToolIds } from "../src/lib/routeMap";

// 예시는 "결과가 어떻게 나오나"를 보여 주는 길이다. 예시를 눌렀는데 매핑 확인·분석하기
// 클릭·안내 창이 한 번 더 끼면 첫 체험이 그 자리에서 끊긴다(2026-09-24 사용자 결정).
// 발행 도구 전부에서 파생한다 — 손으로 쓴 목록은 새 도구를 놓친다.
const TOOLS = publishedToolIds();

test("published tools are counted from the route map", () => {
  expect(TOOLS.length).toBeGreaterThan(10);
});

for (const toolId of TOOLS) {
  test(`example goes straight to the result (${toolId})`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(idToSlug[toolId]);
    const example = page.getByRole("button", { name: /예시 데이터로 결과 바로 보기/ }).first();
    const card = page.locator(".result-action-card").first();
    await expect(example.or(card)).toBeVisible({ timeout: 30_000 });
    // 빌드본은 버튼이 서버 렌더로 먼저 보이고 하이드레이션이 뒤에 붙는다 — 그 사이 클릭은 사라진다.
    await expect(async () => {
      if (await example.isVisible()) await example.click();
      await expect(card).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 120_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}
