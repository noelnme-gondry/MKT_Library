import { STANDARD_FIELDS } from "@/utils/csvConstants";
import { parseNumericStrict } from "@/utils/parseNumeric";
import { normalizeText } from "./hangulMatch";

// 올린 CSV → 단어 사전 context(docs/result-autonomy-spec.md §3.4). 원본 행을 읽는 것은
// 이 함수 하나이고, 돌려주는 것은 컬럼 이름·값 목록뿐이다(레시피·동기화에는 값이 안 들어간다
// — 값 단계는 partitionForSync가 기기 전용으로 가른다).
//
// "채널별"이 우리 표준 필드(channel)인지 CSV의 '채널' 컬럼인지는 매핑이 정한다:
//  · 컬럼이 표준 필드로 매핑돼 있으면 단어는 하나("채널별", 힌트에 실제 컬럼명)
//  · 매핑 안 된 컬럼은 그 이름 그대로 단어가 된다. 표준 단어와 이름이 겹치면 "(CSV 컬럼)"을 붙인다
//  · 표준 필드가 비어 있고 이름이 그 필드 별칭과 같은 컬럼이 있으면 "채널별 — '매체'를 채널로"
//    후보를 내고, 고르면 매핑과 단계를 한 번에 적용한다(vocabulary.toSelection).
// 매핑 자체는 레시피에 저장하지 않는다 — 매핑 SSOT는 기존 스토어·매핑 기억이다(AGENTS §7 메타 4).

// 축으로 쓰는 표준 필드와 화면 용어. 순서 = 드롭다운 추천 순서.
export const AXIS_TERMS = Object.freeze([
  ["channel", { ko: "채널", en: "Channel" }],
  ["campaign_name", { ko: "캠페인", en: "Campaign" }],
  ["campaign_id", { ko: "캠페인 ID", en: "Campaign ID" }],
  ["adgroup_name", { ko: "광고그룹", en: "Ad group" }],
  ["creative_id", { ko: "소재", en: "Creative" }],
  ["platform", { ko: "OS", en: "OS" }],
  ["country", { ko: "국가", en: "Country" }],
  ["source", { ko: "광고/오가닉", en: "Paid/organic" }],
]);
const AXIS_TERM_MAP = new Map(AXIS_TERMS);
const MAX_VALUES_PER_DIMENSION = 200;

// 헤더가 "구분"·"type"처럼 무의미해도 값으로 OS·국가를 알아본다(spec §3.4 (2)).
// 전역 자동 매핑의 valueVocabulary는 "값으로만" 판별하는 배타 모드라 헤더 매핑을 막는다 —
// 그래서 전역 스코어러는 그대로 두고, 여기서는 "이 컬럼을 OS로 지정할까요" 제안만 만든다.
const VALUE_VOCABULARY = {
  platform: ["ios", "android", "aos", "iphone", "ipad", "ipados", "안드로이드", "아이폰", "아이오에스"],
  country: [
    "kr", "us", "jp", "cn", "tw", "hk", "sg", "th", "vn", "id", "my", "ph", "in", "gb", "uk", "de", "fr", "es", "it", "ca", "au", "br", "mx", "ru", "tr", "sa", "ae",
    "korea", "south korea", "republic of korea", "united states", "usa", "japan", "china", "taiwan", "hong kong", "singapore", "thailand", "vietnam",
    "indonesia", "malaysia", "philippines", "india", "united kingdom", "germany", "france", "canada", "australia", "brazil",
    "한국", "대한민국", "미국", "일본", "중국", "대만", "홍콩", "싱가포르", "태국", "베트남", "인도네시아", "말레이시아", "필리핀", "인도", "영국", "독일", "프랑스", "캐나다", "호주", "브라질",
  ],
};
const VALUE_MATCH_SHARE = 0.8;
const COLUMN_REF_PREFIX = "col:";

/** 레시피가 가리키는 축: 표준 키(`channel`) 또는 매핑 안 된 CSV 컬럼(`col:권역`). */
export function columnRef(header) {
  return `${COLUMN_REF_PREFIX}${header}`;
}

export function parseFieldRef(ref) {
  const text = String(ref ?? "");
  return text.startsWith(COLUMN_REF_PREFIX)
    ? { kind: "column", header: text.slice(COLUMN_REF_PREFIX.length) }
    : { kind: "standard", key: text };
}

/**
 * 대소문자·앞뒤 공백만 다른 값은 같은 값으로 합친다(2026-09-30 사용자 결정). 대표 표기는
 * 가장 많이 나온 표기, 동률이면 먼저 나온 표기(결정론). 합친 묶음은 화면이 알릴 수 있게 돌려준다.
 */
