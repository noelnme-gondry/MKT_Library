import { pathToFileURL } from "node:url";
import pg from "pg";

// Read-only preflight. Never print keys, connection strings or provider payloads.
export function nicepayReadiness(env = process.env) {
  const checks = [
    ["server_basic_model", env.NICEPAY_APPROVAL_MODEL === "server-basic"],
    ["explicit_mode", ["test", "live"].includes(env.NICEPAY_MODE)],
    ["nicepay_client_key_present", Boolean(env.NICEPAY_CLIENT_KEY?.trim())],
    ["nicepay_secret_key_present", Boolean(env.NICEPAY_SECRET_KEY?.trim())],
    ["database_configured", Boolean(env.PAYMENTS_DATABASE_URL)],
    ["account_login_configured", env.ACCOUNTS_ENABLED === "true" && Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)],
    ["account_environment_allowed", !env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_ENVIRONMENT_NAME === "production"],
    ["sandbox_is_not_production", env.NICEPAY_MODE !== "test" || env.NODE_ENV !== "production"],
  ].map(([id, passed]) => ({ id, passed }));
  return {
    selectedProvider: ["toss", "nicepay"].includes(env.PAYMENTS_PROVIDER || "toss") ? env.PAYMENTS_PROVIDER || "toss" : "unknown",
    nicepayMode: ["test", "live"].includes(env.NICEPAY_MODE) ? env.NICEPAY_MODE : "unknown",
    livePurchasesAllowed: env.PAYMENTS_LIVE_ENABLED === "true",
    signupRestricted: env.ACCOUNT_ALLOWED_EMAILS !== undefined,
    checks,
    configurationPrepared: checks.every(check => check.passed),
    unverified: ["merchant_activation", "credential_authentication", "browser_card_flow", "external_webhook_delivery", "live_purchase_and_refund", "ga_purchase_receipt"],
  };
}

export async function inspectPaymentDatabase(client, env = process.env) {
  await client.query("BEGIN READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='10s'");
    const schema = (await client.query(`SELECT
      to_regclass('gop_payment_orders') IS NOT NULL AS orders,
      to_regclass('gop_accounts') IS NOT NULL AS accounts,
      to_regprocedure('gop_paid_until(uuid,text,timestamp with time zone)') IS NOT NULL AS coverage,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=ANY(current_schemas(false)) AND table_name='gop_payment_orders' AND column_name='provider') AS provider,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=ANY(current_schemas(false)) AND table_name='gop_payment_orders' AND column_name='starts_at') AS periods`)).rows[0];
    if (!schema || !Object.values(schema).every(value => value === true)) return { schemaReady: false, schema, orders: [], blockers: ["payment_schema_migration_required"] };
    const orders = (await client.query(`SELECT provider, mode, status, COUNT(*)::integer AS count
      FROM gop_payment_orders GROUP BY provider, mode, status ORDER BY provider, mode, status`)).rows;
    const blockers = [];
    for (const order of orders) {
      if (!["toss", "nicepay"].includes(order.provider)) blockers.push("unknown_order_provider");
      if (order.provider === "toss" && !env.TOSS_SECRET_KEY?.startsWith(`${order.mode}_gsk_`)) blockers.push(`retain_toss_${order.mode}_credentials`);
      if (order.provider === "nicepay" && (env.NICEPAY_MODE !== order.mode || !env.NICEPAY_CLIENT_KEY || !env.NICEPAY_SECRET_KEY)) blockers.push(`retain_nicepay_${order.mode}_credentials`);
    }
    return { schemaReady: true, schema, orders, blockers: [...new Set(blockers)] };
  } finally { await client.query("ROLLBACK"); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = nicepayReadiness();
  if (process.argv.includes("--database")) {
    const client = new pg.Client({ connectionString: process.env.PAYMENTS_DATABASE_URL, connectionTimeoutMillis: 10000 });
    try {
      if (!process.env.PAYMENTS_DATABASE_URL) throw new Error("DATABASE_REQUIRED");
      await client.connect();
      report.database = await inspectPaymentDatabase(client);
    } catch { report.database = { schemaReady: false, blockers: ["database_check_unavailable"] }; }
    finally { await client.end().catch(() => {}); }
  }
  report.cutoverConfigurationReady = report.configurationPrepared && report.nicepayMode === "live"
    && !report.signupRestricted && report.database?.schemaReady === true && report.database.blockers.length === 0;
  // Configuration readiness is explicitly not proof of successful payment.
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes("--expect-ready") && !report.cutoverConfigurationReady) process.exitCode = 1;
}
