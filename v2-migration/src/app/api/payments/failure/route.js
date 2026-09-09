import { redirectPaymentResult } from "@/lib/subscription/paymentServer";
export const runtime = "nodejs";
export function GET(request) { return redirectPaymentResult(request, true); }
