import { confirmPayment, paymentResponse, paymentError } from "@/lib/subscription/paymentServer";
export const runtime = "nodejs";
export async function POST(request) { try { return paymentResponse(await confirmPayment(request, await request.json())); } catch { return paymentError(); } }
