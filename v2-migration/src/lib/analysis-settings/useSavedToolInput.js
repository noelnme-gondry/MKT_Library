"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import { cleanToolInputs, inputScope, sameInputShape } from "./toolInputs";

// Local React state retains each tool's original update behavior. Only options
// are mirrored after commit, so render-time resets never update another component.
export function useSavedToolInput(toolId, key, initial) {
  const [value, setValue] = useState(() => {
    const state = useAppStore.getState();
    const isApplied = state.savedSetupAppliedTool === toolId && state.savedSetupAppliedProject === state.activeProjectId;
    const saved = isApplied ? cleanToolInputs(toolId, state.savedSetupAppliedInputs) : {};
    const fallback = typeof initial === "function" ? initial() : initial;
    return Object.hasOwn(saved, key) && sameInputShape(saved[key], fallback) ? saved[key] : fallback;
  });
  const revision = useAppStore(state => state.savedSetupApplied || 0);
  const [seenRevision, setSeenRevision] = useState(revision);
  if (seenRevision !== revision) {
    setSeenRevision(revision);
    const state = useAppStore.getState();
    const saved = state.savedSetupAppliedTool === toolId ? cleanToolInputs(toolId, state.savedSetupAppliedInputs) : {};
    if (Object.hasOwn(saved, key) && sameInputShape(saved[key], typeof initial === "function" ? initial() : initial)) setValue(saved[key]);
  }
  useEffect(() => {
    const state = useAppStore.getState();
    const scope = inputScope(toolId);
    const patch = cleanToolInputs(toolId, { [key]: value });
    if (Object.hasOwn(patch, key) && JSON.stringify(state.viewConfig[scope]?.[key]) !== JSON.stringify(value)) state.setViewConfig(scope, patch);
  }, [toolId, key, value]);
  return [value, setValue];
}
