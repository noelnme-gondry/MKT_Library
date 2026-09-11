import { requireAccount, accountDatabase, accountSameOrigin, accountResponse, accountError } from "@/lib/account/accountServer";
export async function POST(request) {
  try {
    accountSameOrigin(request);
    const owner = await requireAccount(request);
    // No request body or user-provided memo content; allowlisted query values only.
    const params = new URL(request.url).searchParams;
    if (!["on", "off"].includes(params.get("reminders"))) throw new Error("INVALID_MEMO");
    await accountDatabase().query("UPDATE gop_accounts SET service_reminders=$2 WHERE id=$1", [owner.id, params.get("reminders") === "on"]);
    return accountResponse({ ok: true });
  } catch (error) { return accountError(error); }
}
