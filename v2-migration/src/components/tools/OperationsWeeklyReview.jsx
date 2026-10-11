"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PillGroup from "@/components/ds/PillGroup";
import DecisionReview from "@/components/ds/DecisionReview";
import { buildReviewEvidence } from "@/lib/reviewEvidence";
import { OPERATIONS_TOOL_ID, OPERATIONS_PATH } from "@/lib/operations/operationsDemo";

export default function OperationsWeeklyReview({ candidates, selected, onSelect, isDemo, locale, currency, periods }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const choice = candidates.find(row => row.id === selected) || candidates[0];
  const kinds = [...new Set(candidates.map(row => row.kind))];
  return <section className="operations-weekly-review" id="ops-review" aria-labelledby="ops-review-title">
    <header className="operations-brief__heading">
      <div><h3 id="ops-review-title" tabIndex={-1}>{tr("주간 리뷰 연결", "Weekly review handoff")}</h3>
        <p>{tr("검토할 변경 하나를 선택하세요. 기준값·대상·질문을 함께 기록해 주간 리뷰에서 이어갑니다.", "Choose one change to review. Carry its baseline, target and question into Weekly review.")}</p></div>
      <Link className="btn ghost operations-weekly-review__link" href={`${locale === "en" ? "/en" : ""}/weekly-review#wr-history`}>{tr("주간 리뷰 열기", "Open Weekly review")}<ArrowRight size={16} aria-hidden="true" /></Link>
    </header>
    {!choice ? <p>{tr("기록할 실측 기준값이 부족합니다. 데이터·기간을 확인하세요.", "Observed baselines are insufficient. Check the data and periods.")}</p> : <>
      <div className="operations-review-choices">
        <PillGroup ariaLabel={tr("검토 종류", "Review type")} value={choice.kind} onChange={kind => onSelect(candidates.find(row => row.kind === kind).id)}
          options={kinds.map(kind => ({ value: kind, label: candidates.find(row => row.kind === kind).label }))} />
        <label className="operations-target-select">{tr("검토 대상", "Review target")}
          <select value={choice.id} onChange={event => onSelect(event.target.value)}>
            {candidates.filter(row => row.kind === choice.kind).map(row => <option key={row.id} value={row.id}>{row.prefill.actionTarget || row.target}</option>)}
          </select>
        </label>
      </div>
      <div className="operations-review-plan">
        <div><span>{tr("이번 기준 · 실측", "Baseline · observed")}</span><strong>{choice.prefill.baseline}</strong><small>{choice.prefill.sourcePeriod} · {choice.target}</small></div>
        <ArrowRight size={20} aria-hidden="true" />
        <div><span>{tr("다음 검토", "Next review")}</span><strong>{choice.prefill.reviewDate || "—"}</strong><small>{choice.automatic ? tr("같은 범위·같은 길이의 새 데이터", "New data for the same scope and duration") : tr("선택 대상의 새 데이터로 재분석", "Reanalyze new data for this target")}</small></div>
      </div>
      <div className="operations-review-action"><strong>{tr("검토할 변경", "Change to review")}</strong>
        {choice.actionLines?.length ? <ul>{choice.actionLines.map(line => <li key={line}>{line}</li>)}</ul> : <p>{choice.prefill.action}</p>}
      </div>
      <p className="operations-review-question">{choice.prefill.reviewQuestion}</p>
      {isDemo ? <div className="operations-review-demo" role="status">
        <strong>{tr("데모에서는 검토 계획을 미리 봅니다", "Previewing the review plan in the demo")}</strong>
        <p>{tr("예시 결과는 저장되지 않습니다. 내 파일의 결정 저장은 로그인과 Pro(7일 체험 포함)가 필요하며, 분석은 무료입니다.", "Sample results are not saved. Saving your own decisions requires sign-in and Pro, including the 7-day trial. Analysis is free.")}</p>
      </div> : <DecisionReview key={choice.id} toolId={OPERATIONS_TOOL_ID} locale={locale}
        sourcePath={OPERATIONS_PATH} analyticsPlacement="operations_weekly_review"
        decisionPrefill={choice.prefill} decisionPrefillKey={JSON.stringify(choice.prefill)} allowAutomaticComparison={choice.automatic}
        analysisEvidence={buildReviewEvidence({ headline: choice.prefill.conclusion, points: [{ text: choice.prefill.action }, { text: choice.prefill.reviewQuestion }],
          stats: [{ label: `${choice.prefill.metric} · ${tr("실측 기준", "Observed baseline")}`, value: choice.prefill.baseline }],
          scope: { dateStart: periods.current.start, dateEnd: periods.current.end, comparisonStart: periods.previous.start, comparisonEnd: periods.previous.end,
            currency, metric: choice.prefill.metric, campaign: choice.kind === "campaign" ? choice.target : undefined }, analysisType: "operations", resultState: "ready" })} />}
    </>}
  </section>;
}
