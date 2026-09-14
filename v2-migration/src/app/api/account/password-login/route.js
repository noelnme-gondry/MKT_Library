import { signInWithPassword } from "@/lib/account/passwordLogin";
import { accountError, accountSameOrigin } from "@/lib/account/accountServer";
import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";

export async function POST(request) {
  if (!admitPaymentRequest("order", request)) return paymentLimitResponse();
  try {
    accountSameOrigin(request);
    const reader = request.body?.getReader();
    if (!reader) throw new Error("INVALID_LOGIN");
    let bytes = 0, text = "";
    const decoder = new TextDecoder();
    try {
      while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 1024) { await reader.cancel(); throw new Error("INVALID_LOGIN"); } text += decoder.decode(part.value, { stream: true }); }
    } finally { reader.releaseLock(); }
    const input = JSON.parse(text + decoder.decode());
    return await signInWithPassword(request, input.email, input.password);
  } catch (error) { return accountError(error); }
}
