import { describe, expect, it } from 'vitest';
import { DASHBOARD_SPEC, dashboardControlPatch, dashboardSnapshotSteps } from './dashboardRecipe';
import { recipeVocabularyFor } from './toolVocabulary';
import { foldSteps, partitionForSync } from './recipe';
import { captureSavedAnalysis, savedAnalysisConfiguration } from '@/lib/project/savedAnalyses';
import { useAppStore } from '@/store/useDataStore';
const vocabulary = recipeVocabularyFor('5-2');
describe('dashboard recipe boundaries', () => {
  it('snapshots current shared controls and rejects unsupported states', () => {
    const steps = dashboardSnapshotSteps({ dashboardTab: 'scorecard', dashWindowDays: 14, selectedCohort: 7 }, [{ id: 'view.hide', params: { block: 'supporting' } }]);
    expect(dashboardControlPatch(steps)).toEqual({ dashboardTab: 'scorecard', dashWindowDays: 14, selectedCohort: 7 });
    expect(dashboardControlPatch([{ id: 'dashboard.dashboardTab', params: { value: 'invalid' } }])).toEqual({});
    expect(partitionForSync([...steps, { id: 'filter.only.analysis', params: { field: 'channel', values: ['private campaign'] } }], vocabulary).syncable).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'filter.only.analysis' })]));
  });
  it('locks conclusion and KPIs while allowing supporting charts to hide', () => {
    const fold = foldSteps([{ id: 'view.hide', params: { block: 'conclusion' } }], vocabulary, DASHBOARD_SPEC);
    expect(fold.rejected[0].code).toBe('LOCKED_BLOCK');
  });
  it('does not replay stale dashboard controls when applying another tool', async () => {
    const state = { ...useAppStore.getInitialState(), dashboardTab: 'cohort', dashWindowDays: 28, selectedCohort: 14,
      csvGroups: { efficiency: { headers: ['date'], mapping: { date: 'date' } } },
      viewConfig: { 'analysis-inputs:5-3': { budget: '1000' }, 'analysis-inputs:5-2': { recipeSteps: [{ id: 'dashboard.dashboardTab', params: { value: 'viz' } }] } } };
    const saved = await captureSavedAnalysis(state, '5-3', 'Allocation', 'ko');
    const applied = savedAnalysisConfiguration(saved, state);
    expect(dashboardControlPatch(applied.viewConfig['analysis-inputs:5-2'].recipeSteps)).toEqual({ dashboardTab: 'cohort', dashWindowDays: 28, selectedCohort: 14 });
  });
  it('captures live controls and restores them through the project entry path', async () => {
    const old = useAppStore.getState();
    const csv = { raw: [{ date: '2024-01-01', cost: 100 }], headers: ['date', 'cost'], mapping: { date: 'date', cost: 'cost' }, fileName: 'private.csv' };
    try {
      useAppStore.setState({ ...useAppStore.getInitialState(), currentRouteId: '5-2', activeDataGroup: 'efficiency', csvData: csv, csvGroups: { ...old.csvGroups, efficiency: csv }, dashboardTab: 'scorecard', dashWindowDays: 28, selectedCohort: 14, viewConfig: { 'analysis-inputs:5-2': { recipeSteps: [{ id: 'view.hide', params: { block: 'supporting' } }] } } });
      const saved = await captureSavedAnalysis(useAppStore.getState(), '5-2', 'Weekly check', 'ko');
      expect(JSON.stringify(saved.configuration)).not.toContain('private.csv');
      useAppStore.setState({ dashboardTab: 'viz', dashWindowDays: 7, selectedCohort: 0 });
      useAppStore.getState().applyProjectConfig(savedAnalysisConfiguration(saved, useAppStore.getState()), ['efficiency']);
      expect(useAppStore.getState()).toMatchObject({ dashboardTab: 'scorecard', dashWindowDays: 28, selectedCohort: 14 });
    } finally { useAppStore.setState(old, true); }
  });
});
