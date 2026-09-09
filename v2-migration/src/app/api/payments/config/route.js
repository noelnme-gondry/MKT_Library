import { paymentConfiguration } from "@/lib/subscription/paymentServer";
export const runtime = "nodejs";
export function GET() { return Response.json(paymentConfiguration(), { headers: { "Cache-Control": "no-store" } }); }
