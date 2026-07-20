import { describe, expect, it } from "vitest";
import { autoGuessColMap, buildPanelFromColMap, mmmSegmentValues } from "./MmmColumnMapper";

describe("MMM column mapping", () => {
  it("auto-detects row OS and Revenue, then filters the panel", () => {
    const headers = ["week", "os", "revenue", "google_spend"];
    const rows = [
      { week: "2025-01-06", os: "android", revenue: "100", google_spend: "20" },
      { week: "2025-01-06", os: "iOS", revenue: "80", google_spend: "10" },
    ];
    const map = autoGuessColMap(headers, rows);
    expect(map.os.role).toBe("platform");
    expect(map.revenue.role).toBe("revenue");
    expect(mmmSegmentValues(headers, rows, map).values.map((v) => v.value)).toEqual(["android", "iOS"]);
    const panel = buildPanelFromColMap(headers, rows, map, "android").panel;
    expect(panel.targets.Revenue).toEqual([100]);
    expect(panel.ch.c_google_spend).toEqual([20]);
  });

  it("sorts date-like week inputs chronologically instead of parseFloat year ties", () => {
    const headers = ["week", "regs", "google_spend"];
    const rows = [
      { week: "2025-02-03", regs: "20", google_spend: "200" },
      { week: "2025-01-06", regs: "10", google_spend: "100" },
    ];
    const map = { week: { role: "week" }, regs: { role: "reg" }, google_spend: { role: "channel", kind: "perf", plat: "common" } };
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.weekLabel).toEqual(["2025-01-06", "2025-02-03"]);
    expect(panel.targets.Regs).toEqual([10, 20]);
    expect(panel.week).toEqual([1, 2]);
  });
});
