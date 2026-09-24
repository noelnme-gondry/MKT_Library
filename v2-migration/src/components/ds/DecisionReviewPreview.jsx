"use client";
import Link from "next/link";
import { trackProductEvent } from "@/lib/analytics";

// 예시 데이터 결과의 '다음 검토 약속' 자리(2026-09-24 B안). 예시에서는 가짜 결정을 남기지 않으므로
// 저장 단계가 통째로 숨어 있었고, 체험한 사람은 분석 → 저장 → 재검토 루프가 있다는 것 자체를 못 봤다.
// 여기서는 저장하지 않고, 무엇이 저장되는지와 조건(로그인 + Pro, 7일 체험 포함)만 사실대로 보여 준다.
// 문장은 제품 SSOT F-01·§5.1.3에서 가져왔다 — 분석·결과 확인은 무료, 리뷰 저장은 Pro.
export default function DecisionReviewPreview({ toolId, locale = "ko" }) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const track = (action) => trackProductEvent("review_entry_clicked", { tool_id: toolId, source: "analysis_result", placement: `demo_preview_${action}`, locale });
  return (
    <section className="decision-review-preview" aria-labelledby={`decision-preview-${toolId}`}>
      <h3 id={`decision-preview-${toolId}`}>{en ? "Next: set a review date (preview)" : "다음 검토 약속 만들기 (미리보기)"}</h3>
      <p>{en
        ? "This is sample data, so nothing is saved. With your own data you can save this conclusion as a review date and check the same metric against the next period."
        : "예시 데이터라 저장하지 않습니다. 내 데이터로 분석하면 이 결론을 검토 약속으로 저장하고, 다음 기간 데이터로 같은 지표를 다시 확인합니다."}</p>
      <ul>
        <li>{en ? "Saved: the conclusion, key figures and the date to look again" : "저장되는 것: 결론 한 문장 · 핵심 수치 · 다시 볼 날짜"}</li>
        <li>{en ? "Saving needs sign-in and Pro (7-day trial included). Analysis and results stay free." : "저장은 로그인과 Pro(7일 체험 포함)가 필요합니다. 분석과 결과 확인은 무료입니다."}</li>
      </ul>
      <div className="decision-review-preview__actions">
        <Link className="btn primary" href={`${prefix}/start`} onClick={() => track("start")}>{en ? "Analyze my data" : "내 데이터로 분석하기"}</Link>
        <Link className="btn ghost" href={`${prefix}/subscription`} onClick={() => track("pro")}>{en ? "About Pro" : "Pro 안내"}</Link>
      </div>
    </section>
  );
}
