import { redirectNicepayResult } from "@/lib/subscription/paymentServer";
export const runtime = "nodejs";
export async function POST(request) { return redirectNicepayResult(request); }
