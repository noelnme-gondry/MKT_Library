import { decisionDataOrigin, canTrackDecisionReview } from "@/lib/dataOrigin";
import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { describeDataSeries, compareDataSeries } from "./dataSeries";
import { migrateLegacyProject } from "./repository";
import { parseProjectBackup } from "./backup";
import { serializeDecisionReviewCsv, normalizeDecisionReviewRows } from "@/lib/decisionReview";
const data = (fileName, dates) => ({ fileName, currency: "KRW", mapping: { Date: "date", Cost: "cost" }, raw: dates.map(date => ({ Date: date, Cost: "100" })) });
describe("project compatibility and backup contracts", () => {
  it("excludes demo follow-up data even when the original decision was real", () => {
    expect(canTrackDecisionReview({ dataOrigin: "real" }, { importSource: "demo", raw: [{}] }, true)).toBe(false);
    expect(canTrackDecisionReview({ dataOrigin: "real" }, { importSource: "csv", raw: [{}] }, true)).toBe(true);
    expect(canTrackDecisionReview({ dataOrigin: "unknown" })).toBe(false);
    expect(canTrackDecisionReview({ dataOrigin: "real" })).toBe(true);
  });
  it("does not classify real renamed uploads as demos", () => {
    expect(decisionDataOrigin({ fileName: "demo_actual.csv", importSource: "csv", raw: [{}] })).toBe("real");
    expect(decisionDataOrigin({ fileName: "demo_actual.csv", raw: [{}] })).toBe("demo");
    expect(decisionDataOrigin({ fileName: "renamed.csv", importSource: "demo", raw: [{}] })).toBe("demo");
  });
  it("a renamed next-week export stays compatible; date gaps, overlaps and unit changes are visible", () => {
    const previous = describeDataSeries(data("old.csv", ["2026-08-24", "2026-08-30"]), "efficiency");
    const next = describeDataSeries(data("completely-different.csv", ["2026-08-31", "2026-09-06"]), "efficiency");
    expect(compareDataSeries(previous, next)).toBe("next_period");
    expect(compareDataSeries(previous, { ...next, start: "2026-09-02" })).toBe("gap");
    expect(compareDataSeries(previous, { ...next, start: "2026-08-29" })).toBe("overlap");
    expect(compareDataSeries(previous, { ...next, currency: "USD" })).toBe("currency_changed");
    expect(compareDataSeries(previous, { ...next, roles: ["cost"] })).toBe("schema_changed");
  });
  it("migration preserves settings, snapshots and decisions without inventing provenance", () => {
    const settings = { name: "Client A", metric: "cpa" };
    const snapshots = [{ period: { start: "2026-08-24", end: "2026-08-30" } }];
    const migrated = migrateLegacyProject(settings, snapshots, [{ action: "Hold" }], 123);
    expect(migrated).toMatchObject({ id: "default", key: "project:default", settings, snapshots, lastUsedAt: 123 });
    expect(migrated.decisions[0].dataOrigin).toBe("unknown");
  });
  it("decision CSV columns round-trip structured goals, guardrails and provenance", () => {
    const original = { toolId: "weekly-review", action: "Budget +10%", actionKind: "increase_budget", goalMetric: "conversions", goalDirection: "up", guardrailMetric: "cpa", guardrailOp: "lte", guardrailValue: "9", hypothesis: "Improve volume", dataOrigin: "real" };
    const rows = Papa.parse(serializeDecisionReviewCsv([original]), { header: true, skipEmptyLines: true }).data;
    expect(normalizeDecisionReviewRows(rows)[0]).toMatchObject({ goalMetric: "conversions", goalDirection: "up", guardrailValue: "9", hypothesis: "Improve volume", dataOrigin: "real" });
  });
  it("rejects unsafe or malformed backups before touching storage", () => {
    expect(() => parseProjectBackup('{"__proto__":{"x":1}}')).toThrow();
    expect(() => parseProjectBackup('{"product":"growthopt-playbook-backup","version":100}')).toThrow();
    const backup = { product: "growthopt-playbook-backup", version: 1, project: { name: "A", snapshots: [], decisions: [], branding: { company: "Company", footer: "Footer", logo: "" } }, files: [] };
    expect(parseProjectBackup(JSON.stringify(backup)).project.branding).toEqual(backup.project.branding);
  });
});
