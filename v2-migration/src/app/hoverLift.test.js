import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A5(2026-09-24): 올리면 떠오르는 카드는 생성형 UI의 전형이다 — 누를 수 있는 것은 테두리 색으로 답한다.
// 호버는 렌더된 화면 검사로 잡을 수 없어(마우스를 올려야 생긴다) CSS에서 파생해 본다. 옆으로 미는
// 화살표(translateX)는 떠오름이 아니라서 허용하고, 위아래 이동과 호버 그림자만 막는다.
const FILES = ["src/app/globals.css", "src/app/library-workspace.css"];
const RULE = /([^{}]+)\{([^{}]*)\}/g;
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("hover does not lift or shadow", () => {
  const offenders = [];
  let hoverRules = 0;
  for (const file of FILES) {
    const css = stripComments(readFileSync(file, "utf8"));
    for (const [, selector, body] of css.matchAll(RULE)) {
      if (!selector.includes(":hover")) continue;
      hoverRules += 1;
      const transform = body.match(/transform\s*:\s*([^;}]*)/)?.[1] || "";
      if (/translateY\(|translate\(\s*[^,)]+,\s*-?[1-9]|translate3d\(/.test(transform)) offenders.push(`${file}: ${selector.trim()} → transform: ${transform.trim()}`);
      const shadow = body.match(/box-shadow\s*:\s*([^;}]*)/)?.[1]?.trim();
      if (shadow && shadow !== "none" && !/inset|^0 0 0 /.test(shadow)) offenders.push(`${file}: ${selector.trim()} → box-shadow: ${shadow}`);
    }
  }
  it("scans the real stylesheets", () => expect(hoverRules).toBeGreaterThan(20));
  it("no lift or shadow on hover", () => expect(offenders).toEqual([]));
});
