import { describe, expect, it } from "vitest";

import { RESPONSE_SUBTOOL_IDS } from "./responseSubtoolContent";
import { TOOL_SEARCH_CONTENT_IDS, getToolSearchContent } from "./toolSearchContent";
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
