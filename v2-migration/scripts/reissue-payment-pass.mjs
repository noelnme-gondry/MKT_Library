import pg from "pg";
import { writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { reissuePass } from "../src/lib/subscription/reissuePass.js";

const args = process.argv.slice(2);
const value = flag => args[args.indexOf(flag) + 1];
if (!["--order", "--verified-case", "--output"].every(flag => args.includes(flag) && value(flag) && !value(flag).startsWith("--"))) {
  console.error("Usage: node scripts/reissue-payment-pass.mjs --order gop_UUID --verified-case CASE_ID --output /private/new-code.txt");
  process.exit(1);
}
const secret = process.env.TOSS_SECRET_KEY || "";
const mode = secret.startsWith("live_gsk_") ? "live" : secret.startsWith("test_gsk_") ? "test" : null;
if (!mode || !process.env.PAYMENTS_DATABASE_URL) { console.error("Payment configuration is missing."); process.exit(1); }
const db = new pg.Pool({ connectionString: process.env.PAYMENTS_DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
const output = resolve(value("--output"));
try {
  const result = await reissuePass({ db, orderId: value("--order"), verifiedCase: value("--verified-case"), mode,
    fetchPayment: async key => {
      const response = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(key)}`, { headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}` }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE");
      return response.json();
    },
    writeSecret: code => writeFile(output, `${code}\n`, { flag: "wx", mode: 0o600 }),
    removeSecret: () => unlink(output),
  });
  console.log(JSON.stringify({ status: "reissued", orderId: result.orderId, expiresAt: result.expiresAt, verifiedCase: result.verifiedCase }));
} catch { console.error("Reissue failed. Check verified ownership, payment status, configuration and an unused output path. No credential is printed."); process.exitCode = 1; }
finally { await db.end(); }
