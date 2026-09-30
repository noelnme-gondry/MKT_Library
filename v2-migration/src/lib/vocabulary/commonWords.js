// 모든 도구가 함께 쓰는 단어(기간·보기·내보내기)와 올린 데이터에서 만드는 틀 단어
// (값 필터·차원 축·값 합치기). 도구 전용 단어(PVM의 "채널+캠페인별" 등)는 도구 어댑터가
// 이 목록 뒤에 붙인다(docs/result-autonomy-spec.md §3.3·§4.3).
// context = { toolSpec, dimensions:[{field, label:{ko,en}, values:[]}], caseVariants:[{field, values:[]}] }

const lookbackLabel = {
  1: { ko: "직전주와 비교", en: "Compare with prior week" },
  2: { ko: "2주 전과 비교", en: "Compare with 2 weeks ago" },
  3: { ko: "3주 전과 비교", en: "Compare with 3 weeks ago" },
};

function currentBasis(state) {
  return state.data.period?.kind === "lookback" ? state.data.period.basis : "calendar";
}

function currentWeeks(state) {
  return state.data.period?.kind === "lookback" ? state.data.period.weeks : 1;
}

const periodWords = [1, 2, 3].map((weeks) => ({
  id: `period.lookback.${weeks}`,
  kind: "period",
  slot: "period.compare",
  requires: ["date"],
  label: lookbackLabel[weeks],
  aliases: { ko: [`${weeks}주`, weeks === 1 ? "지난주" : `${weeks}주전`], en: [`wow`, `${weeks}w`] },
  apply: (state) => {
    state.data.period = { kind: "lookback", weeks, basis: currentBasis(state) };
    return state;
  },
}));

const basisWords = [
  { basis: "calendar", label: { ko: "마감주(월~일) 기준", en: "Calendar week (Mon–Sun)" }, aliases: { ko: ["월요일", "달력주"], en: ["calendar"] } },
  { basis: "rolling7", label: { ko: "최근 7일 기준", en: "Last 7 days" }, aliases: { ko: ["7일", "롤링"], en: ["rolling"] } },
].map(({ basis, label, aliases }) => ({
  id: `period.basis.${basis}`,
  kind: "period",
  slot: "period.basis",
  requires: ["date"],
  label,
  aliases,
  apply: (state) => {
    state.data.period = { kind: "lookback", weeks: currentWeeks(state), basis };
    return state;
  },
}));

const monthWord = {
  id: "period.monthOverMonth",
  kind: "period",
  slot: "period.compare",
  requires: ["date"],
  label: { ko: "지난달과 비교", en: "Compare with last month" },
  aliases: { ko: ["월간", "전월"], en: ["mom", "month over month"] },
  apply: (state) => {
    state.data.period = { kind: "monthOverMonth" };
    return state;
  },
};

const viewWords = [
  ...[5, 10].map((n) => ({
    id: `view.top.${n}`,
    kind: "view",
    slot: "view.topN",
    label: { ko: `상위 ${n}개만 보기`, en: `Show top ${n}` },
    aliases: { ko: [`top${n}`, `${n}개`], en: [`top ${n}`] },
    apply: (state) => {
      state.view.topN = n;
      return state;
    },
  })),
  {
    id: "view.only.worse",
    kind: "view",
    slot: "view.only",
    label: { ko: "악화만 보기", en: "Show worsened only" },
    aliases: { ko: ["나빠진"], en: ["worse"] },
    apply: (state) => {
      state.view.only = "worse";
      return state;
    },
  },
  {
    id: "view.only.better",
    kind: "view",
    slot: "view.only",
    label: { ko: "개선만 보기", en: "Show improved only" },
    aliases: { ko: ["좋아진"], en: ["better"] },
    apply: (state) => {
      state.view.only = "better";
      return state;
    },
  },
  {
    // 숨길 수 있는 블록만 후보로 낸다. 잠긴 블록(항등식·판정 보류 사유)은 단어 자체가 없다.
    id: "view.hide",
    kind: "view",
    label: (params, context) => {
      const block = (context.toolSpec?.blocks || []).find((item) => item.id === params.block);
      const name = block?.label || { ko: params.block, en: params.block };
      return { ko: `${name.ko} 숨기기`, en: `Hide ${name.en ?? name.ko}` };
    },
    expand: (context) => (context.toolSpec?.blocks || [])
      .filter((block) => !block.locked)
      .map((block) => ({ block: block.id })),
    apply: (state, params) => {
      if (!state.view.hidden.includes(params.block)) state.view.hidden.push(params.block);
      return state;
    },
  },
];

const exportFormatLabel = {
  xlsx: { ko: "엑셀로 받기(수식 포함)", en: "Download Excel (with formulas)", aliases: ["excel", "xlsx", "엑셀"] },
  csv: { ko: "CSV로 받기", en: "Download CSV", aliases: ["csv"] },
  png: { ko: "그림 PNG로 받기", en: "Download figure PNG", aliases: ["png", "이미지"] },
  docx: { ko: "워드로 받기", en: "Download Word", aliases: ["word", "docx", "문서"] },
};

const exportWords = [
  ...Object.entries(exportFormatLabel).map(([format, { ko, en, aliases }]) => ({
    id: `export.format.${format}`,
    kind: "export",
    slot: "export.format",
    label: { ko, en },
    aliases,
    apply: (state) => {
      state.export.format = format;
      return state;
    },
  })),
  {
    id: "export.caveats.exclude",
    kind: "export",
    slot: "export.caveats",
    label: { ko: "한계 문구 빼고 받기", en: "Download without caveats" },
    aliases: { ko: ["주의 제외"], en: ["no caveats"] },
    apply: (state) => {
      state.export.includeCaveats = false;
      return state;
    },
  },
];

