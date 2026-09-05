import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// 기존 e2e는 base `use.colorScheme: "dark"`로 돈다. 라이트 모드를 실제로 보는 것은
// `desktop-light-en` 프로젝트 하나뿐이고 그건 EN `/start` 한 화면만 본다 — 즉
// **도구·블로그의 라이트 모드는 아무도 렌더해서 본 적이 없었다.**
//
// 그 사이 슬림 푸터(전 도구 페이지)가 3.07:1까지 떨어져 있었다. 영구 다크 표면에
// 테마 토큰 글자색을 쓴 조합이라, CSS를 정적으로 읽는 가드는 구조적으로 못 본다.
// 배경과 글자를 실제로 합성해 봐야 나온다.
test.use({ colorScheme: "light" });

// 뷰포트 프로젝트 셋에서 모두 돈다. 폭에 따라 색이 바뀌는 규칙이 실제로 있으므로
// (예: 좁은 폭에서만 적용되는 배경) 한 폭만 보면 그 규칙이 검사 밖에 남는다.

const ROUTES = [
  ["/", "홈"],
  ["/start", "데이터로 시작"],
  ["/dashboard", "운영 대시보드"],
  ["/tools/budget-allocation", "예산 배분"],
  ["/blog", "블로그"],
  ["/weekly-review", "주간 검토"],
];

for (const [path, label] of ROUTES) {
  test(`${label} 라이트 모드에서 본문 대비가 AA를 넘는다`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    // 진입 애니메이션이 도는 중에 재면 중간 opacity가 배경과 섞여 **없는 색**이 나온다.
    // 실제로 CI에서 `--dc-text-dim`(#5d6f85)이 opacity 0.71로 섞인 #8a97a7으로 잡혀
    // 위반처럼 보였다. 끝난 상태에서만 재도록 유한 애니메이션을 즉시 종료시킨다
    // (무한 반복은 finish()가 던지므로 건너뛴다).
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        try { animation.finish(); } catch { /* 무한 반복 — 최종 상태가 없다 */ }
      }
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2aa", "wcag21aa"])
      .analyze();
    const contrast = results.violations.filter((violation) => violation.id === "color-contrast");
    // 실패했을 때 어느 요소가 몇 대 몇인지 바로 보이게 남긴다 — 숫자가 없으면
    // 다음 사람이 다시 재야 한다.
    const detail = contrast.flatMap((violation) => violation.nodes.map((node) => (
      `${node.target.join(" ")} — ${(node.any?.[0]?.message || "").replace(/\s+/g, " ")}`
    ))).join("\n");
    expect(contrast, detail).toEqual([]);
  });
}
