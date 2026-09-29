import { expect, test } from "@playwright/test";
import { hasEnVersion, idToSlug, publishedToolIds } from "../src/lib/routeMap";
import { toolIndexEntry } from "../src/lib/toolIndex";

// 홈에서 "증액 여력 진단"을 눌렀는데 "마케팅 효율 진단 (Saturation)"이 열렸다 — 발행 도구
// 20개 전부의 보이는 제목이 목록·경로 이름과 달랐다(2026-09-29 실측). 제목은 레지스트리
// 이름 하나이고 검색어형 이름은 제목 밑 한 줄이다(사용자 결정 A). 제목을 그리는 경로가
// 도구마다 달라서(ToolIntro · ToolPageShell · Dashboard · PaidOrganicTrend) 단위 테스트
// 하나로는 전부를 못 본다 — 실제 화면에서 발행 도구 전체를 파생해 잰다.
const TOOLS = publishedToolIds();

test("published tools are counted from the route map", () => {
  expect(TOOLS.length).toBeGreaterThan(10);
});

for (const toolId of TOOLS) {
  test(`visible title matches the tool list name (${toolId})`, async ({ page }) => {
    await page.goto(idToSlug[toolId]);
    const h1 = page.locator("h1").filter({ visible: true });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(toolIndexEntry(toolId, "ko").name);
    if (hasEnVersion(toolId)) {
      await page.goto(`/en${idToSlug[toolId]}`);
      await expect(page.locator("h1").filter({ visible: true })).toHaveText(toolIndexEntry(toolId, "en").name);
    }
  });
}
