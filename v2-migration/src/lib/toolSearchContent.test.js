import { describe, expect, it } from "vitest";

import { RESPONSE_SUBTOOL_IDS } from "./responseSubtoolContent";
import { TOOL_SEARCH_CONTENT_IDS, getToolFaq, getToolSearchContent } from "./toolSearchContent";
import { ROUTES, isRoutePublished } from "./routeMap";

const LOCALES = ["ko", "en"];

describe("toolSearchContent", () => {
  it.each(LOCALES)("gives every registered tool a complete longform block (%s)", (locale) => {
    for (const id of TOOL_SEARCH_CONTENT_IDS) {
      const content = getToolSearchContent(id, locale);
      expect(content, id).toBeTruthy();
      expect(content.eyebrow, id).toBeTruthy();
      expect(content.title, id).toBeTruthy();
      expect(content.lead, id).toBeTruthy();
      expect(content.detailsLabel, id).toBeTruthy();
      expect(content.sections.length, id).toBeGreaterThanOrEqual(3);
      for (const [heading, body] of content.sections) {
        expect(heading, id).toBeTruthy();
        expect(body.length, `${id} ${heading}`).toBeGreaterThan(40);
      }
    }
  });

  it.each(LOCALES)("keeps FAQ entries answerable and unique per tool (%s)", (locale) => {
    for (const id of TOOL_SEARCH_CONTENT_IDS) {
      const { faq } = getToolSearchContent(id, locale);
      expect(faq.length, id).toBeGreaterThanOrEqual(2);
      expect(new Set(faq.map((item) => item.q)).size, id).toBe(faq.length);
      for (const item of faq) {
        expect(item.q.length, id).toBeGreaterThan(5);
        expect(item.a.length, id).toBeGreaterThan(20);
      }
    }
  });

  // AEO: 도구가 답하는 질문과 한 문장 답을 접기 바깥과 FAQ JSON-LD 첫 항목에 둔다.
  // 답이 길어지면 "앞에 둔다"의 의미가 없어지므로 길이 상한도 같이 고정한다.
  it.each(LOCALES)("answers the tool's core question up front (%s)", (locale) => {
    for (const id of TOOL_SEARCH_CONTENT_IDS) {
      const content = getToolSearchContent(id, locale);
      expect(content.question, id).toBeTruthy();
      expect(content.question.endsWith("?"), id).toBe(true);
      expect(content.answer, id).toBeTruthy();
      expect(content.answer.length, `${id} answer too long`).toBeLessThanOrEqual(90);
      // 핵심 질문이 아래 FAQ와 중복되면 같은 질문이 두 번 렌더된다.
      expect(content.faq.map((item) => item.q), id).not.toContain(content.question);
    }
  });

  it.each(LOCALES)("puts the core question first in the FAQ payload (%s)", (locale) => {
    for (const id of TOOL_SEARCH_CONTENT_IDS) {
      const content = getToolSearchContent(id, locale);
      const faq = getToolFaq(id, locale);
      expect(faq[0]?.q, id).toBe(content.question);
      expect(faq.length, id).toBe(content.faq.length + 1);
      expect(new Set(faq.map((item) => item.q)).size, id).toBe(faq.length);
    }
  });

  it("does not reuse one core question across tools", () => {
    for (const locale of LOCALES) {
      const questions = TOOL_SEARCH_CONTENT_IDS.map((id) => getToolSearchContent(id, locale).question);
      expect(new Set(questions).size).toBe(questions.length);
    }
  });

  it("does not reuse one headline across tools", () => {
    for (const locale of LOCALES) {
      const titles = TOOL_SEARCH_CONTENT_IDS.map((id) => getToolSearchContent(id, locale).title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it("still resolves 5-18 subtool content through the fallback", () => {
    for (const id of RESPONSE_SUBTOOL_IDS) {
      expect(getToolSearchContent(id, "ko"), id).toBeTruthy();
      expect(getToolSearchContent(id, "en"), id).toBeTruthy();
    }
  });

  it("registers only real published tool routes", () => {
    const published = new Set(ROUTES.filter((route) => isRoutePublished(route)).map((route) => route.id));
    for (const id of TOOL_SEARCH_CONTENT_IDS) {
      expect(published.has(id), id).toBe(true);
    }
  });

  // 신규 도구가 검색 진입면 없이 배포되는 것을 막는 커버리지 가드.
  it("covers every published tool route", () => {
    const publishedTools = ROUTES.filter(
      (route) => isRoutePublished(route) && (route.id.startsWith("5-") || route.id.startsWith("9-")),
    );
    for (const route of publishedTools) {
      expect(getToolSearchContent(route.id, "ko"), route.id).toBeTruthy();
      expect(getToolSearchContent(route.id, "en"), route.id).toBeTruthy();
    }
  });

  it("returns null for routes without content instead of throwing", () => {
    expect(getToolSearchContent("home")).toBeNull();
    expect(getToolSearchContent("guide-index", "en")).toBeNull();
  });
});
