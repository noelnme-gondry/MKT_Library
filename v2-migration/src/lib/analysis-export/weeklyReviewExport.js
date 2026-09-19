import { formatReviewMetric, CAMPAIGN_STATUS } from "@/lib/weekly-review/workspaceEvidence";
import { buildAnalysisExportPayload } from "./exportContract";

export function buildWeeklyReviewExport({ csvData, evidence, review, text, locale, projectName = "", reviewRecords = [], basis = "actions" }) {
  const en = locale === "en";
  const rows = [["Campaign", "Previous cost", "Previous conversions", "Previous installs", "Previous revenue", "Current cost", "Current conversions", "Current installs", "Current revenue", "Previous KPI", "Current KPI", "Change ratio", "Observation"]];
  if (!en) rows[0] = ["캠페인", "지난 비용", "지난 전환", "지난 설치", "지난 매출", "이번 비용", "이번 전환", "이번 설치", "이번 매출", "지난 KPI", "이번 KPI", "변화율", "관측 상태"];
  const metric = evidence.metric;
  const format = (value, key) => formatReviewMetric(value, key, evidence.currency, locale);
  const stats = [metric, "cost", "conversions"].filter((key, index, keys) => keys.indexOf(key) === index).map(key => ({ label: key === "cost" ? (en ? "Spend" : "비용") : key === "conversions" ? (en ? "Conversions" : "전환") : key.toUpperCase(), value: format(review.metrics?.current?.[key], key), detail: `${en ? "Previous" : "지난 기간"}: ${format(review.metrics?.previous?.[key], key)}` }));
  for (const campaign of evidence.campaigns) {
    const index = rows.length + 1;
    const kpi = previous => {
      const cost = `${previous ? "B" : "F"}${index}`;
      const denominator = `${metric === "cpi" ? (previous ? "D" : "H") : (previous ? "C" : "G")}${index}`;
      const revenue = `${previous ? "E" : "I"}${index}`;
      if (metric === "conversions") return { value: campaign[previous ? "previous" : "current"]?.[metric] ?? null, formula: `=IF(ISNUMBER(${denominator}),${denominator},"")` };
      return { value: campaign[previous ? "previous" : "current"]?.[metric] ?? null, ...(metric === "roas" ? { numberFormat: "0.0%" } : {}), formula: metric === "roas" ? `=IF(AND(ISNUMBER(${cost}),${cost}>0,ISNUMBER(${revenue})),${revenue}/${cost},"")` : `=IF(AND(ISNUMBER(${cost}),ISNUMBER(${denominator}),${denominator}>0),${cost}/${denominator},"")` };
    };
    rows.push([campaign.label, campaign.previous?.cost ?? null, campaign.previous?.conversions ?? null, campaign.previous?.installs ?? null, campaign.previous?.revenue ?? null, campaign.current?.cost ?? null, campaign.current?.conversions ?? null, campaign.current?.installs ?? null, campaign.current?.revenue ?? null, kpi(true), kpi(false), { value: campaign.deltaPct, formula: `=IF(AND(ISNUMBER(J${index}),ISNUMBER(K${index}),J${index}>0),(K${index}-J${index})/ABS(J${index}),"")`, numberFormat: "0.0%" }, CAMPAIGN_STATUS[locale === "en" ? "en" : "ko"][campaign.status]]);
  }
  return buildAnalysisExportPayload({ toolId: "weekly-review", toolTitle: locale === "en" ? "Weekly Review" : "주간 리뷰", locale, generatedAt: new Date().toISOString(), projectName, reviewRecords, stats, headline: `${metric.toUpperCase()} ${format(review.metrics?.previous?.[metric], metric)} → ${format(review.metrics?.current?.[metric], metric)}`, points: text.split("\n").filter(Boolean).slice(1).map(line => ({ text: line })), source: { ...csvData, rows: csvData.raw }, scope: { previous: `${review.previous.period.start} ~ ${review.previous.period.end}`, current: `${review.current.period.start} ~ ${review.current.period.end}`, metric, currency: evidence.currency, denomBasis: basis }, addon: { calculationMode: "exact_after_preprocessing", calculationTables: [{ name: "WEEKLY_CAMPAIGNS", rows, note: locale === "en" ? "Prepared campaign totals. Edit totals to recalculate KPI cells; raw rows are not reaggregated automatically." : "캠페인 집계 입력입니다. 집계값을 편집하면 KPI가 재계산됩니다. 원본 행은 자동 재집계되지 않습니다." }], method: { name: en ? "Observed weekly campaign comparison" : "주간 캠페인 관측 비교", limitations: [locale === "en" ? "Previous-period totals can come from a saved snapshot rather than the current upload. Unobserved values remain blank. A before/after change is not a causal effect." : "이전 기간 집계는 이번 업로드가 아닌 저장 스냅샷에서 올 수 있습니다. 미관측값은 빈칸으로 남깁니다. 전후 변화는 인과효과가 아닙니다."] } } });
}
