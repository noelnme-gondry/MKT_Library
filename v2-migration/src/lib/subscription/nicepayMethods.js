// Only merchant-approved methods should be exposed by NICEPAY_METHODS.
export const NICEPAY_METHODS = Object.freeze([
  { id: "card", ko: "신용·체크카드", en: "Credit / debit card" },
  { id: "vbank", ko: "무통장입금 (가상계좌)", en: "Bank deposit (virtual account)" },
  { id: "naverpayCard", ko: "네이버페이 (카드)", en: "Naver Pay (card)" },
  { id: "kakaopay", ko: "카카오페이", en: "Kakao Pay" },
  { id: "cellphone", ko: "휴대폰 결제", en: "Mobile phone billing" },
]);
export function configuredNicepayMethods(value = "card") {
  const enabled = new Set(value.split(",").map(item => item.trim()));
  return NICEPAY_METHODS.filter(method => enabled.has(method.id)).map(method => method.id);
}
export function nicepayMethodOptions(method) {
  if (!NICEPAY_METHODS.some(item => item.id === method)) throw new Error("INVALID_PAYMENT_METHOD");
  return { method, ...(method === "cellphone" ? { isDigital: true } : {}),
    ...(method === "vbank" ? { vbankHolder: "Growth Opt Playbook", vbankValidHours: 24 } : {}) };
}
