import { requireAccount, accountDatabase, accountSameOrigin, accountResponse, accountError } from "@/lib/account/accountServer";
export async function POST(request) {
  try {
    accountSameOrigin(request);
    const owner = await requireAccount(request);
    // No request body or user-provided memo content; allowlisted query values only.
    const params = new URL(request.url).searchParams;
    const reminders = params.get("reminders");
    const sourceCurrency = params.get("sourceCurrency");
    if (reminders === null && sourceCurrency === null) throw new Error("INVALID_MEMO");
    if (reminders !== null && !["on", "off"].includes(reminders)) throw new Error("INVALID_MEMO");
    if (sourceCurrency !== null && !["KRW", "USD"].includes(sourceCurrency)) throw new Error("INVALID_MEMO");
    if (reminders !== null) await accountDatabase().query("UPDATE gop_accounts SET service_reminders=$2 WHERE id=$1", [owner.id, reminders === "on"]);
    if (sourceCurrency !== null) await accountDatabase().query("UPDATE gop_accounts SET source_currency=$2 WHERE id=$1", [owner.id, sourceCurrency]);
    return accountResponse({ ok: true });
  } catch (error) { return accountError(error); }
}
