import { requireAccount, accountDatabase, accountSameOrigin, accountResponse, accountError, saveAccountMemo } from "@/lib/account/accountServer";
import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";
async function readMemoInput(request) {
  accountSameOrigin(request);
  await requireAccount(request);
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_MEMO");
  let bytes = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 24000) { await reader.cancel(); throw new Error("INVALID_MEMO"); }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}
export async function GET(request) {
  try { const owner = await requireAccount(request); const { rows } = await accountDatabase().query("SELECT memo FROM gop_decision_memos WHERE account_id=$1 ORDER BY updated_at DESC", [owner.id]); return accountResponse({ memos: rows.map(row => row.memo) }); }
  catch (error) { return accountError(error); }
}
export async function POST(request) {
  if (!admitPaymentRequest("account-memo", request)) return paymentLimitResponse();
  try { return accountResponse(await saveAccountMemo(request, await readMemoInput(request))); }
  catch (error) { return accountError(error); }
}
export async function DELETE(request) {
  try { accountSameOrigin(request); const owner = await requireAccount(request); const id = new URL(request.url).searchParams.get("id"); if (!id || id.length > 120) throw new Error("INVALID_MEMO"); await accountDatabase().query("DELETE FROM gop_decision_memos WHERE account_id=$1 AND id=$2", [owner.id, id]); return accountResponse({ ok: true }); }
  catch (error) { return accountError(error); }
}
