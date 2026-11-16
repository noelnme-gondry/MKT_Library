import { describe, expect, it } from "vitest";
import data from "@/lib/blogExamples/data.json";
import FINDER_EXAMPLES from "@/lib/finder/finderExamples.json";
import { deriveFinderExamples } from "@/lib/finder/finderExamples";
import { FINDER_CARD_GROUPS, countFinderAnalyses, filterFinderCards, finderCards, finderFamilies, finderHref, finderSituations, parseFinderFamily, parseFinderSituation } from "@/lib/finder/analysisFinder";
import { publishedToolIds } from "@/lib/routeMap";
import { TOOL_GROUP } from "@/lib/toolGroups";

describe("analysis finder cards (product-ssot §1.1c card contract)", () => {
  it("lists every published analysis exactly once, as a card or inside its group card", () => {
    for (const locale of ["ko", "en"]) {
      const cards = finderCards(locale);
      // 같은 파일을 쓰는 도구는 대표 카드 안의 목록이 된다(product-ssot §5.1 "묶기") — 도구는 빠지지 않는다.
      const ids = cards.flatMap((card) => card.toolIds);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual([...publishedToolIds()].sort());
      expect(cards.length).toBeLessThan(ids.length);
      expect(cards.length).toBeGreaterThan(20);
      for (const group of FINDER_CARD_GROUPS) {
        const card = cards.find((item) => item.id === group.lead);
        expect(card.toolIds.slice(1), group.id).toEqual(group.members);
        // 묶음 이름이 있는 카드는 대표 분석도 목록에 보인다(카드 이름이 그 분석 하나가 아니다).
        expect(card.members.map((member) => member.id), group.id).toEqual(group.name ? [group.lead, ...group.members] : group.members);
        for (const id of group.members) expect(cards.some((item) => item.id === id), id).toBe(false);
      }
      // 묶인 도구가 속한 상황에서도 대표 카드가 보인다 — 상황으로 찾았는데 그 도구가 사라지면 안 된다.
      const situations = finderSituations(locale);
      expect(situations).toHaveLength(7);
      for (const situation of situations) {
        const shown = filterFinderCards(cards, { situation: situation.id });
        // 칩의 수 = 그 상황의 분석 수 = 상황을 골랐을 때 카드들에 든 그 상황의 분석 수.
        expect(countFinderAnalyses(shown, situation.id), situation.id).toBe(situation.count);
        expect(situation.count, situation.id).toBeGreaterThan(0);
      }
      expect(situations.reduce((sum, situation) => sum + situation.count, 0)).toBe(publishedToolIds().length);
      expect(countFinderAnalyses(cards)).toBe(publishedToolIds().length);
      expect(filterFinderCards(cards, { situation: "performance" }).map((card) => card.id)).toEqual(expect.arrayContaining(["5-31", "5-18-trend"]));
      expect(filterFinderCards(cards, { situation: "overlap" }).map((card) => card.id)).toContain("5-18-trend");
    }
  });

  it("names the file before columns and keeps EN free of Korean", () => {
    for (const locale of ["ko", "en"]) {
      for (const card of finderCards(locale)) {
        expect(card.source?.file, card.id).toBeTruthy();
        expect(card.source?.family, card.id).toBeTruthy();
        expect(card.question, card.id).toBeTruthy();
        expect(card.exampleHref, card.id).toMatch(/\?example=1$/);
        if (locale === "en") {
          const visible = [card.name, card.question, card.answer, card.example, card.source.file, card.source.family, card.situation.title, card.membersLabel, ...card.required, ...card.optional, ...card.sameFile.map((item) => item.name), ...card.members.flatMap((item) => [item.name, item.question])];
          for (const text of visible.filter(Boolean)) expect(/[가-힣]/.test(text), `${card.id}: ${text}`).toBe(false);
        }
      }
    }
  });

  it("derives 'same file' from TOOL_GROUP and never lists the card itself", () => {
    const cards = finderCards("ko");
    let linked = 0;
    for (const card of cards) {
      expect(card.sameFile.some((item) => item.id === card.id)).toBe(false);
      for (const item of card.sameFile) expect(TOOL_GROUP[item.id]).toBe(TOOL_GROUP[card.id]);
      linked += card.sameFile.length;
    }
    expect(linked).toBeGreaterThan(0);
    // 같은 파일을 쓰는 묶음은 대표 카드의 목록이 말한다 — "같은 파일로" 줄이 같은 도구를 한 번 더 늘어놓지 않는다.
    const planner = cards.find((card) => card.id === "5-31");
    expect(planner.members.map((item) => item.id)).toEqual(["5-2", "5-21", "5-3"]);
    expect(planner.sameFile.some((item) => planner.toolIds.includes(item.id))).toBe(false);
    expect(cards.find((card) => card.id === "5-18-trend").href).toBe("/tools/marketing-response");
  });

  it("uses only engine-computed example conclusions from the same demo data the example button opens", () => {
    // 신선도: 화면이 읽는 파생본은 원본에서 다시 파생한 값과 같아야 한다.
    expect(FINDER_EXAMPLES).toEqual(deriveFinderExamples(data));
    for (const [toolId, example] of Object.entries(FINDER_EXAMPLES)) {
      const sources = Object.values(data).filter((entry) => entry.toolId === toolId && entry.ko.headline === example.ko);
      expect(sources.length, toolId).toBeGreaterThan(0);
      expect(sources.every((entry) => entry.source === "demo"), toolId).toBe(true);
    }
    const withExample = finderCards("ko").filter((card) => card.example);
    expect(withExample.length).toBeGreaterThan(10);
    // 예시가 없는 카드는 지어내지 않고 비워 둔다.
    for (const card of finderCards("ko").filter((item) => !FINDER_EXAMPLES[item.id])) expect(card.example).toBeNull();
  });

  it("filters by situation, saved tools and every search term", () => {
    const cards = finderCards("ko");
    const budget = filterFinderCards(cards, { situation: "budget" });
    expect(budget.length).toBeGreaterThan(0);
    expect(budget.every((card) => card.situationIds.includes("budget"))).toBe(true);
    // 묶인 도구를 저장해 뒀으면 대표 카드로 찾힌다(예전에 저장한 5-21 등).
    expect(filterFinderCards(cards, { situation: "saved", savedIds: ["5-21"] }).map((card) => card.id)).toEqual(["5-31"]);
    expect(filterFinderCards(cards, { query: "MMM" }).map((card) => card.id)).toContain("5-18-trend");
    expect(filterFinderCards(cards, { situation: "saved", savedIds: [] })).toEqual([]);
    // 파일 이름·출처로도 찾힌다.
    const byFile = filterFinderCards(cards, { query: cards.find((card) => card.id === "5-27").source.file });
    expect(byFile.map((card) => card.id)).toContain("5-27");
    expect(filterFinderCards(cards, { query: "ROAS 예산" }).every((card) => card.searchText.includes("roas") && card.searchText.includes("예산"))).toBe(true);
    expect(filterFinderCards(cards, { query: "zzzz-없는-말" })).toEqual([]);
  });

  it("accepts only known situations from the address", () => {
    expect(parseFinderSituation("budget")).toBe("budget");
    expect(parseFinderSituation("<script>")).toBe("all");
    expect(parseFinderSituation(undefined)).toBe("all");
    expect(finderHref("budget")).toBe("/start?situation=budget#finder");
    expect(finderHref("all", "en")).toBe("/en/start#finder");
  });

  it("offers the file-type entry: every card sits in exactly one non-empty file family", () => {
    for (const locale of ["ko", "en"]) {
      const cards = finderCards(locale);
      const families = finderFamilies(locale);
      expect(families.length).toBeGreaterThanOrEqual(4);
      expect(families.every((family) => family.count > 0)).toBe(true);
      expect(families.reduce((sum, family) => sum + family.count, 0)).toBe(cards.length);
      for (const family of families) {
        const filtered = filterFinderCards(cards, { family: family.id });
        expect(filtered).toHaveLength(family.count);
        expect(filtered.every((card) => card.source.familyId === family.id)).toBe(true);
      }
      if (locale === "en") expect(/[가-힣]/.test(JSON.stringify(families))).toBe(false);
    }
    expect(parseFinderFamily("commerce")).toBe("commerce");
    expect(parseFinderFamily("<script>")).toBeNull();
    expect(parseFinderFamily(null)).toBeNull();
  });
});
