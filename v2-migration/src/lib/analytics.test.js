import { describe, expect, it } from "vitest";
import { sanitizeProductEventParams } from "./analytics";

describe("product analytics privacy boundary", () => {
  it("keeps only approved aggregate parameters", () => {
    expect(sanitizeProductEventParams({
      tool_id: "5-18",
      row_count: 120,
      analysis_type: "mmm",
      source_tool_id: "5-2",
      data_continuity: "same_csv",
      rank: 1,
      file_name: "sensitive.csv",
      industry_name: "고객사 내부 업종명",
      channel_name: "Meta KR",
      raw_value: 12345,
    })).toEqual({
      tool_id: "5-18",
      row_count: 120,
      analysis_type: "mmm",
      source_tool_id: "5-2",
      data_continuity: "same_csv",
      rank: 1,
    });
  });

  it("drops retired preset parameters at the analytics boundary", () => {
    expect(sanitizeProductEventParams({
      preset_id: "mobile-game",
      preset_scale: "growth",
      source: "start",
    })).toEqual({ source: "start" });
  });
});
