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

  it("projects a dated subscription export through the same CSV path used by survival analysis", () => {
    const headers = ["Subscription Start Date", "Cancellation Date", "Data Extracted At"];
    const raw = [
      { "Subscription Start Date": "2026-01-15", "Cancellation Date": "2026-02-18", "Data Extracted At": "2026-03-01" },
      { "Subscription Start Date": "2026-01-20", "Cancellation Date": "", "Data Extracted At": "2026-03-01" },
    ];
    const data = prepareDatasetForTool({ toolId: "5-28", headers, raw });

    expect(data.mappingContract.requiredMissing).toEqual([]);
    expect(data.mappedRows).toEqual([
      { subscription_start_date: "2026-01-15", churn_date: "2026-02-18", observation_end_date: "2026-03-01" },
      { subscription_start_date: "2026-01-20", churn_date: "", observation_end_date: "2026-03-01" },
    ]);
    expect(data.mappingBindingsV2).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceColumn: "Subscription Start Date", canonicalKey: "subscription_start_date" }),
      expect.objectContaining({ sourceColumn: "Cancellation Date", canonicalKey: "subscription_churn_date" }),
      expect.objectContaining({ sourceColumn: "Data Extracted At", canonicalKey: "subscription_observation_end_date" }),
    ]));
  });
});
