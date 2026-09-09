import { reconcilePaymentWebhook, paymentError } from "@/lib/subscription/paymentServer";
export const runtime = "nodejs";
export async function POST(request) { try { await reconcilePaymentWebhook(await request.json()); return Response.json({ received: true }); } catch { return paymentError(); } }
