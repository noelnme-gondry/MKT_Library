import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

// 마이크로 라벨 하한. 6~8px 모노 대문자 라벨이 앱 전반에 흩어져 있었고,
// 라이트 모드·고해상도 화면에서 사실상 읽히지 않았다(§7 가시성).
// 값 하나를 예외로 두기 시작하면 다시 흩어지므로 파일 전체를 훑는 하한으로 고정한다.
const FLOOR_PX = 9.5;

// `font-size: 8px` 와 `font: 700 8px/1.4 var(--font-mono)` 두 형태 모두 잡는다.
// shorthand는 첫 px 값이 항상 크기 슬롯이다(weight는 단위 없음, style/variant는 키워드).
function collectUndersizedDeclarations(css) {
  const found = [];
  const push = (raw, value, index) => {
    if (Number(value) >= FLOOR_PX) return;
    const lineNumber = css.slice(0, index).split("\n").length;
    found.push(`${lineNumber}: ${raw.trim()}`);
  };
  for (const match of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
    push(match[0], match[1], match.index);
  }
  for (const match of css.matchAll(/font:\s*[^;{}]*?(?<![\d.])(\d+(?:\.\d+)?)px/g)) {
    push(match[0], match[1], match.index);
  }
  return found;
}

describe("globals.css typography floor", () => {
  it("keeps every declared type size readable", () => {
    expect(collectUndersizedDeclarations(CSS)).toEqual([]);
  });

  it("detects an undersized declaration when one is reintroduced", () => {
    const regressed = ".x { font-size: 8px; }\n.y { font: 700 7px var(--font-mono); }";
    expect(collectUndersizedDeclarations(regressed)).toHaveLength(2);
  });

  it("does not mistake padding or line-height for the size slot", () => {
    const safe = ".x { padding: 2px 4px; font: 700 10px/16px var(--font-mono); border-radius: 1px; }";
    expect(collectUndersizedDeclarations(safe)).toEqual([]);
  });
});
