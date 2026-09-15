import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const CSS = stripSourceComments(readFileSync(new URL("./globals.css", import.meta.url), "utf8"));

// 색 토큰은 다크(`:root`)와 라이트(`body.light-mode`)가 같은 이름을 일부러 두 번
// 선언한다 — 그건 테마 시스템이다. 문제는 **테마와 무관한 기하 토큰**이 조건 없는
// `:root`에 두 벌 이상 존재하는 경우다: 앞 블록만 읽으면 값을 틀리게 안다.
// 실제로 `--radius-full`은 앞에서 12px, 뒤에서 999px이었고, 그 착각 위에서
// "pill 자리가 각진다"는 틀린 진단과 아무 효과 없는 수정이 나왔다(§7).
const GEOMETRY_TOKEN = /^--(radius[a-z-]*|sidebar-width|container-max|gutter|section-gap|chart-h|fs-[a-z0-9]+|topbar-h|font-(?:sans|mono))$/;

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

// ── 반경도 같은 병이었다 ───────────────────────────────────────────────────
// 기사("바이브 코딩 대시보드가 형편없어 보이는 10가지 이유")가 모서리 8단계를
// 지적했는데, 실측하니 우리는 **18종**이었다. 토큰 5단(`--radius-sm`~`-pill`)이
// 이미 있는데 143곳만 쓰고 446곳이 raw px였다 — 타입 스케일과 똑같이 "정의는
// 있는데 소비처가 없는" 상태다(§16). 값이 아니라 **한 곳에서 고른다**를 지킨다.
// `50%`(원형)는 단이 아니라 도형이므로 대상 밖이다.
export function collectRawRadiusDeclarations(css) {
  const found = [];
  css.split("\n").forEach((line, index) => {
    if (/--radius[a-z0-9-]*\s*:/.test(line)) return;
    for (const match of line.matchAll(/border-radius:\s*([^;{}]+)/g)) {
      if (/\d+(?:\.\d+)?px/.test(match[1])) found.push(`${index + 1}: ${match[0].trim()}`);
    }
  });
  return found;
}

describe("모서리 반경은 토큰 5단에서만 고른다", () => {
  it("globals.css에 raw px 반경이 없다", () => {
    expect(collectRawRadiusDeclarations(CSS)).toEqual([]);
  });

  it("raw px 반경이 다시 들어오면 잡는다", () => {
    expect(collectRawRadiusDeclarations(".x { border-radius: 12px; }")).toHaveLength(1);
    expect(collectRawRadiusDeclarations(".y { border-radius: 4px 4px 0 0; }")).toHaveLength(1);
  });

  it("원형(50%)과 토큰 선언 자체는 대상 밖이다", () => {
    expect(collectRawRadiusDeclarations(".x { border-radius: 50%; }")).toEqual([]);
    expect(collectRawRadiusDeclarations(":root { --radius-lg: 10px; }")).toEqual([]);
  });
});

// ── 표면 재질의 위계 ───────────────────────────────────────────────────────
// 결론 카드는 §5.5의 1층이고, 보조 도구·마감 영역은 그 뒤다. 셋이 같은 재질을
// 쓰면 화면은 "무엇이 중요한지"를 말하지 못한다(기사 2번). §12.30이 이미
// 마감·보조 영역의 재질을 `--operator-line`/`--work-surface`로 정해 뒀는데
// `.dashboard-support-tools`만 결론 카드와 같은 재질이었다 — 다수가 맞으면
// 소수의 예외가 안 보인다(§16).
export function surfaceMaterial(css, selector) {
  const re = new RegExp(`(^|[},;])\\s*${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\{([^}]*)\\}`, "m");
  const match = css.match(re);
  return match ? match[2] : "";
}

describe("결론 카드는 보조·마감 영역과 다른 재질이다", () => {
  it("보조 도구와 마감 영역은 운영 재질을 쓴다", () => {
    for (const selector of [".dashboard-support-tools", ".tool-outro"]) {
      const body = surfaceMaterial(CSS, selector);
      expect(body, `${selector} 규칙을 못 찾았다 — 셀렉터가 바뀌었으면 이 가드를 다시 설계할 것`).toBeTruthy();
      expect(body, `${selector}는 --operator-line 테두리를 써야 한다`).toMatch(/border:[^;]*var\(--operator-line\)/);
      expect(body, `${selector}는 --work-surface 바탕을 써야 한다`).toMatch(/background:\s*var\(--work-surface\)/);
    }
  });

  it("결론 카드만 강조 상단선과 최대 반경을 갖는다", () => {
    const card = surfaceMaterial(CSS, ".result-action-card");
    expect(card).toMatch(/border-top:\s*3px solid var\(--primary\)/);
    expect(card).toMatch(/border-radius:\s*var\(--radius-xl\)/);
    expect(surfaceMaterial(CSS, ".dashboard-support-tools")).not.toMatch(/border-top:\s*3px/);
  });
});
