import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 포커스 링 가드.
 *
 * 배경: `globals.css`에는 전역 `:focus-visible { outline: 2px solid var(--primary) }`가
 * 이미 있다. 그런데 개별 규칙이 `outline: none`/`outline: 0`으로 그 링을 **취소하고**
 * 테두리색·밑줄 같은 미세 변화로 대체한 곳이 12곳 있었다(카드·계산기 링크·대시보드
 * 추천·템플릿 체크리스트·주간 검토 링크 등). 키보드 사용자는 지금 어디에 있는지를
 * 1px 색 변화로 판별해야 했다 — `docs/product-ssot.md` §6.1이 금지하는 상태다.
 *
 * "outline:none이 몇 개 있나"를 세는 검사는 이 문제를 못 잡는다. 취소가 유효한지는
 * **캐스케이드**로 갈리기 때문이다. 그래서 두 갈래로 본다.
 *  ① 셀렉터에 `:focus-visible`이 있으면서 outline을 취소 → 항상 실패.
 *  ② 전역 규칙보다 **뒤에** 선언된 기본 규칙의 취소 → 같은 특이도면 소스 순서로
 *     이기므로 실패. 단 `input`은 `:where(input…):focus-visible { … !important }`가
 *     따로 덮으므로 예외다. 그 예외가 지금도 성립하는지 아래에서 함께 단언한다 —
 *     근거 규칙이 사라지면 예외도 같이 무너져야 한다(§7).
 *
 * 대상 목록은 CSS에서 파생한다. 손으로 쓴 셀렉터 배열을 두지 말 것.
 */

const CSS = readFileSync(
  path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "app/globals.css"),
  "utf-8",
);
const LINES = CSS.split("\n");

const CANCELS_OUTLINE = /outline:\s*(none|0)\b/;

/** outline 취소가 들어 있는 줄의 소유 셀렉터를 역방향으로 찾는다. */
function cancellationSites() {
  const sites = [];
  LINES.forEach((line, index) => {
    if (!CANCELS_OUTLINE.test(line)) return;
    if (line.includes("{")) {
      sites.push({ line: index + 1, selector: line.split("{")[0].trim() });
      return;
    }
    for (let j = index - 1; j >= 0; j -= 1) {
      if (!LINES[j].trimEnd().endsWith("{")) continue;
      const parts = [LINES[j].trimEnd().slice(0, -1).trim()];
      for (let k = j - 1; k >= 0 && LINES[k].trimEnd().endsWith(","); k -= 1) parts.unshift(LINES[k].trim());
      sites.push({ line: index + 1, selector: parts.join(" ") });
      return;
    }
  });
  return sites;
}

const globalRuleLine = LINES.findIndex((line) => /^:focus-visible\s*\{/.test(line.trim())) + 1;

describe("focus ring", () => {
  it("keeps one global :focus-visible ring of at least 2px", () => {
    expect(globalRuleLine).toBeGreaterThan(0);
    const rule = LINES[globalRuleLine - 1];
    const width = rule.match(/outline:\s*(\d+(?:\.\d+)?)px/);
    expect(width, `전역 :focus-visible이 outline 두께를 정하지 않는다 — ${rule}`).toBeTruthy();
    expect(Number(width[1])).toBeGreaterThanOrEqual(2);
  });

  // input 예외의 근거. 이 규칙이 없어지면 아래 예외도 성립하지 않는다.
  it("covers form fields with an !important ring of its own", () => {
    const rule = LINES.find((line) => line.includes(":where(input") && line.includes(":focus-visible"));
    expect(rule, "input 전용 포커스 규칙이 사라졌다면 input 예외를 다시 검토해야 한다").toBeTruthy();
    expect(/outline:\s*2px[^;]*!important/.test(rule)).toBe(true);
  });

  it("never cancels the ring on a :focus-visible rule", () => {
    const offenders = cancellationSites()
      .filter((site) => site.selector.includes(":focus-visible"))
      .map((site) => `L${site.line} ${site.selector}`);
    expect(offenders, "포커스 표시를 지우고 색·밑줄 변화로 대체할 수 없다(product-ssot §6.1)").toEqual([]);
  });

  it("never cancels the ring from a base rule that outranks it by source order", () => {
    const offenders = cancellationSites()
      .filter((site) => site.line > globalRuleLine)
      .filter((site) => !site.selector.includes(":focus-visible"))
      // input은 위에서 단언한 !important 규칙이 덮는다.
      .filter((site) => !site.selector.split(",").every((part) => /\binput$/.test(part.trim())))
      .map((site) => `L${site.line} ${site.selector}`);
    expect(offenders, "전역 :focus-visible보다 뒤에 선언된 outline 취소는 소스 순서로 링을 이긴다").toEqual([]);
  });
});
