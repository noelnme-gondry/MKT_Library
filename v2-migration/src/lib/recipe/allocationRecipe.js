// Allocation settings and presentation options; allocator math stays unchanged.
const choice = (value, values, ko, en) => ({ value, values, ko, en });
const number = (value, min, max, ko, en) => ({ value, min, max, ko, en });
export const ALLOCATION_OPTIONS = {
  analysisRange: { value: { start: "", end: "" }, private: true, ko: "분석 기간", en: "Analysis dates" },
  unitField: choice("channel", ["channel", "country", "campaign_name"], "배분 단위", "Allocation unit"),
  planningBasis: choice("budget", ["budget", "target"], "계획 기준", "Planning basis"),
  targetValue: { ...number(null, 0, Infinity, "효율 목표", "Efficiency target"), private: true },
  budgetPeriod: choice("daily", ["daily", "monthly"], "예산 단위", "Budget period"),
  budget: { value: "", private: true, ko: "예산", en: "Budget" },
  recentDays: number(7, 1, 365, "기준 일수", "Baseline days"),
  allocMode: choice("c", ["c", "b"], "배분 방식", "Allocation method"),
  holdLowConfidence: { value: true, ko: "저신뢰 대상 유지", en: "Hold low-confidence targets" },
  objective: choice(null, ["install", "action", "roas"], "성과 기준", "Objective"),
  selectedCountries: { value: null, list: true, private: true, ko: "분석 국가", en: "Analysis countries" },
  selectedChannelsFilter: { value: null, list: true, private: true, ko: "분석 채널", en: "Analysis channels" },
  platformFilter: choice("all", ["all", "android", "ios"], "OS", "OS"),
  trendType: choice("auto", ["auto", "linear", "log", "poly2", "power"], "추세 모형", "Trend model"),
  weightMode: choice("none", ["none", "linear", "exponential"], "관측 가중", "Observation weights"),
  outlierMethod: choice("iqr", ["none", "iqr", "modz"], "이상치 처리", "Outlier method"),
  outlierStrength: choice("standard", ["standard", "strong", "very_strong"], "이상치 강도", "Outlier strength"),
  normalizeMode: choice("raw", ["raw", "log", "minmax", "robust"], "차트 축", "Chart scale"),
  hidePoints: { value: false, ko: "추세선만 표시", en: "Trend lines only" },
  chartChannels: { value: null, list: true, private: true, ko: "산점도 대상", en: "Scatter targets" },
  lowerChartCountries: { value: null, list: true, private: true, ko: "하단 차트 국가", en: "Lower chart countries" },
  chartUnit: choice("country_channel", ["country_channel", "allocation"], "산점도 보기", "Scatter grouping"),
  rollupLevel: choice("detail", ["detail", "country_channel", "country", "all"], "표 묶어 보기", "Table grouping"),
  groupModels: { value: {}, private: true, ko: "대상별 모형", en: "Per-target models" },
  curveChannel: { value: null, private: true, ko: "응답곡선 대상", en: "Response target" },
};
export const ALLOCATION_BLOCKS = [
  { id: "s-result", label: { ko: "결론·현재와 변경안", en: "Conclusion and allocation" }, locked: true },
  { id: "s-table", label: { ko: "채널별 배분표", en: "Allocation table" }, locked: true },
  { id: "s-algo", label: { ko: "계산 근거", en: "Calculation evidence" }, locked: true },
  ...[["s-scatter", "효율·추세선", "Efficiency & trends"], ["s-bar", "배분 비중", "Allocation share"], ["s-scenario", "예산 시나리오", "Budget scenarios"], ["s-response", "채널 응답곡선", "Channel response"]].map(([id, ko, en]) => ({ id, label: { ko, en } })),
];
export const ALLOCATION_SPEC = { toolId: "5-3", maxLevels: 0, metrics: ["install", "action", "roas"], periodKinds: [], exportFormats: [], blocks: ALLOCATION_BLOCKS, commandExample: { ko: "예: 예산 시나리오 숨기기, PNG 제목만, 파일명에 기간", en: "e.g. Hide Budget scenarios, PNG title only, Period in filename" } };

export function allocationOptionValue(state, key) {
  return state.data.allocation?.[key] ?? ALLOCATION_OPTIONS[key].value;
}
export function allocationOptionStep(key, value) {
  const option = ALLOCATION_OPTIONS[key];
  if (!option) throw new Error("UNKNOWN_ALLOCATION_OPTION");
  if (value instanceof Set) value = [...value];
  const encoded = key === "groupModels" ? Object.entries(value).map(pair => JSON.stringify(pair)) : option.list && value != null ? value : [JSON.stringify(value)];
  const params = option.private ? { values: encoded } : value == null ? {} : { value };
  return { id: `allocation.${key}`, params };
}
export function decodeAllocationOption(key, params) {
  const option = ALLOCATION_OPTIONS[key];
  const value = !option.private ? params.value ?? option.value : key === "groupModels" ? Object.fromEntries((params.values || []).map(pair => JSON.parse(pair))) : option.list && params.values?.[0] !== "null" ? params.values : JSON.parse(params.values?.[0] ?? "null");
  if (value == null && option.value == null) return value;
  let valid;
  if (key === "analysisRange") valid = value && [value.start, value.end].every(date => date === "" || /^\d{4}-\d{2}-\d{2}$/.test(date)) && (!value.start || !value.end || value.start <= value.end);
  else if (key === "groupModels") valid = value && !Array.isArray(value) && Object.entries(value).every(([name, model]) => name && ["linear", "log", "poly2", "power", "auto"].includes(model));
  else if (option.list) valid = Array.isArray(value) && value.length <= 100 && value.every(item => typeof item === "string");
  else if (option.values) valid = option.values.includes(value);
  else if (option.min != null) valid = (key !== "recentDays" || Number.isInteger(value)) && Number.isFinite(value) && value >= option.min && value <= option.max;
  else valid = typeof value === typeof option.value || (key === "curveChannel" && typeof value === "string");
  if (!valid) throw new Error("INVALID_ALLOCATION_OPTION");
  return value;
}
export function legacyAllocationSteps(inputs = {}) {
  return Object.keys(ALLOCATION_OPTIONS).filter(key => Object.hasOwn(inputs, key)).flatMap(key => {
    try { const step = allocationOptionStep(key, inputs[key]); decodeAllocationOption(key, step.params); return [step]; } catch { return []; }
  });
}

// Named account setups retain the effective public defaults too. Private values
// remain only in the project/device recipe and are preserved when applying a preset.
export function allocationAccountSteps(state, steps) {
  return [
    ...Object.entries(ALLOCATION_OPTIONS).filter(([, option]) => !option.private).map(([key]) => allocationOptionStep(key, allocationOptionValue(state, key))),
    ...steps.filter(step => !step.id.startsWith("allocation.") || ALLOCATION_OPTIONS[step.id.slice(11)]?.private),
  ];
}
