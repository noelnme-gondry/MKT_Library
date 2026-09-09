import { readPaymentAccess, paymentResponse, paymentError } from "@/lib/subscription/paymentServer";
export const runtime = "nodejs";
export async function GET(request) { try { return paymentResponse(await readPaymentAccess(request)); } catch { return paymentError(); } }
export async function POST(request) { try { const { recoveryCode } = await request.json(); if (typeof recoveryCode !== "string" || recoveryCode.length > 150) return Response.json({ error: "INVALID_CODE" }, { status: 400 }); return paymentResponse(await readPaymentAccess(request, recoveryCode)); } catch { return paymentError(); } }
