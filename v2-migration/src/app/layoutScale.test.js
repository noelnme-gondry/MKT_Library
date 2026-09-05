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
    // 값은 **마지막 정의**에서 읽는다 — 앞 블록을 보고 판단하면 틀린다(§7).
    const all = [...CSS.matchAll(/--radius-default:\s*([\d.]+)(px|rem)/g)];
    const [, value, unit] = all.at(-1);
    expect(Number(value) * (unit === "rem" ? 16 : 1)).toBeGreaterThanOrEqual(4);
  });
});

// ── 사이드바 접기 ──────────────────────────────────────────────────────────
// 트랙을 0px로 만드는 것만으로는 부족했다: 사이드바가 흐름에서 빠지면 그리드 자식이
// 하나만 남아 **첫 트랙**에 배치되고, 그 트랙이 0px이라 본문이 통째로 사라졌다
// (e2e 7건이 "uploader hidden"으로 잡았다). 값이 아니라 그 근거를 고정한다.
describe("collapsed sidebar layout", () => {
  it("declares a single column when the sidebar leaves the flow", () => {
    expect(CSS).toMatch(/body\.is-sidebar-collapsed\s+\.sidebar\s*\{[^}]*display:\s*none/);
    const singleColumn = CSS.match(/body\.is-sidebar-collapsed\s+\.app\s*\{([^}]*)\}/);
    expect(singleColumn).toBeTruthy();
    expect(singleColumn[1]).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it("zeroes the width token so the gradient and footer indent follow", () => {
    expect(CSS).toMatch(/body\.is-sidebar-collapsed\s*\{[^}]*--sidebar-width:\s*0px/);
  });

  it("hides the toggle where there is no sidebar to control", () => {
    // 홈과 모바일에는 사이드바 자체가 없다 — 가리킬 대상 없는 컨트롤을 남기지 않는다.
    expect(CSS).toMatch(/\.app\.is-home\s+\.header-sidebar-toggle\s*\{[^}]*display:\s*none/);
    expect(CSS).toMatch(/@media \(max-width: 768px\) \{[^}]*\.header-sidebar-toggle\s*\{[^}]*display:\s*none/);
  });
});

// ── 터치 기기 · 데스크톱 사이트 모드 ───────────────────────────────────────
// Chrome의 "데스크톱 사이트"는 viewport 메타를 무시하고 레이아웃 폭을 ~980px로
// 강제한다. 폭만 보고 판단하면 폰에서 사이드바 레일이 그대로 뜨고 화면이 축소돼
// 읽히지 않는다(제보 2회). 폭은 속일 수 있어도 입력 방식은 못 속인다.
describe("coarse pointer layout", () => {
  const block = CSS.match(/@media \(pointer: coarse\) and \(max-width: 1100px\) \{([\s\S]*?)\n\}/);

  it("drops the sidebar rail on touch devices regardless of the reported width", () => {
    expect(block).toBeTruthy();
    expect(block[1]).toMatch(/\.app\.is-home \.sidebar \{ display: none/);
    expect(block[1]).toMatch(/grid-template-columns: minmax\(0, 1fr\)/);
  });

  it("also drops the right-hand table of contents there", () => {
    expect(block[1]).toMatch(/\.tool-page-shell__toc \{ display: none/);
    expect(block[1]).toMatch(/padding-right: 0/);
  });

  it("keeps the toggle out of a screen that has no sidebar", () => {
    expect(block[1]).toMatch(/\.header-sidebar-toggle \{ display: none/);
  });
});

// ── 랜딩 초기 숨김의 브라우저 레벨 failsafe ────────────────────────────────
describe("landing motion failsafe", () => {
  it("lets the browser finish the reveal even if JS never does", () => {
    // JS가 숨김을 벗겨 주기만 기다리면 JS가 멈춘 순간 랜딩이 영영 투명하다.
    // 이 애니메이션은 JS와 무관하게 최종 상태를 확정한다.
    const armed = CSS.match(/\.decision-console-landing\.is-motion-armed :is\([\s\S]*?\) \{([\s\S]*?)\n\}/);
    expect(armed).toBeTruthy();
    expect(armed[1]).toMatch(/opacity:0/);
    const delay = armed[1].match(/animation: dc-motion-failsafe [\d.]+m?s linear ([\d.]+)s forwards/);
    expect(delay).toBeTruthy();
    // 늦으면 그만큼 빈 화면을 본다 — 상한을 고정한다.
    expect(Number(delay[1])).toBeLessThanOrEqual(2);
    expect(CSS).toMatch(/@keyframes dc-motion-failsafe \{ to \{ opacity:1; \} \}/);
  });
});
