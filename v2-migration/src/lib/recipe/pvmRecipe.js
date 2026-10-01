import { prepareRecipeRows, normalizeRecipeValue as norm } from "./recipeRows";
import { AXIS_TERMS, parseFieldRef } from "@/lib/vocabulary/dataContext";

// 5-21 캠페인 성과 변동의 레시피 어댑터(docs/result-autonomy-spec.md §4). 레시피 상태 →
// 엔진 입력(keys·행·기간)과 표시(블록·보기 필터)로 옮긴다. 엔진(PVM_MATH)은 그대로다 —
// 분해 축을 필드 이름으로 받으므로(pvmMath.js r[keys.ch]) 축 교체는 keys 조립만으로 된다.

export const PVM_TOOL_ID = "5-21";

const AXIS_TERM_MAP = new Map(AXIS_TERMS);

/** 레벨 수에 맞춘 표 블록 + 고정 블록. 잠긴 블록(항등식 확인)은 숨길 수 없다. */
export function pvmBlocks(levelLabels = []) {
  const [l1 = { ko: "채널", en: "Channel" }, l2 = { ko: "캠페인", en: "Campaign" }, l3 = { ko: "소재", en: "Creative" }] = levelLabels;
  return [
    { id: "fig.mixRate", label: { ko: "핵심 그림", en: "Key figure" } },
    { id: "sec.scorecard", label: { ko: "성과 변화 요약", en: "Performance change" } },
    { id: "sec.efficiency", label: { ko: "효율이 움직인 이유", en: "Why efficiency moved" } },
    { id: "note.explainer", label: { ko: "Mix·Rate 설명", en: "Mix · Rate explainer" } },
    // 첫 분해표는 결론의 근거(Σ = 전체 변화)라 숨기지 않는다.
    { id: "tbl.level1", label: { ko: `${l1.ko}별 결과`, en: `By ${l1.en}` }, locked: true },
    { id: "tbl.level2", label: { ko: `${l2.ko}별 결과`, en: `By ${l2.en}` } },
    { id: "tbl.level3", label: { ko: `${l3.ko}별 결과`, en: `By ${l3.en}` } },
    { id: "caveat.identity", label: { ko: "항등식 확인", en: "Identity check" }, locked: true },
  ];
}

/**
 * 레시피 단계가 없을 때의 축 — 기존 5-21 동작 그대로(채널 → 캠페인 → 소재, 캠페인 없이 소재만
 * 있어도 채널→소재). 채널이 없는 CSV는 캠페인·OS·국가 중 있는 첫 축으로 시작한다.
 */
export function defaultPvmKeys(mappedFields) {
  const has = (key) => mappedFields.has(key);
  const campaign = has("campaign_id") || has("campaign_name");
  if (has("channel")) {
    return { ch: "channel", cmp: campaign ? "campaign_id" : null, cr: has("creative_id") ? "creative_id" : null };
  }
  if (campaign) return { ch: "campaign_id", cmp: null, cr: has("creative_id") ? "creative_id" : null };
  const first = ["platform", "country", "adgroup_name", "creative_id"].find(has);
  return { ch: first || "channel", cmp: null, cr: null };
}

export function keysToLevels(keys) {
  return [keys.ch, keys.cmp, keys.cr].filter(Boolean);
}

/** 레시피 축(표준 키 또는 col:헤더) → 엔진 행 필드. campaign_name은 5-21 행에서 campaign_id로 합쳐진다. */
function levelField(ref) {
  return ref === "campaign_name" ? "campaign_id" : ref;
}

export function pvmKeysFromState(state, { levelsCustom, mappedFields }) {
  if (!levelsCustom) return defaultPvmKeys(mappedFields);
  const [ch, cmp = null, cr = null] = state.data.levels.map(levelField);
  return { ch, cmp, cr };
}

/** 축 이름. 기본 축은 도구 카피(C.level*)를 쓰도록 null을 돌려 호출부가 고른다. */
export function levelLabelFor(ref, context) {
  const parsed = parseFieldRef(ref);
  if (parsed.kind === "column") return { ko: parsed.header, en: parsed.header };
  const dim = (context?.dimensions || []).find((item) => levelField(item.field) === ref || item.field === ref);
  if (dim) return dim.label;
  return AXIS_TERM_MAP.get(ref === "campaign_id" ? "campaign_name" : ref) || { ko: ref, en: ref };
}

