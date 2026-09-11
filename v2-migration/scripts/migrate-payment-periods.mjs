import pg from "pg";
import { readFile } from "node:fs/promises";

// Run before serving requests. No credentials or connection errors are printed.
if (process.env.PAYMENTS_DATABASE_URL && (!process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT_NAME === "production")) {
  const client = new pg.Client({ connectionString: process.env.PAYMENTS_DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("SELECT pg_advisory_xact_lock(71692501)");
    const { rows } = await client.query("SELECT to_regclass('gop_payment_orders') AS orders, to_regclass('gop_accounts') AS accounts");
    if (rows[0].orders && rows[0].accounts) {
      await client.query(await readFile(new URL("./payment-periods.sql", import.meta.url), "utf8"));
    } else if (process.env.ACCOUNTS_ENABLED === "true") throw new Error("ACCOUNT_SCHEMA_REQUIRED");
    await client.query("COMMIT");
    console.log("Payment period migration checked.");
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Payment period migration failed; startup stopped. Check database availability and schema.");
    process.exitCode = 1;
  } finally { await client.end().catch(() => {}); }
}
