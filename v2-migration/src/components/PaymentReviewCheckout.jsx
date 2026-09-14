"use client";
import { useEffect, useRef, useState } from "react";
import { loadPaymentSdk } from "@/lib/subscription/paymentSdk";
import { saveCheckoutSnapshot } from "@/lib/subscription/checkoutSnapshot";

export default function PaymentReviewCheckout({ clientKey, product, locale = "ko" }) {
  const en = locale === "en";
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const widgets = useRef(null);
  const methodsReady = useRef(false);
  const agreementReady = useRef(false);
  const running = useRef(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("payment_review")) return;
    const returned = url.searchParams.get("payment_review") === "returned";
    url.searchParams.delete("payment_review");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    Promise.resolve().then(() => setMessage(returned
      ? (en ? "Returned from the test checkout. This review does not approve a payment or issue a pass." : "테스트 결제창에서 돌아왔습니다. 이 확인 경로는 결제를 승인하거나 이용권을 발급하지 않습니다.")
      : (en ? "The test checkout was closed or could not continue. No pass was issued." : "테스트 결제창을 닫았거나 진행하지 못했습니다. 이용권은 발급되지 않았습니다.")));
  }, [en]);
  if (!/^test_gck_/.test(clientKey || "") || !product?.name || !(product.amount > 0)) return null;
  const open = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setMessage("");
    try {
      if (!ready) {
        if (!widgets.current) {
          const TossPayments = await loadPaymentSdk();
          widgets.current = TossPayments(clientKey).widgets({ customerKey: "ANONYMOUS" });
        }
        await widgets.current.setAmount({ currency: product.currency, value: product.amount });
        if (!methodsReady.current) {
          await widgets.current.renderPaymentMethods({ selector: "#toss-review-methods", variantKey: "DEFAULT" });
          methodsReady.current = true;
        }
        if (!agreementReady.current) {
          await widgets.current.renderAgreement({ selector: "#toss-review-agreement", variantKey: "AGREEMENT" });
          agreementReady.current = true;
        }
        setReady(true);
      } else {
        await saveCheckoutSnapshot();
        const callback = `${location.origin}/api/payments/review-return?locale=${en ? "en" : "ko"}`;
        // A distinct namespace cannot be accepted by the real order/approval API.
        await widgets.current.requestPayment({
          orderId: `gop_review_${crypto.randomUUID()}`, orderName: product.name,
          successUrl: `${callback}&result=returned`, failUrl: `${callback}&result=closed`,
        });
      }
    } catch {
      setMessage(en ? "Could not continue the test checkout. If you closed it, you can open it again. Otherwise check the connection and retry." : "테스트 결제창을 진행하지 못했습니다. 창을 닫았다면 다시 열 수 있습니다. 그 외에는 연결 상태를 확인한 뒤 재시도하세요.");
    } finally { running.current = false; setBusy(false); }
  };
  return <section className="checkout-review checkout-access-card" aria-labelledby="checkout-review-title">
    <h3 id="checkout-review-title">{en ? "Test checkout for integration review" : "심사용 테스트 결제창"}</h3>
    <p>{en ? "Check the checkout for the pass described above without signing in. It uses a Toss test key: no actual charge, payment approval or Pro access is issued." : "위 이용권 상품의 결제창을 로그인 없이 확인할 수 있습니다. 토스 테스트 키를 사용하며 실제 청구·결제 승인·Pro 권한 발급은 진행하지 않습니다."}</p>
    <p>{en ? "Select a payment method and open its test checkout. This is not a purchase." : "결제수단을 선택한 뒤 테스트 결제창을 여세요. 실제 구매는 이루어지지 않습니다."}</p>
    <div id="toss-review-methods" /><div id="toss-review-agreement" />
    <button type="button" className="btn primary" disabled={busy} onClick={open}>{busy ? (en ? "Opening…" : "여는 중…") : ready ? (en ? `Open KRW ${product.amount.toLocaleString("en-US")} test checkout` : `${product.amount.toLocaleString("ko-KR")}원 테스트 결제창 열기`) : (en ? "Show test payment methods" : "테스트 결제수단 확인")}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
