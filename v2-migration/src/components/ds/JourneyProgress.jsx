"use client";

import Link from "next/link";
import { trackProductEvent } from "@/lib/analytics";

const STEPS = [
  { id: "prepare", ko: "데이터 준비", en: "Prepare data" },
  { id: "analyze", ko: "분석 근거", en: "Read evidence" },
  { id: "decide", ko: "결정 저장", en: "Save a decision" },
  { id: "review", ko: "다음 리뷰", en: "Review outcomes" },
];

// 현재 위치만 표시한다. 링크를 방문했다고 이전 과업을 완료 처리하지 않는다.
export default function JourneyProgress({ stage, locale = "ko", placement = "workspace" }) {
  const en = locale === "en";
  return <nav className="journey-progress" aria-label={en ? "From analysis to the next review" : "분석부터 다음 리뷰까지"}>
    <ol>{STEPS.map((step, index) => <li key={step.id} aria-current={stage === step.id ? "step" : undefined}>
      <span aria-hidden="true">{index + 1}</span>
      {step.id === "review" && stage !== "review" ? <Link href={`${en ? "/en" : ""}/weekly-review`} onClick={() => trackProductEvent("review_entry_clicked", { source: "journey", placement, locale })}>{step[en ? "en" : "ko"]}</Link> : <strong>{step[en ? "en" : "ko"]}</strong>}
    </li>)}</ol>
  </nav>;
}
