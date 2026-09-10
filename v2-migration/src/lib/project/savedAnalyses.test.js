import { describe, expect, it } from "vitest";
import { captureSavedAnalysis, compatibleSavedAnalysis, savedAnalysisConfiguration, validateSavedAnalyses } from "./savedAnalyses";
const state = () => ({ csvGroups: { efficiency: { headers: ["Date", "Spend"], mapping: { Date: "date", Spend: "cost" } } }, dashboardFilterGroups: { efficiency: { dateStart: "2026-08-01", dateEnd: "2026-08-07" } }, viewConfig: { another: { hidden: [] } }, customMetrics: {}, customCharts: {} });
describe("saved analysis setups", () => {
  it("matches headers, rejects incompatible files and keeps raw data out", async () => {
    const before = state();
    const item = await captureSavedAnalysis(before, "5-2", "Weekly", "en");
    expect(await compatibleSavedAnalysis(item, before)).toBe(true);
    expect(await compatibleSavedAnalysis(item, { ...before, csvGroups: { efficiency: { headers: ["Other"] } } })).toBe(false);
    expect(item.configuration.groups.efficiency.raw).toBeUndefined();
    expect(item.configuration.viewConfig).toEqual({});
  });
  it("keeps current dates by default and restores saved dates only explicitly", async () => {
    const before = state(); const item = await captureSavedAnalysis(before, "5-2", "Weekly", "ko");
    const next = state(); next.dashboardFilterGroups.efficiency.dateStart = "2026-09-01";
    expect(savedAnalysisConfiguration(item, next).groups.efficiency.filters.dateStart).toBe("2026-09-01");
    expect(savedAnalysisConfiguration(item, next, false).groups.efficiency.filters.dateStart).toBe("2026-08-01");
    expect(savedAnalysisConfiguration(item, next).viewConfig).toEqual(next.viewConfig);
  });
  it("rejects duplicate ids, unknown tools and foreign group settings", async () => {
    const item = await captureSavedAnalysis(state(), "5-2", "Weekly", "ko");
    expect(() => validateSavedAnalyses([item, item])).toThrow();
    expect(() => validateSavedAnalyses([{ ...item, toolId: "unknown" }])).toThrow();
    expect(() => validateSavedAnalyses([{ ...item, configuration: { ...item.configuration, groups: { ...item.configuration.groups, aha: {} } } }])).toThrow();
    expect(validateSavedAnalyses()).toEqual([]);
  });
});
it("includes validated setups in backup round trips", async () => {
  const { parseProjectBackup } = await import("./backup");
  const item = await captureSavedAnalysis(state(), "5-2", "Weekly", "ko");
  const backup = { product: "growthopt-playbook-backup", version: 1, project: { name: "A", snapshots: [], decisions: [], savedAnalyses: [item] }, files: [] };
  expect(parseProjectBackup(JSON.stringify(backup)).project.savedAnalyses).toEqual([item]);
});
