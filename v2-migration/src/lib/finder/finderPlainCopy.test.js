import { describe, expect, it } from "vitest";
import { FINDER_PLAIN_COPY } from "./finderPlainCopy";
import { filterFinderCards, finderCards } from "./analysisFinder";
import { getToolSearchContent } from "@/lib/toolSearchContent";

// 마케터가 이미 쓰는 약어만 허용한다. 나머지 대문자 약어(HC3·OOS·AUUC·MAD·RFM·CTIT…)는 방법 이름이다.
const MARKETER_ACRONYMS = new Set(["CPA", "CPI", "ROAS", "LTV", "CTR", "CVR", "ID", "MMM", "OS"]);
const methodAcronyms = (text) => (String(text).match(/\b[A-Z][A-Z0-9]{1,}\b/g) || []).filter((token) => !MARKETER_ACRONYMS.has(token));

describe("분석 찾기 카드 쉬운 말", () => {
  it.each(["ko", "en"])("결론 예시가 없는 카드는 방법 약어 없이 읽힌다 (%s)", (locale) => {
    const cards = finderCards(locale).filter((card) => !card.example);
    expect(cards.length).toBeGreaterThan(10);
    // 검사가 실제로 무언가를 걸러 내는지 — 원문에는 방법 약어가 있었다.
    const original = cards.flatMap((card) => getToolSearchContent(card.id, locale)?.outputs || []);
    expect(original.flatMap(methodAcronyms).length).toBeGreaterThan(3);
    for (const card of cards) {
      expect(methodAcronyms([card.question, ...card.outputs].join(" ")), `${card.id}: ${card.outputs.join(" · ")}`).toEqual([]);
      if (locale === "en") expect(/[가-힣]/.test([card.question, ...card.outputs].join(" ")), card.id).toBe(false);
    }
  });

  it("쉬운 말은 원문과 같은 수의 결과를 말한다 — 결과를 새로 만들지 않는다", () => {
    for (const [toolId, entry] of Object.entries(FINDER_PLAIN_COPY)) {
      for (const locale of ["ko", "en"]) {
        const original = getToolSearchContent(toolId, locale)?.outputs || [];
        expect(entry.outputs, toolId).toHaveLength(original.length);
      }
    }
  });

  it("방법 이름은 검색어로 남는다", () => {
    const cards = finderCards("ko");
    expect(filterFinderCards(cards, { query: "Qini" }).map((card) => card.id)).toContain("5-37");
    expect(filterFinderCards(cards, { query: "HC3" }).map((card) => card.id)).toContain("5-34");
    expect(filterFinderCards(cards, { query: "오차 범위" }).length).toBeGreaterThan(0);
  });
});
