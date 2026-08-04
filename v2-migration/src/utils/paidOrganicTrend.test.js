import { describe, expect, it } from "vitest";
import {
  buildPaidOrganicTrend,
  buildPaidOrganicTrendDemo,
  guessPaidOrganicColumns,
  parseTrendNumber,
} from "@/utils/paidOrganicTrend";

describe("paidOrganicTrend", () => {
  it("guesses date, total, paid, and direct organic columns without mixing them", () => {
    expect(guessPaidOrganicColumns(["week", "total_signups", "paid_signups", "organic_signups"])).toEqual({
      date: "week",
      total: "total_signups",
      paid: "paid_signups",
      organic: "organic_signups",
    });
  });

  it("parses formatted numbers", () => {
    expect(parseTrendNumber("1,234")).toBe(1234);
    expect(parseTrendNumber(" 12.5% ")).toBe(12.5);
    expect(parseTrendNumber(42)).toBe(42);
    expect(parseTrendNumber("-")).toBeNull();
  });

  it("aggregates daily rows to Monday weeks and computes organic as total minus paid", () => {
    const result = buildPaidOrganicTrend([
      { date: "2026-01-05", total: "1,000", paid: "400" },
      { date: "2026-01-06", total: "500", paid: "200" },
      { date: "2026-01-12", total: "1,700", paid: "850" },
      { date: "2026-01-19", total: "1,800", paid: "1,080" },
    ], { date: "date", total: "total", paid: "paid", organic: "" });

    expect(result.levels).toEqual([
      { week: "2026-01-05", organic: 900, paid: 600 },
      { week: "2026-01-12", organic: 850, paid: 850 },
      { week: "2026-01-19", organic: 720, paid: 1080 },
    ]);
    expect(result.points).toHaveLength(2);
    expect(result.points[1].x).toBeCloseTo(-15.294, 2);
    expect(result.points[1].y).toBeCloseTo(27.059, 2);
  });

  it("flags a repeated Paid-up Organic-down pattern as a watch signal, not proof", () => {
    const start = Date.UTC(2026, 1, 2);
    const raw = Array.from({ length: 8 }, (_, index) => ({
      week: new Date(start + index * 7 * 86400000).toISOString().slice(0, 10),
      total: 1000 - index * 20 + 300 + index * 35,
      paid: 300 + index * 35,
    }));
    const result = buildPaidOrganicTrend(raw, { date: "week", total: "total", paid: "paid", organic: "" });
    expect(result.verdict).toBe("watch");
    expect(result.watchCount).toBeGreaterThanOrEqual(3);
  });

  it("builds a deterministic demo with enough weeks for the trajectory", () => {
    const first = buildPaidOrganicTrendDemo();
    const second = buildPaidOrganicTrendDemo();
    expect(first).toEqual(second);
    expect(first.raw).toHaveLength(24);
    expect(buildPaidOrganicTrend(first.raw, guessPaidOrganicColumns(first.headers)).points.length).toBe(23);
  });
});