function dimensionName(context, field) {
  const dim = (context.dimensions || []).find((item) => item.field === field);
  return dim?.label || { ko: field, en: field };
}

function valueParams(context) {
  return (context.dimensions || []).flatMap((dim) => (dim.values || []).map((value) => ({ field: dim.field, values: [String(value)] })));
}

function upsertFilter(state, { field, values }, op, scope) {
  const existing = state.data.filters.find((filter) => filter.field === field && filter.op === op && filter.scope === scope);
  if (existing) existing.values = [...new Set([...existing.values, ...values])];
  else state.data.filters.push({ field, op, scope, values: [...values] });
  return state;
}

// "분석"(행을 빼고 다시 계산 — 숫자가 바뀐다)과 "보기"(계산은 전체, 표에서만 거름)를
// 라벨에서 가른다. 섞이면 "합이 안 맞는다"는 의심을 받는다(spec §5).
const filterWords = [
  {
    id: "filter.only.analysis",
    kind: "filter",
    carriesUserValues: true,
    label: (params) => ({ ko: `${params.values?.[0]}만 분석`, en: `Analyze ${params.values?.[0]} only` }),
    aliases: (params) => params.values || [],
    expand: valueParams,
    apply: (state, params) => upsertFilter(state, params, "in", "analysis"),
  },
  {
    id: "filter.exclude.analysis",
    kind: "filter",
    carriesUserValues: true,
    label: (params) => ({ ko: `${params.values?.[0]} 제외하고 분석`, en: `Analyze without ${params.values?.[0]}` }),
    aliases: (params) => params.values || [],
    expand: valueParams,
    apply: (state, params) => upsertFilter(state, params, "notIn", "analysis"),
  },
  {
    id: "filter.only.view",
    kind: "filter",
    carriesUserValues: true,
    label: (params) => ({ ko: `${params.values?.[0]}만 보기`, en: `Show ${params.values?.[0]} only` }),
    aliases: (params) => params.values || [],
    expand: valueParams,
    apply: (state, params) => upsertFilter(state, params, "in", "view"),
  },
];

const dimensionWords = [
  {
    id: "level.dimension",
    kind: "level",
    slot: "level",
    label: (params, context) => {
      const name = dimensionName(context, params.field);
      return { ko: `${name.ko}별`, en: `By ${name.en ?? name.ko}` };
    },
    aliases: (params) => [params.field],
    expand: (context) => (context.dimensions || []).map((dim) => ({ field: dim.field })),
    apply: (state, params) => {
      state.data.levels = [params.field];
      return state;
    },
  },
  {
    // "OS로 먼저 나누기" — 지금 축 위에 차원을 얹는다(OS→채널). 축 수 상한은 도구 선언.
    id: "level.dimensionAbove",
    kind: "level",
    // 기본 축 단어("채널+캠페인별")를 교체하지 않고 그 위에 얹는다. phase 1이라 칩 순서와
    // 무관하게 기본 축 단어 뒤에 적용된다.
    slot: "level.above",
    phase: 1,
    label: (params, context) => {
      const name = dimensionName(context, params.field);
      return { ko: `${name.ko}로 먼저 나누기`, en: `Split by ${name.en ?? name.ko} first` };
    },
    aliases: (params) => [params.field],
    expand: (context) => (context.dimensions || []).map((dim) => ({ field: dim.field })),
    apply: (state, params, spec) => {
      const rest = state.data.levels.filter((level) => level !== params.field);
      state.data.levels = [params.field, ...rest].slice(0, spec?.maxLevels ?? 3);
      return state;
    },
  },
  {
    id: "data.mergeValues",
    kind: "data",
    carriesUserValues: true,
    label: (params) => ({ ko: `${(params.values || []).join("·")} 합치기`, en: `Merge ${(params.values || []).join(" · ")}` }),
    aliases: (params) => params.values || [],
    expand: (context) => (context.caseVariants || []).map((group) => ({ field: group.field, values: [...group.values] })),
    apply: (state, params) => {
      state.data.valueMerges = state.data.valueMerges.filter((merge) => !(merge.field === params.field
        && merge.from.some((value) => params.values.includes(value))));
      state.data.valueMerges.push({ field: params.field, from: [...params.values], to: params.values[0] });
      return state;
    },
  },
];

export const COMMON_WORDS = Object.freeze([
  ...dimensionWords,
  ...periodWords,
  monthWord,
  ...basisWords,
  ...filterWords,
  ...viewWords,
  ...exportWords,
]);

/**
 * 문자열 컬럼이 축 후보인가. 값 종류가 1개면 나눌 게 없고, 행 수에 가까우면 ID·자유 텍스트다
 * (spec §3.4 (3)). 상한은 표·그림이 읽힐 수 있는 수준.
 */
export function isAxisCandidate({ distinctCount, rowCount }) {
  if (!Number.isFinite(distinctCount) || !Number.isFinite(rowCount) || rowCount <= 0) return false;
  return distinctCount >= 2 && distinctCount <= 200 && distinctCount / rowCount <= 0.5;
}

/**
 * 대소문자·앞뒤 공백만 다른 값 묶음("iOS"·"ios"). 자동으로 합치지 않는다 — 합치면 분해 단위가
 * 바뀌어 숫자가 바뀌므로 제안만 하고 유저가 고르면 레시피에 남긴다(spec §3.4).
 */
export function findCaseVariants(values) {
  const groups = new Map();
  for (const raw of values) {
    const value = String(raw ?? "");
    const key = value.trim().toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    const list = groups.get(key);
    if (!list.includes(value)) list.push(value);
  }
  return [...groups.values()].filter((list) => list.length > 1);
}
