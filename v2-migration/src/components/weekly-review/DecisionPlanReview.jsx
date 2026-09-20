"use client";
import Link from "next/link";
import { idToSlug } from "@/lib/routeMap";
import { readDecisionPlan, decisionPlanRows, assessDecisionPlan } from "@/lib/decisionPlan";
export default function DecisionPlanReview({ record, locale = "ko", onChange }) {
  const en = locale === "en", plan = readDecisionPlan(record.reviewPlan);
  if (!Object.values(plan).some(Boolean)) return null;
  const assessment = assessDecisionPlan(plan, record.targetActual);
  const label = { met: en ? "Numeric target met" : "수치 목표 충족", not_met: en ? "Numeric target not met" : "수치 목표 미충족", waiting: en ? "Awaiting a numeric observation" : "수치 관측 대기", incomplete: en ? "No complete numeric criteria" : "수치 기준 미완성·정성 검토" }[assessment.state];
  return <section className="decision-evidence"><h3>{en ? "Saved success criteria" : "저장한 성공 기준"}</h3><dl>{decisionPlanRows(plan, locale).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    {plan.method === "holdout" && <Link href={`${en ? "/en" : ""}${idToSlug["5-23"]}`} target="_blank" rel="noopener noreferrer">{en ? "Validate with incrementality analysis (new tab)" : "증분 분석으로 검증하기 (새 탭)"}</Link>}
    {plan.mode && <><label>{en ? `Target observation — ${record.action}` : `목표 관측값 — ${record.action}`}<input inputMode="decimal" value={record.targetActual || ""} onChange={event => onChange(event.target.value)} /></label><p>{en ? `Enter the observed ${plan.metric || record.metric} in ${plan.unit}, in the same scope and window as the baseline.` : `${plan.metric || record.metric}의 관측값을 ${plan.unit} 단위로 입력하세요. 기준값과 집단·기간·귀속 조건을 맞춰야 합니다.`}</p><strong role="status">{label}</strong><p>{en ? "This checks your numeric threshold only. It does not establish statistical significance, guardrail compliance or causal lift." : "입력한 수치 기준만 대조합니다. 통계적 유의성·가드레일 충족·인과효과 판정은 별도로 확인해야 합니다."}</p></>}
  </section>;
}
