"use client";
import Link from "next/link";
import { useState } from "react";
import NewsletterSignup from "@/components/seo/NewsletterSignup";
import { trackProductEvent } from "@/lib/analytics";
export default function MobileQuickStart({ locale = "ko", onTrySample }) {
  const en = locale === "en", prefix = en ? "/en" : "";
  const [message, setMessage] = useState("");
  return <section className="mobile-quick-start" aria-label={en ? "Start without a CSV" : "CSV 없이 시작"}>
    <p>{en ? "See what you can learn. No CSV needed." : "CSV 없이도, 지금 결과부터 확인하세요."}</p>
    {onTrySample && <button type="button" className="btn primary mobile-quick-start__sample" onClick={onTrySample}>{en ? "Try a sample analysis" : "샘플 데이터로 분석 체험"}</button>}
    <nav aria-label={en ? "Lightweight tools" : "가볍게 시작할 도구"}>
      <Link className="btn" href={`${prefix}/calculator`}>{en ? "Calculators" : "계산기"}</Link>
      <Link className="btn" href={`${prefix}/diagnose`}>{en ? "Diagnose" : "간단 진단"}</Link>
    </nav>
    <details><summary>{en ? "Prepare your own data" : "내 데이터로 분석 준비하기"}</summary>
      <Link className="btn" href={`${prefix}/templates`}>{en ? "CSV templates" : "CSV 템플릿"}</Link>
      <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}`); setMessage(en ? "Page link copied. Open it on your PC; CSVs are not transferred." : "페이지 링크를 복사했습니다. PC에서 열어 주세요. CSV는 전달되지 않습니다."); trackProductEvent("continue_on_desktop", { locale, source: "mobile", data_continuity: "page_link_only" }); } catch { setMessage(en ? "Copy this page's address and open it on your PC." : "주소창의 페이지 주소를 복사해 PC에서 열어 주세요."); } }}>{en ? "Continue on PC" : "PC에서 이어하기"}</button>
    </details>
    <details><summary>{en ? "Get new articles by email" : "새 글 이메일로 받기"}</summary><NewsletterSignup locale={locale} source="mobile" placement="quick_start" /></details>
    {message && <p role="status">{message}</p>}
  </section>;
}
