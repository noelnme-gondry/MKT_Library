import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";
import { createPaymentOrder, paymentResponse, paymentError } from "@/lib/subscription/paymentServer";
export const runtime = "nodejs";
export async function POST(request) { if (!admitPaymentRequest("order")) return paymentLimitResponse(); try { return paymentResponse(await createPaymentOrder(request)); } catch (error) { return paymentError(error); } }
