import { describe, expect, it } from "vitest";
import { ALLOCATION_OPTIONS, ALLOCATION_SPEC, allocationOptionStep, allocationOptionValue, legacyAllocationSteps } from "./allocationRecipe";
import { foldSteps, partitionForSync, serializeRecipe } from "./recipe";
import { recipeVocabularyFor } from "./toolVocabulary";
import { accountRecipe } from "@/lib/account/recipeContract";
const vocab = recipeVocabularyFor("5-3");
const fold = steps => foldSteps(steps, vocab, ALLOCATION_SPEC);
describe("allocation recipe contract", () => {
  it("preserves original defaults and round-trips every setting", () => {
    for (const [key, option] of Object.entries(ALLOCATION_OPTIONS)) {
      const result = fold([allocationOptionStep(key, option.value)]);
      expect(result.rejected, key).toEqual([]);
      expect(allocationOptionValue(result.state, key), key).toEqual(option.value);
    }
    const models = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`KR · Channel ${i} · Android`, "linear"]));
    const steps = [allocationOptionStep("groupModels", models), allocationOptionStep("selectedCountries", new Set(["KR", "US"]))];
    expect(fold(serializeRecipe({ toolId: "5-3", steps }).steps).state.data.allocation).toEqual({ groupModels: models, selectedCountries: ["KR", "US"] });
  });
  it("keeps amounts, dates and entity names device-only; server also rejects them", () => {
    const steps = [allocationOptionStep("budget", "120,000"), allocationOptionStep("analysisRange", { start: "2026-01-01", end: "2026-01-31" }), allocationOptionStep("selectedCountries", new Set(["KR"])), allocationOptionStep("groupModels", { privateChannel: "linear" }), allocationOptionStep("recentDays", 14), { id: "export.png.title", params: {} }];
    const { syncable, deviceOnly } = partitionForSync(steps, vocab);
    expect(syncable.map(step => step.id)).toEqual(["allocation.recentDays", "export.png.title"]);
    for (const step of deviceOnly) expect(() => accountRecipe({ toolId: "5-3", name: "test", steps: [step] })).toThrow();
    expect(accountRecipe({ toolId: "5-3", name: "test", steps: syncable }).steps).toEqual(syncable);
  });
  it("locks conclusion, allocation table and calculation evidence", () => {
    for (const block of ALLOCATION_SPEC.blocks.filter(block => block.locked)) expect(fold([{ id: "view.hide", params: { block: block.id } }]).rejected[0].code).toBe("LOCKED_BLOCK");
    expect(fold([{ id: "view.hide", params: { block: "s-scenario" } }]).state.view.hidden).toEqual(["s-scenario"]);
  });
  it("migrates legacy settings without restoring approval flags or results", () => {
    const steps = legacyAllocationSteps({ budget: "50,000", recentDays: 14, verifiedSig: "yes", groupVerification: { a: "verified" }, result: 123 });
    expect(steps).toHaveLength(2);
    expect(fold(steps).state.data.allocation).toEqual({ budget: "50,000", recentDays: 14 });
    expect(fold([allocationOptionStep("recentDays", -1)]).rejected).toHaveLength(1);
  });
});
