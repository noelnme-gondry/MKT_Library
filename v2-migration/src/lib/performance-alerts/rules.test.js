import { describe, expect, it } from "vitest";
import { bindAlertRule, checkAlert, evaluateAlert, sanitizeAlertRules, shiftDay } from "./rules";
const mapping = { Date: "date", Channel: "channel", Cost: "cost", Installs: "installs", Custom: "__ignore__" };
export const fixture = (start = "2026-08-01", count = 84) => ({ headers: Object.keys(mapping), mapping, currency: "KRW", importSource: "csv", fileName: "same.csv", raw: Array.from({ length: count }, (_, index) => ({ Date: shiftDay(start, index), Channel: "Meta", Cost: index < count - 7 ? 100 : 140, Installs: 10, Custom: index < count - 7 ? 200 : 100 })) });
export const draft = { name: "Meta CPR", metric: "cpr", basis: "installs", days: 7, comparison: "previous", percent: 20, direction: "up", target: 100, channel: "Meta", valueHeader: "" };
const bind = (data, patch = {}) => bindAlertRule({ ...draft, ...patch }, data, "rule-one");

describe("project performance rules", () => {
  it("uses ratio of period sums and adjacent windows, not daily ratio means", () => {
    const data = fixture("2026-08-01", 14);
    data.raw[13].Cost = 1400; data.raw[13].Installs = 100;
    const rule = checkAlert(bind(data), data, 1), result = evaluateAlert(rule);
    expect(result.status).toBe("triggered");
    expect(result.reference).toBe(10); expect(result.value).toBe(14);
    expect(result.previousEnd).toBe("2026-08-07"); expect(result.currentStart).toBe("2026-08-08");
    expect(rule.history).toHaveLength(14);
  });
  it("joins consecutive uploads and replaces overlapping intervals without stale gap filling", () => {
    const first = fixture("2026-08-01", 7), next = fixture("2026-08-08", 7);
    let rule = checkAlert(bind(first), first);
    rule = checkAlert(rule, next);
    expect(rule.history).toHaveLength(14); expect(evaluateAlert(rule).status).not.toBe("unavailable");
    const partial = { ...fixture("2026-08-01", 14), raw: fixture("2026-08-01", 14).raw.filter((_, index) => index !== 3) };
    rule = checkAlert(rule, partial);
    expect(rule.history).toHaveLength(13); expect(evaluateAlert(rule)).toMatchObject({ status: "unavailable", issue: "coverage" });
    const repeated = checkAlert(rule, partial); expect(repeated.history).toEqual(rule.history);
  });
  it("rejects different currency, schema, role mapping, missing channel and non-daily data", () => {
    const data = fixture(), rule = bind(data);
    expect(checkAlert(rule, { ...data, currency: "USD" }).issue).toBe("currency");
    expect(checkAlert(rule, { ...data, headers: [...data.headers, "Other"] }).issue).toBe("columns");
    expect(checkAlert(rule, { ...data, mapping: { ...mapping, Installs: "actions" } }).issue).toBe("columns");
    expect(checkAlert({ ...rule, channel: "Google" }, data).issue).toBe("scope");
    expect(checkAlert(rule, { ...data, raw: [{ ...data.raw[0], Date: "2026-W31" }] }).issue).toBe("dates");
    expect(checkAlert(rule, { ...data, raw: [{ ...data.raw[0], Date: "08/01/2026" }] }).issue).toBe("dates");
  });
  it("withholds invalid numbers and zero denominator/reference instead of announcing no alert", () => {
    for (const value of ["", "garbage", -10]) {
      const data = fixture(); data.raw[0].Cost = value;
      expect(evaluateAlert(checkAlert(bind(data), data))).toMatchObject({ status: "unavailable", issue: "numbers" });
    }
    const data = fixture(); data.raw.forEach(row => { row.Installs = 0; });
    expect(evaluateAlert(checkAlert(bind(data), data))).toMatchObject({ status: "unavailable", issue: "denominator" });
  });
  it("checks raw custom column totals/row averages and target-relative declines", () => {
    const data = fixture();
    const rule = checkAlert(bind(data, { metric: "mean", valueHeader: "Custom", comparison: "target", target: 200, direction: "down", percent: 40 }), data);
    expect(evaluateAlert(rule)).toMatchObject({ status: "triggered", value: 100, reference: 200, change: -50, threshold: 120 });
  });
  it("bounds history and rejects malformed backup rules, duplicates and forged daily points", () => {
    const data = fixture("2025-01-01", 500), rule = checkAlert(bind(data), data);
    expect(rule.history).toHaveLength(366); expect(sanitizeAlertRules([rule])[0].history).toEqual(rule.history);
    expect(() => sanitizeAlertRules([rule, rule])).toThrow();
    expect(() => sanitizeAlertRules([{ ...rule, history: [{ date: "2026-02-30", n: 1, d: 1 }] }])).toThrow();
    expect(() => sanitizeAlertRules([{ ...rule, metric: "execute" }])).toThrow();
  });
});

it("includes exact threshold equality without percent-rounding false negatives", () => {
  const data = fixture("2026-08-01", 14); data.raw.slice(7).forEach(row => { row.Cost = 120; });
  expect(evaluateAlert(checkAlert(bind(data), data)).status).toBe("triggered");
});
it("evicts an absent channel's replacement interval before later incremental uploads", () => {
  const data = fixture("2026-08-01", 14); let rule = checkAlert(bind(data), data);
  const replacement = fixture("2026-08-08", 7); replacement.raw.forEach(row => { row.Channel = "Google"; });
  rule = checkAlert(rule, replacement); expect(rule.issue).toBe("scope"); expect(rule.history).toHaveLength(7);
  rule = checkAlert(rule, fixture("2026-08-15", 7));
  expect(evaluateAlert(rule)).toMatchObject({ status: "unavailable", issue: "coverage" });
});

it("invalid numeric replacements cannot resurrect older values as the next baseline", () => {
  let rule = checkAlert(bind(fixture("2026-08-01", 14)), fixture("2026-08-01", 14));
  const bad = fixture("2026-08-08", 7); bad.raw[0].Cost = "";
  rule = checkAlert(rule, bad); expect(rule.issue).toBe("numbers");
  expect(rule.history.some(point => point.date === "2026-08-08")).toBe(false);
  rule = checkAlert(rule, fixture("2026-08-15", 7));
  expect(evaluateAlert(rule)).toMatchObject({ status: "unavailable", issue: "coverage" });
});

it("withholds conflicting role mappings instead of choosing the first source column", () => {
  const data = fixture(), rule = bind(data);
  expect(checkAlert(rule, { ...data, mapping: { ...data.mapping, Custom: "cost" } }).issue).toBe("columns");
});
