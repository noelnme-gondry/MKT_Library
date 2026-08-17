import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 버튼 글자색 가드.
 *
 * 배경: 블로그 본문 중간 CTA("내 데이터로 운영 점검")가 **파란 버튼 위 파란 글씨**로
 * 나가 드래그해야 읽혔다. 원인은 색이 아니라 캐스케이드였다 —
 * `.blog-prose a`(특이도 0,1,1)가 `.content-action-panel__cta`(0,1,0)를 이겨서
 * `color: var(--on-primary)`를 `var(--primary)`로 덮었다. 배경도 `--primary`라 대비 1.0.
 *
 * 그래서 검사도 두 갈래다.
 *  ① `--primary` 배경 위 글자색은 `--on-primary`로 통일 — 임의 토큰(`--bg-1`·
 *     `--surface-base`·raw hex·`white`)은 테마 한쪽에서 AA에 미달한다.
 *     (라이트 3.97~4.40 / `white`는 다크 2.30 → `--on-primary`는 양쪽 4.64·8.30)
 *  ② 본문 prose 링크 규칙은 **클래스 없는 앵커만** 잡아야 한다. 그러지 않으면
 *     prose 안에 놓인 어떤 컴포넌트 버튼이든 같은 방식으로 납치된다.
 *
 * 규칙 목록은 CSS에서 파생한다 — 손으로 쓴 셀렉터 배열을 두지 말 것(§7).
 */

const CSS = readFileSync(
  path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "app/globals.css"),
  "utf8",
);

// §7: `:root`·`body.light-mode`가 파일에 여러 번 나온다 → 마지막 정의가 실효값.
function tokensFor(selector) {
  const found = {};
  const blocks = CSS.matchAll(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g"));
  for (const block of blocks) {
    for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) found[name] = value.trim();
  }
  return found;
}
const DARK = tokensFor(":root");
const LIGHT = { ...DARK, ...tokensFor("body.light-mode") };

const NAMED = { white: "#ffffff", black: "#000000" };

function resolveColor(raw, tokens, depth = 0) {
  if (!raw || depth > 6) return null;
  const value = raw.trim().replace(/;$/, "");
  const varMatch = value.match(/^var\((--[\w-]+)(?:\s*,\s*(.+))?\)$/);
  if (varMatch) return resolveColor(tokens[varMatch[1]] ?? varMatch[2], tokens, depth + 1);
  if (NAMED[value.toLowerCase()]) return NAMED[value.toLowerCase()];
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{3}$/i.test(value)) return `#${[...value.slice(1)].map((c) => c + c).join("")}`;
  return null;
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(a, b) {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// 배경이 정확히 var(--primary)인 규칙만 — color-mix·gradient는 실효 배경이 달라 제외.
function primaryButtonRules() {
  const rules = [];
  for (const rule of CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = rule[1].trim().split("\n").pop().trim();
    const body = rule[2];
    const backgrounds = [...body.matchAll(/background(?:-color)?\s*:\s*([^;!}]+)/g)].map((m) => m[1]);
    const colors = [...body.matchAll(/(?<![-\w])color\s*:\s*([^;}]+)/g)].map((m) => m[1]);
    if (!backgrounds.length || !colors.length) continue;
    if (backgrounds.at(-1).trim().replace(/;$/, "") !== "var(--primary)") continue;
    rules.push({ selector, color: colors.at(-1).trim().replace(/;$/, "") });
  }
  return rules;
}

describe("버튼 글자색", () => {
  const rules = primaryButtonRules();

  it("검사 대상을 실제로 수집한다", () => {
    // 정규식이 깨지면 0건이 되고 아래 검사가 공허하게 통과한다.
    expect(rules.length).toBeGreaterThan(15);
  });

  it("--primary 배경 위 글자색은 --on-primary로 통일한다", () => {
    const offenders = rules
      .filter((rule) => !rule.color.includes("--on-primary") && !rule.color.includes("--sidebar-primary-ink"))
      .map((rule) => `${rule.selector} → color: ${rule.color}`);
    expect(offenders, `--primary 버튼인데 임의 글자색:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("--primary 버튼 글자가 두 테마 모두 AA(4.5:1)를 넘는다", () => {
    const failures = [];
    for (const [tokens, theme] of [[LIGHT, "light"], [DARK, "dark"]]) {
      const background = resolveColor("var(--primary)", tokens);
      for (const rule of rules) {
        const color = resolveColor(rule.color, tokens);
        if (!color || !background) continue;
        const ratio = contrastRatio(color, background);
        if (ratio < 4.5) failures.push(`${theme} ${rule.selector}: ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures, `AA 미달:\n${failures.join("\n")}`).toEqual([]);
  });

  it("본문 prose 링크 규칙이 컴포넌트 버튼을 납치하지 않는다", () => {
    // `.blog-prose a`가 클래스 있는 앵커까지 잡으면 특이도로 컴포넌트 색을 덮는다.
    const bare = CSS.match(/^\.blog-prose a\s*(?:,|\{)/m);
    expect(bare, ".blog-prose a 는 :not([class])로 한정해야 한다(컴포넌트 버튼 납치 방지)").toBeNull();
    expect(CSS).toContain(".blog-prose a:not([class])");
  });
});
