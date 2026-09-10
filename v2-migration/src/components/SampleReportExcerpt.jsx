import { buildSampleReport } from "@/lib/analysis-export/sampleReport";
export default function SampleReportExcerpt({ locale = "ko" }) {
  const en = locale === "en";
  const payload = buildSampleReport(locale);
  const chart = payload.charts[0];
  const max = Math.ceil(Math.max(...chart.series.flatMap(series => series.values.map(point => point.y))) / 5000) * 5000;
  return <section className="sample-report-excerpt"><header><span>{en ? "ACTUAL SAMPLE REPORT EXCERPT" : "실제 샘플 보고서 발췌"}</span><h3>{payload.summary.headline}</h3><p>{payload.scope.period} · KRW · {en ? "Built-in sample, paid traffic" : "체험용 데이터, 광고 유입"}</p></header><figure><figcaption>{chart.title} · {en ? "Shorter means lower cost" : "짧을수록 전환 한 건의 비용이 낮음"}</figcaption><p>{en ? "Common scale" : "공통 눈금"}: 0 — {max.toLocaleString()} {en ? "KRW" : "원"}</p>{chart.labels.slice(0, 3).map((label, index) => <div className="sample-report-channel" key={label}><strong>{label}</strong>{chart.series.map((series, seriesIndex) => <div className="sample-report-bar" key={series.label}><span>{series.label}</span><div aria-hidden="true"><i className={seriesIndex ? "is-current" : ""} style={{ width: `${series.values[index].y / max * 100}%` }} /></div><b>{Math.round(series.values[index].y).toLocaleString()} {en ? "KRW" : "원"}</b></div>)}</div>)}</figure><p>{en ? "Before changing budgets, compare each campaign’s cost and actions. These observed changes do not identify their causes. The files include all channels." : "예산을 바꾸기 전 캠페인별 비용과 전환을 함께 확인하세요. 관측된 변화만으로 원인을 확정할 수 없습니다. 파일에는 전체 채널을 담았습니다."}</p></section>;
}
