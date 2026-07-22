import { describe, expect, it } from "vitest";
import { buildRouterDiagnosis } from "./buildRouterDiagnosis";

const day = (index) => new Date(Date.UTC(2026, 6, index + 1)).toISOString().slice(0, 10);

describe("buildRouterDiagnosis", () => {
  it("recommends PVM first when the latest seven-day CPA deteriorates", () => {
    const canonicalData = {
      records: Array.from({ length: 14 }, (_, index) => ({
        date: day(index),
        dimensions: { channel: index < 7 ? "Google" : "Meta" },
        metrics: { cost: 700, actions: index < 7 ? 70 : 35 },
      })),
    };
    const diagnosis = buildRouterDiagnosis({ canonicalData, mapping: { Date: "date", Cost: "cost", Actions: "actions", Channel: "channel" } });
    expect(diagnosis.byTool["5-21"]).toMatchObject({ score: 100 });
    expect(diagnosis.byTool["5-21"].reason).toContain("CPA가 직전 7일보다 100% 악화");
  });

  it("withholds a trend recommendation when the period is too short", () => {
    const canonicalData = { records: Array.from({ length: 13 }, (_, index) => ({ date: day(index), dimensions: {}, metrics: { cost: 100, actions: 10 } })) };
    expect(buildRouterDiagnosis({ canonicalData, mapping: { Date: "date", Cost: "cost", Actions: "actions" } }).byTool).toEqual({});
  });
});
