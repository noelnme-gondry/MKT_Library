"use client";
import { useState } from "react";
import ReviewSaveDialog from "@/components/ReviewSaveDialog";
import { useReviewDraftGuard } from "@/lib/project/reviewDraftGuard";
import { toLocalDecisionDate } from "@/lib/decisionReview";
import { useAppStore } from "@/store/useDataStore";
import { trackProductEvent } from "@/lib/analytics";

export default function DecisionFollowUp({ record, locale = "ko" }) {
  const en = locale === "en";
  const records = useAppStore(state => state.decisionRecords);
  const parent = records.find(item => item.id === record.parentDecisionId);
  const children = records.filter(item => item.parentDecisionId === record.id);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState("");
  const [date, setDate] = useState(() => { const next = new Date(); next.setDate(next.getDate() + 7); return toLocalDecisionDate(next); });
  const [pending, setPending] = useState(null);
  useReviewDraftGuard(open && Boolean(action.trim()));
  // Only committed observations may become the basis for another decision.
  const observed = Boolean(record.actual?.trim() || record.learning?.trim());
  return <section className="decision-follow-up" aria-label={en ? "Decision feedback loop" : "결정 피드백 루프"}>
    {parent && <p>{en ? "Previous decision" : "이전 결정"}: {parent.action}</p>}
    {record.parentDecisionId && !parent && <p>{en ? "The previous decision is not available in this project." : "이전 결정은 현재 프로젝트에 없습니다."}</p>}
    {children.length > 0 && <><strong>{en ? "Next decisions" : "이어진 결정"}</strong><ul>{children.map(child => <li key={child.id}>{child.action} · {child.reviewDate || (en ? "No review date" : "검토일 미정")}</li>)}</ul></>}
    {observed && !open && <button className="btn" onClick={() => setOpen(true)}>{en ? "Turn this learning into the next decision" : "배운 점으로 다음 결정 만들기"}</button>}
    {open && <div className="decision-follow-up__form">
      <p>{en ? "Keep the previous record and its observations. Define the next action; verify a new analysis basis in the source tool before scoring it." : "이전 결정과 관측 이력은 그대로 남습니다. 다음 행동을 정하고, 성과를 판정하기 전에 원본 도구에서 새 분석 기준을 확인하세요."}</p>
      {record.learning && <blockquote>{record.learning}</blockquote>}
      <label>{en ? "Next action" : "다음에 실행할 행동"}<textarea value={action} maxLength={500} onChange={event => setAction(event.target.value)} /></label>
      <label>{en ? "Next review date" : "다음 결정 검토일"}<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <button className="btn primary" disabled={!action.trim() || !date} onClick={() => setPending({ toolId: record.toolId, sourcePath: record.sourcePath, dataOrigin: record.dataOrigin, locale, parentDecisionId: record.id, action: action.trim(), hypothesis: record.learning || "", conclusion: record.learning || record.conclusion, metric: record.metric, targetDirection: record.targetDirection, goalMetric: record.goalMetric, goalDirection: record.goalDirection, reviewQuestion: record.reviewQuestion, reviewDate: date, createdAt: new Date().toISOString(), status: "scheduled" })}>{en ? "Save next decision" : "다음 결정 저장"}</button>
      <button className="btn" onClick={() => { setOpen(false); setAction(""); }}>{en ? "Cancel" : "취소"}</button>
    </div>}
    {pending && <ReviewSaveDialog locale={locale} record={pending} onClose={() => setPending(null)} onSaved={() => { setOpen(false); setAction(""); trackProductEvent("decision_follow_up_saved", { tool_id: record.toolId, locale, source: "project_review" }); }} />}
  </section>;
}
