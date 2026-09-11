"use client";
import PassRecoveryHelp from "./PassRecoveryHelp";
import { readPaymentReturn } from "@/lib/subscription/paymentReturnPath";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveCheckoutSnapshot, restoreCheckoutSnapshot } from "@/lib/subscription/checkoutSnapshot";
import { SUBSCRIPTION } from "@/lib/subscription/entitlement";
import { refreshAccount } from "@/lib/account/accountClient";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
import { rememberPaymentAccess } from "@/lib/subscription/paymentClient";
import { trackProductEvent } from "@/lib/analytics";
import { trackPaymentEvent, paymentFailureEvent } from "@/lib/subscription/paymentAnalytics";
import { downloadFile } from "@/utils/download";

let sdkPromise;
function loadSdk() {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  sdkPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v2/standard";
    script.onload = () => resolve(window.TossPayments);
    script.onerror = () => { sdkPromise = null; script.remove(); reject(new Error("SDK_UNAVAILABLE")); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
async function jsonRequest(path, body) {
  const response = await fetch(`/api/payments/${path}`, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(response.status === 429 ? "RATE_LIMITED" : "PAYMENT_UNAVAILABLE");
  return response.json();
}
export default function SubscriptionCheckout({ locale = "ko" }) {
  const en = locale === "en";
  const router = useRouter();
  const entitlement = useAppStore(state => state.entitlement);
  const paid = hasPaidAccess(entitlement) && !entitlement?.trial;
  const [returnPath, setReturnPath] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) setReturnPath(readPaymentReturn()); });
    return () => { active = false; };
  }, []);
  const [config, setConfig] = useState(null);
  const [checkoutAccount, setCheckoutAccount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [returnStatus, setReturnStatus] = useState(null);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [restoreCode, setRestoreCode] = useState("");
  const widgets = useRef(null);
  const order = useRef(null);
  const confirming = useRef(false);
  const autoPrepared = useRef(false);
  const preparing = useRef(false);
  useEffect(() => { jsonRequest("config").then(setConfig).catch(() => setConfig({ enabled: false })); }, []);
  useEffect(() => {
    if (!config?.requiresAccount) return;
    let active = true;
    const refresh = async () => { try { const result = await refreshAccount(); if (active) setCheckoutAccount(result.account); } catch { if (active) setCheckoutAccount(null); } };
    const onMessage = event => { if (event.origin === location.origin && event.data?.type === "gop-account-ready") refresh(); };
    refresh(); window.addEventListener("focus", refresh); window.addEventListener("message", onMessage);
    return () => { active = false; window.removeEventListener("focus", refresh); window.removeEventListener("message", onMessage); };
  }, [config?.requiresAccount]);
  const confirm = useCallback(async () => {
    if (confirming.current) return;
    confirming.current = true; setBusy(true);
    try {
      const result = await jsonRequest("confirm", {});
      rememberPaymentAccess(result.entitlement); setRecoveryCode(result.recoveryCode);
      trackPaymentEvent("purchase", { locale, mode: result.mode, transaction: result.transaction });
      setMessage(en ? "Payment confirmed. Your report pass is active. Save your recovery code before leaving this page." : "결제를 확인했습니다. 보고서 이용권이 활성화되었습니다. 이 화면을 떠나기 전에 복원 코드를 보관해 주세요.");
      window.history.replaceState(null, "", `${window.location.pathname}#purchase`);
      setReturnStatus(null);
      trackProductEvent("payment_access_activated", { locale, source: "subscription_page", state: result.mode });
    } catch { trackPaymentEvent("payment_confirmation_failed", { locale, mode: undefined }); setMessage(en ? "Approval could not be confirmed. Retry confirmation; do not pay again. Contact us if this continues." : "승인 결과를 확인하지 못했습니다. 다시 결제하지 말고 승인 확인을 재시도해 주세요. 계속되면 고객센터로 문의해 주세요."); }
    finally { confirming.current = false; setBusy(false); }
  }, [en, locale]);
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("payment");
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setReturnStatus(status);
      if (status === "confirm") confirm();
      if (["failed", "cancelled"].includes(status)) {
        trackPaymentEvent(status === "cancelled" ? "payment_cancelled" : "payment_failed", { locale });
        window.history.replaceState(null, "", `${window.location.pathname}#purchase`);
        setMessage(en ? "Payment was cancelled or did not complete. You can try again." : "결제가 취소되었거나 완료되지 않았습니다. 다시 시도할 수 있습니다.");
      }
    });
    return () => { active = false; };
  }, [confirm, en, locale]);
  const prepare = useCallback(async () => {
    if (preparing.current) return;
    preparing.current = true;
    setBusy(true); setMessage("");
    trackPaymentEvent("checkout_requested", { locale, mode: config?.mode });
    try {
      order.current = await jsonRequest("order", {});
      trackPaymentEvent("begin_checkout", { locale, mode: config.mode, transaction: order.current });
      const TossPayments = await loadSdk();
      widgets.current = TossPayments(config.clientKey).widgets({ customerKey: order.current.customerKey });
      await widgets.current.setAmount({ currency: "KRW", value: order.current.amount });
      await widgets.current.renderPaymentMethods({ selector: "#toss-payment-methods", variantKey: "DEFAULT" });
      await widgets.current.renderAgreement({ selector: "#toss-payment-agreement", variantKey: "AGREEMENT" });
      setReady(true);
      trackProductEvent("checkout_started", { locale, source: "subscription_page", state: config.mode });
    } catch (error) { trackPaymentEvent("checkout_failed", { locale, mode: config?.mode }); setMessage(error.message === "RATE_LIMITED" ? (en ? "Too many requests. Wait one minute before trying again." : "요청이 많습니다. 1분 후 다시 시도해 주세요.") : (en ? "Checkout could not load. Please retry." : "결제 화면을 불러오지 못했습니다. 다시 시도해 주세요.")); }
    finally { preparing.current = false; setBusy(false); }
  }, [config, locale, en]);
  useEffect(() => {
    if (!config?.enabled || paid || (config.requiresAccount && !checkoutAccount) || autoPrepared.current || new URLSearchParams(window.location.search).get("payment") === "confirm") return;
    autoPrepared.current = true;
    prepare();
  }, [config, paid, prepare, checkoutAccount]);
  const pay = async () => {
    setBusy(true);
    try {
      await saveCheckoutSnapshot();
      // Revalidate identity just before handing control to the payment provider.
      if (config?.requiresAccount) {
        const currentOrder = await jsonRequest("order", {});
        if (currentOrder.accountId !== checkoutAccount?.id) throw new Error("ACCOUNT_CHANGED");
        order.current = currentOrder;
      }
      trackPaymentEvent("payment_submitted", { locale, mode: config?.mode });
      await widgets.current.requestPayment({ orderId: order.current.orderId, orderName: order.current.orderName, successUrl: `${location.origin}/api/payments/return?locale=${locale}`, failUrl: `${location.origin}/api/payments/failure?locale=${locale}` });
    } catch (error) { trackPaymentEvent(paymentFailureEvent(error), { locale, mode: config?.mode }); setMessage(en ? "Payment did not complete. Check browser storage and your payment method, then retry. Your current analysis remains open." : "결제가 완료되지 않았습니다. 브라우저 저장 공간과 결제수단을 확인하고 다시 시도해 주세요. 현재 분석은 그대로 열려 있습니다."); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    setBusy(true);
    try { const result = await jsonRequest("access", { recoveryCode: restoreCode.trim() }); if (!result.entitlement) throw new Error("INVALID_CODE"); rememberPaymentAccess(result.entitlement); setRestoreCode(""); setMessage(en ? "Report pass restored. Project files stay on their original device; import a project backup to move them." : "이용권을 복원했습니다. 프로젝트 데이터는 원래 기기에 남아 있으므로 옮기려면 프로젝트 백업을 가져오세요."); }
    catch { setMessage(en ? "Could not restore this pass. Check the code, expiry date, and connection." : "이용권을 복원하지 못했습니다. 코드·만료일·연결 상태를 확인해 주세요."); }
    finally { setBusy(false); }
  };
  const saveRecovery = async () => {
    try {
      const code = recoveryCode || (await jsonRequest("access")).recoveryCode;
      if (!code) throw new Error("NO_RECOVERY_CODE");
      downloadFile(new Blob([`${en ? "Keep this code private. It restores your paid access, not project data." : "이 코드는 이용권을 복원합니다. 다른 사람에게 공유하지 마세요. 프로젝트 데이터는 별도로 백업하세요."}\n\n${code}`], { type: "text/plain;charset=utf-8" }), "growthopt-pass-recovery.txt");
    } catch { setMessage(en ? "Could not save the recovery code. Reconnect and try again." : "복원 코드를 보관하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요."); }
  };
  return <div className="subscription-checkout">
    {paid ? <div className="checkout-access-card"><p role="status">{en ? "Your report pass is active until" : "보고서 이용권 사용 중 · 만료일"} {new Date(entitlement.expiresAt).toLocaleDateString(en ? "en-US" : "ko-KR")}</p>{(recoveryCode || entitlement?.payment) && <button type="button" className="btn" onClick={saveRecovery}>{en ? "Save pass recovery code" : "이용권 복원 코드 보관"}</button>}</div> : config?.enabled ? <><p>{en ? "One-time payment. No automatic renewal. By purchasing, you agree to the terms and refund policy below." : "자동 갱신 없는 1회 결제입니다. 구매 시 아래 이용약관과 환불정책에 동의합니다."}</p><p>{en ? "Paying first saves a temporary copy of this project's inputs and settings in this browser. Return to your analysis to restore it. Unrestored copies expire after 24 hours and are removed on the next cleanup. Nothing is uploaded." : "결제하기를 누르면 이 프로젝트의 입력·설정을 먼저 이 브라우저에 임시 보관합니다. 분석 복귀 버튼으로 복원할 수 있습니다. 미복원본은 24시간 뒤 다음 정리 때 삭제하며 서버로 보내지 않습니다."}</p>{config.mode === "test" && <p>{en ? "Test checkout · no actual charge" : "테스트 결제 · 실제 청구되지 않음"}</p>}</> : <p>{config ? (en ? "Purchases are currently unavailable. You can keep analyzing or try a free sample report." : "지금은 구매할 수 없습니다. 분석을 계속하거나 무료 샘플 보고서를 확인하세요.") : (en ? "Checking checkout availability…" : "구매 가능 여부 확인 중…")} {config && <a href="#report-preview-title">{en ? "Free sample reports" : "무료 샘플 보고서"}</a>}</p>}
    <div className="checkout-widgets" hidden={paid}><div id="toss-payment-methods" /><div id="toss-payment-agreement" /></div>
    {!paid && config?.requiresAccount && !checkoutAccount && <p>{en ? "Sign in to link this purchase to your verified email. Marketing consent is not required." : "구매 이용권을 검증된 이메일에 연결하려면 로그인해 주세요. 마케팅 수신 동의는 필요하지 않습니다."} <a href="#account-archive">{en ? "Sign in" : "로그인하기"}</a></p>}
    {!paid && config?.enabled && (!config.requiresAccount || checkoutAccount) && <button className="btn primary" type="button" disabled={busy} onClick={ready ? pay : prepare}>{busy ? (en ? "Processing…" : "처리 중…") : ready ? (en ? `Pay KRW ${SUBSCRIPTION.monthlyKrw.toLocaleString("en-US")}` : `${SUBSCRIPTION.monthlyKrw.toLocaleString("ko-KR")}원 결제하기`) : (en ? "Reload checkout" : "결제 화면 다시 불러오기")}</button>}
    {message && <p role="status">{message}</p>}
    {returnStatus === "confirm" && <button type="button" className="btn" disabled={busy} onClick={confirm}>{en ? "Retry approval check" : "승인 확인 재시도"}</button>}
    {returnPath && <button className="btn" disabled={busy} onClick={async () => { try { await restoreCheckoutSnapshot(); router.push(returnPath); } catch { setMessage(en ? "Could not restore this project's temporary copy. Reopen the original project; your current work was not replaced." : "이 프로젝트의 임시본을 복원하지 못했습니다. 원래 프로젝트를 다시 열어 주세요. 현재 작업은 덮어쓰지 않았습니다."); } }}>{en ? "Return to your analysis" : "진행하던 분석으로 돌아가기"}</button>}
    <div className="purchase-project-transfer">
      <p>{en ? "Moving to another device? Restore your pass here, then import the backup exported from Projects on your original device. Your files and review history do not sync automatically." : "다른 기기로 옮기시나요? 여기서 이용권을 복원한 뒤, 원래 기기의 프로젝트 보관함에서 내보낸 백업을 가져오세요. 파일과 검토 이력은 자동 동기화되지 않습니다."}</p>
      <Link className="btn" href={en ? "/en/projects#project-backup" : "/projects#project-backup"}>{en ? "Import project backup" : "프로젝트 백업 가져오기"}</Link>
    </div>
    <section className="checkout-restore" aria-labelledby="checkout-restore-title"><h4 id="checkout-restore-title">{en ? "Restore a purchased pass on this device" : "구매한 이용권을 이 기기에서 복원"}</h4><div className="checkout-restore__form"><label className="wr-field">{en ? "Private recovery code" : "이용권 복원 코드"}<input type="password" autoComplete="off" maxLength={150} value={restoreCode} onChange={event => setRestoreCode(event.target.value)} /></label><button type="button" className="btn" disabled={busy || !restoreCode.trim()} onClick={restore}>{en ? "Restore access" : "이용권 복원"}</button></div></section>
    <PassRecoveryHelp locale={locale} />
  </div>;
}
