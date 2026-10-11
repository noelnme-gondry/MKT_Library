"use client";

import Link from "next/link";
import { trackProductEvent } from "@/lib/analytics";

const STEPS = [
  { id: "prepare", ko: "데이터 준비", en: "Prepare data" },
  { id: "analyze", ko: "분석 근거", en: "Read evidence" },
  { id: "decide", ko: "결정 저장", en: "Save a decision" },
  { id: "review", ko: "다음 리뷰", en: "Review outcomes" },
];

// 현재 위치와, 호출부가 사실로 아는 완료만 표시한다. 링크를 방문했다고 이전 과업을
// 완료 처리하지 않는다 — 완료는 `completed`로 넘긴 단계(예: 데이터가 실제로 올라와 있음)뿐이다.
// 네 단계는 하나의 구획된 진행 면이다. 이동 가능한 리뷰에만 링크를 둔다.
export default function JourneyProgress({ stage, locale = "ko", placement = "workspace", completed = [] }) {
  const en = locale === "en";
  const done = new Set(completed);
  return <nav className="journey-progress" aria-label={en ? "From analysis to the next review" : "분석부터 다음 리뷰까지"}>
    <ol>{STEPS.map((step, index) => {
      const isDone = done.has(step.id) && step.id !== stage;
      const label = step[en ? "en" : "ko"];
      return <li key={step.id} className={isDone ? "is-done" : undefined} aria-current={stage === step.id ? "step" : undefined}>
        <span className="journey-progress__num" aria-hidden="true">{isDone ? "✓" : index + 1}</span>
        {isDone && <span className="sr-only">{en ? "Done: " : "완료: "}</span>}
        {step.id === "review" && stage !== "review" && placement !== "weekly_review" ? <Link href={`${en ? "/en" : ""}/weekly-review`} onClick={() => trackProductEvent("review_entry_clicked", { source: "journey", placement, locale })}>{label}</Link> : <span className="journey-progress__label">{label}</span>}
      </li>;
    })}</ol>
  </nav>;
}
