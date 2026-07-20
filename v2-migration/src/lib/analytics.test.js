import { describe, expect, it } from "vitest";
import { sanitizeProductEventParams } from "./analytics";

describe("product analytics privacy boundary", () => {
  it("keeps only approved aggregate parameters", () => {
    expect(sanitizeProductEventParams({
      tool_id: "5-18",
      row_count: 120,
      analysis_type: "mmm",
      file_name: "sensitive.csv",
      channel_name: "Meta KR",
      raw_value: 12345,
    })).toEqual({ tool_id: "5-18", row_count: 120, analysis_type: "mmm" });
  });
});
