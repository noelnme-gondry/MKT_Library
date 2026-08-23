import { describe, expect, it } from "vitest";

import { ANALYSIS_CATALOG } from "./analysisCatalog";
import { efficiencyAdapterFor } from "./efficiencyAnalysisAdapters";
import { optimizationAdapterFor } from "./optimizationAnalysisAdapters";
import { responseAdapterFor } from "./responseAnalysisAdapters";
import { specialAdapterFor } from "./specialAnalysisAdapters";
import { subscriptionAdapterFor } from "./subscriptionAnalysisAdapters";

function workspaceAdapterFor(toolId) {
  return efficiencyAdapterFor(toolId)
    || optimizationAdapterFor(toolId)
    || responseAdapterFor(toolId)
    || specialAdapterFor(toolId)
    || subscriptionAdapterFor(toolId);
}

describe("Dochi workspace adapter coverage", () => {
  it("connects every analysis declared safe for automatic baseline execution", () => {
    const automatic = ANALYSIS_CATALOG.filter((entry) => entry.runMode === "baseline" && entry.executionCost === "light");
    expect(automatic.map((entry) => entry.toolId)).toHaveLength(11);
    expect(automatic.filter((entry) => !workspaceAdapterFor(entry.toolId)).map((entry) => entry.toolId)).toEqual([]);
  });
});
