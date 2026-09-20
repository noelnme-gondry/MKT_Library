"use client";
import Link from "next/link";
import { idToSlug } from "@/lib/routeMap";
import { PLAN_METHODS, PLAN_MODES, readDecisionPlan, decisionPlanError } from "@/lib/decisionPlan";
export default function DecisionPlanFields({ value, onChange, locale = "ko" }) {
  const en = locale === "en", p = readDecisionPlan(value), lang = en ? 1 : 0;
  const update = (key, value) => onChange({ ...p, [key]: value });
  const error = decisionPlanError(p, locale);
  return <fieldset className="decision-plan-fields decision-review__field--wide"><legend>{en ? "Operating target and review design" : "운영 목표와 검토 설계"}</legend>
    <label>{en ? "Review method" : "검토 방법"}<select value={p.method || ""} onChange={e => update("method", e.target.value)}><option value="">{en ? "Not set" : "미설정"}</option>{Object.entries(PLAN_METHODS).map(([key, labels]) => <option key={key} value={key}>{labels[lang]}</option>)}</select></label>
    <label>{en ? "Target channel / group" : "대상 채널·집단"}<input value={p.target || ""} maxLength={160} onChange={e => update("target", e.target.value)} placeholder={en ? "e.g. Google brand search" : "예: Google 브랜드 검색"} /></label>
    {(p.method === "holdout" || p.method === "controlled") && <><label>{en ? "Comparison group" : "비교군"}<input value={p.control || ""} maxLength={400} onChange={e => update("control", e.target.value)} placeholder={en ? "e.g. unchanged control regions" : "예: 집행을 유지하는 대조 지역"} /></label><label>{en ? "Observation window" : "관측 기간"}<input value={p.window || ""} maxLength={400} onChange={e => update("window", e.target.value)} placeholder={en ? "e.g. Oct 1–14; same attribution window" : "예: 10/1~10/14, 동일 귀속 윈도우"} /></label></>}
    <label>{en ? "Success threshold type" : "성공 기준 유형"}<select value={p.mode || ""} onChange={e => update("mode", e.target.value)}><option value="">{en ? "Qualitative review (no numeric threshold)" : "정성 검토 (수치 기준 없음)"}</option>{Object.entries(PLAN_MODES).map(([key, labels]) => <option key={key} value={key}>{labels[lang]}</option>)}</select></label>
    {p.mode && <><label>{en ? "Target value" : "목표값"}<input inputMode="decimal" value={p.value || ""} onChange={e => update("value", e.target.value)} /></label><label>{en ? "Measurement unit" : "측정 단위"}<input value={p.unit || ""} maxLength={40} onChange={e => update("unit", e.target.value)} placeholder={en ? "people, conversions, KRW, %" : "명, 건, KRW, %"} /></label><label>{en ? "Baseline for this decision" : "이번 결정의 기준값"}<input inputMode="decimal" value={p.baseline || ""} onChange={e => update("baseline", e.target.value)} /></label><p>{en ? "For a 10% recovery from 5,000 people, use baseline 5000, target 10 and unit people. +500 people uses absolute increase. A rate rising from 20% to 25% is +5 percentage points, or +25% relative." : "5,000명 대비 10% 회복이면 기준값 5000·목표값 10·단위 명입니다. 500명 회복은 수량 증가를 선택하세요. 비율 20%→25%는 +5%p 또는 상대 +25%입니다."}</p></>}
    {p.method === "holdout" && <p>{en ? "Attribution estimates suggest a hypothesis, not a causal effect. Check total conversions and allocation, sample size and contamination in the experiment design." : "기여 추정은 실험 가설입니다. 오가닉 귀속 이동만으로 성공을 판단하지 말고 총 전환수·집단 배정·표본 수·집단 간 영향을 함께 확인하세요."} <Link href={`${en ? "/en" : ""}${idToSlug["5-23"]}`} target="_blank" rel="noopener noreferrer">{en ? "Open incrementality analysis in a new tab" : "새 탭에서 증분 분석 열기"}</Link></p>}
    <p>{en ? "This is an operating target, not a statistical detection threshold. A smaller effect may still be supported by the experiment." : "운영 목표이며 통계적 효과 탐지 기준이 아닙니다. 목표보다 작은 효과도 실험에서 근거가 확인될 수 있습니다."}</p>
    {error && <p role="status">{error}</p>}
  </fieldset>;
}
