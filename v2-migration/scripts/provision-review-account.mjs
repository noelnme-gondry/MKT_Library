// Create or update the id/password account a card-network reviewer signs in with.
// Run manually against the payments database; never in the request path.
//
//   REVIEW_ACCOUNT_EMAIL=... REVIEW_ACCOUNT_PASSWORD=... \
//   PAYMENTS_DATABASE_URL=... node scripts/provision-review-account.mjs
//
// The password is read from the environment and never written to this repository,
// logged, or echoed. Add the same address to ACCOUNT_PASSWORD_LOGINS (and to
// ACCOUNT_ALLOWED_EMAILS when that allow list is set) so the sign-in is accepted.
import { randomUUID, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const derive = promisify(scrypt);
const email = (process.env.REVIEW_ACCOUNT_EMAIL || "").trim();
const password = process.env.REVIEW_ACCOUNT_PASSWORD || "";
const url = process.env.PAYMENTS_DATABASE_URL;

if (!url) { console.error("PAYMENTS_DATABASE_URL is required."); process.exit(1); }
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error("REVIEW_ACCOUNT_EMAIL must be an email address."); process.exit(1); }
if (password.length < 12 || password.length > 200) { console.error("REVIEW_ACCOUNT_PASSWORD must be 12-200 characters."); process.exit(1); }

const salt = randomBytes(16);
const key = await derive(password, salt, 64, { N: 16384, r: 8, p: 1 });
const hash = `scrypt$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const existing = await client.query("SELECT id FROM gop_accounts WHERE lower(email)=lower($1)", [email]);
  if (existing.rows.length > 1) throw new Error("MULTIPLE_ACCOUNTS_FOR_EMAIL");
  if (existing.rows.length === 1) {
    await client.query("UPDATE gop_accounts SET password_hash=$2 WHERE id=$1", [existing.rows[0].id, hash]);
    console.log("Password set on the existing account for this address.");
  } else {
    // No trial is started and no purchase is granted: the reviewer sees the free state.
    await client.query("INSERT INTO gop_accounts(id,google_sub,email,password_hash) VALUES($1,NULL,$2,$3)", [randomUUID(), email, hash]);
    console.log("Review account created in the free state.");
  }
} catch (error) {
  console.error("Provisioning failed:", error.message);
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
