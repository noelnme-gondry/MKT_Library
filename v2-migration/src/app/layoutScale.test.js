import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const CSS = stripSourceComments(readFileSync(new URL("./globals.css", import.meta.url), "utf8"));

// ── 브레이크포인트 ─────────────────────────────────────────────────────────
// 같은 목적의 접힘이 700·720·760에 흩어져 있어서, 그 사이 폭에서는 어떤 요소는
// 접히고 어떤 요소는 안 접힌 중간 상태가 나왔다. 특히 `max-width: 760px`은 태블릿
// 세로(768px)에 **적용되지 않는다** — 옆 규칙이 780px이면 둘이 갈린다.
// 값을 세는 대신 "스케일 밖의 경계를 새로 만들지 않는다"를 고정한다.
const BREAKPOINTS = [480, 560, 640, 720, 768, 860, 1000, 1100];

export function collectOffScaleBreakpoints(css) {
  const found = [];
  for (const match of css.matchAll(/@media[^{]*?max-width:\s*(\d+)px/g)) {
    if (!BREAKPOINTS.includes(Number(match[1]))) found.push(match[0].trim());
  }
  return found;
}

// min-width는 짝이 되는 max-width 바로 위(+1)여야 두 규칙이 한 픽셀도 겹치지 않는다.
export function collectOverlappingMinWidths(css) {
  const found = [];
  for (const match of css.matchAll(/@media[^{]*?min-width:\s*(\d+)px/g)) {
    if (!BREAKPOINTS.includes(Number(match[1]) - 1)) found.push(match[0].trim());
  }
  return found;
}

describe("responsive breakpoint scale", () => {
  it("declares no boundary outside the scale", () => {
    expect(collectOffScaleBreakpoints(CSS)).toEqual([]);
  });

  it("keeps tablet portrait (768px) inside the mobile band", () => {
    // 760px은 768px에 적용되지 않는다 — 스케일이 768을 포함해야 이 구멍이 안 생긴다.
    expect(BREAKPOINTS).toContain(768);
    expect(CSS).toMatch(/max-width:\s*768px/);
  });

  it("starts every min-width one pixel above a scale boundary", () => {
    expect(collectOverlappingMinWidths(CSS)).toEqual([]);
  });

  it("still scans a meaningful number of queries", () => {
    // 스캐너가 깨지면 0건이 되어 조용히 통과한다(§7).
    expect([...CSS.matchAll(/@media[^{]*?max-width:\s*\d+px/g)].length).toBeGreaterThan(40);
  });

  it("detects an off-scale boundary when one is reintroduced", () => {
    expect(collectOffScaleBreakpoints("@media (max-width: 733px) { .x { color: red } }")).toHaveLength(1);
  });
});

// ── 반경 ───────────────────────────────────────────────────────────────────
describe("radius scale", () => {
  it("names the pill radius for what it is", () => {
    // `--radius-full`이 12px이라 pill이 필요한 자리가 그 토큰을 못 쓰고 리터럴
    // 999px을 직접 적고 있었다. 이름이 값과 맞아야 다음 사람이 안 속는다.
    expect(CSS).toMatch(/--radius-pill:\s*999px/);
    expect(CSS).not.toMatch(/border-radius:\s*999px/);
  });

  it("keeps the default radius soft enough to read as a rounded control", () => {
    const match = CSS.match(/--radius-default:\s*([\d.]+)rem/);
    expect(Number(match[1]) * 16).toBeGreaterThanOrEqual(4);
  });
});
