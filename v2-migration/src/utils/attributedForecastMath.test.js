import { describe, expect, it } from "vitest";
import { buildAttributedForecastDataset, runAttributedForecastRouter } from "./attributedForecastMath";

function fixture() {
  const start = Date.UTC(2024, 0, 1);
  const rows = [];
  for (let week = 0; week < 80; week++) {
    const date = new Date(start + week * 7 * 86400000).toISOString().slice(0, 10);
    ["ANDROID", "IOS"].forEach((platform, platformIndex) => {
      const organic = 800 + platformIndex * 200 + (week >= 68 ? 120 : 0);
      const metaCost = 100 + (week % 5) * 20 + platformIndex * 10;
      const googleCost = 80 + (week % 7) * 15 + platformIndex * 10;
      rows.push({ week: date, platform, channel: "Organic", cost: 0, regs: organic });
      rows.push({ week: date, platform, channel: "Meta", cost: metaCost, regs: 20 + Math.log1p(metaCost) * 12 });
      rows.push({ week: date, platform, channel: "Google", cost: googleCost, regs: 15 + Math.log1p(googleCost) * 10 });
    });
  }
  return rows;
}

describe("attributed forecast router", () => {
  it("excludes the current partial week and chooses between Total and OS-sum on sealed WMAPE", () => {
    const rows = fixture();
    rows.push({ week: "2025-07-14", platform: "ANDROID", channel: "Organic", cost: 0, regs: 999999 });
    const dataset = buildAttributedForecastDataset(rows, {
      timeHeader: "week",
      platformHeader: "platform",
      channelHeader: "channel",
      spendHeader: "cost",
      targetHeader: "regs",
    }, { asOfDate: "2025-07-15" });
    expect(dataset.weekLabels.at(-1)).not.toBe("2025-07-14");
    const result = runAttributedForecastRouter(dataset);
    expect(result.candidates.map((candidate) => candidate.route).sort()).toEqual(["android-ios-sum", "direct-total"]);
    expect(result.backtest.actual).toHaveLength(24);
    expect(result.forecast.organic).toHaveLength(12);
    expect(result.forecast.performance.every((value) => value >= 0)).toBe(true);
    expect(result.forecast.predicted.every((value, index) =>
      Math.abs(value - result.forecast.organic[index] - result.forecast.performance[index]) < 1e-8,
    )).toBe(true);
  });
});
