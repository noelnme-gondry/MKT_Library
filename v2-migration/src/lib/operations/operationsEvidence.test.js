import { describe, expect, it } from "vitest";
import { operationsInputEvidence } from "./operationsEvidence";

const mapping = { Date: "date", Spend: "cost", Installs: "installs", Impressions: "impressions", Clicks: "clicks", Actions: "actions" };
const period = { start: "2026-10-01", end: "2026-10-07" };
const rows = [
  { date: "2026-10-01", cost: "100", installs: "1", actions: "1", impressions: "100", clicks: "10" },
  { date: "2026-10-02", cost: "100", installs: "9", actions: "4", impressions: "900", clicks: "10" },
];
const inspect = (changes = {}) => operationsInputEvidence({ rows, mapping, period, ...changes });
const metric = (model, id) => model.metrics.find(item => item.id === id);

describe("operations CSV metric evidence", () => {
  it("uses sums over the same rows, not an average of ratios", () => {
    const model = inspect();
    expect(metric(model, "cpi").value).toBe(20);
    expect(metric(model, "cpc").value).toBe(10);
    expect(metric(model, "cvr").value).toBe(0.5);
    expect(metric(model, "ctr").value).toBe(0.02);
    expect(metric(model, "cpm").value).toBe(200);
    expect(model.metrics.some(item => item.id === "profit" || item.id === "roas")).toBe(false);
  });

  it("uses the selected outcome and traces it to the actual source header", () => {
    const cpa = metric(inspect({ metric: "actions" }), "cpi");
    expect(cpa.value).toBe(40);
    expect(cpa.dependencies[1].key).toBe("actions");
    expect(cpa.dependencies[1].headers).toEqual(["Actions"]);
  });

  it("keeps missing optional fields unavailable, without closing usable CPR", () => {
    const model = inspect({ mapping: { Date: "date", Spend: "cost", Installs: "installs" } });
    expect(metric(model, "cpi").value).toBe(20);
    expect(metric(model, "ctr").value).toBeNull();
    expect(metric(model, "ctr").reason).toBe("unmapped");
  });

  it.each(["", "not a number", -1])("does not fill invalid optional values (%s) with zero", value => {
    const model = inspect({ rows: [rows[0], { ...rows[1], clicks: value }] });
    expect(metric(model, "cpc").value).toBeNull();
    expect(metric(model, "cpc").reason).toBe("invalid");
    expect(metric(model, "cpi").value).toBe(20);
    expect(model.inputs.find(input => input.key === "clicks").invalidCount).toBe(1);
  });

  it("distinguishes observed zero outcomes from a missing outcome", () => {
    const zero = inspect({ rows: rows.map(row => ({ ...row, installs: "0" })) });
    expect(metric(zero, "cpi").reason).toBe("zero_denominator");
    expect(metric(zero, "cpi").value).toBeNull();
    expect(zero.inputs.find(input => input.key === "installs").total).toBe(0);
  });

  it("blocks conflicting source columns and supports the existing spend alias", () => {
    const conflict = inspect({ mapping: { ...mapping, SecondSpend: "cost" } });
    expect(metric(conflict, "cpi").reason).toBe("conflict");
    const alias = inspect({ mapping: { ...mapping, Spend: "spend" } });
    expect(metric(alias, "cpi").value).toBe(20);
    expect(metric(alias, "cpi").dependencies[0].headers).toEqual(["Spend"]);
  });

  it("does not report partial totals when an invalid date cannot be scoped", () => {
    const model = inspect({ rows: [...rows, { ...rows[0], date: "2026-02-30" }] });
    expect(model.invalidDateCount).toBe(1);
    expect(model.metrics.every(item => item.value === null)).toBe(true);
    expect(model.inputs.every(item => item.total === null)).toBe(true);
  });

  it("uses the actual period and reports no observations without invented zeros", () => {
    expect(metric(inspect({ period: { start: "2026-10-02", end: "2026-10-02" } }), "cpi").value).toBeCloseTo(100 / 9, 10);
    const empty = inspect({ period: { start: "2026-10-10", end: "2026-10-17" } });
    expect(empty.observations).toBe(0);
    expect(metric(empty, "cpi").reason).toBe("empty");
    expect(empty.inputs.every(input => input.total === null)).toBe(true);
  });
});
