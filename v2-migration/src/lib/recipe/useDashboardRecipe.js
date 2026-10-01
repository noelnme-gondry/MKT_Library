"use client";
import { useMemo } from 'react';
import { useAppStore } from '@/store/useDataStore';
import { useSavedToolInput } from '@/lib/analysis-settings/useSavedToolInput';
import { buildDataContext } from '@/lib/vocabulary/dataContext';
import { foldSteps } from './recipe';
import { recipeVocabularyFor } from './toolVocabulary';
import { useAccountRecipes } from './useAccountRecipes';
import { sharedRecipeFilters } from './sharedFilters';
import { DASHBOARD_SPEC, dashboardControlPatch, dashboardPresentationSteps, dashboardSnapshotSteps } from './dashboardRecipe';
const vocabulary = recipeVocabularyFor('5-2');
export function useDashboardRecipe({ csvData, dashboardFilter, setDashboardFilter, locale, enabled }) {
  const analyzed = useAppStore(state => state.isGroupAnalyzed("5-2"));
  const [saved, setSteps] = useSavedToolInput(enabled ? '5-2' : '9-7', 'recipeSteps', []);
  const steps = useMemo(() => dashboardPresentationSteps(saved), [saved]);
  const dataContext = useMemo(() => {
    const context = buildDataContext({ headers: csvData?.headers || [], rows: enabled && analyzed ? csvData?.raw || [] : [], mapping: csvData?.mapping || {}, toolId: '5-2', locale });
    return { ...context, dimensions: context.dimensions.filter(dim => ['country', 'channel', 'platform', 'source'].includes(dim.field)), toolSpec: DASHBOARD_SPEC };
  }, [csvData, locale, enabled, analyzed]);
  const fold = useMemo(() => foldSteps(steps, vocabulary, DASHBOARD_SPEC, dataContext), [steps, dataContext]);
  const account = useAccountRecipes('5-2', vocabulary);
  const shared = sharedRecipeFilters({ csvData, dashboardFilter, setDashboardFilter, locale });
  const applyPreset = incoming => {
    const accepted = foldSteps(incoming, vocabulary, DASHBOARD_SPEC, dataContext).applied;
    useAppStore.setState(dashboardControlPatch(accepted));
    // Account recipes do not contain private value filters. If imported locally,
    // route them to the existing shared owner instead of retaining inert chips.
    for (const step of accepted.filter(step => step.id.startsWith('filter.'))) shared.onSelectStep(step);
    setSteps(dashboardPresentationSteps(incoming).filter(step => !step.id.startsWith('filter.')));
  };
  return { vocabulary, steps, setSteps, fold, context: dataContext, shared, applyPreset,
    presets: { ...account, save: (name, current) => account.save(name, dashboardSnapshotSteps(useAppStore.getState(), current)) } };
}
