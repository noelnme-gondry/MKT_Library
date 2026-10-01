import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ToolRecipeWorkspace from '@/components/ds/ToolRecipeWorkspace';
import { useSavedToolInput } from '@/lib/analysis-settings/useSavedToolInput';
import { useAppStore } from '@/store/useDataStore';
import { partitionForSync } from './recipe';
import { recipeVocabularyFor } from './toolVocabulary';

const fixture = vi.hoisted(() => ({ recipes: [], canApply: true, save: vi.fn() }));
vi.mock('./useAccountRecipes', () => ({ useAccountRecipes: () => ({ status: 'ready', ...fixture }) }));
function SurvivalInputs() {
  const [draft, setDraft] = useSavedToolInput('5-28', 'draft', { timeUnit: 'month', inputMode: 'periods', horizon: '', eventDefinition: 'private action', observationEndDate: '2026-10-01', segmentKey: '', arpu: '12345', margin: '', discountRate: '' });
  return <>
    <select aria-label="Unit" value={draft.timeUnit} onChange={e => setDraft(v => ({ ...v, timeUnit: e.target.value }))}><option value="month">Month</option><option value="week">Week</option><option value="day">Day</option></select>
    <input aria-label="Private" value={draft.arpu} onChange={e => setDraft(v => ({ ...v, arpu: e.target.value }))}/>
    <output data-testid="draft">{JSON.stringify(draft)}</output>
  </>;
}
function ForecastInputs() {
  const [horizon, setHorizon] = useSavedToolInput('5-18-forecast', 'fcHorizon', 13);
  const [draft] = useSavedToolInput('5-18-forecast', 'fcHorizonDraft', '13');
  const [budget] = useSavedToolInput('5-18-forecast', 'fcBudget', { privateChannel: 20000 });
  return <><input aria-label="Horizon" value={horizon} onChange={e => setHorizon(Number(e.target.value))}/><output aria-label="Draft horizon">{draft}</output><span>{budget.privateChannel}</span></>;
}
const preset = (name, steps) => ({ name, steps });
async function apply(name, en = false) {
  const input = screen.getByRole('combobox', { name: en ? 'Analysis and view settings' : '분석·보기 설정' });
  fireEvent.focus(input); fireEvent.change(input, { target: { value: name } });
  await waitFor(() => expect(screen.getByRole('option', { name: new RegExp(name) })).toBeTruthy());
  fireEvent.keyDown(input, { key: 'Enter' });
}
beforeEach(() => {
  fixture.recipes = []; fixture.canApply = true; fixture.save.mockReset(); fixture.save.mockResolvedValue({ ok: true });
  useAppStore.setState({ ...useAppStore.getInitialState(), csvData: { raw: [], headers: ['date'], mapping: {} } }, true);
});
it('saves unchanged analysis defaults, private omissions and visible view choices from the same controls', async () => {
  render(<ToolRecipeWorkspace toolId="5-28"><SurvivalInputs/></ToolRecipeWorkspace>);
  fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'week' } });
  fireEvent.click(screen.getByRole('button', { name: '이 설정 저장' }));
  fireEvent.change(screen.getByLabelText('설정 이름'), { target: { value: 'Weekly review' } });
  fireEvent.click(screen.getByRole('button', { name: '저장', exact: true }));
  await waitFor(() => expect(fixture.save).toHaveBeenCalledOnce());
  const steps = fixture.save.mock.calls[0][1];
  expect(steps).toContainEqual({ id: 'input.draft.timeUnit', params: { value: 'week' } });
  expect(steps).toContainEqual({ id: 'input.draft.inputMode', params: { value: 'periods' } });
  const portable = partitionForSync(steps, recipeVocabularyFor('5-28')).syncable;
  expect(JSON.stringify(portable)).not.toMatch(/12345|2026-10-01|private action/);
  expect(useAppStore.getState().viewConfig['analysis-inputs:5-28'].draft.arpu).toBe('12345');
});
it.each(['ko', 'en'])('loads, edits and reapplies the same recipe without overwriting private fields (%s)', async locale => {
  fixture.recipes = [preset('Weekly', [{ id: 'input.draft.timeUnit', params: { value: 'week' } }])];
  render(<ToolRecipeWorkspace toolId="5-28" locale={locale}><SurvivalInputs/></ToolRecipeWorkspace>);
  await apply('Weekly', locale === 'en'); expect(screen.getByLabelText('Unit').value).toBe('week');
  fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'day' } });
  fireEvent.change(screen.getByLabelText('Private'), { target: { value: '9876' } });
  await apply('Weekly', locale === 'en');
  expect(screen.getByLabelText('Unit').value).toBe('week'); expect(screen.getByLabelText('Private').value).toBe('9876');
  expect(screen.getByTestId('draft').textContent).toContain('private action');
});
it('applies forecast draft and execution controls together and retains local budgets', async () => {
  fixture.recipes = [preset('Quarter', [{ id: 'input.fcHorizon', params: { value: 26 } }])];
  render(<ToolRecipeWorkspace toolId="5-18-forecast"><ForecastInputs/></ToolRecipeWorkspace>);
  await apply('Quarter');
  expect(screen.getByLabelText('Horizon').value).toBe('26'); expect(screen.getByLabelText('Draft horizon').textContent).toBe('26');
  expect(screen.getByText('20000')).toBeTruthy();
});
it('rejects invalid recipes atomically and refuses application after Pro expiry', async () => {
  fixture.recipes = [preset('Invalid', [{ id: 'input.draft.timeUnit', params: { value: 'week' } }, { id: 'input.fcHorizon', params: { value: 999 } }])];
  const view = render(<ToolRecipeWorkspace toolId="5-28"><SurvivalInputs/></ToolRecipeWorkspace>);
  await apply('Invalid'); expect(screen.getByLabelText('Unit').value).toBe('month'); expect(screen.getByRole('alert')).toBeTruthy();
  fixture.canApply = false; fixture.recipes = [preset('Valid', [{ id: 'input.draft.timeUnit', params: { value: 'week' } }])];
  view.rerender(<ToolRecipeWorkspace toolId="5-28"><SurvivalInputs/></ToolRecipeWorkspace>);
  await apply('Valid'); expect(screen.getByLabelText('Unit').value).toBe('month');
});
it('restores current device project inputs after an account recipe was edited locally', async () => {
  fixture.recipes = [preset('Weekly', [{ id: 'input.draft.timeUnit', params: { value: 'week' } }])];
  const view = render(<ToolRecipeWorkspace toolId="5-28"><SurvivalInputs/></ToolRecipeWorkspace>);
  await apply('Weekly'); fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'day' } });
  const saved = useAppStore.getState().viewConfig['analysis-inputs:5-28'];
  view.unmount();
  act(() => useAppStore.setState({ savedSetupApplied: 1, savedSetupAppliedTool: '5-28', savedSetupAppliedProject: 'local', activeProjectId: 'local', savedSetupAppliedInputs: saved }));
  render(<ToolRecipeWorkspace toolId="5-28"><SurvivalInputs/></ToolRecipeWorkspace>);
  expect(screen.getByLabelText('Unit').value).toBe('day');
});

