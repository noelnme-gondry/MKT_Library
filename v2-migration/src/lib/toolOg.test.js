import { describe, expect, it } from "vitest";
import { getToolOgData, getToolOgImageUrl, TOOL_OG_CONFIG } from "./toolOg";

const TOOL_IDS = ["5-2", "5-3", "5-4", "5-18", "5-20", "5-21", "5-22", "5-23", "9-1", "9-6"];

describe("tool-specific social cards", () => {
  it.each(TOOL_IDS)("%s has distinct KO and EN card copy", (toolId) => {
    const ko = getToolOgData(toolId, "ko");
    const en = getToolOgData(toolId, "en");
    expect(ko).toMatchObject({ toolId, locale: "ko" });
    expect(en).toMatchObject({ toolId, locale: "en" });
    expect(ko.title).not.toBe(en.title);
    expect(ko.metrics.length).toBeGreaterThanOrEqual(3);
    expect(en.metrics.length).toBeGreaterThanOrEqual(3);
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
