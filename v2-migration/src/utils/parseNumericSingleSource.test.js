// 숫자 파서 단일성 가드 (2026-09-16 감사 P1-003)
// 소비처를 손으로 나열하지 않는다 — 소스 트리에서 **파생**한다(§7: 커버리지 가드가
// 손으로 쓴 배열을 돌면 가드가 아니다). 예외는 주석이 아니라 코드 표식으로만
// 통과한다(§16: 표식을 주석에 두면 가드가 주석에 속는다).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNumericStrict, parseNumericOrZero, parseNumericOrNaN } from "./parseNumeric";
import { DIRTY_NUMBERS } from "./__fixtures__/qaFixtures";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const SCAN_ROOTS = ["utils", "lib"];
// 해석 규칙을 소유한 파일과, 값이 아니라 표기를 다루는 파일.
const OWNERS = new Set([
  "utils/parseNumeric.js",
  "lib/data-import/normalizeValues.js",
]);
const EXEMPT_MARKER = "PARSE_NUMERIC_EXEMPT";

function jsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsFiles(full));
    else if (/\.jsx?$/.test(entry) && !/\.test\.jsx?$/.test(entry)) out.push(full);
  }
  return out;
}

// 주석을 먼저 지운다 — 안 그러면 "왜 자체 파서를 안 쓰는지" 설명하는 주석이
// 그 자체로 위반으로 잡히고, 반대로 주석 안의 예시가 가드를 통과시킨다.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// 문자열에서 콤마·통화기호·퍼센트를 벗겨 Number/parseFloat/parseInt로 넘기는 형태.
const AD_HOC_PARSER = /(?:Number|parseFloat|parseInt)\s*\([^;]{0,160}?\.replace\(\s*\/\[?[^/]*[,%₩$][^/]*\/[gimsuy]*\s*,/;

describe("숫자 파서 단일성", () => {
  const files = SCAN_ROOTS.flatMap((root) => jsFiles(join(SRC, root)))
    .map((full) => ({ path: relative(SRC, full).replaceAll("\\", "/"), source: readFileSync(full, "utf8") }));

  it("스캐너가 실제로 파일을 훑는다", () => {
    // 규모 단언이 없으면 스캐너가 깨져도 0건으로 조용히 통과한다(§7).
    expect(files.length).toBeGreaterThan(150);
  });

  it("자체 숫자 파서를 새로 만들지 않는다", () => {
    const offenders = files
      .filter(({ path }) => !OWNERS.has(path))
      .filter(({ source }) => !source.includes(EXEMPT_MARKER))
      .filter(({ source }) => AD_HOC_PARSER.test(stripComments(source)))
      .map(({ path }) => path);
    expect(offenders, `SSOT(utils/parseNumeric)를 쓰거나 ${EXEMPT_MARKER} 표식과 사유를 남길 것`).toEqual([]);
  });

  it("예외 표식을 단 파일은 실제로 존재하고 사유가 함께 있다", () => {
    // 예외가 사라졌는데 규칙만 남는 것도, 표식만 있고 사유가 없는 것도 막는다.
    const exempt = files.filter(({ source }) => source.includes(EXEMPT_MARKER));
    expect(exempt.length).toBeGreaterThan(0);
    for (const { path, source } of exempt) {
      const line = source.split("\n").find((l) => l.includes(EXEMPT_MARKER));
      expect(line.length, `${path}: 표식 옆에 사유를 적을 것`).toBeGreaterThan(EXEMPT_MARKER.length + 20);
    }
  });

  it("가드가 부러뜨릴 수 있는 형태다", () => {
    // 가드를 만들면 실제로 깨지는지 확인한다(§7).
    expect(AD_HOC_PARSER.test('const n = Number(String(v).replace(/,/g, ""));')).toBe(true);
    expect(AD_HOC_PARSER.test('const n = parseFloat(s.replace(/[,\\s₩]/g, ""));')).toBe(true);
    // 값 파싱이 아닌 것은 잡지 않는다.
    expect(AD_HOC_PARSER.test('const label = name.replace(/,/g, " ");')).toBe(false);
  });
});

describe("파서 계약", () => {
  it.each(DIRTY_NUMBERS)("strict: $input → $expected", ({ input, expected }) => {
    expect(parseNumericStrict(input)).toBe(expected);
  });

  it("폴백만 다르고 해석은 같다", () => {
    expect(parseNumericStrict("1.000,25")).toBeNull();
    expect(parseNumericOrZero("1.000,25")).toBe(0);
    expect(Number.isNaN(parseNumericOrNaN("1.000,25"))).toBe(true);
    // 빈 값은 "오염"이 아니라 "결측" — NaN 계약에서도 0이다.
    expect(parseNumericOrNaN("")).toBe(0);
    expect(parseNumericOrNaN(null)).toBe(0);
  });

  it("숫자는 그대로, 비유한 숫자는 거부", () => {
    expect(parseNumericStrict(1234.5)).toBe(1234.5);
    expect(parseNumericStrict(Number.NaN)).toBeNull();
    expect(parseNumericStrict(Infinity)).toBeNull();
  });
});
