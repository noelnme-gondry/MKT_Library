import { STANDARD_FIELDS } from "@/utils/csvConstants";
import { normalizeDateValue, normalizeNumericValue } from "./normalizeValues";

// 범주/식별 차원은 수치 품질 검사 대상이 아니다. 검색어·매치 타입을 지표로 남기면
// Apple Ads export가 "유효한 핵심 지표 없음"으로 차단된다.
const DIMENSION_KEYS = new Set(["channel", "campaign_name", "campaign_id", "ad_group", "adgroup_name", "creative_name", "creative_id", "country", "platform", "store_source", "search_term", "match_type"]);
const EMPTY = (value) => value == null || String(value).trim() === "";

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

function isSummaryRow(row) {
  const values = Object.values(row || {}).map((value) => String(value ?? "").trim()).filter(Boolean);
  return values.length > 0 && values.every((value) => /^(total|subtotal|합계|소계)$/i.test(value));
}

export function buildCanonicalDataset({ raw = [], headers = [], mapping = {} } = {}) {
  const records = [];
  const issues = [];
  let emptyRowsRemoved = 0;
  let summaryRowsRemoved = 0;

  raw.forEach((row, index) => {
    if (!row || headers.every((header) => EMPTY(row[header]))) {
      emptyRowsRemoved += 1;
      return;
    }
    if (isSummaryRow(row)) {
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

  return {
    records,
    summary: {
      inputRows: raw.length,
      outputRows: records.length,
      emptyRowsRemoved,
      summaryRowsRemoved,
      invalidValueCount: issues.length,
    },
    issues,
  };
}
