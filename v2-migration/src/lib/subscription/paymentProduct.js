import { SUBSCRIPTION } from "./entitlement";

export const PAYMENT_PRODUCT = Object.freeze({ id: "report-pass-month-v1", amount: SUBSCRIPTION.monthlyKrw, currency: "KRW", name: "Growth Opt Playbook 1개월 보고서 이용권" });

// Calendar month in KST, clamped to the last day of the following month.
export function passExpiresAt(start) {
  const date = new Date(new Date(start).getTime() + 9 * 3600000);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return new Date(date.getTime() - 9 * 3600000).toISOString();
}

export function verifiedPayment(payment, order) {
  return payment?.orderId === order.id && payment?.paymentKey === order.payment_key
    && payment?.totalAmount === order.amount && payment?.currency === "KRW"
    && payment?.status === "DONE" && Number.isFinite(Date.parse(payment.approvedAt))
    && (!payment.cancels || payment.cancels.length === 0);
}
