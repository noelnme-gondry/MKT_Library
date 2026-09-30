import { describe, expect, it } from "vitest";
import { efficiencyStages } from "./efficiencyStages";

const fields = ["impressions", "clicks", "installs", "actions"];
const base = { spend: 1000, impressions: 10000, clicks: 1000, installs: 100, actions: 10 };
const run = (after, result = "actions", mapped = fields) => efficiencyStages([base], [after], result, mapped);

describe("efficiencyStages", () => {
  it.each([
    ["cpm", { ...base, spend: 2000 }],
    ["impressions-clicks", { ...base, clicks: 500, installs: 50, actions: 5 }],
    ["clicks-installs", { ...base, installs: 50, actions: 5 }],
    ["installs-actions", { ...base, actions: 5 }],
  ])("attributes an isolated stage move to %s", (key, after) => {
    const result = run(after);
    expect(result.ok).toBe(true);
    expect(result.delta).toBe(100);
    for (const stage of result.stages) expect(stage.contribution).toBeCloseTo(stage.key === key ? 100 : 0, 10);
  });

  it("averages order effects rather than adding percentage changes", () => {
    // 직전 CPI=10. CPM×2, 클릭률÷2만 변경하면 CPI=40.
    // CPM을 먼저 바꾸면 +10/+20, 역순은 +20/+10. 평균은 각각 +15.
    const result = run({ ...base, spend: 2000, clicks: 500, installs: 50, actions: 5 }, "installs");
    expect(result.stages.map(stage => stage.contribution)).toEqual([15, 15, 0]);
    expect(result.delta).toBe(30);
  });

  it("preserves the identity and reverses contributions when periods swap", () => {
    const after = { spend: 1700, impressions: 13000, clicks: 900, installs: 80, actions: 12 };
    const result = run(after);
    const reverse = efficiencyStages([after], [base], "actions", fields);
    expect(result.stages.reduce((sum, stage) => sum + stage.contribution, 0)).toBeCloseTo(1700 / 12 - 100, 10);
    result.stages.forEach((stage, i) => expect(stage.contribution).toBeCloseTo(-reverse.stages[i].contribution, 10));
  });

  it("does not hide offsetting contributions behind an unchanged total", () => {
    const result = run({ ...base, spend: 2000, actions: 20 });
    expect(result.delta).toBe(0);
    expect(result.stages.find(stage => stage.key === "cpm").contribution).toBe(75);
    expect(result.stages.find(stage => stage.key === "installs-actions").contribution).toBe(-75);
  });

  it("ends CPI at installs and CPA at actions", () => {
    expect(run(base, "installs").stages.map(stage => stage.key)).toEqual(["cpm", "impressions-clicks", "clicks-installs"]);
    expect(run(base).stages.at(-1).key).toBe("installs-actions");
  });

  it("merges unavailable intermediate stages without inventing detail", () => {
    const result = run({ ...base, clicks: undefined }, "actions");
    expect(result.omitted).toEqual(["clicks"]);
    expect(result.stages.map(stage => stage.key)).toEqual(["cpm", "impressions-installs", "installs-actions"]);
    expect(run(base, "actions", ["impressions", "actions"]).stages.map(stage => stage.key)).toEqual(["cpm", "impressions-actions"]);
  });

  it("rejects invalid essential totals and partial data", () => {
    for (const value of [null, "", -1, NaN, Infinity, 0]) expect(run({ ...base, impressions: value }).ok).toBe(false);
    expect(efficiencyStages([base, { ...base, impressions: "" }], [base], "actions", fields).ok).toBe(false);
    const result = efficiencyStages([base, { ...base, clicks: "" }], [base], "actions", fields);
    expect(result.ok).toBe(true);
    expect(result.omitted).toContain("clicks");
  });

  it("uses weighted aggregate ratios and accepts comma formatted counts", () => {
    const result = efficiencyStages([base, { ...base, impressions: "20,000", clicks: 100 }], [base], "installs", fields);
    expect(result.stages[1].before).toBeCloseTo(1100 / 30000, 12);
  });
});
