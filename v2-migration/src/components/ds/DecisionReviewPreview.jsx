"use client";
import Link from "next/link";
import { CalendarClock, FileChartColumn, BookmarkCheck, ArrowRight } from "lucide-react";
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
    <section className="decision-review-preview" data-design-exempt="nested: user-requested next-period review grouping" aria-labelledby={`decision-preview-${toolId}`}>
      <header className="decision-review-preview__head">
        <CalendarClock size={22} aria-hidden="true" />
        <h3 id={`decision-preview-${toolId}`}>{en ? "Review this decision next period" : "다음 기간 결과와 비교하기"}</h3>
      </header>
      <ol className="decision-review-preview__steps" aria-label={en ? "Review workflow" : "검토 순서"}>
        {[
          { icon: FileChartColumn, title: en ? "Analyze your data" : "내 데이터 분석", detail: en ? "Analysis is free" : "분석은 무료" },
          { icon: BookmarkCheck, title: en ? "Save the decision" : "판단 저장", detail: en ? "Conclusion, key figures, review date" : "결론·핵심 수치·검토일" },
          { icon: CalendarClock, title: en ? "Review next period" : "다음 기간 검토", detail: en ? "Compare with the next result" : "다음 분석 결과와 비교" },
        ].map(({ icon: Icon, title, detail }, index) => (
          <li key={title}>
            <Icon size={20} aria-hidden="true" />
            <div><strong>{title}</strong><span>{detail}</span></div>
            {index < 2 && <ArrowRight className="decision-review-preview__arrow" size={16} aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <div className="decision-review-preview__footer">
        <div>
          <p>{en ? "Sample results are not saved." : "예시 결과는 저장되지 않습니다."}</p>
          <p className="decision-review-preview__terms">{en ? "Saving requires sign-in and Pro, including the 7-day trial. Analysis is free." : "저장은 로그인과 Pro(7일 체험 포함)가 필요합니다. 분석은 무료입니다."}</p>
        </div>
        <div className="decision-review-preview__actions">
          <Link className="btn primary" href={`${prefix}/start`} onClick={() => track("start")}>{en ? "Analyze my data" : "내 데이터로 분석하기"}</Link>
          <Link className="btn ghost" href={`${prefix}/subscription`} onClick={() => track("pro")}>{en ? "About Pro" : "Pro 안내"}</Link>
        </div>
      </div>
    </section>
  );
}
