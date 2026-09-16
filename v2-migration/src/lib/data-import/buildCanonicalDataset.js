import { STANDARD_FIELDS } from "@/utils/csvConstants";
import { normalizeDateValue, normalizeNumericValue, parseDateValue } from "./normalizeValues";

// 범주/식별 차원은 수치 품질 검사 대상이 아니다. 검색어·매치 타입을 지표로 남기면
// Apple Ads export가 "유효한 핵심 지표 없음"으로 차단된다.
const DIMENSION_KEYS = new Set(["channel", "campaign_name", "campaign_id", "ad_group", "adgroup_name", "creative_name", "creative_id", "country", "platform", "store_source", "search_term", "match_type"]);
const EMPTY = (value) => value == null || String(value).trim() === "";
const SUMMARY_LABEL = /^(?:grand\s+total|sub\s*total|total|subtotal|average|avg|총계|합계|소계|평균)$/i;

function normalizeFieldValue(value, field) {
  if (EMPTY(value)) return null;
  if (field?.type === "date") return normalizeDateValue(value);
  if (field?.type === "number" || field?.type === "percent") {
    const parsed = normalizeNumericValue(value);
    if (!parsed) return null;
    return field.type === "percent" && parsed.isPercent ? parsed.value / 100 : parsed.value;
  }
  return String(value).trim();
}

export function isSummaryRow(row, { headers = Object.keys(row || {}), mapping = {} } = {}) {
  const entries = headers
    .map((header) => ({ header, value: String(row?.[header] ?? "").trim(), standardKey: mapping[header] }))
    .filter(({ value }) => value !== "");
  if (!entries.length) return false;
  if (entries.every(({ value }) => SUMMARY_LABEL.test(value))) return true;

  // 날짜가 유효한 실제 데이터행에서 캠페인명이 "Total"인 경우는 지우지 않는다.
  // 반대로 날짜 셀 자체가 합계 라벨이면 나머지 지표값이 숫자여도 명백한 summary다.
  const dateEntry = entries.find(({ standardKey }) => standardKey === "date");
  if (dateEntry && SUMMARY_LABEL.test(dateEntry.value)) return true;
  if (dateEntry && normalizeDateValue(dateEntry.value)) return false;

  const labelEntry = entries.find(({ standardKey, value }) => (
    SUMMARY_LABEL.test(value) && DIMENSION_KEYS.has(standardKey)
  ));
  if (!labelEntry) return false;
  return entries.every(({ value }) => (
    value === labelEntry.value || SUMMARY_LABEL.test(value) || Boolean(normalizeNumericValue(value))
  ));
}

export function buildCanonicalDataset({ raw = [], headers = [], mapping = {} } = {}) {
  const records = [];
  const issues = [];
  let emptyRowsRemoved = 0;
  let summaryRowsRemoved = 0;
  // 숫자만으로 M/D·D/M을 가를 수 없던 날짜 셀 수(§P3-001).
  let ambiguousDateCount = 0;

  raw.forEach((row, index) => {
    if (!row || headers.every((header) => EMPTY(row[header]))) {
      emptyRowsRemoved += 1;
      return;
    }
    if (isSummaryRow(row, { headers, mapping })) {
      summaryRowsRemoved += 1;
      return;
    }

    const dimensions = {};
    const metrics = {};
    const extras = {};
    let date = null;


    headers.forEach((header) => {
      const value = row[header];
      const standardKey = mapping[header];
      const field = standardKey && standardKey !== "__ignore__" ? STANDARD_FIELDS[standardKey] : null;
      if (!field) {
        if (!EMPTY(value)) extras[header] = value;
        return;
      }
      const normalized = normalizeFieldValue(value, field);
      if (field.type === "date" && normalized && parseDateValue(value)?.ambiguous) ambiguousDateCount += 1;
      if (standardKey === "date") {
        date = normalized;
        if (!normalized && !EMPTY(value)) issues.push({ rowNumber: index + 2, header, code: "invalid_date" });
      } else if (field.type === "date") {
        // snapshot/start/end 같은 보조 날짜는 분석 기준 날짜를 덮어쓰면 안 된다.
        // canonical dimensions에 보존해 코호트 성숙도·기간 표기에 재사용한다.
        dimensions[standardKey] = normalized;
        if (!normalized && !EMPTY(value)) issues.push({ rowNumber: index + 2, header, code: "invalid_date" });
      } else if (DIMENSION_KEYS.has(standardKey)) {
        dimensions[standardKey] = normalized;
      } else {
        metrics[standardKey] = normalized;
        if (normalized == null && !EMPTY(value)) issues.push({ rowNumber: index + 2, header, code: "invalid_number" });
      }
    });

    records.push({ date, dimensions, metrics, source: { rowNumber: index + 2 }, extras });
  });

  // 두 원본 컬럼이 같은 표준키로 매핑되면 mapRowsToStandard에서 뒤쪽이 앞쪽을
  // 조용히 덮는다 — 합계가 줄어드는데 화면은 아무 말도 안 했다(2026-09-16 감사).
  // 행을 돌 필요 없이 매핑만으로 판별되므로 여기서 한 번만 센다.
  const headersByStandardKey = new Map();
  headers.forEach((header) => {
    const standardKey = mapping[header];
    if (!standardKey || standardKey === "__ignore__") return;
    if (!headersByStandardKey.has(standardKey)) headersByStandardKey.set(standardKey, []);
    headersByStandardKey.get(standardKey).push(header);
  });
  const duplicateMappings = [...headersByStandardKey.entries()]
    .filter(([, mappedHeaders]) => mappedHeaders.length > 1)
    .map(([standardKey, mappedHeaders]) => ({ standardKey, headers: mappedHeaders }));

  return {
    records,
    summary: {
      inputRows: raw.length,
      outputRows: records.length,
      emptyRowsRemoved,
      summaryRowsRemoved,
      invalidValueCount: issues.length,
      duplicateMappings,
      ambiguousDateCount,
    },
    issues,
  };
}
