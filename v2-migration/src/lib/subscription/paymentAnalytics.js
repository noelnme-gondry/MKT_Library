import { trackProductEvent } from "../analytics";
import { PAYMENT_PRODUCT } from "./paymentProduct";

// Only public order metadata; never payment keys, recovery codes or provider messages.
export function trackPaymentEvent(name, { locale = "ko", mode, transaction } = {}) {
  try {
    const params = { locale, source: "subscription_page", state: ["live", "test"].includes(mode) ? mode : "unknown" };
    if (["begin_checkout", "purchase"].includes(name)) {
      if (!["live", "test"].includes(mode) || !/^gop_[a-f0-9-]{36}$/.test(transaction?.orderId || "")
        || !Number.isSafeInteger(transaction.amount) || transaction.amount <= 0) return false;
      Object.assign(params, { currency: PAYMENT_PRODUCT.currency, value: transaction.amount,
        items: [{ item_id: PAYMENT_PRODUCT.id, price: transaction.amount, quantity: 1 }] });
      if (name === "purchase") params.transaction_id = transaction.orderId;
      const event = mode === "test" ? `test_${name}` : name;
      const key = `gop:ga:${event}:${transaction.orderId}`;
      try { if (sessionStorage.getItem(key) || (name === "purchase" && localStorage.getItem(key))) return false; } catch { /* GA transaction ID remains stable. */ }
      const sent = trackProductEvent(event, params);
      if (sent) { try { sessionStorage.setItem(key, "1"); if (name === "purchase") localStorage.setItem(key, "1"); } catch { /* Storage is optional. */ } }
      return sent;
    }
    return trackProductEvent(name, params);
  } catch { return false; } // Analytics must never interrupt checkout or activation.
}

export function paymentFailureEvent(error) {
  return ["PAY_PROCESS_CANCELED", "USER_CANCEL"].includes(error?.code) ? "payment_cancelled" : "payment_failed";
}
