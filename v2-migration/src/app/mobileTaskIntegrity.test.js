import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 모바일에서 핵심 과업이 사라지지 않는지.
 *
 * `docs/product-ssot.md` §5.3·§6.5: 반응형이 기능 격차가 되면 안 된다. 320px에서도
 * 파일 선택·오류 수정·분석 실행·결론 확인·저장이 끝나야 한다. 라벨을 줄이거나
 * 사이드바를 접는 것은 정당한 축소지만, **행동 자체를 지우는 것**은 아니다.
 *
 * 실기기 확인을 대신하지는 못한다(jsdom은 레이아웃을 계산하지 않는다). 이 검사는
 * "규칙으로 명시적으로 지운 것"만 잡는다 — 겹침·잘림은 사람이 봐야 한다(§8.3).
 */

const CSS = readFileSync(
  path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "app/globals.css"),
  "utf-8",
);

// 이 클래스들이 사라지면 그 화면에서 과업이 끝나지 않는다. 장식이 아니라 행동이다.
const CORE_ACTIONS = [
  { pattern: /\.dc-action-route--primary\b/, why: "홈의 주 진입 행동" },
  { pattern: /\.result-action-card\b(?![-_])/, why: "결론 카드 — 결과 확인" },
  { pattern: /\.csv-guide-example-btn\b/, why: "예시 데이터로 시작" },
  { pattern: /\.ab-button\b/, why: "분석 실행" },
  { pattern: /\.tool-index__link\b/, why: "도구 진입" },
  { pattern: /\.blocked-options-note\b/, why: "막힌 이유 안내" },
];

/** 모바일 미디어쿼리(≤820px) 안에서 display:none 되는 셀렉터를 모은다. */
function hiddenOnMobile() {
  const out = [];
  for (const query of CSS.matchAll(/@media[^{]*max-width:\s*(\d+)px[^{]*\{/g)) {
    const width = Number(query[1]);
    if (width > 820) continue;
    let index = query.index + query[0].length;
    let depth = 1;
    while (index < CSS.length && depth > 0) {
      if (CSS[index] === "{") depth += 1;
      else if (CSS[index] === "}") depth -= 1;
      index += 1;
    }
    const block = CSS.slice(query.index + query[0].length, index);
    for (const rule of block.matchAll(/([^{}]+)\{([^{}]*display:\s*none[^{}]*)\}/g)) {
      out.push({ width, selector: rule[1].trim().replace(/\s+/g, " ") });
    }
  }
  return out;
}

describe("mobile task integrity", () => {
  it("never hides a core action at a mobile width", () => {
    const hidden = hiddenOnMobile();
    // 대상이 0이면 스캐너가 깨진 것이다 — 규칙은 실제로 존재한다.
    expect(hidden.length, "모바일 display:none 규칙을 하나도 못 찾았다 — 스캐너 확인").toBeGreaterThan(5);

    const offenders = [];
    for (const rule of hidden) {
      // 셀렉터가 여러 개면 각각 본다. 그리고 **마지막 대상**만 본다 —
      // `.x > span`은 자식 라벨을 줄이는 것이지 `.x`를 지우는 게 아니다.
      // `:not(.x)`도 제외한다: 그 안의 클래스는 대상이 아니라 조건이다.
      // (실제로 `.dc-action-route:not(.dc-action-route--primary) > span`이 오탐으로 잡혔다.)
      for (const one of rule.selector.split(",")) {
        const target = one.trim().split(/[>+~]|\s+/).filter(Boolean).pop() || "";
        const withoutNot = target.replace(/:not\([^)]*\)/g, "");
        for (const action of CORE_ACTIONS) {
          if (action.pattern.test(withoutNot)) {
            offenders.push(`≤${rule.width}px "${one.trim()}" — ${action.why}`);
          }
        }
      }
    }
    expect(
      offenders,
      "모바일에서 핵심 행동을 지웠다. 구조를 재배치하되 행동은 남길 것(product-ssot §5.3)",
    ).toEqual([]);
  });

  // 320px 계약의 근거. 최소 폭 규칙이 통째로 사라지면 좁은 화면을 아무도 안 보고 있다는 뜻이다.
  it("still has rules written for the narrowest supported width", () => {
    const narrow = [...CSS.matchAll(/@media[^{]*max-width:\s*(\d+)px/g)]
      .map((match) => Number(match[1]))
      .filter((width) => width <= 480);
    expect(narrow.length, "480px 이하를 겨냥한 규칙이 없다").toBeGreaterThan(0);
  });
});
