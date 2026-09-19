let sdkPromise;
let nicepayPromise;
export function loadNicepaySdk() {
  if (window.AUTHNICE?.requestPay) return Promise.resolve(window.AUTHNICE);
  nicepayPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://pay.nicepay.co.kr/v1/js/";
    const fail = () => { nicepayPromise = null; script.remove(); reject(new Error("SDK_UNAVAILABLE")); };
    script.onload = () => window.AUTHNICE?.requestPay ? resolve(window.AUTHNICE) : fail();
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return nicepayPromise;
}
export function loadPaymentSdk() {
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
