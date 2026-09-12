"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ModalDialog from "@/components/ds/ModalDialog";
import SubscriptionTrialOffer from "./SubscriptionTrialOffer";
import { useAppStore } from "@/store/useDataStore";
import { SUBSCRIPTION } from "@/lib/subscription/entitlement";
import { trackProductEvent } from "@/lib/analytics";

export default function SubscriptionPurchasePrompt() {
  const prompt = useAppStore(state => state.purchasePrompt);
  const [availability, setAvailability] = useState("loading");
  const [reasonPrompt, setReasonPrompt] = useState(null);
  useEffect(() => {
    if (!prompt) return;
    let active = true;
    fetch("/api/payments/config", { cache: "no-store" }).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(config => { if (active) setAvailability(config.enabled ? "ready" : "unavailable"); }).catch(() => { if (active) setAvailability("unavailable"); });
    return () => { active = false; };
  }, [prompt]);
  const en = prompt?.locale === "en";
  const close = () => useAppStore.setState({ purchasePrompt: null });
  return <ModalDialog open={Boolean(prompt)} onClose={close} ariaLabel={en ? "Take your analysis into your next meeting" : "분석을 다음 회의에서 바로 쓰세요"} overlayClassName="purchase-dialog-overlay" panelClassName="purchase-dialog">
    <button className="btn ghost purchase-dialog-close" type="button" onClick={close}>{en ? "Close" : "닫기"}</button>
    <h2>{en ? "Reports you can use and edit" : "전달하고 다시 계산할 수 있는 보고서"}</h2>
    <p>{en ? "Keep the conclusion, supporting evidence, and next actions together." : "결론과 근거, 다음 행동을 한 번에 정리해 가져가세요."}</p>
    <p>{en ? "Analysis downloads require an active purchased pass. Sign-in and the 14-day trial do not unlock downloads." : "분석자료 다운로드는 유효한 구매 이용권이 필요합니다. 로그인·14일 체험만으로는 다운로드할 수 없습니다."}</p>
    <ul><li><strong>Word</strong> — {en ? "Meeting-ready conclusions, evidence tables, charts and limitations" : "회의용 결론·근거 표·차트·해석 한계"}</li><li><strong>Excel</strong> — {en ? "Source rows, mappings, calculation sheets and editable charts" : "원본·매핑·계산 시트·편집 가능한 차트"}</li></ul>
    <p>{en ? `KRW ${SUBSCRIPTION.monthlyKrw.toLocaleString("en-US")} for one month. No automatic renewal.` : `1개월 ${SUBSCRIPTION.monthlyKrw.toLocaleString("ko-KR")}원 · 자동 갱신 없음`}</p>
    <SubscriptionTrialOffer locale={en ? "en" : "ko"} onNavigate={close} />
    {availability === "unavailable" && <p role="status">{en ? "Purchases are currently unavailable. You can continue your analysis or contact support." : "지금은 구매할 수 없습니다. 분석은 계속할 수 있으며 구매 관련 사항은 고객센터로 문의해 주세요."}</p>}
    <Link className="btn primary" href={availability === "unavailable" ? (en ? "/en/subscription#report-preview-title" : "/subscription#report-preview-title") : (en ? "/en/subscription#purchase" : "/subscription#purchase")} onClick={close}>{availability === "unavailable" ? (en ? "View free sample reports" : "무료 샘플 보고서 보기") : (en ? "View the pass and purchase" : "이용권 확인하고 구매")}</Link>
    <p>{en ? "When you pay, this browser temporarily saves your current work before opening the payment window." : "결제 실행 시 현재 작업을 이 브라우저에 임시 보관한 뒤 결제창을 엽니다."}</p>
    <details><summary>{en ? "Not ready to purchase? (optional)" : "구매를 보류하는 이유가 있나요? (선택)"}</summary><div className="purchase-reasons">{["price", "identity", "trust", "refund", "later"].map((reason, index) => <button className="btn ghost" type="button" key={reason} disabled={reasonPrompt === prompt} onClick={() => { trackProductEvent("subscription_gate_reason", { tool_id: prompt?.toolId, locale: en ? "en" : "ko", gate_reason: reason, source: "purchase_prompt" }); setReasonPrompt(prompt); }}>{(en ? ["Price", "Account requirements", "Need more confidence", "Refund terms", "Not now"] : ["가격", "계정 요구", "신뢰·효용 확인", "환불 조건", "지금은 아님"])[index]}</button>)}</div>{reasonPrompt === prompt && <p role="status">{en ? "Thank you for your feedback. You can close this window and continue your analysis." : "의견 감사합니다. 이 창을 닫고 분석을 계속할 수 있습니다."}</p>}</details>
    <p className="purchase-dialog-note">{en ? "Analysis stays free. Report generation happens in your browser; source data is not uploaded." : "분석은 계속 무료입니다. 보고서는 브라우저에서 생성하며 원본을 서버에 보내지 않습니다."}</p>
  </ModalDialog>;
}
