import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";
import { reconcilePaymentWebhook, paymentError } from "@/lib/subscription/paymentServer";
export const runtime = "nodejs";
export async function POST(request) {
  if (!admitPaymentRequest("webhook", request)) return paymentLimitResponse();
  try {
    await reconcilePaymentWebhook(await request.json(), "nicepay");
    return new Response("OK", { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) { return paymentError(error); }
}
