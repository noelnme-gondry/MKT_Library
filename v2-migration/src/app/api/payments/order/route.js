import { createPaymentOrder, paymentResponse, paymentError } from "@/lib/subscription/paymentServer";
export const runtime = "nodejs";
export async function POST(request) { try { return paymentResponse(await createPaymentOrder(request)); } catch { return paymentError(); } }
