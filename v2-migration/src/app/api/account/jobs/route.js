import { authorizeMailJob, dispatchAccountMail } from "@/lib/account/accountMail";
import { accountResponse, accountError } from "@/lib/account/accountServer";
export async function POST(request) {
  try { authorizeMailJob(request); return accountResponse(await dispatchAccountMail()); }
  catch (error) { return accountError(error); }
}
