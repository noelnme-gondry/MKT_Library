import { expect, test } from "@playwright/test";
import { publishedToolIds } from "../src/lib/routeMap";
import { exampleHref } from "../src/lib/exampleLink";
import { TEMPLATE_PAGES } from "../src/lib/templateCatalog";

// 예시 결과는 버튼뿐 아니라 주소 하나로도 열린다(?example=1, 2026-09-29) — 블로그·템플릿·외부 공유·AI
// 답변이 가리킬 수 있는 "라이브 데모" 링크다. 예시 버튼과 같은 핸들러를 타므로 성공 조건도 같다
// (example-straight-to-result.spec.js: 결론 카드가 뜨고 안내 창이 끼지 않는다). 발행 도구 전체에서 파생.
const TOOLS = publishedToolIds();

test("published tools are counted from the route map", () => {
  expect(TOOLS.length).toBeGreaterThan(10);
});

for (const toolId of TOOLS) {
  test(`example link opens the result (${toolId})`, async ({ page }) => {
    test.setTimeout(150_000);
    const href = exampleHref(toolId, "ko");
    expect(href).toMatch(/\?example=1$/);
    await page.goto(href);
    await expect(page.locator(".result-action-card").first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // 한 번 쓴 파라미터는 지운다 — 새로고침·주소 복사가 올린 파일을 예시로 덮지 않게.
    await expect(page).not.toHaveURL(/example=1/);
  });
}


// 템플릿 상세는 "이 CSV를 채우면 무엇이 나오나"를 빈 도구가 아니라 예시 결과로 보여 준다(DashThis식
// 템플릿 → 결과 샘플). 발행 도구의 템플릿 전부가 예시 링크를 갖는지는 링크 계약(exampleHref)이 보장한다.
test("template detail links to its tool's example result", async ({ page }) => {
  const template = TEMPLATE_PAGES.find((item) => exampleHref(item.toolId, "ko"));
  expect(template).toBeTruthy();
  await page.goto(`/templates/${template.slug}`);
  const link = page.getByRole("link", { name: "예시 결과 보기 →" });
  await expect(link).toHaveAttribute("href", exampleHref(template.toolId, "ko"));
  await link.click();
  await expect(page.locator(".result-action-card").first()).toBeVisible({ timeout: 120_000 });
});
