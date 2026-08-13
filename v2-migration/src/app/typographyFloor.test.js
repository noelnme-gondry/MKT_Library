import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

// 이 가드는 오래도록 globals.css **한 파일만** 훑었다. 그런데 앱에는 인라인
// `style={{ fontSize: ... }}`이 581곳 있고, 거기 적힌 크기는 CSS 파일에 나타나지
// 않는다 — 즉 하한을 우회하는 경로가 통째로 열려 있었다(§7 "가드가 있다는 사실이
// 가드가 없다는 사실을 가린다"). JSX 쪽도 같은 하한으로 훑는다.
const SRC_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function collectJsxFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsxFiles(full, acc);
    else if (entry.name.endsWith(".jsx") && !entry.name.includes(".test.")) acc.push(full);
  }
  return acc;
}

// `fontSize: "8px"` · `fontSize: "8"` · `fontSize: 8` 세 형태를 잡는다. 계산식
// (`fontSize: size + "px"`)은 정적으로 못 읽으므로 대상 밖 — 리터럴만 고정한다.
export function collectUndersizedInlineSizes(source) {
  const found = [];
  for (const match of source.matchAll(/fontSize:\s*"?(\d+(?:\.\d+)?)(?:px)?"?\s*[,}]/g)) {
    if (Number(match[1]) < FLOOR_PX) found.push(match[0].trim());
  }
  return found;
}

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

describe("inline style typography floor", () => {
  it("keeps every inline fontSize readable", () => {
    const offenders = [];
    for (const file of collectJsxFiles(SRC_ROOT)) {
      for (const hit of collectUndersizedInlineSizes(readFileSync(file, "utf8"))) {
        offenders.push(`${path.relative(SRC_ROOT, file)}: ${hit}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("detects an undersized inline size when one is reintroduced", () => {
    const regressed = 'a(<i style={{ fontSize: "8px" }} />); b(<i style={{ fontSize: 7 }} />);';
    expect(collectUndersizedInlineSizes(regressed)).toHaveLength(2);
  });

  it("does not flag sizes at or above the floor", () => {
    const safe = 'a(<i style={{ fontSize: "9.5px", padding: "2px" }} />); b(<i style={{ fontSize: 11 }} />);';
    expect(collectUndersizedInlineSizes(safe)).toEqual([]);
  });
});
