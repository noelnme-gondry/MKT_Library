import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const CSS = stripSourceComments(readFileSync(new URL("./globals.css", import.meta.url), "utf8"));

// 근거를 고정하는 가드다(§7 "가드가 '지금 값'을 그대로 적으면 그 순간부터 버그를
// 지킨다"). 값(17px)이 아니라 **왜 선언이 필요한지**를 지킨다:
//
//   globals.css는 `@layer app` 안에 요소 셀렉터 `p { font-size:14px }` ·
//   `li { line-height:22px }`를 갖고 있다. 이건 특이도 (0,0,1)이라
//   `.blog-prose { font-size:17px }`(0,1,0)가 **컨테이너에** 건 값의 상속을 이긴다.
//   반대로 font-size를 선언하지 않은 요소는 상속을 받는다 — 그래서 원고 본문이
//   문단 14px / 목록 17px로 갈렸다(실측 후 수정, PR 블로그 레이아웃).
//
// 그러므로: 전역 요소 규칙이 살아 있는 한 `.blog-prose p`·`li`는 상속을 명시적으로
// 되돌려야 한다. 전역 규칙이 사라지면 이 가드의 근거도 사라지므로, 근거가 아직
// 있는지도 함께 단언한다(근거가 없어지면 예외도 무너져야 한다).
function ruleBody(selector) {
  const re = new RegExp(`(^|[},;/])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "m");
  const m = CSS.match(re);
  return m ? m[2] : null;
}

describe("블로그 원고 본문은 요소 종류와 무관하게 한 크기다", () => {
  it("가드의 근거 — 전역 요소 규칙이 아직 상속을 끊고 있다", () => {
    const p = ruleBody("p");
    const li = ruleBody("li");
    expect(p, "globals.css의 전역 `p` 규칙을 못 찾았다 — 셀렉터가 바뀌었으면 이 가드를 다시 설계할 것").toBeTruthy();
    expect(p).toMatch(/font-size:/);
    expect(li).toMatch(/line-height:/);
  });

  it(".blog-prose p / li 가 컨테이너 상속을 되돌린다", () => {
    const p = ruleBody(".blog-prose p");
    const li = ruleBody(".blog-prose li");
    expect(p).toMatch(/font-size:\s*inherit/);
    expect(p).toMatch(/line-height:\s*inherit/);
    expect(li).toMatch(/line-height:\s*inherit/);
  });

  it(".blog-prose 컨테이너가 실제 크기를 소유한다(한 곳에서만 결정)", () => {
    const bodies = [...CSS.matchAll(/(^|[},;])\s*\.blog-prose\s*\{([^}]*)\}/g)].map((m) => m[2]);
    const withSize = bodies.filter((b) => /font-size:/.test(b));
    expect(withSize.length, ".blog-prose 컨테이너에 font-size 선언이 있어야 한다").toBeGreaterThan(0);
  });
});
