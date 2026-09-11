import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { STANDARD_FIELDS } from "@/utils/csvConstants";
import { FUNNEL_MATH } from "@/utils/funnelMath";
import { groupForRoute } from "@/lib/toolGroups";

export function blogMappingToolId(toolId) {
  const group = groupForRoute(toolId);
  return group === "efficiency" ? "start-gate" : group === "response" ? "5-18" : toolId;
}

export function strictMetric(value) {
  const text = String(value ?? "").trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) return null;
  const number = Number(text.replaceAll(",", ""));
  return Number.isFinite(number) ? number : null;
}
export function blogMapping(raw, headers, toolId) {
  // The full target-tool contract is retained for handoff; never narrow a shared slice.
  return buildMappingContract({ rows: raw, headers, toolId: blogMappingToolId(toolId), source: "csv" });
}
export function validateBlogNumbers(csv) {
  const numeric = Object.entries(csv.mapping).filter(([, field]) => ["number", "percent"].includes(STANDARD_FIELDS[field]?.type));
  return numeric.every(([header]) => csv.raw.every(row => strictMetric(row[header]) !== null));
}
export function descriptiveBlogResult(csv, selection, locale) {
  const en = locale === "en";
  const { category, value, denominator } = selection;
  if (!category || !value || !csv.headers.includes(category) || !csv.headers.includes(value) || (denominator && !csv.headers.includes(denominator))) throw new Error("columns");
  const groups = new Map();
  for (const row of csv.raw) {
    const key = String(row[category] ?? "").trim();
    const amount = strictMetric(row[value]), base = denominator ? strictMetric(row[denominator]) : 0;
    if (!key || amount === null || base === null) throw new Error("values");
    const previous = groups.get(key) || { sum: 0, base: 0 };
    const next = { sum: previous.sum + amount, base: previous.base + base };
    if (!Number.isFinite(next.sum) || !Number.isFinite(next.base)) throw new Error("values");
    groups.set(key, next);
  }
  if (groups.size > 100 || !groups.size) throw new Error("groups");
  const data = [...groups].map(([label, item]) => ({ label, value: denominator ? FUNNEL_MATH.cvr(item.sum, item.base) : item.sum }));
  const missing = data.filter(item => item.value === null).length;
  return { status: "success", verdict: {
    headline: en ? `${groups.size} groups · ${denominator ? "ratio of sums" : "totals"}${missing ? ` · ${missing} undefined denominator(s)` : ""}` : `${groups.size}개 그룹 · ${denominator ? "합계의 비율" : "합계"}${missing ? ` · 분모 계산 불가 ${missing}개` : ""}`,
    caveats: [en ? "A descriptive check of the selected columns. This does not run the article's causal, retention, or statistical model. Confirm units, observation windows and comparable groups in the full analysis." : "선택한 열의 기술적 집계입니다. 글의 인과·리텐션·통계 모형을 실행한 결과는 아닙니다. 상세 분석에서 단위·관찰 기간·그룹 비교 조건을 확인하세요."],
  }, visualizations: [{ kind: "bar", question: `${value}${denominator ? ` / ${denominator}` : ""}`, data, options: { x: "label", y: "value" } }] };
}
export async function runBlogAdapter(toolId, csvData, locale) {
  if (!validateBlogNumbers(csvData)) throw new Error("values");
  const input = { csvData, locale, inputSignature: "blog-explicit-run", mappingSignature: "blog-confirmed-mapping", options: { displayCurrency: csvData.currency, denomBasis: csvData.denomBasis || "installs" } };
  let adapters;
  if (["5-2", "5-21", "5-22", "5-3"].includes(toolId)) { adapters = await import("@/lib/assistant/efficiencyAnalysisAdapters"); return adapters.runEfficiencyAnalysis({ toolId, ...input }); }
  if (["5-25", "5-26"].includes(toolId)) { adapters = await import("@/lib/assistant/optimizationAnalysisAdapters"); return adapters.runOptimizationAnalysis({ toolId, ...input }); }
  if (["5-27", "9-6"].includes(toolId)) { adapters = await import("@/lib/assistant/specialAnalysisAdapters"); return adapters.runSpecialAnalysis({ toolId, ...input }); }
  adapters = await import("@/lib/assistant/responseAnalysisAdapters");
  return adapters.runResponseAnalysis({ toolId, ...input });
}
