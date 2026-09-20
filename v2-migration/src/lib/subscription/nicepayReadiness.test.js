import { expect, it, vi } from "vitest";
import { nicepayReadiness, inspectPaymentDatabase } from "../../../scripts/check-nicepay-readiness.mjs";

const env = { NICEPAY_APPROVAL_MODEL: "server-basic", NICEPAY_MODE: "live", NICEPAY_CLIENT_KEY: "private-client", NICEPAY_SECRET_KEY: "private-secret", PAYMENTS_DATABASE_URL: "private-db", ACCOUNTS_ENABLED: "true", GOOGLE_CLIENT_ID: "private-google", GOOGLE_CLIENT_SECRET: "private-google-secret", NODE_ENV: "production" };
it("can prepare NICEPAY without switching new Toss purchases or disclosing secrets", () => {
  const report = nicepayReadiness(env);
  expect(report).toMatchObject({ configurationPrepared: true, selectedProvider: "toss", livePurchasesAllowed: false });
  expect(JSON.stringify(report)).not.toContain("private-");
  expect(report.unverified).toContain("live_purchase_and_refund");
});
it("does not pass unsupported models, production sandbox, or missing keys", () => {
  for (const override of [{ NICEPAY_APPROVAL_MODEL: "client" }, { NICEPAY_MODE: "test" }, { NICEPAY_SECRET_KEY: "" }, { RAILWAY_ENVIRONMENT_NAME: "preview" }]) {
    expect(nicepayReadiness({ ...env, ...override }).configurationPrepared).toBe(false);
  }
});
it("checks mixed-provider credentials in a read-only transaction without exposing orders", async () => {
  const client = { query: vi.fn(async sql => ({ rows: sql.startsWith("SELECT\n")
    ? [{ orders: true, accounts: true, coverage: true, provider: true, periods: true }]
    : sql.startsWith("SELECT provider") ? [{ provider: "toss", mode: "live", status: "paid", count: 2 }] : [] })) };
  const result = await inspectPaymentDatabase(client, env);
  expect(result.blockers).toEqual(["retain_toss_live_credentials"]);
  expect(client.query.mock.calls[0][0]).toBe("BEGIN READ ONLY");
  expect(client.query.mock.calls.at(-1)[0]).toBe("ROLLBACK");
  expect(client.query.mock.calls.some(([sql]) => /^(UPDATE|DELETE|INSERT|ALTER)/.test(sql))).toBe(false);
});
