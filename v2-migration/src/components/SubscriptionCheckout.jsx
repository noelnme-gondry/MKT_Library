"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
import { rememberPaymentAccess } from "@/lib/subscription/paymentClient";
import { trackProductEvent } from "@/lib/analytics";
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
  if (!response.ok) throw new Error("PAYMENT_UNAVAILABLE");
  return response.json();
}
export default function SubscriptionCheckout({ locale = "ko" }) {
  const en = locale === "en";
  const entitlement = useAppStore(state => state.entitlement);
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [returnStatus, setReturnStatus] = useState(null);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [restoreCode, setRestoreCode] = useState("");
  const widgets = useRef(null);
  const order = useRef(null);
  const confirming = useRef(false);
  useEffect(() => { jsonRequest("config").then(setConfig).catch(() => setConfig({ enabled: false })); }, []);
  const confirm = useCallback(async () => {
    if (confirming.current) return;
    confirming.current = true; setBusy(true);
    try {
      const result = await jsonRequest("confirm", {});
      rememberPaymentAccess(result.entitlement); setRecoveryCode(result.recoveryCode);
      setMessage(en ? "Payment confirmed. Your report pass is active. Save your recovery code before leaving this page." : "결제를 확인했습니다. 보고서 이용권이 활성화되었습니다. 이 화면을 떠나기 전에 복원 코드를 보관해 주세요.");
      window.history.replaceState(null, "", `${window.location.pathname}#purchase`);
      setReturnStatus(null);
      trackProductEvent("payment_access_activated", { locale, source: "subscription_page", state: result.mode });
    } catch { setMessage(en ? "Approval could not be confirmed. Retry confirmation; do not pay again. Contact us if this continues." : "승인 결과를 확인하지 못했습니다. 다시 결제하지 말고 승인 확인을 재시도해 주세요. 계속되면 고객센터로 문의해 주세요."); }
    finally { confirming.current = false; setBusy(false); }
  }, [en, locale]);
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("payment");
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setReturnStatus(status);
      if (status === "confirm") confirm();
      if (status === "failed") setMessage(en ? "Payment was cancelled or did not complete. You can try again." : "결제가 취소되었거나 완료되지 않았습니다. 다시 시도할 수 있습니다.");
    });
    return () => { active = false; };
  }, [confirm, en]);
  const prepare = async () => {
    setBusy(true); setMessage("");
    try {
      order.current = await jsonRequest("order", {});
      const TossPayments = await loadSdk();
      widgets.current = TossPayments(config.clientKey).widgets({ customerKey: order.current.customerKey });
      await widgets.current.setAmount({ currency: "KRW", value: order.current.amount });
      await widgets.current.renderPaymentMethods({ selector: "#toss-payment-methods", variantKey: "DEFAULT" });
      await widgets.current.renderAgreement({ selector: "#toss-payment-agreement", variantKey: "AGREEMENT" });
      setReady(true);
      trackProductEvent("checkout_started", { locale, source: "subscription_page", state: config.mode });
    } catch { setMessage(en ? "Checkout could not load. Please retry." : "결제 화면을 불러오지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  };
  const pay = async () => {
    setBusy(true);
    try {
      await widgets.current.requestPayment({ orderId: order.current.orderId, orderName: order.current.orderName, successUrl: `${location.origin}/api/payments/return?locale=${locale}`, failUrl: `${location.origin}/api/payments/failure?locale=${locale}` });
    } catch { setMessage(en ? "Payment did not complete. Check your selection and try again." : "결제가 완료되지 않았습니다. 결제수단을 확인하고 다시 시도해 주세요."); }
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
    {hasPaidAccess(entitlement) ? <p role="status">{en ? "Your report pass is active until" : "보고서 이용권 사용 중 · 만료일"} {new Date(entitlement.expiresAt).toLocaleDateString(en ? "en-US" : "ko-KR")}</p> : config?.enabled ? <><p>{en ? "One-time payment. No automatic renewal. By purchasing, you agree to the terms and refund policy below." : "자동 갱신 없는 1회 결제입니다. 구매 시 아래 이용약관과 환불정책에 동의합니다."}</p>{config.mode === "test" && <p>{en ? "Test checkout · no actual charge" : "테스트 결제 · 실제 청구되지 않음"}</p>}<button className="btn primary" type="button" disabled={busy} onClick={ready ? pay : prepare}>{busy ? (en ? "Processing…" : "처리 중…") : ready ? (en ? "Pay KRW 5,900" : "5,900원 결제하기") : (en ? "Choose payment method" : "결제수단 선택")}</button></> : <p>{en ? "Contact customer service for purchase availability." : "이용권 구매 가능 여부는 고객센터로 문의해 주세요."}</p>}
    <div id="toss-payment-methods" /><div id="toss-payment-agreement" />
    {message && <p role="status">{message}</p>}
    {returnStatus === "confirm" && <button type="button" className="btn" disabled={busy} onClick={confirm}>{en ? "Retry approval check" : "승인 확인 재시도"}</button>}
    {(recoveryCode || entitlement?.payment) && <button type="button" className="btn" onClick={saveRecovery}>{en ? "Save pass recovery code" : "이용권 복원 코드 보관"}</button>}
    <details><summary>{en ? "Restore a purchased pass on this device" : "구매한 이용권을 이 기기에서 복원"}</summary><label className="wr-field">{en ? "Private recovery code" : "이용권 복원 코드"}<input type="password" autoComplete="off" maxLength={150} value={restoreCode} onChange={event => setRestoreCode(event.target.value)} /></label><button type="button" className="btn" disabled={busy || !restoreCode.trim()} onClick={restore}>{en ? "Restore access" : "이용권 복원"}</button></details>
  </div>;
}
