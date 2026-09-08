export const EMPTY_DESIGN = { unit: "", assignment: "", plannedWindow: "", concurrentChanges: "", independentCounts: "" };

export function assessCausalDesign(values, requiresRandomization = false) {
  const scopeDeclared = ["person", "device", "region", "time"].includes(values.unit)
    && ["randomized", "comparison", "observational"].includes(values.assignment);
  const stableContext = values.plannedWindow === "planned" && values.concurrentChanges === "none";
  // Aggregate binomial counts do not supply cluster-robust uncertainty.
  const independentRandomizedUnits = ["person", "device"].includes(values.unit)
    && values.assignment === "randomized" && values.independentCounts === "unique";
  return { ready: scopeDeclared && stableContext && (!requiresRandomization || independentRandomizedUnits) };
}

export function designEvidenceTable(values, ready) {
  return { name: "DESIGN_DECLARATIONS", title: "User-declared design; not independently verified", rows: [["condition", "declaration"], ...Object.entries(values), ["action_context_ready", ready]] };
}
