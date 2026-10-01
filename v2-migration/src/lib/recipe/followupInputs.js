// Portable configuration only. CSV values, money, dates and column names stay in
// the existing device/project input store. No fitted values or approvals here.
const choice = (ko, en, values) => ({ ko, en, values });
const number = (ko, en, min, max, extra = {}) => ({ ko, en, min, max, ...extra });
const bool = (ko, en) => ({ ko, en, boolean: true });
const local = (ko, en) => ({ ko, en, private: true });
const response = {
  target: choice('타깃', 'Target', ['Traffic', 'Regs', 'React', 'Purchasers', 'Revenue']),
  bayesianUsePrior: bool('정보 사전분포', 'Informative prior'),
  platformFilter: local('플랫폼·세그먼트 대상', 'Platform / segment scope'),
  mmmWeekStart: choice('주 시작', 'Week start', ['monday', 'sunday']),
};
const forecast = {
  fcHorizon: number('예측 기간', 'Forecast horizon', 1, 52, { integer: true, aliases: ['fcHorizonDraft'] }),
  fcEventPolicy: choice('미래 이벤트', 'Future events', ['hold', 'off']),
  fcBudget: local('채널 예산', 'Channel budgets'), fcStepOff: local('구조변화 종료', 'Step end dates'),
  fcTotalBudget: local('총예산', 'Total budget'), fcMinBudget: local('최소 예산', 'Minimum budget'), fcMaxBudget: local('최대 예산', 'Maximum budget'),
};
forecast.fcEventPolicy.aliases = ['fcEventPolicyDraft'];
export const FOLLOWUP_INPUTS = {
  '5-18-trend': { ...response },
  '5-18-paid-organic': {}, // Mapping is already part of the device project; no independent model options.
  '5-18-cannibal': { ...response, cannibQuestion: choice('진단 질문', 'Diagnostic question', ['precedence', 'detrend', 'net', 'lag']), cannibChannel: local('채널', 'Channel') },
  '5-18-mmm': { ...response, mmmResultModel: choice('결과 모델', 'Result model', ['bayesian', 'webr']), decompGrouped: bool('기여 묶음', 'Grouped contribution'), includeBaseDemandInShare: bool('기본 수요 포함', 'Include baseline'), weeklyPerformanceView: choice('주별 성과 보기', 'Weekly performance view', ['individual', 'grouped']), spendTimelineKind: choice('지출 추이', 'Spend timeline', ['brand', 'perf']), contributionViewStart: local('시작일', 'Start date'), contributionViewEnd: local('종료일', 'End date'), bayesianResponseChannel: local('반응곡선 채널', 'Response channel'), selectedCollinearPairKey: local('공선 채널 쌍', 'Collinear pair') },
  '5-18-forecast': { ...response, ...forecast },
  '5-4': {
    activeTab: choice('실험 화면', 'Experiment view', ['design', 'readout']),
    testType: choice('성과 유형', 'Outcome type', ['binary', 'continuous']), mode: choice('설계 방식', 'Design mode', ['plan', 'analyze', 'threshold']),
    planBaseline: local('기준 전환율', 'Baseline conversion'), planMean: local('기준 평균', 'Baseline mean'), planSigma: local('표준편차', 'Standard deviation'),
    planMde: number('최소 탐지 변화율', 'Minimum detectable change', 0.00001, 100000), planAlpha: choice('유의수준', 'Significance level', ['0.10', '0.05', '0.01']), planPower: choice('검정력', 'Power', ['0.70', '0.80', '0.90']),
    planCprA: local('A 결과당 비용', 'A cost per result'), planCprB: local('B 결과당 비용', 'B cost per result'), sequentialLooks: number('중간 확인 횟수', 'Sequential looks', 2, 6, { integer: true }), plannedShare: number('계획 배정 비율', 'Planned allocation', 0, 100, { empty: true }), equivalenceMargin: number('동등성 허용폭', 'Equivalence margin', 0, 100000, { empty: true }),
    pcBaseline: local('비교 기준 전환율', 'Comparison baseline'), pcAlpha: choice('비교 유의수준', 'Comparison significance', ['0.10', '0.05', '0.01']), pcPower: choice('비교 검정력', 'Comparison power', ['0.70', '0.80', '0.90']),
  },
  '5-23': { method: choice('분석 방법', 'Analysis method', ['suppression', 'on', 'off']), useDiD: bool('대조군 보정', 'Control adjustment'), ...Object.fromEntries(['cutoff','winStart','winEnd','metricCol','groupCol','controlGroup','treatmentGroup'].map(key => [key, local('비교 데이터 조건', 'Comparison data setting')])) },
  '5-24': { dataPath: choice('분석 경로', 'Analysis path', ['its']), dateColumn: local('날짜 열', 'Date column'), outcomeColumn: local('성과 열', 'Outcome column'), campaignColumn: local('집행 열', 'Campaign column'), costColumnChoice: local('비용 열', 'Cost column'), costCurrencyChoice: choice('비용 통화 단위', 'Cost currency unit', ['KRW', 'USD', null]) },
  '5-25': {}, // Fixed diagnostic thresholds are engine contracts, not editable recipe knobs.
  '5-26': { settings: local('예산·CPA·CPT', 'Budget / CPA / CPT') },
  '5-27': {}, // Automatic period split; source rows and event annotations are data, not a recipe.
  '5-28': { 'draft.inputMode': choice('입력 방식', 'Input mode', ['periods', 'dates']), 'draft.timeUnit': choice('시간 단위', 'Time unit', ['day', 'week', 'month']), 'draft.horizon': number('관측 기간', 'Observation horizon', 0, 100000, { empty: true }), ...Object.fromEntries(['segmentKey','observationEndDate','eventDefinition','arpu','margin','discountRate'].map(key => [`draft.${key}`, local('생존 분석 데이터 조건', 'Survival data setting')])) },
  '5-29': { draft: local('기간·분석 대상', 'Periods and scope'), design: local('비교군 설정', 'Comparison groups') },
  '5-20': { segmentColumn: local('세그먼트 열', 'Segment column'), segmentValue: local('세그먼트 값', 'Segment value'), minSupport: number('최소 표본', 'Minimum support', 1, 10000000, { integer: true }), holdoutOn: bool('홀드아웃 검증', 'Holdout validation'), outcomeStartDay: local('성과 관측 시작일 · 데이터별 재확인', 'Outcome start day · reconfirm for data'), sortBy: choice('후보 정렬', 'Candidate order', ['f1', 'lift', 'precision']), windowFilter: number('행동 관측 기간', 'Action window', 1, 100000, { nullable: true, integer: true }) },
  '9-6': { metric: choice('성과 지표', 'Performance metric', ['ctr', 'cvr', 'cpa', 'cpi', 'roas', 'ipm', 'cpm', 'cpc']), activeProblem: choice('운영 관점', 'Operating view', ['swaps', 'production', 'drivers', 'operations']), weeklyVelocity: local('주간 제작량', 'Weekly production') },
  '9-1': { outcome: local('성과 열', 'Outcome column'), features: local('요소 열', 'Feature columns'), clusterColumn: local('군집 열', 'Cluster column'), validationTimeColumn: local('시간 검증 열', 'Validation time column') },
};
export const followupInputKeys = toolId => [...new Set(Object.entries(FOLLOWUP_INPUTS[toolId] || {}).flatMap(([path, option]) => [path.split('.')[0], ...(option.aliases || [])]))];
const stepId = path => `input.${path}`;
export function validateFollowupValue(option, value) {
  if (!option || option.private) return false;
  if (option.values) return option.values.includes(value);
  if (option.boolean) return typeof value === 'boolean';
  if (value === null) return !!option.nullable;
  if (value === '') return !!option.empty;
  if (!['number', 'string'].includes(typeof value) || !/^(?:\d+\.?\d*|\.\d+)$/.test(String(value))) return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= option.min && n <= option.max && (!option.integer || Number.isInteger(n));
}
export function decodeFollowupStep(toolId, step) {
  const path = step?.id?.startsWith('input.') ? step.id.slice(6) : '';
  const option = FOLLOWUP_INPUTS[toolId]?.[path];
  const keys = Object.keys(step.params || {});
  // Recipe wire format uses empty params for an automatic/default (null) choice.
  const value = keys.length === 0 ? null : step.params.value;
  if (!option || keys.length > 1 || (keys.length === 1 && keys[0] !== 'value') || !validateFollowupValue(option, value)) throw new Error('INVALID_ANALYSIS_INPUT');
  return { path, value };
}
export function followupWords(toolId) {
  return Object.entries(FOLLOWUP_INPUTS[toolId] || {}).map(([path, option]) => ({
    id: stepId(path), kind: 'data', slot: stepId(path), carriesUserValues: !!option.private,
    label: () => ({ ko: option.ko, en: option.en }), expand: () => [],
    apply: (state, params) => {
      const decoded = decodeFollowupStep(toolId, { id: stepId(path), params });
      state.data.inputs = { ...state.data.inputs, [decoded.path]: decoded.value };
      return state;
    },
  }));
}
// Capture effective controls, including unchanged defaults. Private markers only
// count omitted fields; the account snapshot never contains their actual values.
export function snapshotFollowupInputs(toolId, values, steps) {
  const captured = [];
  for (const [path, option] of Object.entries(FOLLOWUP_INPUTS[toolId] || {})) {
    const [key, field] = path.split('.');
    if (!Object.hasOwn(values, key)) continue;
    const value = field ? values[key]?.[field] : values[key];
    if ((option.aliases || []).some(alias => Object.hasOwn(values, alias) && String(values[alias]) !== String(value))) throw new Error('UNAPPLIED_ANALYSIS_INPUT');
    if (option.private) captured.push({ id: stepId(path), params: { values: ['device-only'] } });
    else {
      if (!validateFollowupValue(option, value)) throw new Error('INVALID_ANALYSIS_INPUT');
      captured.push({ id: stepId(path), params: value == null ? {} : { value } });
    }
  }
  const ids = new Set(captured.map(step => step.id));
  const viewSteps = steps.filter(step => !ids.has(step.id));
  if (!viewSteps.some(step => step.id.startsWith('export.png.'))) viewSteps.push({ id: 'export.png.full', params: {} });
  return [...viewSteps, ...captured];
}
export function followupOverrides(toolId, steps) {
  const overrides = {};
  for (const step of steps.filter(step => step.id.startsWith('input.'))) {
    const { path, value } = decodeFollowupStep(toolId, step);
    overrides[path] = value;
    for (const alias of FOLLOWUP_INPUTS[toolId][path].aliases || []) overrides[alias] = String(value);
  }
  return overrides;
}
export function applyFollowupInput(overrides, key, current) {
  if (Object.hasOwn(overrides, key)) {
    const value = overrides[key];
    return value != null && typeof current === 'number' ? Number(value) : value != null && typeof current === 'string' ? String(value) : value;
  }
  const fields = Object.entries(overrides).filter(([path]) => path.startsWith(`${key}.`));
  return fields.length && current && typeof current === 'object' && !Array.isArray(current)
    ? { ...current, ...Object.fromEntries(fields.map(([path, value]) => [path.slice(key.length + 1), value])) }
    : current;
}
