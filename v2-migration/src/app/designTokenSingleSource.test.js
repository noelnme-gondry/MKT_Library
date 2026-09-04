import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const CSS = stripSourceComments(readFileSync(new URL("./globals.css", import.meta.url), "utf8"));

// 색 토큰은 다크(`:root`)와 라이트(`body.light-mode`)가 같은 이름을 일부러 두 번
// 선언한다 — 그건 테마 시스템이다. 문제는 **테마와 무관한 기하 토큰**이 조건 없는
// `:root`에 두 벌 이상 존재하는 경우다: 앞 블록만 읽으면 값을 틀리게 안다.
// 실제로 `--radius-full`은 앞에서 12px, 뒤에서 999px이었고, 그 착각 위에서
// "pill 자리가 각진다"는 틀린 진단과 아무 효과 없는 수정이 나왔다(§7).
const GEOMETRY_TOKEN = /^--(radius[a-z-]*|sidebar-width|container-max|gutter|section-gap|chart-h|fs-[a-z0-9]+|topbar-h)$/;

// 조건 없는(미디어쿼리 밖) `:root` 블록만 모은다. 미디어쿼리 안의 재선언은
// 브레이크포인트별 값이라 정상이다.
export function collectUnconditionalRootTokens(css) {
  const found = new Map();
  const lines = css.split("\n");
  let depth = 0;
  let mediaDepth = null;
  let rootDepth = null;
  for (const line of lines) {
    const head = line.includes("{") ? line.slice(0, line.indexOf("{")).trim() : "";
    if (line.includes("{") && head.startsWith("@media") && mediaDepth === null) mediaDepth = depth;
    if (line.includes("{") && head === ":root" && mediaDepth === null && rootDepth === null) rootDepth = depth;
    if (rootDepth !== null && mediaDepth === null) {
      const match = line.match(/^\s*(--[a-z0-9-]+):\s*([^;]+);/);
      if (match) {
        const list = found.get(match[1]) || [];
        list.push(match[2].trim());
        found.set(match[1], list);
      }
    }
    for (const char of line) {
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (mediaDepth !== null && depth <= mediaDepth) mediaDepth = null;
        if (rootDepth !== null && depth <= rootDepth) rootDepth = null;
      }
    }
  }
  return found;
}

export function collectGeometryTokenConflicts(css) {
  const conflicts = [];
  for (const [token, values] of collectUnconditionalRootTokens(css)) {
    if (!GEOMETRY_TOKEN.test(token)) continue;
    if (new Set(values).size > 1) conflicts.push(`${token}: ${values.join(" → ")}`);
  }
  return conflicts.sort();
}

describe("design token single source", () => {
  it("declares each geometry token once, so the first block a reader finds is the real value", () => {
    expect(collectGeometryTokenConflicts(CSS)).toEqual([]);
  });

  it("still scans a meaningful number of tokens", () => {
    // 스캐너가 깨지면 0건이 되어 조용히 통과한다(§7).
    const tokens = [...collectUnconditionalRootTokens(CSS).keys()].filter((token) => GEOMETRY_TOKEN.test(token));
    expect(tokens.length).toBeGreaterThan(10);
  });

  it("detects a reintroduced double declaration", () => {
    const regressed = ":root {\n  --sidebar-width: 280px;\n}\n:root {\n  --sidebar-width: 248px;\n}";
    expect(collectGeometryTokenConflicts(regressed)).toEqual(["--sidebar-width: 280px → 248px"]);
  });

  it("leaves theme colors alone — dark/light pairs are the theme system, not drift", () => {
    const themed = ":root {\n  --primary: #adc6ff;\n}\nbody.light-mode {\n  --primary: #2b6cb0;\n}";
    expect(collectGeometryTokenConflicts(themed)).toEqual([]);
  });

  it("allows a breakpoint to override a geometry token inside a media query", () => {
    const responsive = ":root {\n  --sidebar-width: 248px;\n}\n@media (max-width: 1100px) {\n  :root {\n    --sidebar-width: 232px;\n  }\n}";
    expect(collectGeometryTokenConflicts(responsive)).toEqual([]);
  });
});
