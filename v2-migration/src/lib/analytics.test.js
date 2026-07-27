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
});
