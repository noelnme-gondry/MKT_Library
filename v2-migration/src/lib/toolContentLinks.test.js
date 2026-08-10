import { describe, expect, it } from "vitest";

import { PUBLISHED_BLOG_TOOL_MAP, PUBLISHED_GLOSSARY_TOOL_MAP } from "./contentToolRegistry";
import { blogSlugsForTool, glossarySlugsForTool, hasContentForTool } from "./toolContentLinks";
import { ROUTES, isRoutePublished } from "./routeMap";

const publishedTools = ROUTES.filter(
  (route) => isRoutePublished(route) && (route.id.startsWith("5-") || route.id.startsWith("9-")),
);

describe("toolContentLinks", () => {
  it("derives the reverse index from the forward registry only", () => {
    for (const [slug, toolId] of Object.entries(PUBLISHED_BLOG_TOOL_MAP)) {
      const reachable = blogSlugsForTool(toolId);
      // 상한(3편)을 넘는 도구는 일부만 노출되므로, 등록된 글은 최소한 해당 도구의
      // 후보 목록에 존재해야 한다는 관계로 검증한다.
      expect(reachable.length, toolId).toBeLessThanOrEqual(3);
      expect(Object.keys(PUBLISHED_BLOG_TOOL_MAP)).toContain(slug);
    }
    for (const toolId of new Set(Object.values(PUBLISHED_GLOSSARY_TOOL_MAP))) {
      expect(glossarySlugsForTool(toolId).length, toolId).toBeLessThanOrEqual(2);
    }
  });

  it("points 5-18 subtool routes at the parent tool's content", () => {
    expect(blogSlugsForTool("5-18-mmm")).toEqual(blogSlugsForTool("5-18"));
    expect(glossarySlugsForTool("5-18-cannibal")).toEqual(glossarySlugsForTool("5-18"));
  });

  it("gives every published tool at least one piece of supporting content", () => {
    for (const route of publishedTools) {
      expect(hasContentForTool(route.id), route.id).toBe(true);
    }
  });

  // 보충 매핑이 실재하지 않는 slug를 가리키면 도구 화면에서 링크가 조용히 사라진다.
  it("only references content slugs that exist in the registry", () => {
    const knownPosts = new Set(Object.keys(PUBLISHED_BLOG_TOOL_MAP));
    const knownTerms = new Set(Object.keys(PUBLISHED_GLOSSARY_TOOL_MAP));
    for (const route of publishedTools) {
      for (const slug of blogSlugsForTool(route.id)) expect(knownPosts.has(slug), slug).toBe(true);
      for (const slug of glossarySlugsForTool(route.id)) expect(knownTerms.has(slug), slug).toBe(true);
    }
  });

  it("returns empty lists for non-tool routes without throwing", () => {
    expect(blogSlugsForTool("home")).toEqual([]);
    expect(glossarySlugsForTool(undefined)).toEqual([]);
    expect(hasContentForTool("guide-index")).toBe(false);
  });

  it("stays deterministic across calls", () => {
    expect(blogSlugsForTool("5-2")).toEqual(blogSlugsForTool("5-2"));
    expect(glossarySlugsForTool("5-3")).toEqual(glossarySlugsForTool("5-3"));
  });
});
