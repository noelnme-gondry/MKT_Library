import { randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/routeMap";
import { accountDatabase, accountHash, accountCookie, readCookie, accountSameOrigin, issueAccountSession } from "./accountServer";
import { mailEnabled, sendAccountMail } from "./accountMail";
import { accountEmailAllowed } from "./accountAccess";
export async function requestEmailLogin(request, email, locale = "ko") {
  accountSameOrigin(request);
  if (!mailEnabled()) throw new Error("ACCOUNTS_UNAVAILABLE");
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_LOGIN");
  const db = accountDatabase();
  const accounts = accountEmailAllowed(email) ? (await db.query("SELECT id FROM gop_accounts WHERE lower(email)=lower($1)", [email.trim()])).rows : [];
  const browser = randomBytes(32).toString("hex");
  // Never merge identities merely because they share an email address.
  if (accounts.length === 1) {
    const token = randomBytes(32).toString("hex");
    await db.query("DELETE FROM gop_email_logins WHERE account_id=$1 OR expires_at<NOW()", [accounts[0].id]);
    await db.query("INSERT INTO gop_email_logins(token_hash,browser_hash,account_id,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '10 minutes')", [accountHash(token), accountHash(browser), accounts[0].id]);
    const url = `${new URL(process.env.ACCOUNTS_ORIGIN || SITE_URL).origin}/api/account/email-callback?token=${token}`;
    const en = locale === "en";
    await sendAccountMail(email.trim(), en ? "Your one-time sign-in link" : "일회용 로그인 링크", `${en ? "Open in the browser where you requested this link. Valid once for 10 minutes. If you did not request it, ignore this email." : "링크를 요청한 브라우저에서 열어 주세요. 10분간 한 번만 사용할 수 있습니다. 요청하지 않았다면 무시해 주세요."}\n\n${url}`);
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": accountCookie("gop_email_browser", browser, 600) } });
}
export async function finishEmailLogin(request) {
  const token = new URL(request.url).searchParams.get("token") || "", browser = readCookie(request, "gop_email_browser");
  if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(browser)) throw new Error("INVALID_LOGIN");
  const row = (await accountDatabase().query("DELETE FROM gop_email_logins WHERE token_hash=$1 AND browser_hash=$2 AND expires_at>NOW() RETURNING account_id", [accountHash(token), accountHash(browser)])).rows[0];
  if (!row) throw new Error("INVALID_LOGIN");
  const response = await issueAccountSession(row.account_id);
  response.headers.append("Set-Cookie", accountCookie("gop_email_browser", "", 0));
  return response;
}
