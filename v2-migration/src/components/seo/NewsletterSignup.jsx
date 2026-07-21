"use client";

import Link from "next/link";
import { useState } from "react";
import { trackProductEvent } from "@/lib/analytics";

const FORM_ACTION = "https://buttondown.com/api/emails/embed-subscribe/noelnme";

export default function NewsletterSignup({ locale = "ko", placement = "post" }) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const isEnglish = locale === "en";
  const copy = isEnglish
    ? {
        eyebrow: "NEW POSTS, NO NOISE",
        title: "Get the next practical note by email.",
        description: "New Growth Opt Playbook articles and analysis notes. No CSV or analysis result is ever included.",
        email: "Email address",
        consent: "I agree to receive marketing emails about new articles and analysis insights. I can unsubscribe anytime.",
        submit: "Subscribe",
        submitted: "Check your inbox to complete the subscription.",
        privacy: "Privacy policy",
      }
    : {
        eyebrow: "NEW POSTS, NO NOISE",
        title: "다음 실무 노트를 이메일로 받으세요.",
        description: "새 블로그 글과 분석 인사이트만 보냅니다. CSV·분석 결과는 이메일로 전송하지 않습니다.",
        email: "이메일 주소",
        consent: "새 글·분석 인사이트 등 광고성 이메일 수신에 동의합니다. 언제든 수신 거부할 수 있습니다.",
        submit: "구독하기",
        submitted: "받은편지함에서 확인 메일을 열어 구독을 완료해 주세요.",
        privacy: "개인정보처리방침",
      };
  const privacyHref = isEnglish ? "/privacy" : "/privacy";
  const sourceTag = `blog-${locale}-${placement}`;

  function handleSubmit() {
    setIsSubmitted(true);
    trackProductEvent("newsletter_submit", { source: "blog", locale, placement });
  }

  return (
    <section className="newsletter-signup" aria-label={isEnglish ? "Newsletter subscription" : "블로그 이메일 구독"}>
      <div className="newsletter-signup__copy">
        <span className="newsletter-signup__eyebrow">{copy.eyebrow}</span>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>
      <form action={FORM_ACTION} method="post" target="buttondown-subscribe-frame" onSubmit={handleSubmit} className="newsletter-signup__form">
        <input type="hidden" name="embed" value="1" />
        <input type="hidden" name="tag" value="growthopt-blog" />
        <input type="hidden" name="tag" value={sourceTag} />
        <input type="hidden" name="tag" value="marketing-consent-v1" />
        <input type="hidden" name="metadata__consent_version" value="2026-07-21" />
        <label className="newsletter-signup__email">
          <span className="sr-only">{copy.email}</span>
          <input name="email" type="email" autoComplete="email" required placeholder={copy.email} />
          <button type="submit">{copy.submit}</button>
        </label>
        <label className="newsletter-signup__consent">
          <input name="metadata__marketing_consent" type="checkbox" value="yes" required />
          <span>{copy.consent}</span>
        </label>
        <p className="newsletter-signup__privacy">
          <Link href={privacyHref}>{copy.privacy}</Link>
        </p>
        {isSubmitted && <p className="newsletter-signup__success" role="status">{copy.submitted}</p>}
      </form>
      <iframe className="newsletter-signup__frame" name="buttondown-subscribe-frame" title="Buttondown subscription response" />
    </section>
  );
}
