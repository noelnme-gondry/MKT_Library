"use client";

import ModalDialog from "./ModalDialog";
import { isDemoData } from "@/lib/dataOrigin";

const SCOPE_LABELS = { start: ["시작", "Start"], end: ["종료", "End"], dateStart: ["분석 시작일", "Analysis start"], dateEnd: ["분석 종료일", "Analysis end"], comparisonStart: ["비교 시작일", "Comparison start"], comparisonEnd: ["비교 종료일", "Comparison end"], previous: ["이전 기간", "Previous period"], current: ["현재 기간", "Current period"], currency: ["통화", "Currency"], denomBasis: ["전환 기준", "Conversion basis"], metric: ["지표", "Metric"], channel: ["채널", "Channel"], campaign: ["캠페인", "Campaign"], platforms: ["플랫폼", "Platforms"], countries: ["국가", "Countries"], channels: ["채널", "Channels"], sources: ["소스", "Sources"] };
const scopeLabel = (key, en) => SCOPE_LABELS[key]?.[en ? 1 : 0] || key;

// Render the same payload used by Word/XLSX. Never send it to analytics/storage.
// React text nodes escape user-provided names and conclusions.
export default function AnalysisReportPreview({ payload, locale = "ko", onClose, returnFocusRef }) {
  const en = locale === "en";
  const summary = payload.summary;
  return <ModalDialog open onClose={onClose} returnFocusRef={returnFocusRef} ariaLabel={en ? "Your report preview" : "내 보고서 미리보기"} overlayClassName="review-save-overlay" panelClassName="analysis-report-preview">
    <header><div><span>{en ? "Report summary" : "보고서 요약"}</span><h2>{payload.toolTitle}</h2></div><button className="btn" onClick={onClose}>{en ? "Close" : "닫기"}</button></header>
    {isDemoData(payload.source) && <p>{en ? "Sample data — this is not your business performance." : "샘플 데이터로 만든 결과입니다. 실제 운영 성과가 아닙니다."}</p>}
    <p className="analysis-report-preview__note">{en ? "From your current analysis. This preview includes the summary and limitations; full tables, charts and workbook formulas are in the paid downloads. Your data stays in this browser." : "현재 분석 결과로 만든 미리보기입니다. 결론과 한계를 먼저 확인하세요. 전체 표·차트·워크북 수식은 구매 후 다운로드에 포함되며, 데이터는 이 브라우저에만 남습니다."}</p>
    <section><h3>{en ? "Conclusion" : "핵심 결론"}</h3><p className="analysis-report-preview__headline">{summary.headline}</p></section>
    {summary.stats.length > 0 && <dl className="analysis-report-preview__metrics">{summary.stats.map((stat, index) => <div key={index}><dt>{stat.label}</dt><dd><strong>{stat.value}</strong>{stat.detail && <p>{stat.detail}</p>}</dd></div>)}</dl>}
    <section><h3>{en ? "Scope" : "분석 범위"}</h3><dl className="analysis-report-preview__scope">
      {Object.entries(payload.scope).filter(([, value]) => value !== "" && (!Array.isArray(value) || value.length)).map(([key, value]) => <div key={key}><dt>{scopeLabel(key, en)}</dt><dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd></div>)}
      <div><dt>{en ? "Source rows" : "원본 행"}</dt><dd>{payload.source.rows.length.toLocaleString()}</dd></div>
    </dl><p>{en ? "Source rows are not the number of observations used by every calculation." : "원본 행 수는 각 계산에 사용된 분석 표본 수와 다를 수 있습니다."}</p></section>
    {summary.points.length > 0 && <section><h3>{en ? "Evidence and next steps" : "근거와 다음 행동"}</h3>{summary.points.map((point, index) => <div key={index}><p><strong>{point.label}</strong> {point.text}</p>{point.detail && <p>{point.detail}</p>}</div>)}</section>}
    <section><h3>{en ? "Method and limitations" : "분석 방법과 해석 한계"}</h3><p>{payload.method.name}</p>
      {[...payload.method.assumptions, ...payload.method.limitations].map((text, index) => <p key={index}>{text}</p>)}
      <p>{payload.calculationMode === "exact_after_preprocessing" ? (en ? "Workbook formulas recalculate prepared inputs. Editing raw rows does not rerun preprocessing." : "워크북 수식은 전처리된 입력부터 다시 계산합니다. 원본 수정만으로 전처리가 다시 실행되지는 않습니다.") : (en ? "Model estimates are browser-engine outputs. Refit the model on the website after changing data." : "통계 모델 추정치는 브라우저 엔진 산출물입니다. 데이터를 바꾸면 사이트에서 모델을 다시 추정해야 합니다.")}</p>
    </section>
  </ModalDialog>;
}