it('changes the actual survival controls without authorizing or running analysis', async () => {
  const { default: Survival } = await import('@/components/tools/SubscriptionSurvivalAnalysis');
  fixture.recipes = [preset('Eight weeks', [{ id: 'input.draft.timeUnit', params: { value: 'week' } }, { id: 'input.draft.horizon', params: { value: '8' } }])];
  const rows = [{ tenure_periods: '10', event_observed: '1' }, { tenure_periods: '12', event_observed: '0' }];
  const { container } = render(<ToolRecipeWorkspace toolId="5-28"><Survival rows={rows} analyzed/></ToolRecipeWorkspace>);
  await apply('Eight weeks');
  expect(screen.getByLabelText('시간 단위').value).toBe('week');
  expect(screen.getByLabelText('확인할 기간').value).toBe('8');
  expect(screen.getByLabelText('이탈·종료 이벤트 정의').value).toBe('');
  expect(container.querySelector('#subscription-survival-result')).toBeNull();
});

it('keeps restored content column choices through the actual CSV reseed and leaves analysis closed', async () => {
  const { default: Content } = await import('@/components/tools/ContentElementAnalyzer');
  const raw = Array.from({ length: 30 }, (_, i) => ({ post_id: `p${i}`, featureA: i % 2, featureB: i % 3, ctr: i / 10 + 1 }));
  const csv = { raw, headers: Object.keys(raw[0]), mapping: {}, fileName: 'private-content.csv' };
  act(() => {
    useAppStore.getState().setCurrentRouteId('9-1');
    useAppStore.getState().setCsvData(csv);
    useAppStore.setState({ activeProjectId: 'content-project', savedSetupAppliedProject: 'content-project', savedSetupAppliedTool: '9-1', savedSetupApplied: 1, savedSetupAppliedInputs: { outcome: 'ctr', features: ['featureB'], clusterColumn: 'post_id', validationTimeColumn: '' } });
  });
  const { container } = render(<ToolRecipeWorkspace toolId="9-1"><Content/></ToolRecipeWorkspace>);
  await waitFor(() => expect(useAppStore.getState().viewConfig['analysis-inputs:9-1'].features).toEqual(['featureB']));
  expect(useAppStore.getState().viewConfig['analysis-inputs:9-1'].clusterColumn).toBe('post_id');
  expect(container.querySelector('#s-content-result')).toBeNull();
});

it('restores Aha segment inputs and shows a saved outcome day without re-confirming its declaration', async () => {
  const { default: Aha } = await import('@/components/tools/AhaMomentFinder');
  const raw = Array.from({ length: 30 }, (_, i) => ({ user_id: `u${i}`, messages_7d: i % 10, retained_30d: i % 2, country: i % 2 ? 'KR' : 'US' }));
  act(() => {
    useAppStore.getState().setCurrentRouteId('5-20');
    useAppStore.getState().setCsvData({ raw, headers: Object.keys(raw[0]), mapping: {}, fileName: 'private-events.csv' });
    useAppStore.setState({ activeProjectId: 'aha-project', savedSetupAppliedProject: 'aha-project', savedSetupAppliedTool: '5-20', savedSetupApplied: 1, savedSetupAppliedInputs: { segmentColumn: 'country', segmentValue: 'KR', outcomeStartDay: '14' } });
  });
  render(<ToolRecipeWorkspace toolId="5-20"><Aha/></ToolRecipeWorkspace>);
  expect(screen.getByLabelText('전환 평가를 시작하는 가입 후 일수').value).toBe('14');
  expect(screen.getByRole('button', { name: '저장한 평가 시작일을 이 데이터에 적용' })).toBeTruthy();
  expect(screen.getByText(/평가창 미선언/)).toBeTruthy();
  await waitFor(() => expect(useAppStore.getState().viewConfig['analysis-inputs:5-20'].segmentValue).toBe('KR'));
});
