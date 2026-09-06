/* 자동매핑 스코프 가드.
 *
 * 컬럼명 매핑의 점수 계산은 `scoreMappingCandidates`가 하고, 후보 집합은
 * `buildMappingContract`가 `fieldKeysForTool(toolId)`로 **도구 스코프에 제한**한다.
 * 전체 `STANDARD_FIELDS`를 후보로 넘기면 그 도구가 쓰지 않는 필드까지 매핑돼
 * "매핑은 됐는데 기능엔 못 쓴다"가 된다(docs/pitfalls.md).
 *
 * 실제로 `csvConstants.js`에 그 동작을 그대로 하는 `autoMapHeaders(headers, rows,
 * allowedKeys)` 래퍼가 남아 있었다 — allowedKeys를 안 주면 전체 스코프가 되는데
 * 호출부가 0이라 아무 검사도 걸리지 않았다. 이름만 보고 부르면 문서가 금지한 버그가
 * 그대로 재현되는 상태였다.
 *
 * 값이 아니라 근거를 고정한다: 스코프를 좁히는 주체가 mappingContract 하나여야 한다.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");

const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
};

// 주석은 먼저 지운다 — 자기 설명 주석에 속는 가드는 가드가 아니다(AGENTS.md §16).
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SCORER = "scoreMappingCandidates";
const DEFINITION = "lib/data-import/scoreMappingCandidates.js";
// 스코어러를 직접 부를 자격이 있는 파일. 넓히려면 여기 사유와 함께 적을 것.
const ALLOWED = new Set(["lib/data-import/mappingContract.js"]);

describe("자동매핑 스코프", () => {
  it("스코어러를 직접 부르는 곳은 도구 스코프를 계산하는 mappingContract뿐이다", () => {
    const callers = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file).split(path.sep).join("/");
      if (rel === DEFINITION) continue; // 정의는 호출이 아니다
      const source = stripComments(fs.readFileSync(file, "utf8"));
      // import만 있는 재노출이 아니라 실제 호출(`scoreMappingCandidates(`)을 찾는다.
      if (new RegExp(`\\b${SCORER}\\s*\\(`).test(source)) {
        callers.push(rel);
      }
    }
    expect(callers.sort()).toEqual([...ALLOWED].sort());
  });

  it("mappingContract가 후보를 도구 스코프로 제한한다 (이 가드의 근거)", () => {
    const source = stripComments(
      fs.readFileSync(path.join(SRC, "lib/data-import/mappingContract.js"), "utf8"),
    );
    expect(source).toContain("fieldKeysForTool(toolId)");
    expect(source).toMatch(/allowedKeys[,)]/);
  });

  it("도구 스코프를 우회하는 전역 자동매핑 래퍼가 되살아나지 않는다", () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file).split(path.sep).join("/");
      if (ALLOWED.has(rel)) continue;
      const source = stripComments(fs.readFileSync(file, "utf8"));
      if (/\bautoMapHeaders\b/.test(source)) offenders.push(rel);
    }
    expect(offenders, `전역 자동매핑은 buildMappingContract로 대체됐다: ${offenders.join(", ")}`).toEqual([]);
  });
});
