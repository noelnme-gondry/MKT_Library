import { finishEmailLogin } from "@/lib/account/emailLogin";
import { accountError } from "@/lib/account/accountServer";
export async function GET(request) {
  try { return await finishEmailLogin(request); } catch (error) { return accountError(error); }
}
