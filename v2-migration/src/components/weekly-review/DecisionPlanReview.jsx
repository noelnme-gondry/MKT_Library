"use client";
import { useState } from "react";
import { reviewEvidenceMatch } from "@/lib/reviewEvidenceMatch";
import EvidenceCompatibility from "./EvidenceCompatibility";
import Link from "next/link";
import { idToSlug } from "@/lib/routeMap";
import { readDecisionPlan, decisionPlanRows, decisionObservationRows } from "@/lib/decisionPlan";
import { readReviewEvidence } from "@/lib/reviewEvidence";
import { useAppStore } from "@/store/useDataStore";
import DecisionEvidence from "./DecisionEvidence";
export default function DecisionPlanReview({ record, locale = "ko", onChange, onEvidenceChange }) {
  const [showOthers, setShowOthers] = useState(false);
  const [pendingSource, setPendingSource] = useState(null);
  const records = useAppStore(state => state.decisionRecords);
  const en = locale === "en", plan = readDecisionPlan(record.reviewPlan);
  if (!Object.values(plan).some(Boolean)) return readReviewEvidence(record.effectEvidence) ? <><DecisionEvidence record={{ evidence: record.effectEvidence }} locale={locale} title={en ? "Linked effect analysis — estimate, interval and design" : "연결한 효과 분석 — 추정치·구간·설계"} expanded />{onEvidenceChange && <button className="btn" onClick={() => onEvidenceChange(null)}>{en ? "Unlink this evidence" : "근거 연결 해제"}</button>}</> : null;
  const observationRows = decisionObservationRows(plan, record.targetActual, locale);
  const candidates = records.filter(item => item.id !== record.id && item.dataOrigin === record.dataOrigin && readReviewEvidence(item.evidence));
  const visibleCandidates = candidates.filter(item => showOthers || item.id === record.effectSourceId || reviewEvidenceMatch(record, item, locale).recommended);
  return <section className="decision-evidence"><section data-information-section=""><header data-information-heading="">{en ? "Saved operating target and design" : "저장한 운영 목표와 설계"}</header><dl>{decisionPlanRows(plan, locale).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>
    {plan.method === "holdout" && <Link href={`${en ? "/en" : ""}${idToSlug["5-23"]}`} target="_blank" rel="noopener noreferrer">{en ? "Validate with incrementality analysis (new tab)" : "증분 분석으로 검증하기 (새 탭)"}</Link>}
    {plan.mode && <><label>{en ? `Target observation — ${record.action}` : `목표 관측값 — ${record.action}`}<input inputMode="decimal" value={record.targetActual || ""} onChange={event => onChange(event.target.value)} /></label><p>{en ? `Enter the observed ${plan.metric || record.metric} in ${plan.unit}, in the same scope and window as the baseline.` : `${plan.metric || record.metric}의 관측값을 ${plan.unit} 단위로 입력하세요. 기준값과 집단·기간·귀속 조건을 맞춰야 합니다.`}</p></>}
    <h4>{en ? "Effect size and uncertainty" : "효과 크기와 불확실성"}</h4>
    <p>{en ? "Partial recovery can matter below an operating target. Assess the experiment estimate and its interval; an interval crossing zero is uncertain, not proof of no effect. Before/after counts alone cannot identify cannibalization." : "운영 목표보다 작아도 부분 회복은 의미가 있을 수 있습니다. 실험의 추정치와 구간을 함께 읽으세요. 구간이 0을 지나면 불확실한 것이지 효과가 없다는 증거가 아닙니다. 전후 인원수만으로 카니발을 판정할 수는 없습니다."}</p>
    {onEvidenceChange && <label>{en ? "Link saved follow-up analysis" : "후속 분석 근거 연결"}<select value={pendingSource?.id || record.effectSourceId || ""} onChange={event => { const source = candidates.find(item => item.id === event.target.value); if (source) setPendingSource(source); else { setPendingSource(null); onEvidenceChange(null); } }}><option value="">{en ? "Select the matching experiment result" : "같은 실험의 분석 결과 선택"}</option>{record.effectSourceId && !candidates.some(item => item.id === record.effectSourceId) && <option value={record.effectSourceId}>{en ? "Saved evidence snapshot" : "보관된 근거 사본"}</option>}{visibleCandidates.map(item => <option key={item.id} value={item.id}>{`${item.createdAt?.slice(0, 10) || ""} · ${item.metric || item.toolId} · ${item.action}`}</option>)}</select></label>}
    {onEvidenceChange && <><label><input type="checkbox" checked={showOthers} onChange={event => setShowOthers(event.target.checked)} />{en ? "Show other saved analyses (conditions may differ)" : "다른 저장 분석도 보기 (조건이 다를 수 있음)"}</label>{pendingSource && <><EvidenceCompatibility match={reviewEvidenceMatch(record, pendingSource, locale)} locale={locale} /><button className="btn" onClick={() => { onEvidenceChange(pendingSource); setPendingSource(null); }}>{en ? "Conditions checked — use this evidence" : "조건 확인 후 이 근거 사용"}</button></>}</>}
    <p>{en ? "In the analysis tool, choose ‘Link this result to an existing decision’. You can also select an already saved result above. Ad incrementality and organic recovery are different estimands." : "분석 도구의 ‘이 결과를 기존 결정에 연결’을 사용하세요. 이미 저장한 결과는 위에서 선택할 수도 있습니다. 광고 순증분과 오가닉 회복은 서로 다른 추정 대상입니다."}</p>
    {readReviewEvidence(record.effectEvidence) ? <DecisionEvidence record={{ evidence: record.effectEvidence }} locale={locale} title={en ? "Linked effect analysis — estimate, interval and design" : "연결한 효과 분석 — 추정치·구간·설계"} expanded /> : <p>{en ? "Effect evidence not linked. Uncertainty cannot be estimated from this count alone." : "효과 근거 미연결 · 현재 인원수만으로 불확실성은 추정 불가"}</p>}
    {onEvidenceChange && readReviewEvidence(record.effectEvidence) && <button className="btn" onClick={() => { setPendingSource(null); onEvidenceChange(null); }}>{en ? "Unlink this evidence" : "근거 연결 해제"}</button>}
    <h4>{en ? "Observation and operating target" : "관측 변화와 운영 목표"}</h4>
    <div role="status"><dl>{observationRows.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>{!observationRows.length && <p>{en ? "Awaiting a numeric observation" : "수치 관측 대기"}</p>}</div>
    <p>{en ? "Operating progress is not a cannibalization recovery share, statistical confidence or causal verdict. Review total conversions and other guardrails separately." : "운영 목표 진행률은 카니발 회복률·통계적 신뢰도·인과 판정이 아닙니다. 총 전환수 등 유지할 조건도 별도로 검토하세요."}</p>
  </section>;
}
