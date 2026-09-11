import { finishEmailLogin } from "@/lib/account/emailLogin";
import { accountLoginFailure } from "@/lib/account/accountServer";
export async function GET(request) {
  try { return await finishEmailLogin(request); } catch (error) { return accountLoginFailure(error, "email"); }
}
