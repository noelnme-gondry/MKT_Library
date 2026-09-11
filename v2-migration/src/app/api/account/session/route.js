import { accountsEnabled, readAccount, logoutAccount, accountResponse, accountError } from "@/lib/account/accountServer";
import { accountEntitlement } from "@/lib/account/archiveContract";
import { mailEnabled } from "@/lib/account/accountMail";
export async function GET(request) {
  try { const account = await readAccount(request); return accountResponse({ enabled: accountsEnabled(), signupRestricted: process.env.ACCOUNT_ALLOWED_EMAILS !== undefined, mailEnabled: mailEnabled(), account: account ? { id: account.id, email: account.email, trialStartedAt: account.trial_started_at, serviceReminders: account.service_reminders === true } : null, entitlement: accountEntitlement(account) }); }
  catch (error) { return accountError(error); }
}
export async function DELETE(request) { try { return await logoutAccount(request); } catch (error) { return accountError(error); } }
