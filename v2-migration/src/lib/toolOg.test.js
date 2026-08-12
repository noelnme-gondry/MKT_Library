import { describe, expect, it } from "vitest";
import { getToolFeatureList, getToolOgData, getToolOgImageUrl, TOOL_OG_CONFIG } from "./toolOg";
import { ROUTES, isRoutePublished } from "./routeMap";

// 손으로 쓴 배열이 아니라 ROUTES에서 **파생**한다. 하드코딩하던 시절 5-25·5-26이
// 배포된 뒤에도 TOOL_OG_CONFIG에서 빠져 있었는데, "every published tool"을 검증한다는
// 이 테스트가 같은 누락을 가진 배열을 돌아 통과했다(감사 P1-9).
const TOOL_IDS = ROUTES.filter((route) => isRoutePublished(route) && /^(5|9)-\d+$/.test(route.id)).map((route) => route.id);

describe("tool-specific social cards", () => {
  it.each(TOOL_IDS)("%s has distinct KO and EN card copy", (toolId) => {
    const ko = getToolOgData(toolId, "ko");
    const en = getToolOgData(toolId, "en");
    expect(ko).toMatchObject({ toolId, locale: "ko" });
    expect(en).toMatchObject({ toolId, locale: "en" });
    expect(ko.title).not.toBe(en.title);
    expect(ko.metrics.length).toBeGreaterThanOrEqual(3);
    expect(en.metrics.length).toBeGreaterThanOrEqual(3);
    expect(getToolFeatureList(toolId, "ko")).toContain("브라우저 내 CSV 분석");
    expect(getToolFeatureList(toolId, "en")).toContain("Client-side CSV analysis");
  });

  it("uses a unique visual signature for every published tool", () => {
    const signatures = TOOL_IDS.map((toolId) => {
      const item = TOOL_OG_CONFIG[toolId];
      return `${item.accent}|${item.glyph}`;
    });
    expect(new Set(signatures).size).toBe(TOOL_IDS.length);
  });

  it("builds localized URLs and falls back for non-tool routes", () => {
    expect(getToolOgImageUrl("https://example.com", "5-2", "ko")).toBe("https://example.com/og/tool/5-2");
    expect(getToolOgImageUrl("https://example.com", "5-2", "en")).toBe("https://example.com/og/tool/5-2?lang=en");
    expect(getToolOgImageUrl("https://example.com", "guide-index", "ko")).toBe("https://example.com/og-card.png");
  });
});
