import { redirectPaymentReview } from "@/lib/subscription/paymentServer";
export const runtime = "nodejs";
export function GET(request) { return redirectPaymentReview(request); }
