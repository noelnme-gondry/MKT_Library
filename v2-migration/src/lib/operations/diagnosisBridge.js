import { inferDiagnosisMapping, mapDiagnosisData } from "../diagnosisImport";
import { isDemoData } from "../dataOrigin";
import { sourceCurrencyOf } from "@/utils/format";
import { operationsSourceRows } from "./operationsIntervals";

// A workspace file can use custom header names. Preserve its confirmed mapping,
// then pick up optional diagnosis columns that the original planner never mapped.
export function readPlannerDiagnosis(csv, filters, metric, grain, locale) {
  const headers = csv.headers || Object.keys(csv.raw[0] || {});
  const source = Object.fromEntries(Object.entries(csv.mapping || {}).map(([header, key]) => [key, header]));
  const mapping = inferDiagnosisMapping(headers);
  for (const [key, column] of Object.entries({
    date:source.date, cost:source.cost || source.spend, channel:source.channel,
    campaign:source.campaign_name || source.campaign_id, creative:source.creative_id,
    market:source.country, platform:source.platform, clicks:source.clicks, impressions:source.impressions,
  })) if (column) mapping[key] = column;
  if (!source[metric]) throw new Error(locale === "en" ? "Map the selected outcome to a column first." : "선택한 성과에 해당하는 열을 먼저 연결해 주세요.");
  mapping.result = source[metric];
  const scopes = {countries:mapping.market, platforms:mapping.platform, channels:mapping.channel, sources:source.source};
  const raw = csv.raw.filter(row => Object.entries(scopes).every(([key, col]) => !filters?.[key]?.size || filters[key].has(String(row[col] ?? "").trim())));
  const records = raw.map(row => headers.map(header => String(row[header] ?? "")));
  if (!["day","week"].includes(grain)) throw new Error(locale === "en" ? "This comparison requires daily or weekly observations." : "주간 효율 비교에는 일별 또는 주별 원자료가 필요합니다.");
  const decoded = mapDiagnosisData({headers, records},mapping,{grain:grain==="week"?"weekly":"daily",currency:csv.currency || "",locale,source:isDemoData(csv)?"example":"upload"});
  decoded.meta.resultLabel = metric === "installs" ? (locale==="en"?"Installs":"설치") : (locale==="en"?"Sign-ups":"가입");
  return decoded;
}

export function campaignExecutionInput(rows, meta) {
  const label=String(meta.resultLabel).trim().toLowerCase();
  const metric = /^(?:installs?|설치(?:수| 수| 건수)?)$/.test(label) ? "installs"
    : /^(?:actions?|sign[ -]?ups?|registrations?|가입(?:수| 수| 건수)?)$/.test(label) ? "actions" : null;
  if (!metric || !sourceCurrencyOf(meta) || meta.grain !== "daily" || rows.some(r => r.cost == null || r.result == null)) return null;
  const mapped = rows.map(row => ({
    date:row.date, channel:row.channel, campaign_name:row.campaign, creative_id:row.creative,
    country:row.market, platform:row.platform, cost:row.cost, [metric]:row.result,
    impressions:row.impressions, clicks:row.clicks,
  }));
  const keys=Object.keys(mapped[0] || {}).filter(key=>mapped.some(row=>row[key]!=null));
  return {metric,rows:operationsSourceRows(mapped),csv:{raw:mapped,mappedRows:mapped,headers:keys,
    mapping:Object.fromEntries(keys.map(key=>[key,key])),currency:meta.currency,importSource:meta.source==="example"?"demo":"upload"}};
}
