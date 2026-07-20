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

  it("pivots long weekly channel spend without summing repeated weekly targets", () => {
    const headers = ["date", "channel", "spend", "regs"];
    const rows = [
      { date: "2025-01-13", channel: "Google", spend: "200", regs: "12" },
      { date: "2025-01-06", channel: "Meta", spend: "50", regs: "10" },
      { date: "2025-01-06", channel: "Google", spend: "100", regs: "10" },
      { date: "2025-01-13", channel: "Meta", spend: "40", regs: "12" },
    ];
    const map = autoGuessColMap(headers, rows);
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.weekLabel).toEqual(["2025-01-06", "2025-01-13"]);
    expect(panel.targets.Regs).toEqual([10, 12]);
    expect(panel.channels.map((channel) => channel.label)).toEqual(["MMM spend · Google", "MMM spend · Meta"]);
    expect(panel.ch.c_mmm_spend_google).toEqual([100, 200]);
    expect(panel.ch.c_mmm_spend_meta).toEqual([50, 40]);
  });

  it("auto-detects explicit week labels before pivoting long-format MMM", () => {
    const headers = ["week", "media", "cost", "revenue"];
    const rows = [
      { week: "2025-W02", media: "Google", cost: "200", revenue: "500" },
      { week: "2025-W01", media: "Google", cost: "100", revenue: "400" },
    ];
    const map = autoGuessColMap(headers, rows);
    expect(map.week.role).toBe("week");
    const panel = buildPanelFromColMap(headers, rows, map).panel;
    expect(panel.weekLabel).toEqual(["2025-W01", "2025-W02"]);
    expect(panel.targets.Revenue).toEqual([400, 500]);
  });
});
