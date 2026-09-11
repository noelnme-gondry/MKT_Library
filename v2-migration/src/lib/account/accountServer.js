import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { OAuth2Client } from "google-auth-library";
import { SITE_URL } from "@/lib/routeMap";
import { accountEntitlement, archiveMemo } from "./archiveContract";
import { accountEmailAllowed } from "./accountAccess";

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
  const { rows } = await accountDatabase().query(`SELECT a.*, gop_paid_until(a.id,'live',NOW()) AS paid_until FROM gop_account_sessions s JOIN gop_accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>NOW()`, [hash(token)]);
  if (rows[0] && !accountEmailAllowed(rows[0].email)) throw new Error("ACCOUNT_RESTRICTED");
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
  const statuses = { LOGIN_REQUIRED: 401, INVALID_ORIGIN: 403, ACCOUNT_RESTRICTED: 403, NO_PURCHASE: 404, INVALID_MEMO: 400, PRO_REQUIRED: 402, INVALID_LOGIN: 400, ACCOUNTS_UNAVAILABLE: 503, ARCHIVE_LIMIT: 409 };
  const code = Object.hasOwn(statuses, error?.message) ? error.message : "ACCOUNTS_UNAVAILABLE";
  return accountResponse({ error: code }, statuses[code]);
}
export function accountLoginFailure(error, channel = "google") {
  const restricted = error?.message === "ACCOUNT_RESTRICTED";
  const unavailable = error?.message === "ACCOUNTS_UNAVAILABLE";
  const code = restricted ? "ACCOUNT_RESTRICTED" : unavailable ? "ACCOUNTS_UNAVAILABLE" : "INVALID_LOGIN";
  const ko = restricted ? "현재 계정 기능은 제한 검증 중입니다. 익명 분석은 계속 이용할 수 있습니다. 저장한 기록을 삭제한 것은 아닙니다." : channel === "email" ? "로그인 링크를 요청한 브라우저에서 다시 열어 주세요. 링크가 만료됐거나 이미 사용됐다면 새 링크를 요청하세요." : "로그인을 완료하지 못했습니다. 원래 분석 화면으로 돌아가 다시 시도해 주세요.";
  const en = restricted ? "Account features are currently in a restricted pilot. Anonymous analysis remains available. Your saved records have not been deleted." : channel === "email" ? "Open this link in the browser where you requested it. If it has expired or was already used, request a new link." : "Sign-in could not be completed. Return to your analysis and try again.";
  const nonce = randomBytes(16).toString("base64");
  return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>로그인 안내 · Sign-in help</title><main><h1>로그인 안내 <span lang="en">· Sign-in help</span></h1><p>${ko}</p><p lang="en">${en}</p><p><a href="/start">익명 분석 계속하기</a> · <a href="/en/start" lang="en">Continue anonymous analysis</a></p><p>원래 창의 로그인 버튼으로 다시 시도할 수 있습니다. <span lang="en">You can retry from the sign-in button in your original window.</span></p></main><script nonce="${nonce}">if(window.opener){window.opener.postMessage({type:"gop-account-failed",code:"${code}"},location.origin)}</script></html>`, { status: restricted ? 403 : unavailable ? 503 : 400, headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'` } });
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
  if (!accountEmailAllowed(identity.email)) throw new Error("ACCOUNT_RESTRICTED");
  const account = (await accountDatabase().query("INSERT INTO gop_accounts(id,google_sub,email) VALUES($1,$2,$3) ON CONFLICT(google_sub) DO UPDATE SET email=EXCLUDED.email RETURNING id", [randomUUID(), identity.sub, identity.email])).rows[0];
  return issueAccountSession(account.id);
}
export async function issueAccountSession(accountId) {
  const account = (await accountDatabase().query("SELECT email FROM gop_accounts WHERE id=$1", [accountId])).rows[0];
  if (!account) throw new Error("INVALID_LOGIN");
  if (!accountEmailAllowed(account.email)) throw new Error("ACCOUNT_RESTRICTED");
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
