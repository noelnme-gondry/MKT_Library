"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ProjectStorageSummary from "./ProjectStorageSummary";
import SellerInformation from "./SellerInformation";
import SubscriptionCheckout from "./SubscriptionCheckout";
import { useAppStore } from "@/store/useDataStore";
import { trackProductEvent } from "@/lib/analytics";
import { SUBSCRIPTION, validateLicense, hasPaidAccess } from "@/lib/subscription/entitlement";

export default function SubscriptionPage({ locale = "ko" }) {
  const en = locale === "en";
  const reason = useAppStore(state => state.upgradeReason);
  const entitlement = useAppStore(state => state.entitlement);
  const setEntitlement = useAppStore(state => state.setEntitlement);
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
    <header><h1>{en ? "Weekly Review subscription" : "주간 리뷰 구독 안내"}</h1><p>{en ? "Keep weekly reviews for multiple projects together, prepare batch reports, and add your branding. Review the plan, storage limits, and refund policy below." : "여러 프로젝트의 주간 리뷰를 모아 관리하고, 일괄 보고서와 브랜드 맞춤 보고서를 만드세요. 이용 요금·저장 한도·환불 기준을 아래에서 확인할 수 있습니다."}</p><a href="#refund-policy">{en ? "Read the refund policy" : "환불정책 보기"}</a></header>
    <section><h2>{en ? "Analyze for free. Take a report to your next meeting." : "분석은 무료로, 보고서는 다음 회의까지."}</h2><p>{en ? "All analysis tools and one project remain free. Reading saved decisions and exporting your project backup remain available after a pass expires. Analysis report downloads require an active pass." : "모든 분석 도구와 프로젝트 1개는 무료입니다. 저장한 결정 읽기와 프로젝트 백업 내보내기는 이용권 만료 후에도 가능합니다. 분석 보고서 다운로드는 이용권으로 제공합니다."}</p></section>
    <section id="purchase"><h2>{en ? "One-month report pass · KRW 5,900" : "1개월 보고서 이용권 · 5,900원"}</h2><p>{en ? "Word analysis reports, Excel workbooks, multiple projects, batch reviews and report branding. Browser storage limits still apply." : "Word 분석 보고서, Excel 계산 워크북, 여러 프로젝트 관리, 일괄 리뷰와 보고서 브랜딩을 제공합니다. 브라우저 저장 한도는 계속 적용됩니다."}</p>
      <div className="subscription-deliverables">
        <article><span aria-hidden="true">W</span><h3>{en ? "A report you can present" : "바로 설명할 수 있는 Word"}</h3><p>{en ? "Conclusion → key results → evidence → charts → method and limitations. Edit the document for your team." : "결론 → 핵심 수치 → 근거 → 차트 → 분석 방법과 한계. 팀에 맞게 문서를 편집하세요."}</p></article>
        <article><span aria-hidden="true">X</span><h3>{en ? "A workbook you can inspect" : "계산을 확인할 수 있는 Excel"}</h3><p>{en ? "Source rows, mappings, scope, calculation sheets and editable chart data. Model estimates remain explicitly labelled engine outputs." : "원본 행·매핑·분석 범위·계산 시트와 편집 가능한 차트 데이터. 모델 추정값은 엔진 산출물로 구분합니다."}</p></article>
      </div>
      <p>{en ? "One calendar month from payment, without automatic renewal. Complex statistical models must be refitted on the website; changing raw workbook cells does not rerun preprocessing or model estimation." : "결제일부터 1개월이며 자동 갱신되지 않습니다. 복잡한 통계 모델은 사이트에서 다시 추정해야 하며, Excel 원본 셀 수정만으로 전처리·모델 추정이 다시 실행되지는 않습니다."}</p>
      <p><Link href={en ? "/en/terms" : "/terms"}>{en ? "Terms" : "이용약관"}</Link> · <a href="#refund-policy">{en ? "Refund policy" : "환불정책"}</a></p>
      <SubscriptionCheckout locale={locale} />
    </section>
    {Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) && <section><h2>{en ? "Already have a license key?" : "전달받은 라이선스 키가 있나요?"}</h2><p>{en ? "Manual one-month licenses, no account required. Verification sends only a key hash. CSVs, project names, and branding never enter this request. A key works across devices; projects do not automatically sync." : "계정 없이 수동으로 전달받은 1개월 키를 사용합니다. 검증 요청에는 키 해시만 전송하며 CSV·프로젝트명·브랜딩은 보내지 않습니다. 여러 기기에서 키를 사용할 수 있지만 프로젝트가 자동 동기화되지는 않습니다."}</p>
      <label className="wr-field">{en ? "License key" : "라이선스 키"}<input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} maxLength={200} /></label><button type="button" className="btn" disabled={busy || !key.trim()} onClick={activate}>{en ? "Verify key" : "키 확인"}</button>
      {status && <p role="status">{messages[status]}</p>}
      {hasPaidAccess(entitlement, now) && <p>{en ? "Valid until" : "키 만료일"}: {new Date(entitlement.expiresAt).toLocaleDateString(en ? "en-US" : "ko-KR")}{entitlement.expiresAt - now < 7 * 86400000 ? (en ? " · Expires within 7 days; contact us to renew." : " · 7일 안에 만료됩니다. 연장은 문의해 주세요.") : ""}</p>}
    </section>}
    <section id="refund-policy" aria-labelledby="refund-policy-title">
      <h2 id="refund-policy-title">{en ? "Refund policy" : "환불정책"}</h2>
      <p>{en ? "Applies to the Growth Opt Playbook KRW 5,900 one-month pass. Updated September 9, 2026." : "Growth Opt Playbook 5,900원 1개월 이용권에 적용됩니다. 최종 업데이트: 2026년 9월 9일."}</p>
      <h3>{en ? "1. Full refund within 7 days" : "1. 결제 후 7일 이내 전액 환불"}</h3>
      <p>{en ? "Request a full refund within 7 days of payment, regardless of whether you have used the paid features or downloaded reports." : "결제 후 7일 이내에 환불을 요청하면 유료 기능 사용 여부나 보고서 다운로드 여부와 관계없이 결제 금액 전액을 환불합니다."}</p>
      <h3>{en ? "2. Prorated refund after 7 days" : "2. 7일 경과 후 남은 기간 환불"}</h3>
      <p>{en ? "During the remaining paid term, you can request a refund for unused days. Refund = amount actually paid × unused days ÷ total days in your purchased term, rounded up to the nearest KRW. Dates follow Korea Standard Time; the request date counts as unused. Processing delays do not reduce your refund. No cancellation penalty or payment processing fee is deducted." : "이용 기간이 남아 있다면 미사용 기간에 대해 일할 환불을 요청할 수 있습니다. 환불액은 ‘실제 결제 금액 × 미사용 일수 ÷ 구매한 전체 이용 일수’로 계산하고, 원 미만 금액은 올림합니다. 날짜는 한국 표준시를 기준으로 하며 요청일은 미사용 일수에 포함합니다. 처리 지연 기간은 사용일로 추가하지 않습니다. 위약금이나 결제 수수료는 차감하지 않습니다."}</p>
      <p>{en ? "Example: for a 30-day term costing KRW 5,900 with 15 unused days, the refund is KRW 2,950. Your actual term may have a different number of days." : "계산 예시: 전체 이용 기간이 30일이고 15일이 남았다면 5,900원 × 15 ÷ 30 = 2,950원입니다. 실제 이용 기간의 일수에 따라 환불액은 달라집니다."}</p>
      <h3>{en ? "3. How to request a refund" : "3. 환불 신청 방법"}</h3>
      <p><Link href={en ? "/en/contact" : "/contact"}>{en ? "Contact us by email" : "문의 페이지의 이메일"}</Link>{en ? " with the subject ‘Refund request’, your order number or payment date and amount, and a reply address. If you cannot find the order number, provide the payment date and amount so we can help locate it. A reason is optional. Do not send CSV files, analysis data, full card numbers, or passwords." : "로 제목에 ‘환불 요청’을 적어 보내 주세요. 주문번호 또는 결제일·결제 금액과 답변받을 연락처를 알려 주세요. 주문번호를 찾기 어렵다면 결제일과 금액을 바탕으로 확인을 도와드립니다. 환불 사유는 선택 사항입니다. CSV·분석 데이터·카드번호 전체·비밀번호는 보내지 마세요."}</p>
      <h3>{en ? "4. Processing and access" : "4. 처리 기한과 이용 권한"}</h3>
      <p>{en ? "We process refunds within 3 business days of your request and request cancellation through the original payment method without delay. Your card issuer or payment provider may take additional time to display the credit. Paid features end when the refund is processed. Existing projects remain readable and exportable under the same device storage policy; a refund itself does not delete your data." : "환불 요청일로부터 3영업일 이내에 환급을 처리하고, 원래 결제한 수단으로 지체 없이 결제 취소를 요청합니다. 카드사·결제수단에 따라 실제 환급 내역 반영에는 추가 시간이 걸릴 수 있습니다. 환불 처리 시 유료 기능 이용 권한은 종료됩니다. 기존 프로젝트 열기·내보내기는 같은 기기 보관 정책 아래 계속 가능하며, 환불 자체를 이유로 데이터를 삭제하지 않습니다."}</p>
      <h3>{en ? "5. Service problems and statutory rights" : "5. 서비스 문제와 법정 권리"}</h3>
      <p>{en ? "For duplicate charges, unavailable paid features, or services differing from their description or contract, we provide refunds and other remedies required by applicable law. The 7-day and prorated rules above do not limit statutory withdrawal rights, defect remedies, or compensation. Mandatory consumer protections prevail if they are more favorable to you. Later policy changes do not reduce the refund rights attached to an existing purchase." : "중복 결제, 유료 기능 제공 불가, 표시·광고 또는 계약 내용과 다른 서비스 제공은 관계 법령에 따른 환불과 필요한 조치의 대상입니다. 위 7일·일할 환불 기준은 법정 청약철회, 하자에 따른 환불이나 손해배상 권리를 제한하지 않습니다. 관계 법령에서 더 유리한 소비자 보호 기준을 정한 경우 그 기준을 우선 적용합니다. 정책이 변경되어도 이미 구매한 이용권의 환불 권리를 불리하게 변경하지 않습니다."}</p>
    </section>
    <ProjectStorageSummary locale={locale} />
    <SellerInformation locale={locale} />
    <Link className="btn" href={en ? "/en/projects" : "/projects"}>{en ? "Open projects" : "프로젝트 보관함 열기"}</Link>
  </div>;
}