export function buildValueCanonicalizer(values) {
  const groups = new Map();
  let order = 0;
  for (const raw of values) {
    const value = String(raw ?? "");
    const key = value.trim().toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { key, first: order, counts: new Map(), seen: [] });
    const group = groups.get(key);
    if (!group.counts.has(value)) group.seen.push(value);
    group.counts.set(value, (group.counts.get(value) || 0) + 1);
    order += 1;
  }
  const toCanonical = new Map();
  const canonical = [];
  const merged = [];
  for (const group of [...groups.values()].sort((a, b) => a.first - b.first)) {
    const best = group.seen.reduce((top, value) => (group.counts.get(value) > group.counts.get(top) ? value : top), group.seen[0]);
    const total = [...group.counts.values()].reduce((sum, count) => sum + count, 0);
    canonical.push({ value: best, count: total });
    for (const value of group.seen) toCanonical.set(value, best);
    if (group.seen.length > 1) merged.push({ to: best, from: [...group.seen] });
  }
  return {
    canonicalOf: (raw) => toCanonical.get(String(raw ?? "")) ?? String(raw ?? "").trim(),
    values: canonical,
    merged,
  };
}

function isTextColumn(values) {
  const present = values.filter((value) => String(value ?? "").trim() !== "");
  if (!present.length) return false;
  const numeric = present.filter((value) => parseNumericStrict(value) != null).length;
  const dateLike = present.filter((value) => /^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(String(value).trim())).length;
  return numeric / present.length < 0.8 && dateLike / present.length < 0.8;
}

function isAxisSized(distinctCount, rowCount) {
  return distinctCount >= 2 && distinctCount <= MAX_VALUES_PER_DIMENSION && distinctCount / rowCount <= 0.5;
}

function termFor(key) {
  if (AXIS_TERM_MAP.has(key)) return AXIS_TERM_MAP.get(key);
  const field = STANDARD_FIELDS[key];
  return { ko: field?.label || key, en: field?.labelEn || field?.label || key };
}

function topValues(canonicalizer) {
  return [...canonicalizer.values]
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, MAX_VALUES_PER_DIMENSION)
    .map((item) => item.value);
}

function valuesMatch(key, values) {
  const vocabulary = VALUE_VOCABULARY[key];
  if (!vocabulary) return false;
  const distinct = [...new Set(values.map((value) => String(value ?? "").trim().toLowerCase()).filter(Boolean))];
  if (!distinct.length) return false;
  return distinct.filter((value) => vocabulary.includes(value)).length / distinct.length >= VALUE_MATCH_SHARE;
}

function aliasMatches(key, header) {
  const normalized = normalizeText(header);
  const aliases = [key, ...(STANDARD_FIELDS[key]?.aliases || [])];
  return aliases.some((alias) => normalizeText(alias) === normalized);
}

/**
 * @param {{ headers?: string[], rows: object[], mapping?: Record<string,string>, toolId?: string, toolSpec?: object, locale?: string }} input
 */
export function buildDataContext({ headers, rows = [], mapping = {}, toolId = null, toolSpec = null, locale = "ko" } = {}) {
  const headerList = headers?.length ? headers : Object.keys(rows[0] || {});
  const mappedTo = (header) => {
    const key = mapping[header];
    return key && key !== "__ignore__" ? key : null;
  };
  const mappedFields = new Set(headerList.map(mappedTo).filter(Boolean));
  const rowCount = rows.length;
  const columnValues = (header) => rows.map((row) => row?.[header]);

  const standardDims = [];
  const columnDims = [];
  for (const header of headerList) {
    const key = mappedTo(header);
    const values = columnValues(header);
    if (key && !AXIS_TERM_MAP.has(key)) continue;
    if (!key && !isTextColumn(values)) continue;
    const canonicalizer = buildValueCanonicalizer(values);
    const distinct = canonicalizer.values.length;
    // 매핑된 축은 값이 1개여도(채널 하나짜리 데이터) 축이다. 매핑 안 된 컬럼은 ID·자유
    // 텍스트를 걸러야 하므로 크기 조건을 건다.
    if (key ? distinct < 1 : !isAxisSized(distinct, rowCount)) continue;
    const dim = {
      field: key || columnRef(header),
      column: header,
      standardKey: key,
      values: topValues(canonicalizer),
      merged: canonicalizer.merged,
      label: key ? termFor(key) : { ko: header, en: header },
    };
    (key ? standardDims : columnDims).push(dim);
  }
  standardDims.sort((a, b) => AXIS_TERMS.findIndex(([k]) => k === a.standardKey) - AXIS_TERMS.findIndex(([k]) => k === b.standardKey));
  const standardLabels = new Set(standardDims.map((dim) => normalizeText(dim.label.ko)));
  for (const dim of columnDims) {
    dim.isRawColumn = true;
    // 매핑 안 된 '채널' 컬럼과 표준 "채널"이 둘 다 있으면 이름으로 구분한다.
    if (standardLabels.has(normalizeText(dim.column))) {
      dim.label = { ko: `${dim.column} (CSV 컬럼)`, en: `${dim.column} (CSV column)` };
    }
  }

  // 비어 있는 축 필드 ← 이름이 그 필드 별칭과 같거나, 값이 그 필드 어휘인 매핑 안 된 컬럼.
  const fieldCandidates = AXIS_TERMS
    .filter(([key]) => !mappedFields.has(key))
    .map(([key, term]) => ({
      field: key,
      label: term,
      columns: headerList.filter((header) => !mappedTo(header)
        && (aliasMatches(key, header) || valuesMatch(key, columnValues(header)))),
    }))
    .filter((item) => item.columns.length);

  return {
    toolId,
    toolSpec,
    locale,
    mappedFields,
    dimensions: [...standardDims, ...columnDims],
    fieldCandidates,
  };
}
