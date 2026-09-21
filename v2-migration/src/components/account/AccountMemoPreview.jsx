import { decisionEpisodeList } from "@/lib/decisionReview";
import { decisionPlanRows, decisionObservationRows } from "@/lib/decisionPlan";
import DecisionEvidence from "../weekly-review/DecisionEvidence";

export default function AccountMemoPreview({ record, locale = "ko" }) {
  const en = locale === "en";
  const fields = [
    [en ? "Decision" : "결정", record.action],
    [en ? "Conclusion" : "분석 결론", record.conclusion],
    [en ? "Expected outcome" : "기대 결과", record.expected],
    [en ? "Review date" : "검토일", record.reviewDate],
    [en ? "Observed result" : "관측 결과", record.actual],
    [en ? "Learning" : "배운 점", record.learning],
    [en ? "Closure reason" : "종료 사유", record.closureReason],
    ...decisionPlanRows(record.reviewPlan, locale),
    ...decisionObservationRows(record.reviewPlan, record.targetActual, locale),
  ].filter(([, value]) => value);
  const episodes = decisionEpisodeList(record);
  return <>
    <dl>{fields.map(([label, value], index) => <div key={`${label}-${index}`}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {record.evidence && <DecisionEvidence record={record} locale={locale} />}
    {episodes.length > 0 && <section><h4>{en ? "Observation history" : "관측 이력"}</h4><ol>{episodes.map((episode, index) => <li key={index}>{episode.observedAt?.slice(0, 10)} · {episode.actual}{episode.learning && <p>{episode.learning}</p>}</li>)}</ol></section>}
    <p className="wr-note">{en ? "The selected decision, saved evidence, review history and links to related decisions are stored. Original CSV rows and device-only data snapshots stay on this device." : "선택한 결정과 저장된 근거·검토 이력·관련 결정 연결을 보관합니다. CSV 원본 행과 기기 전용 데이터 스냅샷은 이 기기에 남습니다."}</p>
  </>;
}
