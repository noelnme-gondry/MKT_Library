import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.dirname(APP_DIR);
const CSS = stripSourceComments(readFileSync(path.join(APP_DIR, "globals.css"), "utf8"));

function tokensFor(selector) {
  const tokens = {};
  for (const match of CSS.matchAll(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g"))) {
    for (const [, name, value] of match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[name] = value.trim();
  }
  return tokens;
}

function resolve(raw, tokens) {
  const value = raw?.trim();
  const variable = value?.match(/^var\((--[\w-]+)\)$/);
  if (variable) return resolve(tokens[variable[1]], tokens);
  if (/^#[0-9a-f]{3}$/i.test(value)) return `#${[...value.slice(1)].map((part) => part + part).join("")}`;
  return /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

function contrast(a, b) {
  const luminance = (hex) => {
    const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
    const [r, g, b] = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [first, second] = [luminance(a), luminance(b)];
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function componentSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return componentSourceFiles(target);
    return /\.(js|jsx)$/.test(entry.name) && !entry.name.includes(".test.") ? [target] : [];
  });
}

describe("테마 대비와 인라인 색", () => {
  it("--text-muted가 카드 밖의 기본 표면에서도 양 테마 AA를 만족한다", () => {
    const dark = tokensFor(":root");
    const light = { ...dark, ...tokensFor("body.light-mode") };
    const failures = [];
    for (const [name, tokens] of [["dark", dark], ["light", light]]) {
      for (const surface of ["--bg-1", "--bg-2", "--surface-base", "--surface-container"]) {
        const ratio = contrast(resolve("var(--text-muted)", tokens), resolve(`var(${surface})`, tokens));
        if (ratio < 4.5) failures.push(`${name} ${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures, `text-muted AA 미달:\n${failures.join("\n")}`).toEqual([]);
  });

  it("JSX의 상태 텍스트·배경은 테마 토큰을 거친다", () => {
    const offenders = componentSourceFiles(path.join(SRC_DIR, "components")).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/(?:color|background|backgroundColor|border|borderColor|borderLeftColor|boxShadow|fill|stroke)\s*:\s*["'`]#[0-9a-fA-F]{3,8}["'`]/g)]
        .map((match) => `${path.relative(SRC_DIR, file)}: ${match[0]}`),
    );
    expect(offenders, `테마를 우회한 인라인 hex:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("설명 속성 대신 키보드·터치가 가능한 도움말을 쓴다", () => {
    const offenders = componentSourceFiles(path.join(SRC_DIR, "components")).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/data-tooltip=/g)].map(() => path.relative(SRC_DIR, file)),
    );
    expect(offenders, `data-tooltip은 화면에 설명을 렌더하지 않는다:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("고대비와 coarse pointer에도 선택·터치 신호를 유지한다", () => {
    expect(CSS).toContain("@media (pointer: coarse)");
    expect(CSS).toContain("min-width: 44px");
    expect(CSS).toContain("@media (forced-colors: active)");
    expect(CSS).toContain("@media (prefers-contrast: more)");
  });
});
