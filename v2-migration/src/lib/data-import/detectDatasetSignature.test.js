import { describe, expect, it } from "vitest";
import { detectDatasetSignature } from "./detectDatasetSignature";

describe("detectDatasetSignature", () => {
  it("identifies a Meta campaign daily export conservatively", () => {
    const signature = detectDatasetSignature(["Date", "Campaign name", "Ad name", "Amount spent", "Link clicks"], [{ Date: "2026-07-01", "Campaign name": "A", "Ad name": "B", "Amount spent": "100", "Link clicks": "4" }]);
    expect(signature).toMatchObject({ source: "meta_ads", shape: "long", grain: "creative_daily", needsWideToLong: false });
  });

  it("flags a date-column report that can be transformed after confirmation", () => {
    const signature = detectDatasetSignature(["Campaign", "2026-07-01", "2026-07-08"], [{ Campaign: "A", "2026-07-01": "10", "2026-07-08": "12" }]);
    expect(signature).toMatchObject({ shape: "wide", needsWideToLong: true, grain: "campaign_summary" });
  });
});
