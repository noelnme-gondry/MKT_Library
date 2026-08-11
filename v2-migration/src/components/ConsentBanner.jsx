"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { applyConsent, looksEeaVisitor, readStoredConsent, writeStoredConsent } from "@/lib/consent";

// EEA/UK 방문자용 동의 배너. 법적 차단(기본 거부)은 Consent Mode의 region 기본값이
// 이미 처리하므로, 이 배너는 "거부 상태를 해제할 기회"를 주는 역할이다.
// KR 등 비EEA 방문자에게는 노출하지 않는다(불필요한 마찰 방지).
const COPY = {
  ko: {
    text: "분석·광고 쿠키 사용에 동의하시나요? 거부해도 도구는 그대로 쓸 수 있습니다.",
    accept: "동의",
    reject: "거부",
    privacy: "개인정보처리방침",
    aria: "쿠키 동의",
  },
  en: {
    text: "Allow analytics and advertising cookies? The tools work either way.",
    accept: "Accept",
    reject: "Reject",
    privacy: "Privacy",
    aria: "Cookie consent",
  },
};

export default function ConsentBanner({ locale = "ko" }) {
  const [visible, setVisible] = useState(false);
  const t = COPY[locale === "en" ? "en" : "ko"];

  useEffect(() => {
    if (readStoredConsent()) return; // 이미 선택함
    let timeZone = "";
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      timeZone = "";
    }
    const language = typeof navigator !== "undefined" ? navigator.language : "";
    // 타임존·언어는 서버 렌더에서 알 수 없어 마운트 후에만 판정할 수 있다(1회, 조건부).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (looksEeaVisitor(timeZone, language)) setVisible(true);
  }, []);

  if (!visible) return null;

  const choose = (value) => {
    writeStoredConsent(value);
    applyConsent(value);
    setVisible(false);
  };

  return (
    <div className="consent-banner" role="dialog" aria-label={t.aria} aria-live="polite">
      <p className="consent-banner__text">
        {t.text}{" "}
        <Link href={locale === "en" ? "/en/privacy" : "/privacy"}>{t.privacy}</Link>
      </p>
      <div className="consent-banner__actions">
        <button type="button" className="btn small" onClick={() => choose("denied")}>{t.reject}</button>
        <button type="button" className="btn small primary" onClick={() => choose("granted")}>{t.accept}</button>
      </div>
    </div>
  );
}
