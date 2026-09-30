// 모든 도구가 함께 쓰는 단어(기간·보기·내보내기)와 올린 데이터에서 만드는 틀 단어
// (값 필터·차원 축·값 합치기). 도구 전용 단어(PVM의 "채널+캠페인별" 등)는 도구 어댑터가
// 이 목록 뒤에 붙인다(docs/result-autonomy-spec.md §3.3·§4.3).
import { directionParticle, objectParticle } from "./hangulMatch";

// context = buildDataContext(...) — { toolSpec, mappedFields, dimensions, fieldCandidates }

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
    // 도구가 선언한 형식만 단어로 낸다(선언이 없으면 이 도구는 형식 단어가 없다).
    expand: (context) => ((context.toolSpec?.exportFormats || []).includes(format) ? [{}] : []),
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

function findDimension(context, field) {
  return (context.dimensions || []).find((item) => item.field === field);
}

function dimensionName(context, field) {
  return findDimension(context, field)?.label || { ko: field, en: field };
}

function dimensionHint(context, field) {
  const dim = findDimension(context, field);
  if (!dim) return null;
  if (dim.isRawColumn) return { ko: "CSV 컬럼 그대로", en: "CSV column as is" };
  return dim.column && dim.column.trim().toLowerCase() !== dim.label.ko.trim().toLowerCase()
    ? { ko: `컬럼: ${dim.column}`, en: `Column: ${dim.column}` }
    : null;
}

function dimensionAliases(context, field) {
  const dim = findDimension(context, field);
  return [dim?.column, dim?.standardKey, ...(dim?.aliases || [])].filter(Boolean);
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
    // 매핑된 표준 축("채널별")과 매핑 안 된 CSV 컬럼("권역별")이 같은 단어 틀을 쓴다.
    // 표준 축은 실제 컬럼명을 힌트·별칭으로 달아 어느 컬럼인지 보이게 한다.
    id: "level.field",
    kind: "level",
    slot: "level",
    label: (params, context) => {
      const name = dimensionName(context, params.field);
      return { ko: `${name.ko}별`, en: `By ${name.en ?? name.ko}` };
    },
    hint: (params, context) => dimensionHint(context, params.field),
    aliases: (params, context) => dimensionAliases(context, params.field),
    expand: (context) => (context.dimensions || []).map((dim) => ({ field: dim.field })),
    apply: (state, params) => {
      state.data.levels = [params.field];
      return state;
    },
  },
  {
    // 축 필드가 비어 있는데 이름이 그 필드 별칭인 컬럼이 있으면("매체") 매핑과 축을 한 번에.
    // 매핑은 레시피가 아니라 기존 매핑 스토어에 쓴다 — toSelection이 둘로 나눠 돌려준다.
    id: "level.assignField",
    kind: "level",
    selectOnly: true,
    label: (params, context) => {
      const name = (context.fieldCandidates || []).find((item) => item.field === params.field)?.label || { ko: params.field, en: params.field };
      return { ko: `${name.ko}별 — '${params.column}'${objectParticle(params.column)} ${name.ko}${directionParticle(name.ko)} 지정`, en: `By ${name.en} — use '${params.column}' as ${name.en}` };
    },
    aliases: (params) => [params.column],
    expand: (context) => (context.fieldCandidates || []).flatMap((item) => item.columns.map((column) => ({ field: item.field, column }))),
    toSelection: (params) => ({
      mapping: { column: params.column, field: params.field },
      step: { id: "level.field", params: { field: params.field } },
    }),
    apply: () => {
      throw new Error("level.assignField is selection-only");
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
    // 같은 글자로 시작하는 축 단어("채널별"·"채널+캠페인별") 뒤에 보인다.
    weight: 1,
    label: (params, context) => {
      const name = dimensionName(context, params.field);
      return { ko: `${name.ko}${directionParticle(name.ko)} 먼저 나누기`, en: `Split by ${name.en ?? name.ko} first` };
    },
    aliases: (params) => [params.field],
    // 이미 맨 위 축이면 "먼저 나누기"는 아무것도 바꾸지 않으니 내지 않는다.
    expand: (context) => (context.dimensions || [])
      .filter((dim) => dim.field !== context.currentLevels?.[0])
      .map((dim) => ({ field: dim.field })),
    apply: (state, params, spec) => {
      const rest = state.data.levels.filter((level) => level !== params.field);
      state.data.levels = [params.field, ...rest].slice(0, spec?.maxLevels ?? 3);
      return state;
    },
  },
  {
    // 대소문자·공백만 다른 값은 기본으로 합친다(2026-09-30 결정). 합친 사실은 화면이 알리고
    // (dataContext dimensions[].merged), 원하면 이 단어로 되돌린다.
    id: "data.caseSensitive",
    kind: "data",
    slot: "data.case",
    label: { ko: "대소문자 구분하기", en: "Keep case differences" },
    aliases: { ko: ["대소문자"], en: ["case sensitive"] },
    apply: (state) => {
      state.data.caseSensitive = true;
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
