import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { accountDatabase, accountSameOrigin, accountSessionCookie, accountsEnabled, accountCookie } from "./accountServer";
import { accountEmailAllowed } from "./accountAccess";

const derive = promisify(scrypt);
// Card-network review requires a plain id/password sign-in. Social sign-in stays the
// only public path, so this is opened per account by server setting, never to everyone.
const KDF = { N: 16384, r: 8, p: 1, keyLength: 64 };
const FORMAT = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([a-f0-9]+)\$([a-f0-9]+)$/;
const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW = 15 * 60 * 1000;
// Per-process only. Replica-wide throttling stays with the shared request limiter and
// the edge; this bounds repeated guesses against one id inside a single instance.
const attempts = new Map();

export function passwordLoginEmails() {
  return (process.env.ACCOUNT_PASSWORD_LOGINS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
}
export function passwordLoginsEnabled() {
  return accountsEnabled() && passwordLoginEmails().length > 0;
}
export function passwordLoginAllowed(email) {
  return typeof email === "string" && passwordLoginEmails().includes(email.trim().toLowerCase());
}

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 200) throw new Error("INVALID_LOGIN");
  const salt = randomBytes(16);
  const key = await derive(password, salt, KDF.keyLength, { N: KDF.N, r: KDF.r, p: KDF.p });
  return `scrypt$${KDF.N}$${KDF.r}$${KDF.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(stored, password) {
  const parts = FORMAT.exec(typeof stored === "string" ? stored : "");
  if (!parts || typeof password !== "string" || !password || password.length > 200) return false;
  const [, N, r, p, salt, expected] = parts;
  const key = await derive(password, Buffer.from(salt, "hex"), expected.length / 2, { N: Number(N), r: Number(r), p: Number(p) });
  const target = Buffer.from(expected, "hex");
  return key.length === target.length && timingSafeEqual(key, target);
}

function admitAttempt(email, now = Date.now()) {
  for (const [key, value] of attempts) if (now - value.at >= ATTEMPT_WINDOW) attempts.delete(key);
  const key = email.trim().toLowerCase();
  const entry = attempts.get(key);
  const value = entry && now - entry.at < ATTEMPT_WINDOW ? entry : { at: now, count: 0 };
  attempts.set(key, value);
  if (value.count >= ATTEMPT_LIMIT) return false;
  value.count++;
  return true;
}
export function clearPasswordAttempts(email) {
  attempts.delete(String(email).trim().toLowerCase());
}

export async function signInWithPassword(request, email, password) {
  accountSameOrigin(request);
  if (!passwordLoginsEnabled()) throw new Error("ACCOUNTS_UNAVAILABLE");
  if (typeof email !== "string" || email.length > 254 || typeof password !== "string" || !password || password.length > 200) throw new Error("INVALID_LOGIN");
  if (!admitAttempt(email)) throw new Error("INVALID_LOGIN");
  // Gate on the configured list before touching the database so an unlisted id cannot
  // be used to probe which addresses exist.
  if (!passwordLoginAllowed(email) || !accountEmailAllowed(email)) throw new Error("INVALID_LOGIN");
  const { rows } = await accountDatabase().query("SELECT id, password_hash FROM gop_accounts WHERE lower(email)=lower($1) AND password_hash IS NOT NULL", [email.trim()]);
  // Two identities may share an address, so never guess which one a password belongs to.
  if (rows.length > 1) throw new Error("INVALID_LOGIN");
  if (!await verifyPassword(rows[0]?.password_hash, password)) throw new Error("INVALID_LOGIN");
  clearPasswordAttempts(email);
  const cookie = await accountSessionCookie(rows[0].id);
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookie);
  headers.append("Set-Cookie", accountCookie("gop_oauth_state", "", 0));
  return Response.json({ ok: true }, { headers });
}
