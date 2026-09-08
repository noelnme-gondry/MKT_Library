import { describe, expect, it } from "vitest";
import { executionPreflight } from "./executionPreflight";
import { evaluateEligibility } from "./evaluateEligibility";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { useAppStore } from "@/store/useDataStore";

const mapping = { Date: "date", Channel: "channel", Spend: "cost", Installs: "installs" };
function dataset(variable = false) {
  const raw = Array.from({ length: 28 }, (_, i) => ({ Date: `2026-08-${String(Math.floor(i / 2) + 1).padStart(2, "0")}`, Channel: i % 2 ? "B" : "A", Spend: variable ? String(100 + i * i) : "100", Installs: "10" }));
  return { raw, headers: Object.keys(mapping), mapping, canonicalData: buildCanonicalDataset({ raw, headers: Object.keys(mapping), mapping }) };
}
describe("execution preflight shared with direct uploader", () => {
  it.each(["ko", "en"])("blocks constant-spend VIF at handoff (%s)", (locale) => {
    const data = dataset();
    const result = executionPreflight(data, "5-25", locale);
    expect(result.blockers).toEqual(evaluateEligibility({ ...data, toolId: "5-25", locale }).blockers);
    expect(result.blockers.some((item) => item.code === "insufficient_variation")).toBe(true);
    expect(result.message).toMatch(locale === "en" ? /spend movement/ : /지출 변동/);
    useAppStore.getState().handoffCsvToRoute("5-25", data);
    expect(useAppStore.getState().isGroupAnalyzed("5-25")).toBe(false);
  });
  it("retains valid input while opening the analysis gate", () => {
    const data = dataset(true);
    expect(executionPreflight(data, "5-25").status).not.toBe("blocked");
    useAppStore.getState().handoffCsvToRoute("5-25", data);
    useAppStore.getState().setCurrentRouteId("5-25");
    expect(useAppStore.getState().isGroupAnalyzed("5-25")).toBe(true);
  });
  it("does not auto-approve a tool-owned design or unknown route", () => {
    for (const id of ["5-20", "9-1", "unknown"]) expect(executionPreflight(dataset(), id).scope).toBe("tool_design");
  });
});
