"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ProjectStorageSummary from "./ProjectStorageSummary";
import { useAppStore } from "@/store/useDataStore";
import { trackProductEvent } from "@/lib/analytics";
import { SUBSCRIPTION, validateLicense, hasPaidAccess } from "@/lib/subscription/entitlement";

export default function SubscriptionPage({ locale = "ko" }) {
  const en = locale === "en";
  const reason = useAppStore(state => state.upgradeReason);
  const entitlement = useAppStore(state => state.entitlement);
  const setEntitlement = useAppStore(state => state.setEntitlement);
  const [interested, setInterested] = useState(false);
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const [busy, setBusy] = useState(false);
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackProductEvent("subscription_viewed", { locale, source: "subscription_page" });
    if (reason) {
      trackProductEvent("subscription_gate_viewed", { locale, source: reason });
      useAppStore.setState({ upgradeReason: null });
    }
  }, [locale, reason]);
  const interest = () => {
    if (!interested) trackProductEvent("subscription_interest_clicked", { locale, source: "subscription_page", state: "monthly_5900" });
    setInterested(true);
  };
  const activate = async () => {
    setBusy(true);
    try {
      const result = await validateLicense(key, entitlement);
      setEntitlement(result.entitlement);
      try {
        if (result.entitlement) localStorage.setItem(SUBSCRIPTION.cacheKey, JSON.stringify(result.entitlement));
        else localStorage.removeItem(SUBSCRIPTION.cacheKey);
      } catch { /* 저장 차단 시 세션에서만 사용 */ }
      setStatus(result.status);
      setKey("");
    } catch { setStatus("offline"); } finally { setBusy(false); }
  };
  const messages = en ? { valid: "License verified.", invalid: "This key is unavailable, expired, or revoked.", offline: "Could not reach license verification. An eligible cached license remains usable for its grace period.", not_configured: "License activation is not available yet. No payment is being collected." } : { valid: "키를 확인했습니다.", invalid: "사용할 수 없거나 만료·회수된 키입니다.", offline: "키 검증에 연결하지 못했습니다. 유효한 캐시가 있으면 유예기간 동안 계속 사용할 수 있습니다.", not_configured: "키 등록은 아직 준비 중입니다. 현재 결제를 받지 않습니다." };
  return <div className="projects-page subscription-page">
    <header><h1>{en ? "Weekly Review subscription" : "주간 리뷰 구독 안내"}</h1><p>{en ? "We are checking interest in a KRW 5,900/month plan. No payments, automatic renewals, or subscriptions are created on this page." : "월 5,900원 구독에 대한 관심을 확인하고 있습니다. 지금은 결제·자동 갱신·구독 신청이 이루어지지 않습니다."}</p></header>
    <section><h2>{en ? "What stays free" : "무료로 계속 사용하는 것"}</h2><p>{en ? "All analysis tools, one project, and single-project weekly reports. Existing projects remain accessible and exportable if your license expires, subject to the same device retention policy." : "모든 분석 도구, 프로젝트 1개, 단일 프로젝트 주간 보고서는 무료입니다. 키가 만료돼도 기존 프로젝트 열기·내보내기는 계속 가능하며, 기기 보관 정책은 동일하게 적용됩니다."}</p></section>
    <section><h2>{en ? "Planned paid plan · KRW 5,900/month" : "구독 예정 요금 · 월 5,900원"}</h2><p>{en ? "More projects, batch reports, and your report logo, company name, and footer. No project-count cap with a valid key; browser and app storage limits still apply." : "여러 프로젝트 관리, 일괄 보고서, 보고서 로고·회사명·푸터를 제공합니다. 유효한 키가 있으면 프로젝트 개수 제한은 없지만 브라우저·앱 저장 한도는 적용됩니다."}</p>
      <button className="btn primary" type="button" onClick={interest} disabled={interested}>{interested ? (en ? "Interest noted on this screen" : "이 화면에서 관심 표시 완료") : (en ? "I'm interested at KRW 5,900/month" : "월 5,900원 구독에 관심 있어요")}</button>
      {interested && <p role="status">{en ? "Thank you. This is not a reservation or payment. Analytics records an interest event only when allowed. To discuss a pilot, contact us; CSV files are not needed." : "감사합니다. 예약이나 결제가 아닙니다. 허용된 경우에만 관심 이벤트를 기록합니다. 파일럿 참여를 논의하려면 문의해 주세요. CSV 파일을 보낼 필요는 없습니다."} <Link href={en ? "/en/contact" : "/contact"}>{en ? "Pilot enquiry" : "파일럿 문의"}</Link></p>}
    </section>
    {Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) && <section><h2>{en ? "Already have a license key?" : "전달받은 라이선스 키가 있나요?"}</h2><p>{en ? "Manual one-month licenses, no account required. Verification sends only a key hash. CSVs, project names, and branding never enter this request. A key works across devices; projects do not automatically sync." : "계정 없이 수동으로 전달받은 1개월 키를 사용합니다. 검증 요청에는 키 해시만 전송하며 CSV·프로젝트명·브랜딩은 보내지 않습니다. 여러 기기에서 키를 사용할 수 있지만 프로젝트가 자동 동기화되지는 않습니다."}</p>
      <label className="wr-field">{en ? "License key" : "라이선스 키"}<input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} maxLength={200} /></label><button type="button" className="btn" disabled={busy || !key.trim()} onClick={activate}>{en ? "Verify key" : "키 확인"}</button>
      {status && <p role="status">{messages[status]}</p>}
      {hasPaidAccess(entitlement, now) && <p>{en ? "Valid until" : "키 만료일"}: {new Date(entitlement.expiresAt).toLocaleDateString(en ? "en-US" : "ko-KR")}{entitlement.expiresAt - now < 7 * 86400000 ? (en ? " · Expires within 7 days; contact us to renew." : " · 7일 안에 만료됩니다. 연장은 문의해 주세요.") : ""}</p>}
    </section>}
    <ProjectStorageSummary locale={locale} />
    <Link className="btn" href={en ? "/en/projects" : "/projects"}>{en ? "Open projects" : "프로젝트 보관함 열기"}</Link>
  </div>;
}
