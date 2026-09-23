import { describe, expect, it } from "vitest";
import { executionPreflight } from "./executionPreflight";
import { evaluateEligibility } from "./evaluateEligibility";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { useAppStore } from "@/store/useDataStore";
import { computeCsvEligibility } from "@/lib/assistant/csvEligibility";
import { runResponseAnalysis } from "@/lib/assistant/responseAnalysisAdapters";
import { prepareAnalysisHandoff } from "@/lib/assistant/prepareAnalysisHandoff";

const mapping = { Date: "date", Channel: "channel", Spend: "cost", Installs: "installs" };
function dataset(variable = false) {
  const raw = Array.from({ length: 28 }, (_, i) => ({ Date: `2026-08-${String(Math.floor(i / 2) + 1).padStart(2, "0")}`, Channel: i % 2 ? "B" : "A", Spend: variable ? String(100 + i * i) : "100", Installs: "10" }));
  return { raw, headers: Object.keys(mapping), mapping, canonicalData: buildCanonicalDataset({ raw, headers: Object.keys(mapping), mapping }) };
}
describe("execution preflight shared with direct uploader", () => {
  it.each(["ko", "en"])("uses arbitrary channel spend columns through recommendation and execution (%s)", locale => {
    const raw = Array.from({ length: 16 }, (_, i) => ({ Date: new Date(Date.UTC(2026, 0, 5 + i * 7)).toISOString().slice(0, 10), Signups: String(900 + i * 23 + i % 3 * 7), "Podcast Spend": String(500 + i * 11) }));
    const data = { raw, headers: Object.keys(raw[0]), mapping: { Date: "date", Signups: "mmm_reg", "Podcast Spend": "__ignore__" } };
    expect(computeCsvEligibility({ ...data, locale }).find(item => item.toolId === "5-18-trend").status).toBe("ready");
    expect(executionPreflight(data, "5-18-trend", locale).status).toBe("ready");
    const result = runResponseAnalysis({ toolId: "5-18-trend", csvData: data, inputSignature: "input", mappingSignature: "mapping", locale });
    expect(result.status).toBe("success");
    const ignored = { ...data, mappingBindingsV2: [{ sourceColumn: "Podcast Spend", source: "user" }] };
    expect(computeCsvEligibility({ ...ignored, locale }).find(item => item.toolId === "5-18-trend").status).toBe("blocked");
    expect(executionPreflight(ignored, "5-18-trend", locale).status).toBe("blocked");
    const handoff = prepareAnalysisHandoff({ ...ignored, currency: "USD" }, "5-18-trend");
    expect(handoff.currency).toBe("USD");
    expect(handoff.mappingBindingsV2).toContainEqual({ sourceColumn: "Podcast Spend", source: "user" });
    expect(executionPreflight(handoff, "5-18-trend", locale).status).toBe("blocked");
  });
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
