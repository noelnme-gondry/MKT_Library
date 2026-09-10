import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";
import { reconcilePaymentWebhook, paymentError } from "@/lib/subscription/paymentServer";
export const runtime = "nodejs";
export async function POST(request) { if (!admitPaymentRequest("webhook")) return paymentLimitResponse(); try { await reconcilePaymentWebhook(await request.json()); return Response.json({ received: true }); } catch (error) { return paymentError(error); } }
