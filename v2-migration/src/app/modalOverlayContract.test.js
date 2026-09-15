import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * `ModalDialog`를 쓰는 모든 화면은 오버레이 클래스를 넘겨야 한다.
 *
 * Radix `Dialog.Overlay`는 클래스가 없으면 아무 스타일도 없는 `<div>`다. 위치·배경·
 * z-index가 통째로 빠져 모달이 body 끝에 그냥 쌓이고, 화면에서는 **"버튼을 눌러도
 * 아무 일도 안 일어난 것"** 으로 보인다. 실제로 `ProjectCreateGate`가 그렇게 배포됐다.
 *
 * jsdom은 레이아웃을 재지 않으므로 스모크는 이걸 영영 통과시킨다 — 그래서 소스에서
 * 파생해 막는다. 대상은 손으로 쓴 목록이 아니라 실제 사용처 전수다(§7).
 */
function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".jsx") && !full.includes(".test.") ? [full] : [];
  });
}

// 주석 안의 설명을 사용처로 세지 않는다(§16 — 문자열 포함 검사는 자기 주석에 속는다).
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/**
 * `<ModalDialog … >` 여는 태그만 잘라 낸다.
 *
 * 정규식 `<ModalDialog[\s\S]*?>`로 자르면 `onClose={() => …}` 안의 `>`에서 끊겨
 * 프롭 목록을 끝까지 보지 못한다 — 실제로 그렇게 짰다가 오버레이를 제대로 넘기는
 * 파일까지 전부 실패했다. 중괄호 깊이를 세면서 태그가 실제로 닫히는 자리를 찾는다.
 */
function openingTags(source) {
  const tags = [];
  for (let index = source.indexOf("<ModalDialog"); index !== -1; index = source.indexOf("<ModalDialog", index + 1)) {
    let depth = 0;
    for (let cursor = index; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (character === "{") depth += 1;
      else if (character === "}") depth -= 1;
      else if (character === ">" && depth === 0) { tags.push(source.slice(index, cursor + 1)); break; }
    }
  }
  return tags;
}

describe("ModalDialog 사용처는 오버레이 클래스를 넘긴다", () => {
  const callers = walk("src/components")
    .map((file) => ({ file, source: stripComments(readFileSync(file, "utf8")) }))
    // 컴포넌트 정의 파일 자체는 제외하고, 실제로 `<ModalDialog`를 여는 곳만.
    .filter(({ file, source }) => !file.endsWith("ds/ModalDialog.jsx") && source.includes("<ModalDialog"));

  it("검사 대상이 실제로 존재한다", () => {
    // 스캐너가 깨져 0건이 되면 아래 전수 검사가 조용히 통과한다.
    expect(callers.length).toBeGreaterThanOrEqual(5);
  });

  // 계약은 "클래스를 넘겨라"가 아니라 **오버레이가 어디선가 위치를 받는다**이다.
  // `overlayStyle`로 인라인으로 주는 것도 같은 값을 한다.
  it.each(callers.map(({ file }) => file))("%s 의 오버레이는 위치를 받는다", (file) => {
    const { source } = callers.find((caller) => caller.file === file);
    const openings = openingTags(source);
    expect(openings.length).toBeGreaterThan(0);
    for (const opening of openings) expect(opening).toMatch(/overlayClassName=|overlayStyle=/);
  });

  it("넘긴 오버레이 클래스는 CSS에 실제로 정의돼 있고 화면에 고정된다", () => {
    // 이름만 넘기고 규칙이 없으면 클래스를 안 넘긴 것과 결과가 같다.
    // `globals.css`만 보면 안 된다 — 사이드바 오버레이는 `library-workspace.css`에 있다.
    const css = readdirSync("src/app")
      .filter((entry) => entry.endsWith(".css"))
      .map((entry) => readFileSync(join("src/app", entry), "utf8"))
      .join("\n");
    const broken = [];
    for (const { file, source } of callers) {
      for (const [, name] of source.matchAll(/overlayClassName="([^"]+)"/g)) {
        // 해당 클래스의 규칙 블록을 찾아 `position: fixed`가 실제로 있는지 본다.
        const rule = new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css);
        if (!rule) { broken.push(`${file}:${name}:정의없음`); continue; }
        if (!/position:\s*fixed/.test(rule[1])) broken.push(`${file}:${name}:위치없음`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("인라인 오버레이도 화면에 고정된다", () => {
    const broken = [];
    for (const { file, source } of callers) {
      for (const opening of openingTags(source)) {
        if (!/overlayStyle=/.test(opening)) continue;
        if (!/position:\s*"fixed"/.test(opening)) broken.push(file);
      }
    }
    expect(broken).toEqual([]);
  });
});
