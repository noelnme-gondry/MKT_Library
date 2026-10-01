"use client";
import { useContext, useEffect, useState } from "react";
import { ToolRecipeContext } from "@/lib/recipe/ToolRecipeContext";
import { applyFollowupInput } from "@/lib/recipe/followupInputs";
import { useAppStore } from "@/store/useDataStore";
import { cleanToolInputs, inputScope, sameInputShape } from "./toolInputs";

// Local React state retains each tool's original update behavior. Only options
// are mirrored after commit, so render-time resets never update another component.
export function useSavedToolInput(toolId, key, initial, { migrate } = {}) {
  const recipe = useContext(ToolRecipeContext);
  const bridge = recipe?.toolId === toolId && key !== "recipeSteps" ? recipe.inputs : null;
  const application = bridge?.application;
  const [seenApplication, setSeenApplication] = useState(application);
  const [value, setValue] = useState(() => {
    const state = useAppStore.getState();
    const isApplied = state.savedSetupAppliedTool === toolId && state.savedSetupAppliedProject === state.activeProjectId;
    const saved = isApplied ? cleanToolInputs(toolId, state.savedSetupAppliedInputs) : {};
    const fallback = typeof initial === "function" ? initial() : initial;
    const restored = Object.hasOwn(saved, key) && sameInputShape(saved[key], fallback) ? saved[key] : fallback;
    return applyFollowupInput(application?.overrides || {}, key, restored);
  });
  const revision = useAppStore(state => state.savedSetupApplied || 0);
  const [seenRevision, setSeenRevision] = useState(revision);
  if (seenRevision !== revision) {
    setSeenRevision(revision);
    const state = useAppStore.getState();
    const saved = state.savedSetupAppliedTool === toolId ? cleanToolInputs(toolId, state.savedSetupAppliedInputs) : {};
    if (Object.hasOwn(saved, key) && sameInputShape(saved[key], typeof initial === "function" ? initial() : initial)) setValue(saved[key]);
    else if (migrate && state.savedSetupAppliedTool === toolId) setValue(migrate(saved));
  }
  if (seenApplication !== application) {
    setSeenApplication(application);
    if (application) setValue(current => applyFollowupInput(application.overrides, key, current));
  }
  const register = bridge?.register;
  useEffect(() => { register?.(key, value); }, [register, key, value]);
  useEffect(() => {
    const state = useAppStore.getState();
    const scope = inputScope(toolId);
    const patch = cleanToolInputs(toolId, { [key]: value });
    if (Object.hasOwn(patch, key) && JSON.stringify(state.viewConfig[scope]?.[key]) !== JSON.stringify(value)) state.setViewConfig(scope, patch);
  }, [toolId, key, value]);
  return [value, setValue];
}