/** 레시피가 가리키는 매핑 안 된 CSV 컬럼들(행을 다시 만들어야 하는 경우). */
export function columnRefsInState(state) {
  const refs = [...state.data.levels, ...state.data.filters.map((filter) => filter.field)];
  return [...new Set(refs.filter((ref) => parseFieldRef(ref).kind === "column"))];
}

export function preparePvmRows(rows, { keys, filters = [], caseSensitive = false }) {
  return prepareRecipeRows(rows, {
    levels: keysToLevels(keys),
    filters: filters.map((filter) => ({ ...filter, field: levelField(filter.field) })),
    caseSensitive,
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * "지난달과 비교": 최신 날짜가 속한 달의 1일~최신 날짜 vs 지난달 1일~같은 일(지난달 말일에서 자름).
 * 일수를 맞춰야 달 중간 데이터가 한 달 전체와 비교되지 않는다.
 */
export function monthOverMonthRanges(maxIsoDate) {
  if (!ISO_DATE.test(String(maxIsoDate ?? ""))) return null;
  const end = new Date(`${maxIsoDate}T00:00:00Z`);
  const day = end.getUTCDate();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const prevStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  const prevLastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0)).getUTCDate();
  const prevEnd = new Date(Date.UTC(prevStart.getUTCFullYear(), prevStart.getUTCMonth(), Math.min(day, prevLastDay)));
  return { periodA: { start: ymd(prevStart), end: ymd(prevEnd) }, periodB: { start: ymd(start), end: ymd(end) } };
}

const LEVEL_KEY_FIELD = ["chKey", "cmpKey", "crKey"];

/**
 * 보기 필터·악화/개선·상위 N을 표 한 개(levelIndex 0~2)에 적용한다. 보기 필터는 그 표의 축이거나
 * 상위 축일 때만 적용되고, 적용할 수 없는 필터는 unapplied로 돌려 화면이 말하게 한다.
 * 합계(Σ) 검증은 호출부가 거르기 전 행으로 계산해야 한다 — 가린 행 때문에 항등식이 깨져 보이면 안 된다.
 */
export function applyPvmView(rows, { view, filters = [], keys, levelIndex, caseSensitive = false }) {
  const levelFields = keysToLevels(keys);
  const viewFilters = filters.filter((filter) => filter.scope === "view");
  const unapplied = [];
  let out = rows;
  for (const filter of viewFilters) {
    const at = levelFields.indexOf(levelField(filter.field));
    if (at < 0 || at > levelIndex) {
      unapplied.push(filter);
      continue;
    }
    const wanted = new Set(filter.values.map((value) => norm(value, caseSensitive)));
    const keyField = LEVEL_KEY_FIELD[at];
    out = out.filter((row) => wanted.has(norm(row[keyField], caseSensitive)) === (filter.op === "in"));
  }
  if (view.only === "worse") out = out.filter((row) => row.contribution > 0);
  if (view.only === "better") out = out.filter((row) => row.contribution < 0);
  const beforeTop = out.length;
  if (Number.isInteger(view.topN)) out = out.slice(0, view.topN);
  return { rows: out, hiddenCount: rows.length - out.length, truncated: beforeTop - out.length, unapplied };
}

/** 어느 표에도 걸 수 없는 보기 필터(분해 축이 아닌 컬럼). 화면이 "적용 안 됨"을 말하게 한다. */
export function unappliedViewFilters(filters, keys) {
  const levels = keysToLevels(keys);
  return filters.filter((filter) => filter.scope === "view" && !levels.includes(levelField(filter.field)));
}

export { caveatExclusionNote, exportLimitations } from "@/lib/analysis-export/exportOptions";

/** 예전 저장 입력(지표·기준 주·비교 주)을 레시피 단계로 옮긴다. 기본값이면 단계를 만들지 않는다. */
export function legacyPvmSteps({ metricOverride = null, weekBasis = "calendar", lookback = 1 } = {}) {
  const steps = [];
  if (metricOverride === "cpa" || metricOverride === "cpi") steps.push({ id: `metric.pvm.${metricOverride}`, params: {} });
  if (weekBasis === "rolling7") steps.push({ id: "period.basis.rolling7", params: {} });
  if ([2, 3].includes(lookback)) steps.push({ id: `period.lookback.${lookback}`, params: {} });
  return steps;
}
