"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { buildGrowthFunnel, parseGrowthFunnelRows } from "@/lib/growthFunnel";
import { downloadCsv } from "@/utils/download";

const SAMPLE_ROWS = [
  { event_name: "landing_data_start_clicked", event_count: 120, date: "20260801", source: "landing", result_state: "", tool_id: "" },
  { event_name: "blog_tool_cta_clicked", event_count: 80, date: "20260801", source: "blog", result_state: "", tool_id: "5-3" },
  { event_name: "data_import_success", event_count: 95, date: "20260802", source: "csv", result_state: "", tool_id: "" },
  { event_name: "analysis_completed", event_count: 22, date: "20260802", source: "csv", result_state: "ready", tool_id: "5-2", elapsed_bucket: "under_1m" },
  { event_name: "analysis_completed", event_count: 40, date: "20260802", source: "csv", result_state: "ready", tool_id: "5-2", elapsed_bucket: "1_3m" },
  { event_name: "analysis_completed", event_count: 18, date: "20260802", source: "demo", result_state: "ready", tool_id: "5-2", elapsed_bucket: "under_1m" },
  { event_name: "decision_record_added", event_count: 21, date: "20260803", source: "decision_review", result_state: "", tool_id: "5-3" },
  { event_name: "decision_review_completed", event_count: 8, date: "20260808", source: "weekly_review", result_state: "reviewed", tool_id: "5-3" },
  { event_name: "newsletter_submit_attempt", event_count: 14, date: "20260808", source: "blog", result_state: "", tool_id: "" },
];

const COPY = {
  ko: {
    eyebrow: "LOCAL GROWTH OPS",
    title: "유입 → 분석 → 재검토 퍼널",
    deck: "GA4 탐색에서 내보낸 CSV를 이 브라우저에서만 읽어, 제품 이벤트량의 연결 상태를 확인합니다. 파일은 서버로 보내지 않습니다.",
    privacy: "원본 파일과 집계 결과는 이 화면의 메모리에만 있으며 새로고침하면 사라집니다.",
    upload: "GA4 CSV 선택",
    demo: "예시 데이터로 보기",
    template: "필요 컬럼 양식",
    reset: "다른 파일 보기",
    required: "필수: Event name(이벤트 이름). 권장: Event count, Date, source, result_state, tool_id, elapsed_bucket.",
    exportHint: "GA4 탐색에서 이벤트 이름과 이벤트 수를 행으로 내보내세요. source·result_state를 등록해 함께 내보내면 데모와 준비되지 않은 결과를 제외할 수 있습니다.",
    invalid: "이벤트 이름 열을 찾지 못했습니다. GA4 내보내기에 Event name 또는 이벤트 이름을 포함하세요.",
    range: "집계 기간",
    mode: "집계 기준",
    eventVolume: "이벤트량",
    previousRate: "직전 단계 대비",
    sourceTitle: "완료 이벤트 source",
    activationTitle: "첫 도구 진입→분석 완료 소요시간",
    activationLabels: { under_1m: "1분 미만", "1_3m": "1~3분", "3_10m": "3~10분", "10m_plus": "10분 이상" },
    newsletter: "뉴스레터 제출 시도",
    retention: "결정→재검토 이벤트량 비율",
    noSource: "source 열이 없어 데모 완료를 제외하지 못했습니다.",
    noResult: "result_state 열이 없어 ready 결과만 분리하지 못했습니다.",
    aggregate: "이 수치는 사용자·세션 코호트가 아니라 집계 이벤트량입니다. 실제 전환율은 GA4에서 동일 사용자/세션 기준으로 다시 확인하세요.",
    rowMode: "각 행을 이벤트 1건으로 셌습니다. 세션 전환율은 아닙니다.",
    stages: { intent: "분석 의도", imported: "데이터 가져오기 성공", completed: "비데모 분석 완료", decided: "결정 저장", reviewed: "결정 재검토" },
  },
  en: {
    eyebrow: "LOCAL GROWTH OPS",
    title: "Acquisition → analysis → review funnel",
    deck: "Read a GA4 Exploration CSV only in this browser and inspect product-event volume across the journey. The file is never sent to a server.",
    privacy: "The source file and report stay in page memory and disappear on refresh.",
    upload: "Choose GA4 CSV",
    demo: "View sample data",
    template: "Required-column template",
    reset: "Choose another file",
    required: "Required: Event name. Recommended: Event count, Date, source, result_state, tool_id, and elapsed_bucket.",
    exportHint: "Export Event name and Event count as rows from GA4 Explorations. Add source and result_state dimensions to exclude demos and non-ready results.",
    invalid: "No Event name column was found. Include Event name in the GA4 export.",
    range: "Reporting range",
    mode: "Counting mode",
    eventVolume: "Event volume",
    previousRate: "From prior stage",
    sourceTitle: "Completed events by source",
    activationTitle: "First tool view → analysis complete",
    activationLabels: { under_1m: "Under 1 min", "1_3m": "1–3 min", "3_10m": "3–10 min", "10m_plus": "10+ min" },
    newsletter: "Newsletter submit attempts",
    retention: "Decision-to-review event-volume ratio",
    noSource: "No source column was found, so demo completions could not be excluded.",
    noResult: "No result_state column was found, so ready results could not be isolated.",
    aggregate: "These are aggregate event volumes, not a user or session cohort. Confirm true conversion in GA4 with one user/session scope.",
    rowMode: "Each row was counted as one event. This is not a session conversion rate.",
    stages: { intent: "Analysis intent", imported: "Data import success", completed: "Non-demo analysis complete", decided: "Decision saved", reviewed: "Decision reviewed" },
  },
};

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—";
}

