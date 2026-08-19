import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 탭 계약 가드.
 *
 * `docs/product-ssot.md` §6.1: 탭은 ←/→·Home·End로 이동하고, 선택 항목만 tab 순서에
 * 남으며(로빙 tabindex), `tabpanel`은 자신을 여는 탭과 `aria-labelledby`로 이어져야
 * 한다. 마우스로만 조작되는 탭은 키보드 사용자에게 없는 기능이다.
 *
 * 왜 필요했나: 5개 tablist 중 **9-6 소재 분석 하나만** 계약이 통째로 빠져 있었다
 * (화살표 키·aria-controls·로빙 tabindex·panel 연결 전부 없음). 나머지 넷은
 * 완비돼 있었기 때문에 "탭은 되어 있다"고 보이기 쉬웠다 — 한 곳만 빠진 구멍은
 * 전수로 세지 않으면 안 보인다(§7).
 */

const COMPONENTS = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "components");

function jsxFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return jsxFiles(full);
    return entry.endsWith(".jsx") && !entry.includes(".test.") ? [full] : [];
  });
}

// 주석 안의 role="tablist" 설명이 대상으로 잡히면 통과 못 할 코드가 생긴다.
// (DashboardTabs에는 이 계약을 설명하는 주석이 실제로 있다.)
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("tab contract", () => {
  const files = jsxFiles(COMPONENTS).map((file) => [file, stripComments(readFileSync(file, "utf-8"))]);

  it("gives every tablist arrow keys, roving tabindex, and a controlled panel", () => {
    const sites = [];
    for (const [file, source] of files) {
      for (const match of source.matchAll(/role="tablist"/g)) {
        const line = source.slice(0, match.index).split("\n").length;
        const segment = source.slice(match.index, match.index + 3000);
        const missing = [];
        if (!segment.includes('role="tab"')) missing.push("role=tab");
        if (!segment.includes("aria-controls")) missing.push("aria-controls");
        if (!/tabIndex=/.test(segment)) missing.push("로빙 tabIndex");
        if (!/onKeyDown|ArrowRight/.test(segment)) missing.push("화살표 키");
        if (missing.length) sites.push(`${path.relative(COMPONENTS, file)}:${line} — ${missing.join(", ")} 없음`);
      }
    }
    expect(sites.length, "tablist를 하나도 못 찾았다 — 스캐너가 깨졌는지 확인할 것").toBeDefined();
    expect(sites, "탭이 마우스로만 조작된다(product-ssot §6.1)").toEqual([]);
  });

  it("labels every tabpanel by the tab that opens it", () => {
    const sites = [];
    for (const [file, source] of files) {
      for (const match of source.matchAll(/role="tabpanel"/g)) {
        const line = source.slice(0, match.index).split("\n").length;
        // 여는 태그 범위 안에 aria-labelledby가 있어야 한다.
        const open = source.lastIndexOf("<", match.index);
        const close = source.indexOf(">", match.index);
        const tag = source.slice(open, close < 0 ? match.index : close);
        if (!tag.includes("aria-labelledby")) sites.push(`${path.relative(COMPONENTS, file)}:${line}`);
      }
    }
    expect(sites, "tabpanel이 어느 탭에 속하는지 보조기술이 알 수 없다").toEqual([]);
  });

  // 대상이 0이면 위 두 검사는 통과해도 아무것도 지키지 않는다.
  it("actually finds the tab surfaces it claims to check", () => {
    const tablists = files.reduce((sum, [, source]) => sum + (source.match(/role="tablist"/g) || []).length, 0);
    const panels = files.reduce((sum, [, source]) => sum + (source.match(/role="tabpanel"/g) || []).length, 0);
    expect(tablists).toBeGreaterThanOrEqual(5);
    expect(panels).toBeGreaterThanOrEqual(5);
  });
});
