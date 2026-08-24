import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

/**
 * `title` 어포던스 가드.
 *
 * 배경: 하네스는 오랫동안 "`[title]` 전역 규칙 1개가 전부를 덮는다"고 적고 있었지만
 * 실제 어포던스 셀렉터는 3개 + `[data-help]`뿐이었고, DOM `title` 속성은 197곳이었다.
 * 좁은 셀렉터를 적어 놓고 "전부"라고 선언한 문장이 남은 곳들을 가리고 있었다.
 *
 * 그래서 이 검사는 "몇 개 남았나"를 세지 않는다. `title`은 보조 설명으로는 정당하고
 * (보이는 글자가 있는 버튼의 부연 등) 전부를 금지하면 지킬 수 없는 규칙이 된다.
 * 대신 **title이 유일한 경로일 때만** 잡는다.
 *
 *  ① 화면에 도움말 글리프(ⓘ 등) 하나만 있고 설명 전체가 title에 있는 요소.
 *     포커스도 안 되고 터치로도 안 열린다 — `ds/HelpTip`(details 기반)으로 이관한다.
 *  ② 표 헤더·셀의 약어. 여기는 대체 UI를 만들 수 없으므로 최소한 "설명이 있다"는
 *     시각 단서가 있어야 한다 — CSS 어포던스 규칙의 존재를 단언한다.
 *
 * (product-ssot §6.3 · D-04)
 */

const SRC = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "components");
const CSS = stripSourceComments(readFileSync(
  path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "app/globals.css"),
  "utf-8",
));

// 도움말을 뜻하는 글리프. 조작 힌트(⠿ 드래그 핸들)는 설명이 아니라 어포던스 표시라 제외한다.
const HELP_GLYPHS = /^[ⓘℹ?？]$/u;
// 사유가 버튼 바로 옆 문장으로 이미 보이는 자리. 예외를 파일 단위로 두는 대신
// 사유 문장이 실제로 있는지 아래에서 함께 단언한다 — 문장이 사라지면 예외도 무너져야 한다.
const DISABLED_REASON_VISIBLE = new Set(["tools/MarketingResponse.jsx"]);
// details의 summary는 네이티브로 포커스·조작이 되므로 정당한 도움말 트리거다.
const FOCUSABLE = new Set(["button", "summary", "a"]);

function jsxFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return jsxFiles(full);
    return entry.endsWith(".jsx") && !entry.includes(".test.") ? [full] : [];
  });
}

/** 화면 내용이 도움말 글리프 하나뿐인데 title을 단 요소를 찾는다. */
function glyphOnlyTitleSites() {
  const found = [];
  for (const file of jsxFiles(SRC)) {
    const text = stripSourceComments(readFileSync(file, "utf-8"));
    for (const match of text.matchAll(/\btitle=/g)) {
      const open = text.lastIndexOf("<", match.index);
      const tagMatch = open >= 0 ? /^<([a-z][\w]*)/.exec(text.slice(open)) : null;
      if (!tagMatch) continue; // 대문자 = React 컴포넌트 prop이지 DOM 속성이 아니다
      const tag = tagMatch[1];
      const close = text.indexOf(">", match.index);
      if (close < 0) continue;
      let children = text.slice(close + 1, close + 200);
      const end = children.indexOf(`</${tag}>`);
      if (end >= 0) children = children.slice(0, end);
      if (!HELP_GLYPHS.test(children.trim())) continue;
      if (FOCUSABLE.has(tag)) continue;
      const line = text.slice(0, match.index).split("\n").length;
      found.push(`${path.relative(SRC, file)}:${line} <${tag}>`);
    }
  }
  return found;
}

/** disabled 버튼의 "왜 못 누르나"가 조건부 title에만 있는 자리를 찾는다. */
function blockedReasonOnlyInTitle() {
  const found = [];
  for (const file of jsxFiles(SRC)) {
    const text = stripSourceComments(readFileSync(file, "utf-8"));
    for (const match of text.matchAll(/<button[^>]*?>/gs)) {
      const tag = match[0];
      if (!tag.includes("disabled")) continue;
      // 조건부 title 자체는 문제가 아니다 — 활성일 때 설명을 주는 것은 정당하다.
      // **비활성 분기에 사유 문자열이 들어 있는 것**만 잡는다.
      const conditional = /title=\{[^}]*?\?([\s\S]*?)\}/.exec(tag);
      if (!conditional) continue;
      const disabledBranch = conditional[1].split(" : ")[0].trim();
      if (!disabledBranch || disabledBranch === "undefined" || disabledBranch === '""') continue;
      const line = text.slice(0, match.index).split("\n").length;
      found.push(`${path.relative(SRC, file)}:${line}`);
    }
  }
  return found;
}

describe("title affordance", () => {
  it("never hides a whole explanation behind a non-focusable ⓘ", () => {
    expect(
      glyphOnlyTitleSites(),
      "설명 전체가 title에만 있고 포커스도 안 되는 ⓘ다. ds/HelpTip으로 옮길 것(product-ssot §6.3)",
    ).toEqual([]);
  });

  // disabled 버튼은 포커스를 못 받는다. 사유가 title에만 있으면 터치·키보드
  // 사용자는 **왜 막혔는지 알 길 자체가 없다**(product-ssot §5.4 · D-04).
  // 화면 글자로 꺼내는 것이 계약이고, `ds/BlockedOptionsNote`가 그 자리다.
  it("never hides a disabled reason behind a hover-only tooltip", () => {
    const offenders = blockedReasonOnlyInTitle().filter((site) => !DISABLED_REASON_VISIBLE.has(site.split(":")[0]));
    expect(
      offenders,
      "못 누르는 이유가 hover로만 보인다. ds/BlockedOptionsNote로 화면에 꺼낼 것",
    ).toEqual([]);
  });

  it("gives table headers and cells a visible hint that a definition exists", () => {
    // th/td는 대체 UI를 만들 수 없으므로 어포던스 규칙 자체가 계약이다.
    const rule = /th\[title\][^{]*\{[^}]*\}/s.exec(CSS);
    expect(rule, "th[title] 어포던스 규칙이 사라졌다").toBeTruthy();
    expect(/cursor:\s*help/.test(rule[0])).toBe(true);
    expect(/underline|border-bottom/.test(rule[0])).toBe(true);
  });

  // 예외의 근거. 이 문장이 사라지면 MarketingResponse의 disabled 버튼도 사유를 잃는다.
  it("keeps the visible reason that justifies the one exception", () => {
    const source = stripSourceComments(readFileSync(path.join(SRC, "tools/MarketingResponse.jsx"), "utf-8"));
    expect(source).toContain("원본 CSV 통화만 선택하면 분석할 수 있습니다");
  });

  it("keeps the help component available for new sites", () => {
    const component = stripSourceComments(readFileSync(path.join(SRC, "ds/HelpTip.jsx"), "utf-8"));
    // details 기반이라 키보드·터치·SR 계약이 네이티브로 따라온다. 이걸 span으로
    // 되돌리면 D-04가 그대로 재발한다.
    expect(component).toMatch(/<details/);
    expect(component).toMatch(/<summary/);
  });
});
