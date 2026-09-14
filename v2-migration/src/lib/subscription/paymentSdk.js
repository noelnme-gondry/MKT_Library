let sdkPromise;
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
