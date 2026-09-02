import { describe, expect, it } from "vitest";
import { getToolFeatureList, getToolOgImageUrl, TOOL_OG_CONFIG } from "./toolOg";
import { ROUTES, isRoutePublished } from "./routeMap";

// 손으로 쓴 배열이 아니라 ROUTES에서 **파생**한다. 하드코딩하던 시절 5-25·5-26이
// 배포된 뒤에도 TOOL_OG_CONFIG에서 빠져 있었는데, "every published tool"을 검증한다는
// 이 테스트가 같은 누락을 가진 배열을 돌아 통과했다(감사 P1-9).
const TOOL_IDS = ROUTES.filter((route) => isRoutePublished(route) && /^(5|9)-[\w-]+$/.test(route.id)).map((route) => route.id);

describe("tool feature lists", () => {
  it.each(TOOL_IDS)("%s declares KO and EN features for JSON-LD", (toolId) => {
    const ko = getToolFeatureList(toolId, "ko");
    const en = getToolFeatureList(toolId, "en");
    // featureList가 비면 SoftwareApplication 구조화 데이터가 빈 배열로 나간다(감사 P1-9).
    expect(TOOL_OG_CONFIG[toolId].metrics.ko.length).toBeGreaterThanOrEqual(3);
    expect(TOOL_OG_CONFIG[toolId].metrics.en.length).toBeGreaterThanOrEqual(3);
    expect(ko).toContain("브라우저 내 CSV 분석");
    expect(en).toContain("Client-side CSV analysis");
  });

  it("points every route at the one shared social card", () => {
    // 도구별 동적 카드는 없앴다 — 어떤 라우트를 넣어도 같은 정적 카드가 나와야 한다.
    expect(getToolOgImageUrl("https://example.com", "5-2", "ko")).toBe("https://example.com/og-card.png");
    expect(getToolOgImageUrl("https://example.com", "guide-index", "en")).toBe("https://example.com/og-card.png");
  });
});
