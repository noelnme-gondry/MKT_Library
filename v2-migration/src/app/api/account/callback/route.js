import { finishGoogleLogin, accountLoginFailure } from "@/lib/account/accountServer";
export async function GET(request) { try { return await finishGoogleLogin(request); } catch (error) { return accountLoginFailure(error); } }
