"use client";
import { useState } from "react";
import ReviewSaveDialog from "@/components/ReviewSaveDialog";
import { useReviewDraftGuard } from "@/lib/project/reviewDraftGuard";
import { toLocalDecisionDate, serializeDecisionGuardrails } from "@/lib/decisionReview";
import { useAppStore } from "@/store/useDataStore";
import DecisionPlanFields from "@/components/ds/DecisionPlanFields";
import { toolDecisionGoals, toolDecisionGuardrails, findToolGoal, decisionSourceToolId } from "@/lib/decisionGoals";
import { serializeDecisionPlan, decisionPlanError } from "@/lib/decisionPlan";
import { trackProductEvent } from "@/lib/analytics";

export default function DecisionFollowUp({ record, locale = "ko" }) {
  const en = locale === "en";
  const records = useAppStore(state => state.decisionRecords);
  const parent = records.find(item => item.id === record.parentDecisionId);
  const children = records.filter(item => item.parentDecisionId === record.id);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState("");
  const [date, setDate] = useState(() => { const next = new Date(); next.setDate(next.getDate() + 7); return toLocalDecisionDate(next); });
  const toolId = decisionSourceToolId(record);
  const goals = toolDecisionGoals(toolId, locale);
  const [goalMetric, setGoalMetric] = useState(goals.some(goal => goal.key === record.goalMetric) ? record.goalMetric : record.metric ? "" : goals[0]?.key || "");
  const rails = toolDecisionGuardrails(toolId, locale);
  const [railValues, setRailValues] = useState({});
  const selectedRails = rails.filter(rail => String(railValues[rail.key] || "").trim()).map(rail => ({ metric: rail.key, op: rail.op, value: String(railValues[rail.key]).trim() }));
  const invalidRails = selectedRails.some(rail => !Number.isFinite(Number(rail.value)));
  const [question, setQuestion] = useState(record.reviewQuestion || "");
  const [plan, setPlan] = useState({});
  const [customMetric, setCustomMetric] = useState(record.metric || "");
  const goal = findToolGoal(toolId, goalMetric, locale);
  const [pending, setPending] = useState(null);
  useReviewDraftGuard(open && Boolean(action.trim() || serializeDecisionPlan(plan) || selectedRails.length));
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
      <label>{en ? "Goal for the next decision" : "다음 결정의 목표"}<select value={goalMetric} onChange={event => { setGoalMetric(event.target.value); setQuestion(""); setPlan({}); setRailValues({}); }}>{goals.map(goal => <option key={goal.key} value={goal.key}>{goal.label}</option>)}<option value="">{en ? "Custom metric" : "직접 입력"}</option></select></label>
      {!goalMetric && <label>{en ? "Custom success metric" : "직접 입력한 목표 지표"}<input value={customMetric} onChange={event => setCustomMetric(event.target.value)} /></label>}
      {rails.length > 0 && <fieldset className="decision-plan-fields"><legend>{en ? "Guardrails for the next decision" : "다음 결정에서 지킬 조건"}</legend>{rails.map(rail => <label key={rail.key}>{rail.label} {rail.op === "gte" ? "≥" : "≤"}<input inputMode="decimal" value={railValues[rail.key] || ""} onChange={event => setRailValues(values => ({ ...values, [rail.key]: event.target.value }))} /></label>)}<p>{en ? "Set fresh thresholds; previous thresholds are not copied." : "이번 결정의 기준을 입력하세요. 이전 결정의 임계값을 자동 복사하지 않습니다."}</p>{invalidRails && <p role="status">{en ? "Enter numeric guardrail thresholds." : "유지할 조건의 기준값은 숫자로 입력하세요."}</p>}</fieldset>}
      <DecisionPlanFields locale={locale} value={plan} onChange={setPlan} />
      <label>{en ? "Next review question" : "다음 검토 질문"}<input value={question} maxLength={500} onChange={event => setQuestion(event.target.value)} placeholder={en ? "Did the target improve without breaking guardrails?" : "지킬 조건을 유지하면서 목표를 달성했는가?"} /></label>
      <label>{en ? "Next review date" : "다음 결정 검토일"}<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <button className="btn primary" disabled={!action.trim() || !date || (!goalMetric && !customMetric.trim()) || Boolean(decisionPlanError(plan, locale)) || invalidRails} onClick={() => setPending({ toolId, sourcePath: record.sourcePath, dataOrigin: record.dataOrigin, locale, parentDecisionId: record.id, guardrails: serializeDecisionGuardrails(selectedRails), action: action.trim(), hypothesis: record.learning || "", conclusion: record.learning || record.conclusion, metric: goal?.label || customMetric, targetDirection: goal?.targetDirection || "", goalMetric, goalDirection: goal?.direction || "", reviewPlan: serializeDecisionPlan(plan) ? serializeDecisionPlan({ ...plan, metric: goal?.label || customMetric }) : "", reviewQuestion: question.trim(), reviewDate: date, createdAt: new Date().toISOString(), status: "scheduled" })}>{en ? "Save next decision" : "다음 결정 저장"}</button>
      <button className="btn" onClick={() => { setOpen(false); setAction(""); setPlan({}); setRailValues({}); }}>{en ? "Cancel" : "취소"}</button>
    </div>}
    {pending && <ReviewSaveDialog locale={locale} record={pending} onClose={() => setPending(null)} onSaved={() => { setOpen(false); setAction(""); setPlan({}); setRailValues({}); trackProductEvent("decision_follow_up_saved", { tool_id: record.toolId, locale, source: "project_review" }); }} />}
  </section>;
}
