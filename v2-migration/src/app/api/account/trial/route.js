import { accountError, accountResponse, startAccountTrial } from "@/lib/account/accountServer";
import { admitPaymentRequest, paymentLimitResponse } from "@/lib/subscription/paymentRequestLimit";

// 프로젝트 생성 관문이 부른다. 체험은 계정당 1회이고 서버 시계로 잰다.
export async function POST(request) {
  if (!admitPaymentRequest("account-trial", request)) return paymentLimitResponse();
  try {
    return accountResponse(await startAccountTrial(request));
  } catch (error) { return accountError(error); }
}
