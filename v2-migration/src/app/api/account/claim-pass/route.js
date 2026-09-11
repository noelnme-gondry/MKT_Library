import { accountSameOrigin, requireAccount, accountDatabase, accountResponse, accountError } from "@/lib/account/accountServer";
import { readPaymentAccess } from "@/lib/subscription/paymentServer";
import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";
export async function POST(request) {
  if (!admitPaymentRequest("account-claim", request)) return paymentLimitResponse();
  try {
    accountSameOrigin(request);
    const owner = await requireAccount(request);
    // Verify the private payment cookie and current provider status before linking.
    const access = await readPaymentAccess(request);
    const orderId = access.body.recoveryCode?.split(".")[0];
    if (!access.body.entitlement || !orderId) throw new Error("PRO_REQUIRED");
    const linked = await accountDatabase().query("UPDATE gop_payment_orders SET account_id=$2 WHERE id=$1 AND (account_id IS NULL OR account_id=$2)", [orderId, owner.id]);
    if (!linked.rowCount) throw new Error("INVALID_LOGIN");
    return accountResponse({ ok: true });
  } catch (error) { return accountError(error); }
}
