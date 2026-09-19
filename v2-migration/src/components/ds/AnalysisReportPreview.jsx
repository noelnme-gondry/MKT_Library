"use client";

import { useState } from "react";
import { renderAnalysisBrief } from "@/lib/analysis-export/reviewBrief";
import { trackProductEvent } from "@/lib/analytics";
import ModalDialog from "./ModalDialog";
import { reviewScopeRows } from "@/lib/reviewEvidence";
import { isDemoData } from "@/lib/dataOrigin";

// Render the same payload used by Word/XLSX. Never send it to analytics/storage.
// React text nodes escape user-provided names and conclusions.
export default function AnalysisReportPreview({ payload, locale = "ko", onClose, returnFocusRef }) {
  const en = locale === "en";
  const summary = payload.summary;
  const recordOnly = payload.source.importSource === "project_records";
  const [copyState, setCopyState] = useState("");
  const copyBrief = async () => {
    try { await navigator.clipboard.writeText(renderAnalysisBrief(payload)); setCopyState(en ? "Brief copied." : "검토 브리프를 복사했습니다."); trackProductEvent("report_brief_copied", { tool_id: payload.toolId, locale, source: "report_preview" }); }
    catch { setCopyState(en ? "Could not copy. Check clipboard permission and retry." : "복사하지 못했습니다. 클립보드 권한을 확인하고 다시 시도해 주세요."); }
  };
  return <ModalDialog open onClose={onClose} returnFocusRef={returnFocusRef} ariaLabel={en ? "Your report preview" : "내 보고서 미리보기"} overlayClassName="review-save-overlay" panelClassName="analysis-report-preview">
    <header><div><span>{en ? "Report summary" : "보고서 요약"}</span><h2>{payload.toolTitle}</h2></div><button className="btn" onClick={onClose}>{en ? "Close" : "닫기"}</button></header>
    {isDemoData(payload.source) && <p>{en ? "Sample data — this is not your business performance." : "샘플 데이터로 만든 결과입니다. 실제 운영 성과가 아닙니다."}</p>}
    <p className="analysis-report-preview__note">{en ? "From your current analysis. This preview includes the summary and limitations; full tables, charts and workbook formulas are in the paid downloads. Your data stays in this browser." : "현재 분석 결과로 만든 미리보기입니다. 결론과 한계를 먼저 확인하세요. 전체 표·차트·워크북 수식은 구매 후 다운로드에 포함되며, 데이터는 이 브라우저에만 남습니다."}</p>
    <section><h3>{en ? "Conclusion" : "핵심 결론"}</h3><p className="analysis-report-preview__headline">{summary.headline}</p></section>
    {summary.stats.length > 0 && <dl className="analysis-report-preview__metrics">{summary.stats.map((stat, index) => <div key={index}><dt>{stat.label}</dt><dd><strong>{stat.value}</strong>{stat.detail && <p>{stat.detail}</p>}</dd></div>)}</dl>}
    <section><h3>{en ? "Scope" : "분석 범위"}</h3><dl className="analysis-report-preview__scope">
      {reviewScopeRows(payload.scope, locale).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      {!recordOnly && <div><dt>{en ? "Source rows" : "원본 행"}</dt><dd>{payload.source.rows.length.toLocaleString()}</dd></div>}
    </dl>{!recordOnly && <p>{en ? "Source rows are not the number of observations used by every calculation." : "원본 행 수는 각 계산에 사용된 분석 표본 수와 다를 수 있습니다."}</p>}</section>
    {summary.points.length > 0 && <section><h3>{en ? "Evidence and next steps" : "근거와 다음 행동"}</h3>{summary.points.map((point, index) => <div key={index}><p><strong>{point.label}</strong> {point.text}</p>{point.detail && <p>{point.detail}</p>}</div>)}</section>}
    {payload.review?.decisions.length > 0 && <section><h3>{en ? "Decision review and follow-up" : "결정 검토와 후속 행동"}</h3><p>{en ? "Historical saved records; these are not a new causal assessment." : "저장된 과거 기록이며, 이번 분석의 인과효과 판정을 뜻하지 않습니다."}</p>{payload.review.decisions.map((decision, index) => <article key={index}><h4>{decision.action}</h4><dl>{decision.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>)}{payload.review.total > payload.review.decisions.length && <p>{en ? `Latest ${payload.review.decisions.length} of ${payload.review.total} decisions shown.` : `전체 ${payload.review.total}건 중 최근 ${payload.review.decisions.length}건을 담았습니다.`}</p>}</section>}
    <button className="btn" onClick={copyBrief}>{en ? "Copy review brief" : "검토 브리프 복사"}</button>{copyState && <p role="status">{copyState}</p>}
    <section><h3>{en ? "Method and limitations" : "분석 방법과 해석 한계"}</h3><p>{payload.method.name}</p>
      {[...payload.method.assumptions, ...payload.method.limitations].map((text, index) => <p key={index}>{text}</p>)}
      {!recordOnly && <p>{payload.calculationMode === "exact_after_preprocessing" ? (en ? "Workbook formulas recalculate prepared inputs. Editing raw rows does not rerun preprocessing." : "워크북 수식은 전처리된 입력부터 다시 계산합니다. 원본 수정만으로 전처리가 다시 실행되지는 않습니다.") : (en ? "Model estimates are browser-engine outputs. Refit the model on the website after changing data." : "통계 모델 추정치는 브라우저 엔진 산출물입니다. 데이터를 바꾸면 사이트에서 모델을 다시 추정해야 합니다.")}</p>}
    </section>
  </ModalDialog>;
}
