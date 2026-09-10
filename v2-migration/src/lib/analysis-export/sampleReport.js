import { buildDemoCsv } from "@/utils/demoData";
import { compareSamplePerformance } from "@/utils/sampleSpendPreview";
import { buildAnalysisExportPayload } from "./exportContract";

// No store access: the free report can only contain the bundled sample.
export function buildSampleReport(locale = "ko") {
  const en = locale === "en";
  const csv = buildDemoCsv("efficiency");
  const result = compareSamplePerformance(csv.raw);
  if (!result?.channels?.length) throw new Error("SAMPLE_UNAVAILABLE");
  const rows = [[en ? "Channel" : "채널", en ? "Prior cost" : "전주 비용", en ? "Prior actions" : "전주 전환", en ? "Recent cost" : "이번 주 비용", en ? "Recent actions" : "이번 주 전환", en ? "Prior CPA" : "전주 CPA", en ? "Recent CPA" : "이번 주 CPA"]];
  result.channels.forEach((channel, index) => {
    const n = index + 2;
    rows.push([channel.channel, channel.prior.cost, channel.prior.actions, channel.recent.cost, channel.recent.actions, { formula: `=IF(C${n}>0,B${n}/C${n},"")` }, { formula: `=IF(E${n}>0,D${n}/E${n},"")` }]);
  });
  const lead = result.channels[0];
  const money = value => Math.round(value).toLocaleString(en ? "en-US" : "ko-KR");
  const payload = buildAnalysisExportPayload({ toolId: "sample-report", toolTitle: en ? "Sample · channel comparison" : "샘플 · 채널 성과 비교", locale, generatedAt: new Date().toISOString(), source: { headers: csv.headers, mapping: csv.mapping, rows: csv.raw, fileName: "built-in-sample.csv" }, scope: { period: `${result.dates[0]} — ${result.dates.at(-1)}`, currency: "KRW", source: "paid", conversion: "actions" }, headline: en ? `${lead.channel}: compare cost and actions before changing budget.` : `${lead.channel}: 예산 조정 전 비용과 전환을 함께 확인하세요.`, stats: [{ label: en ? "Prior CPA (KRW)" : "전주 CPA (원)", value: money(lead.prior.cpa) }, { label: en ? "Recent CPA (KRW)" : "이번 주 CPA (원)", value: money(lead.recent.cpa) }], points: [{ text: en ? "This is sample data, not a customer outcome. CPA is cost divided by key actions." : "고객 실적이 아닌 체험용 데이터입니다. CPA는 비용을 핵심행동 수로 나눈 값입니다." }], addon: { calculationMode: "exact_after_preprocessing", calculationTables: [{ name: "CHANNEL_COMPARISON", rows }], method: { name: en ? "Two adjacent 7-day periods" : "연속된 7일 기간 비교", limitations: [en ? "Observed differences do not establish causality. Workbook formulas use prepared channel totals; source edits do not reaggregate them." : "관측 차이는 인과효과가 아닙니다. 워크북 수식은 채널 집계값을 사용하며 원본 수정 시 자동 재집계하지 않습니다."] } } });
  payload.charts = [{ title: en ? "Channel CPA (KRW per action)" : "채널별 CPA (원/전환)", type: "bar", labels: result.channels.map(channel => channel.channel), series: ["prior", "recent"].map(period => ({ label: period === "prior" ? (en ? "Prior 7 days" : "이전 7일") : (en ? "Recent 7 days" : "최근 7일"), values: result.channels.map(channel => ({ y: channel[period].cpa })) })) }];
  return payload;

}
