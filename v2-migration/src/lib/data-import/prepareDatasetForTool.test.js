import { describe, expect, it } from "vitest";
import { prepareDatasetForTool } from "./prepareDatasetForTool";

describe("prepareDatasetForTool", () => {
  it("remaps one raw creative export for the fatigue tool", () => {
    const data = prepareDatasetForTool({
      toolId: "9-6",
      headers: ["날짜", "채널", "소재 ID", "노출수", "클릭수", "설치", "비용"],
      raw: [{ "날짜": "2026-07-01", "채널": "Meta", "소재 ID": "cr-1", "노출수": "100", "클릭수": "5", "설치": "1", "비용": "10" }],
    });
    expect(Object.values(data.mapping)).toEqual(expect.arrayContaining(["date", "channel", "creative_id", "impressions", "clicks", "installs", "spend"]));
    expect(data.canonicalData.records).toHaveLength(1);
  });
});
