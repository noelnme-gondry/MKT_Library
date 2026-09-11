"use client";
import Link from "next/link";
import { useState } from "react";
import NewsletterSignup from "@/components/seo/NewsletterSignup";
import { trackProductEvent } from "@/lib/analytics";
export default function MobileQuickStart({ locale = "ko" }) {
  const en = locale === "en", prefix = en ? "/en" : "";
  const [message, setMessage] = useState("");
  return <section className="mobile-quick-start" aria-label={en ? "Start without a CSV" : "CSV 없이 시작"}>
    <p>{en ? "No CSV on your phone? Start here." : "폰에 CSV가 없다면 여기서 시작하세요."}</p>
    <nav aria-label={en ? "Lightweight tools" : "가볍게 시작할 도구"}>
      <Link className="btn" href={`${prefix}/calculator`}>{en ? "Calculators" : "계산기"}</Link>
      <Link className="btn" href={`${prefix}/diagnose`}>{en ? "Diagnose" : "간단 진단"}</Link>
      <Link className="btn" href={`${prefix}/templates`}>{en ? "Templates" : "템플릿"}</Link>
      <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}`); setMessage(en ? "Page link copied. Open it on your PC; CSVs are not transferred." : "페이지 링크를 복사했습니다. PC에서 열어 주세요. CSV는 전달되지 않습니다."); trackProductEvent("continue_on_desktop", { locale, source: "mobile", data_continuity: "page_link_only" }); } catch { setMessage(en ? "Copy this page's address and open it on your PC." : "주소창의 페이지 주소를 복사해 PC에서 열어 주세요."); } }}>{en ? "Continue on PC" : "PC에서 이어하기"}</button>
    </nav>
    <details><summary>{en ? "Get new articles by email" : "새 글 이메일로 받기"}</summary><NewsletterSignup locale={locale} source="mobile" placement="quick_start" /></details>
    {message && <p role="status">{message}</p>}
  </section>;
}
