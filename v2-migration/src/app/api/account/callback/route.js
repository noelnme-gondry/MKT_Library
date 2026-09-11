import { finishGoogleLogin, accountError } from "@/lib/account/accountServer";
export async function GET(request) { try { return await finishGoogleLogin(request); } catch (error) { return accountError(error); } }
