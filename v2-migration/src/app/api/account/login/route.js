import { startGoogleLogin, accountError } from "@/lib/account/accountServer";
import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";
export async function POST(request) { if (!admitPaymentRequest("account-login", request)) return paymentLimitResponse(); try { return await startGoogleLogin(request); } catch (error) { return accountError(error); } }
