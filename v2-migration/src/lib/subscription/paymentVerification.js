export function verifiedPayment(payment, order) {
  return payment?.orderId === order.id && payment?.paymentKey === order.payment_key
    && payment?.totalAmount === order.amount && payment?.currency === "KRW"
    && payment?.status === "DONE" && Number.isFinite(Date.parse(payment.approvedAt))
    && (!payment.cancels || payment.cancels.length === 0);
}
