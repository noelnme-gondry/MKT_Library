import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

/**
 * 섹션 제목 밑줄 가드.
 *
 * `.section-title`은 자기 `border-bottom`으로 밑줄을 그린다. 그런데 다운로드 버튼과
 * 한 줄에 놓으려고 flex 컨테이너에 넣는 순간 제목이 flex item이 되어 폭이 글자에
 * 맞춰 줄고, 밑줄이 이름 밑에서 끊긴다 — 버튼 있는 섹션만 밑줄이 짧던 원인이다.
 *
 * 해법은 밑줄 소유자를 래퍼(`.section-head`)로 옮기는 것이다. 그래서 이 검사는
 * "flex 컨테이너의 직계 자식인 `.section-title`"을 잡는다. 개수를 세지 않고 형태를
 * 막는다 — 새 도구가 같은 자리를 또 만들면 여기서 걸린다.
 */

const dir = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(dir, "..");

function walk(target) {
  return readdirSync(target).flatMap((name) => {
    const full = path.join(target, name);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".jsx") && !full.includes(".test.") ? [full] : [];
  });
}

const files = walk(SRC);

// 직전 여는 태그가 flex/grid 컨테이너인 `.section-title`을 찾는다.
function inlineFlexHeads(source) {
  const found = [];
  for (const match of source.matchAll(/className="section-title"/g)) {
    const before = source.slice(Math.max(0, match.index - 400), match.index);
    const tags = [...before.matchAll(/<(\w+)([^<>]*)>/g)];
    if (tags.length === 0) continue;
    const attrs = tags[tags.length - 1][2];
    if (/display:\s*"(flex|grid)"/.test(attrs)) {
      found.push(before.slice(before.lastIndexOf("<")).slice(0, 90));
    }
  }
  return found;
}

describe("섹션 제목 밑줄 계약", () => {
  it("검사 대상 컴포넌트가 실제로 있다", () => {
    // 워커가 깨지면 0건이 되어 조용히 통과한다 — 규모부터 단언한다.
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((f) => readFileSync(f, "utf8").includes('className="section-title"')).length).toBeGreaterThan(20);
  });

  it("제목을 인라인 flex 컨테이너의 직계 자식으로 두지 않는다", () => {
    const offenders = files.flatMap((file) => {
      const source = stripSourceComments(readFileSync(file, "utf8"));
      return inlineFlexHeads(source).map((snippet) => `${path.relative(SRC, file)} :: ${snippet}`);
    });
    expect(offenders).toEqual([]);
  });

  it("래퍼가 밑줄을 소유하고 제목은 자기 선을 벗는다", () => {
    const css = readFileSync(path.join(SRC, "app/globals.css"), "utf8");
    const head = css.split("\n").join("\n").match(/\.section-head \{[^}]*\}/)[0];
    expect(head).toContain("border-bottom:");
    expect(head).toContain("display: flex");
    expect(css).toMatch(/\.section-head > \.section-title \{[^}]*border-bottom: 0/);
    // 제목이 래퍼 폭을 다 쓰지 못하면 밑줄만 옮겨 놓고 짧은 건 그대로다.
    expect(css).toMatch(/\.section-head > \.section-title \{[^}]*flex: 1/);
  });
});
