"use client";
import { useMemo } from "react";
import { useSavedToolInput } from "@/lib/analysis-settings/useSavedToolInput";
import { useAppStore } from "@/store/useDataStore";
import { addStep, foldSteps, partitionForSync } from "./recipe";
import { ALLOCATION_OPTIONS, ALLOCATION_SPEC, allocationOptionStep, allocationOptionValue, legacyAllocationSteps } from "./allocationRecipe";
import { recipeVocabularyFor } from "./toolVocabulary";
const vocabulary = recipeVocabularyFor("5-3");
const EMPTY = [];
function initialSteps() {
  const state = useAppStore.getState();
  return state.savedSetupAppliedTool === "5-3" && state.savedSetupAppliedProject === state.activeProjectId ? legacyAllocationSteps(state.savedSetupAppliedInputs) : [];
}
export function useAllocationRecipe(csvData) {
  const [saved, setSteps] = useSavedToolInput("5-3", "recipeSteps", initialSteps, { migrate: legacyAllocationSteps });
  const steps = Array.isArray(saved) ? saved : EMPTY;
  const context = useMemo(() => ({ mappedFields: new Set(Object.values(csvData?.mapping || {})) }), [csvData?.mapping]);
  const spec = useMemo(() => ({ ...ALLOCATION_SPEC, metrics: [["install", "installs"], ["action", "actions"], ["roas", "revenue_d7"]].filter(([, field]) => context.mappedFields.has(field)).map(([key]) => key) }), [context]);
  const fold = useMemo(() => foldSteps(steps, vocabulary, spec, context), [steps, spec, context]);
  const values = Object.fromEntries(Object.keys(ALLOCATION_OPTIONS).map(key => [key, allocationOptionValue(fold.state, key)]));
  // Preserve each structured input independently. Budget/view changes must not
  // invalidate observed rows or refit unchanged per-channel models.
  const controls = {
    ...values,
    analysisRange: useStableControl(values.analysisRange, "analysisRange"),
    groupModels: useStableControl(values.groupModels, "groupModels"),
    selectedCountries: useStableControl(values.selectedCountries, "selectedCountries"),
    selectedChannelsFilter: useStableControl(values.selectedChannelsFilter, "selectedChannelsFilter"),
    chartChannels: useStableControl(values.chartChannels, "chartChannels"),
    lowerChartCountries: useStableControl(values.lowerChartCountries, "lowerChartCountries"),
  };
  const setters = useMemo(() => Object.fromEntries(Object.keys(ALLOCATION_OPTIONS).map(key => [key, next => setSteps(previous => {
      const option = ALLOCATION_OPTIONS[key];
      const current = foldSteps(previous, vocabulary, ALLOCATION_SPEC).state;
      const nextValue = typeof next === "function" ? next(controlValue(allocationOptionValue(current, key), option)) : next;
      return addStep(previous, allocationOptionStep(key, nextValue), vocabulary);
    })])), [setSteps]);
  const field = key => [controls[key], setters[key]];
  const applyPreset = incoming => setSteps(previous => {
    const { deviceOnly } = partitionForSync(previous, vocabulary);
    return [...deviceOnly, ...incoming].reduce((out, step) => addStep(out, step, vocabulary), []);
  });
  return { steps, setSteps, fold, field, controls, setters, applyPreset, vocabulary, spec };
}
// Conversion for React controls only; stored representation is always plain data.
function useStableControl(value, key) {
  const serialized = JSON.stringify(value);
  return useMemo(() => controlValue(JSON.parse(serialized), ALLOCATION_OPTIONS[key]), [serialized, key]);
}
function controlValue(value, option) { return option.list && value != null ? new Set(value) : value; }
