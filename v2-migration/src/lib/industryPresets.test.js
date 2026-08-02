import { describe, expect, it } from "vitest";
import {
  buildIndustryPresetDemo,
  getIndustryPresets,
  getIndustryScaleOptions,
  INDUSTRY_PRESET_IDS,
} from "@/lib/industryPresets";
import { buildDemoCsv } from "@/utils/demoData";

const baseDemo = () => buildDemoCsv("efficiency", "ko");

describe("industry demo presets", () => {
  it("publishes four fixed KR/EN situations and three optional scale bands", () => {
    expect(INDUSTRY_PRESET_IDS).toEqual([
      "app-commerce",
      "mobile-game",
      "subscription",
      "lead-generation",
    ]);
    expect(getIndustryPresets("ko")).toHaveLength(4);
    expect(getIndustryPresets("en").map((preset) => preset.title)).toEqual([
      "App commerce",
      "Mobile game",
      "Subscription",
      "Lead generation",
    ]);
    expect(getIndustryScaleOptions("ko").map((scale) => scale.id)).toEqual(["starter", "growth", "scale"]);
  });

  it("creates deterministic, analysis-ready samples without changing row grain", () => {
    const first = buildIndustryPresetDemo(baseDemo(), "mobile-game", "growth");
    const second = buildIndustryPresetDemo(baseDemo(), "mobile-game", "growth");
    expect(first).toEqual(second);
    expect(first.raw).toHaveLength(2160);
    expect(first.mapping.cost).toBe("cost");
    expect(first.fileName).toBe("demo_preset_mobile-game_growth.csv");
    expect(first.demoPresetId).toBe("mobile-game");
    expect(new Set(first.raw.map((row) => row.channel))).toEqual(new Set(["Google UAC", "Meta Gaming", "AppLovin", "Unity Ads"]));
  });

  it("changes operating scale while preserving valid funnel and cohort counts", () => {
    const starter = buildIndustryPresetDemo(baseDemo(), "subscription", "starter");
    const scaled = buildIndustryPresetDemo(baseDemo(), "subscription", "scale");
    const starterCost = starter.raw.reduce((sum, row) => sum + row.cost, 0);
    const scaledCost = scaled.raw.reduce((sum, row) => sum + row.cost, 0);
    expect(scaledCost / starterCost).toBeCloseTo(16, 3);
    expect(scaled.raw.every((row) => row.actions <= row.installs)).toBe(true);
    expect(scaled.raw.every((row) => row.pu_d7 <= row.actions && row.pu_d14 <= row.actions)).toBe(true);
    expect(scaled.raw.every((row) => row.ret_d14 <= row.ret_d7 && row.ret_d7 <= row.installs)).toBe(true);
  });

  it("refuses unknown identifiers instead of inventing a fallback situation", () => {
    expect(buildIndustryPresetDemo(baseDemo(), "other", "growth")).toBeNull();
    expect(buildIndustryPresetDemo(baseDemo(), "app-commerce", "unknown")).toBeNull();
    expect(buildIndustryPresetDemo(null, "app-commerce", "growth")).toBeNull();
  });
});
