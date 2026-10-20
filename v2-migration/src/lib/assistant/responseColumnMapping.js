import { autoGuessColMap } from "@/lib/data-import/mmmColumnMapping";

export function headersFor(csvData) {
  if (Array.isArray(csvData?.headers) && csvData.headers.length) return csvData.headers;
  return Object.keys(csvData?.raw?.[0] || {});
}

function mappedMmmRole(canonicalKey) {
  if (["week"].includes(canonicalKey)) return "week";
  if (["date", "iso_week_start"].includes(canonicalKey)) return "date";
  if (["mmm_reg", "org_reg", "paid_reg_w", "installs", "actions"].includes(canonicalKey)) return "reg";
  if (canonicalKey === "mmm_react") return "react";
  if (["revenue", "revenue_d0", "revenue_d7", "revenue_d14", "revenue_d30", "revenue_d90", "revenue_d180", "revenue_d360"].includes(canonicalKey)) return "revenue";
  if (["cost", "spend", "media_spend", "ch_google_roi", "ch_google_cbua", "ch_meta", "ch_tiktok", "ch_brand"].includes(canonicalKey)) return "channel";
  if (["platform", "mmm_platform"].includes(canonicalKey)) return "platform";
  return null;
}

// response 도구의 기존 매퍼를 재사용하되, StartGate의 표준 매핑이 이미 있다면
// 시간·성과·지출 역할을 우선한다. 이 함수는 사용자의 매핑을 저장하거나 바꾸지 않는다.
export function buildResponseAdapterColMap(csvData = {}) {
  const headers = headersFor(csvData);
  const colMap = autoGuessColMap(headers, csvData.raw || [], true);
  for (const header of headers) {
    const explicitlyIgnored = csvData.mapping?.[header] === "__ignore__"
      && csvData.mappingBindingsV2?.some(binding => binding.sourceColumn === header && binding.source === "user");
    if (explicitlyIgnored) { colMap[header] = { role: "ignore" }; continue; }
    const role = mappedMmmRole(csvData.mapping?.[header]);
    if (!role) continue;
    const previous = colMap[header] || {};
    colMap[header] = {
      ...previous,
      role,
      kind: previous.kind || (/brand|브랜드/i.test(header) ? "brand" : "perf"),
      plat: previous.plat || "common",
    };
  }
  return colMap;
}