export default function GrowthFunnelReport({ locale = "ko" }) {
  const t = COPY[locale] || COPY.ko;
  const inputRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const parsed = useMemo(() => parseGrowthFunnelRows(rows), [rows]);
  const report = useMemo(() => buildGrowthFunnel(parsed), [parsed]);
  const maxCount = report.ok ? Math.max(1, ...report.stages.map((stage) => stage.count)) : 1;

  const loadFile = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      worker: true,
      complete: (result) => {
        const nextRows = Array.isArray(result.data) ? result.data : [];
        const nextParsed = parseGrowthFunnelRows(nextRows);
        if (!nextParsed.ok) {
          setError(t.invalid);
          setRows([]);
          return;
        }
        setRows(nextRows);
        setFileName(file.name);
        setError("");
      },
      error: () => setError(t.invalid),
    });
  };
  const loadSample = () => {
    setRows(SAMPLE_ROWS);
    setFileName(locale === "en" ? "sample_growth_funnel.csv" : "예시_성장_퍼널.csv");
    setError("");
  };
  const downloadTemplate = () => downloadCsv("\uFEFFevent_name,event_count,date,source,result_state,tool_id,elapsed_bucket\r\nanalysis_completed,1,20260801,csv,ready,5-2,1_3m\r\n", "ga4_growth_funnel_template");

  return <article className="page-inner growth-funnel-page">
    <header className="growth-funnel-page__head"><span>{t.eyebrow}</span><h1>{t.title}</h1><p>{t.deck}</p><small>{t.privacy}</small></header>
    {!report.ok ? <section className="growth-funnel-upload">
      <div><strong>{t.required}</strong><p>{t.exportHint}</p></div>
      <div className="growth-funnel-upload__actions">
        <button className="btn primary" type="button" onClick={() => inputRef.current?.click()}>{t.upload}</button>
        <button className="btn ghost" type="button" onClick={loadSample}>{t.demo}</button>
        <button className="btn text" type="button" onClick={downloadTemplate}>{t.template}</button>
        <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" aria-label={t.upload} onChange={(event) => { loadFile(event.target.files?.[0]); event.target.value = ""; }} />
      </div>
      {error && <p role="alert" className="csv-upload-error">{error}</p>}
    </section> : <>
      <section className="growth-funnel-meta">
        <div><span>{t.range}</span><strong>{report.dateRange ? `${report.dateRange.start} → ${report.dateRange.end}` : "—"}</strong></div>
        <div><span>{t.mode}</span><strong>{report.mode === "aggregated_event_volume" ? t.eventVolume : t.rowMode}</strong></div>
        <div><span>{t.newsletter}</span><strong>{report.newsletterAttempts.toLocaleString()}</strong></div>
        <div><span>{t.retention}</span><strong>{pct(report.decisionReviewRate)}</strong></div>
        <button className="btn ghost" type="button" onClick={() => { setRows([]); setFileName(""); }}>{t.reset}</button>
      </section>
      <p className="growth-funnel-file">{fileName}</p>
      {report.warnings.length > 0 && <section className="growth-funnel-warnings" aria-label={locale === "en" ? "Data limitations" : "데이터 한계"}>
        {report.warnings.map((warning) => <p key={warning}>{warning === "missing_source" ? t.noSource : warning === "missing_result_state" ? t.noResult : warning === "aggregate_not_cohort" ? t.aggregate : t.rowMode}</p>)}
      </section>}
      <section className="growth-funnel-stages" aria-label={t.title}>
        {report.stages.map((stage) => <article key={stage.id}>
          <div><span>{t.stages[stage.id]}</span><strong>{stage.count.toLocaleString()}</strong><small>{t.previousRate} · {pct(stage.rateFromPrevious)}</small></div>
          <div className="growth-funnel-stages__track" aria-hidden="true"><i style={{ width: `${Math.max(stage.count ? 4 : 0, stage.count / maxCount * 100)}%` }} /></div>
        </article>)}
      </section>
      {report.activationBuckets.length > 0 && <section className="growth-funnel-sources"><h2>{t.activationTitle}</h2><div>{report.activationBuckets.map((item) => <span key={item.bucket}><b>{t.activationLabels[item.bucket]}</b><strong>{item.count.toLocaleString()}</strong></span>)}</div></section>}
      {report.sourceBreakdown.length > 0 && <section className="growth-funnel-sources"><h2>{t.sourceTitle}</h2><div>{report.sourceBreakdown.map((item) => <span key={item.source}><b>{item.source}</b><strong>{item.count.toLocaleString()}</strong></span>)}</div></section>}
    </>}
  </article>;
}
