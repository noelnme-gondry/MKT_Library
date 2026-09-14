// Create or update the id/password account a card-network reviewer signs in with.
// Run manually; never in the request path. This is a command, not an environment
// variable: the only variable the running app needs is ACCOUNT_PASSWORD_LOGINS.
//
// With a database connection it writes the account directly:
//   REVIEW_ACCOUNT_EMAIL=... REVIEW_ACCOUNT_PASSWORD=... \
//   PAYMENTS_DATABASE_URL=... node scripts/provision-review-account.mjs
//
// Without one it prints SQL to paste into the database console instead, so an
// operator who cannot open a shell on the app service can still provision:
//   REVIEW_ACCOUNT_EMAIL=... REVIEW_ACCOUNT_PASSWORD=... node scripts/provision-review-account.mjs
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

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error("REVIEW_ACCOUNT_EMAIL must be an email address."); process.exit(1); }
if (password.length < 12 || password.length > 200) { console.error("REVIEW_ACCOUNT_PASSWORD must be 12-200 characters."); process.exit(1); }

const salt = randomBytes(16);
const key = await derive(password, salt, 64, { N: 16384, r: 8, p: 1 });
const hash = `scrypt$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
const sqlLiteral = value => `'${String(value).replace(/'/g, "''")}'`;

// No connection string: print the statements instead of guessing at a database.
// The hash already contains its own salt, so pasting this is equivalent to writing it here.
if (!url) {
  console.log(`-- Paste into the payments database console. Deploy first so password_hash exists.
INSERT INTO gop_accounts (id, google_sub, email, password_hash)
VALUES (gen_random_uuid(), NULL, ${sqlLiteral(email)}, ${sqlLiteral(hash)});

-- If this address already has an account, run this instead:
-- UPDATE gop_accounts SET password_hash=${sqlLiteral(hash)} WHERE lower(email)=lower(${sqlLiteral(email)});`);
  process.exit(0);
}

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
