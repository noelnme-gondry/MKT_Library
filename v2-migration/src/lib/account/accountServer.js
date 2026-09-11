import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { OAuth2Client } from "google-auth-library";
import { SITE_URL } from "@/lib/routeMap";
import { accountEntitlement, archiveMemo } from "./archiveContract";

let pool;
export const accountHash = value => createHash("sha256").update(value).digest("hex");
const hash = accountHash;
const sessionCookie = "gop_account";
export const accountsEnabled = () => process.env.ACCOUNTS_ENABLED === "true" && Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.PAYMENTS_DATABASE_URL);
const origin = () => new URL(process.env.ACCOUNTS_ORIGIN || SITE_URL).origin;
export function accountDatabase() {
  if (!accountsEnabled()) throw new Error("ACCOUNTS_UNAVAILABLE");
  pool ||= new pg.Pool({ connectionString: process.env.PAYMENTS_DATABASE_URL, max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
  return pool;
}
export function readCookie(request, name) {
  return (request.headers.get("cookie") || "").split(";").map(value => value.trim()).find(value => value.startsWith(name + "="))?.slice(name.length + 1) || "";
}
export const accountCookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${origin().startsWith("https:") ? "; Secure" : ""}`;
const cookie = accountCookie;
export function accountSameOrigin(request) {
  if (request.headers.get("origin") !== origin()) throw new Error("INVALID_ORIGIN");
}
export async function readAccount(request) {
  if (!accountsEnabled()) return null;
  const token = readCookie(request, sessionCookie);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await accountDatabase().query(`SELECT a.*, (SELECT max(p.expires_at) FROM gop_payment_orders p WHERE p.account_id=a.id AND p.status='paid' AND p.mode='live') AS paid_until FROM gop_account_sessions s JOIN gop_accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>NOW()`, [hash(token)]);
  return rows[0] || null;
}
export async function requireAccount(request) {
  const account = await readAccount(request);
  if (!account) throw new Error("LOGIN_REQUIRED");
  return account;
}
export function accountResponse(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export function accountError(error) {
  const statuses = { LOGIN_REQUIRED: 401, INVALID_ORIGIN: 403, INVALID_MEMO: 400, PRO_REQUIRED: 402, INVALID_LOGIN: 400, ACCOUNTS_UNAVAILABLE: 503, ARCHIVE_LIMIT: 409 };
  const code = Object.hasOwn(statuses, error?.message) ? error.message : "ACCOUNTS_UNAVAILABLE";
  return accountResponse({ error: code }, statuses[code]);
}
function oauthClient() { return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, origin() + "/api/account/callback"); }
export async function startGoogleLogin(request) {
  accountSameOrigin(request);
  const client = oauthClient();
  const state = randomBytes(32).toString("hex"), nonce = randomBytes(32).toString("hex");
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  await accountDatabase().query("DELETE FROM gop_oauth_attempts WHERE expires_at<NOW()");
  await accountDatabase().query("INSERT INTO gop_oauth_attempts(state_hash,verifier,nonce,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '10 minutes')", [hash(state), codeVerifier, nonce]);
  const url = client.generateAuthUrl({ scope: ["openid", "email"], state, nonce, code_challenge: codeChallenge, code_challenge_method: "S256", prompt: "select_account" });
  return Response.json({ url }, { headers: { "Cache-Control": "no-store", "Set-Cookie": cookie("gop_oauth_state", state, 600) } });
}
export async function finishGoogleLogin(request) {
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  if (!/^[a-f0-9]{64}$/.test(state || "") || state !== readCookie(request, "gop_oauth_state")) throw new Error("INVALID_LOGIN");
  const attempt = (await accountDatabase().query("DELETE FROM gop_oauth_attempts WHERE state_hash=$1 AND expires_at>NOW() RETURNING *", [hash(state)])).rows[0];
  if (!attempt || !params.get("code") || params.has("error")) throw new Error("INVALID_LOGIN");
  const client = oauthClient();
  const { tokens } = await client.getToken({ code: params.get("code"), codeVerifier: attempt.verifier });
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
  const identity = ticket.getPayload();
  if (!identity?.sub || !identity.email_verified || !identity.email || identity.nonce !== attempt.nonce) throw new Error("INVALID_LOGIN");
  const account = (await accountDatabase().query("INSERT INTO gop_accounts(id,google_sub,email) VALUES($1,$2,$3) ON CONFLICT(google_sub) DO UPDATE SET email=EXCLUDED.email RETURNING id", [randomUUID(), identity.sub, identity.email])).rows[0];
  return issueAccountSession(account.id);
}
export async function issueAccountSession(accountId) {
  const token = randomBytes(32).toString("hex");
  await accountDatabase().query("INSERT INTO gop_account_sessions(token_hash,account_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')", [hash(token), accountId]);
  const headers = new Headers({ "Content-Type": "text/html;charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; script-src 'nonce-account-complete'" });
  headers.append("Set-Cookie", cookie(sessionCookie, token, 30 * 86400));
  headers.append("Set-Cookie", cookie("gop_oauth_state", "", 0));
  return new Response('<!doctype html><meta charset="utf-8"><title>Login complete</title><p>로그인 완료 · Login complete. You can return to your analysis.</p><script nonce="account-complete">if(window.opener){window.opener.postMessage({type:"gop-account-ready"},location.origin);window.close()}</script>', { headers });
}
export async function logoutAccount(request) {
  accountSameOrigin(request);
  await accountDatabase().query("DELETE FROM gop_account_sessions WHERE token_hash=$1", [hash(readCookie(request, sessionCookie))]);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": cookie(sessionCookie, "", 0) } });
}
export async function saveAccountMemo(request, input) {
  accountSameOrigin(request);
  const owner = await requireAccount(request);
  if (!input || Object.keys(input).some(key => !["memo", "consent", "reminder", "locale"].includes(key)) || input.consent !== "decision-memo-v1" || (input.reminder !== undefined && typeof input.reminder !== "boolean") || (input.locale !== undefined && !["ko", "en"].includes(input.locale))) throw new Error("INVALID_MEMO");
  const memo = archiveMemo(input.memo);
  if (Object.keys(input.memo).some(key => !Object.hasOwn(memo, key))) throw new Error("INVALID_MEMO");
  const client = await accountDatabase().connect();
  try {
    await client.query("BEGIN");
    const account = (await client.query("SELECT * FROM gop_accounts WHERE id=$1 FOR UPDATE", [owner.id])).rows[0];
    const now = (await client.query("SELECT NOW() AS now")).rows[0].now;
    const trialStarted = !account.trial_started_at;
    // The first successful write starts one server-clock trial; failed writes roll it back.
    if (trialStarted) {
      await client.query("UPDATE gop_accounts SET trial_started_at=$2 WHERE id=$1", [owner.id, now]);
      account.trial_started_at = now;
    }
    const entitlement = accountEntitlement({ ...account, paid_until: owner.paid_until }, new Date(now).getTime());
    if (!entitlement) throw new Error("PRO_REQUIRED");
    const count = (await client.query("SELECT count(*)::int AS count FROM gop_decision_memos WHERE account_id=$1", [owner.id])).rows[0].count;
    const existing = (await client.query("SELECT id FROM gop_decision_memos WHERE account_id=$1 AND id=$2", [owner.id, memo.id])).rowCount;
    if (!existing && count >= 2000) throw new Error("ARCHIVE_LIMIT");
    await client.query("INSERT INTO gop_decision_memos(account_id,id,memo) VALUES($1,$2,$3) ON CONFLICT(account_id,id) DO UPDATE SET memo=EXCLUDED.memo,updated_at=NOW()", [owner.id, memo.id, JSON.stringify(memo)]);
    await client.query("UPDATE gop_decision_memos SET reminder_enabled=$3 WHERE account_id=$1 AND id=$2", [owner.id, memo.id, input.reminder === true]);
    if (input.locale) await client.query("UPDATE gop_accounts SET locale=$2 WHERE id=$1", [owner.id, input.locale]);
    await client.query("COMMIT");
    return { memo, entitlement, trialStarted };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
