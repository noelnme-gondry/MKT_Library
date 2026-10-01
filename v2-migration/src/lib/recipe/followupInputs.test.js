import { describe, expect, it } from 'vitest';
import { FOLLOWUP_TOOL_SPECS } from './followupSpecs';
import { FOLLOWUP_INPUTS, snapshotFollowupInputs, followupOverrides, applyFollowupInput, validateFollowupValue } from './followupInputs';
import { recipeVocabularyFor } from './toolVocabulary';
import { foldSteps, partitionForSync } from './recipe';
import { cleanToolInputs, TOOL_INPUT_KEYS } from '@/lib/analysis-settings/toolInputs';
import { accountRecipe } from '@/lib/account/recipeContract';

const sample = option => option.private ? 'private-client-column-123' : option.values ? option.values[0] : option.boolean ? true : option.min + 1;
describe('follow-up analysis recipe contract', () => {
  it('covers every published follow-up wrapper, including tools with no independent model options', () => {
    expect(Object.keys(FOLLOWUP_INPUTS).sort()).toEqual(Object.keys(FOLLOWUP_TOOL_SPECS).sort());
  });
  it.each(Object.keys(FOLLOWUP_TOOL_SPECS))('%s captures all portable defaults and keeps data local', toolId => {
    const values = {};
    for (const [path, option] of Object.entries(FOLLOWUP_INPUTS[toolId])) {
      const [key, field] = path.split('.');
      expect(TOOL_INPUT_KEYS[toolId]).toContain(key);
      if (field) values[key] = { ...values[key], [field]: sample(option) };
      else values[key] = sample(option);
    }
    const steps = snapshotFollowupInputs(toolId, values, []);
    const { syncable, deviceOnly } = partitionForSync(steps, recipeVocabularyFor(toolId));
    const portable = accountRecipe({ toolId, name: 'Reusable analysis', steps: syncable });
    expect(JSON.stringify(portable)).not.toContain('private-client');
    expect(deviceOnly).toHaveLength(Object.values(FOLLOWUP_INPUTS[toolId]).filter(option => option.private).length);
    expect(foldSteps(syncable, recipeVocabularyFor(toolId), FOLLOWUP_TOOL_SPECS[toolId]).rejected).toEqual([]);
    const overrides = followupOverrides(toolId, syncable);
    for (const [path, option] of Object.entries(FOLLOWUP_INPUTS[toolId])) {
      if (option.private) expect(overrides).not.toHaveProperty(path);
      else expect(overrides[path]).toEqual(sample(option));
    }
    expect(cleanToolInputs(toolId, { ...values, confirmedDesign: true, analysisSignature: 'approved', result: { rows: [] } })).toEqual(values);
  });
  it('rejects unknown fields, wrong-tool settings, private values disguised as portable and malformed numbers on the server', () => {
    for (const step of [
      { id: 'input.fcHorizon', params: { value: 'secret-client' } },
      { id: 'input.fcHorizon', params: { value: 53 } },
      { id: 'input.fcHorizon', params: { value: 1.5 } },
      { id: 'input.fcHorizon', params: { value: 13, extra: 'secret' } },
      { id: 'input.fcBudget', params: { value: 123456 } },
      { id: 'input.confirmedDesign', params: { value: true } },
      { id: 'input.planAlpha', params: { value: '0.05' } },
    ]) expect(() => accountRecipe({ toolId: '5-18-forecast', name: 'bad', steps: [step] })).toThrow('INVALID_RECIPE');
  });
  it('merges survival public fields without losing private dates, definitions or economics', () => {
    const current = { inputMode: 'periods', timeUnit: 'month', horizon: '', eventDefinition: 'client definition', observationEndDate: '2026-10-01', arpu: '30000' };
    const overrides = followupOverrides('5-28', [{ id: 'input.draft.timeUnit', params: { value: 'week' } }, { id: 'input.draft.horizon', params: { value: '8' } }]);
    expect(applyFollowupInput(overrides, 'draft', current)).toEqual({ ...current, timeUnit: 'week', horizon: '8' });
    expect(current.timeUnit).toBe('month');
  });
  it('restores forecast applied/draft options together, preserving numeric input types', () => {
    const overrides = followupOverrides('5-18-forecast', [{ id: 'input.fcHorizon', params: { value: 26 } }, { id: 'input.fcEventPolicy', params: { value: 'off' } }]);
    expect(overrides).toEqual({ fcHorizon: 26, fcHorizonDraft: '26', fcEventPolicy: 'off', fcEventPolicyDraft: 'off' });
    expect(applyFollowupInput({ fcHorizon: '26' }, 'fcHorizon', 13)).toBe(26);
  });
  it('does not turn partially typed or nonfinite options into a saved valid analysis', () => {
    for (const value of ['', NaN, Infinity, '1,000', '   ', '1e4', {}, true]) {
      expect(validateFollowupValue(FOLLOWUP_INPUTS['5-20'].minSupport, value)).toBe(false);
      expect(() => snapshotFollowupInputs('5-20', { minSupport: value }, [])).toThrow('INVALID_ANALYSIS_INPUT');
    }
  });
});


it('round-trips every public enum and optional/default value through the real wire contract', () => {
  for (const [toolId, options] of Object.entries(FOLLOWUP_INPUTS)) for (const [path, option] of Object.entries(options)) {
    if (option.private) continue;
    const values = option.values || (option.boolean ? [false, true] : [option.min, option.max, ...(option.nullable ? [null] : []), ...(option.empty ? [''] : [])]);
    for (const value of values) {
      const [key, field] = path.split('.');
      const inputs = field ? { [key]: { [field]: value } } : { [key]: value };
      // A partial structured input is not a valid entire snapshot; encode this
      // single schema option and verify the same wire format used by snapshots.
      const step = { id: `input.${path}`, params: value == null ? {} : { value } };
      const clean = accountRecipe({ toolId, name: 'Boundary', steps: [step] });
      expect(foldSteps(clean.steps, recipeVocabularyFor(toolId), FOLLOWUP_TOOL_SPECS[toolId]).rejected, `${toolId}:${path}:${value}`).toEqual([]);
      expect(followupOverrides(toolId, clean.steps)[path]).toEqual(value);
      if (!field) expect(snapshotFollowupInputs(toolId, inputs, [])).toContainEqual(step);
    }
  }
});


it('refuses to save an unapplied forecast draft as if it were the current result settings', () => {
  expect(() => snapshotFollowupInputs('5-18-forecast', { fcHorizon: 13, fcHorizonDraft: '26' }, [])).toThrow('UNAPPLIED_ANALYSIS_INPUT');
  expect(() => snapshotFollowupInputs('5-18-forecast', { fcEventPolicy: 'hold', fcEventPolicyDraft: 'off' }, [])).toThrow('UNAPPLIED_ANALYSIS_INPUT');
});
