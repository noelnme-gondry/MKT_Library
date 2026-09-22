import { afterEach, expect, it, vi } from "vitest";

const { query, connect, end } = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), end: vi.fn() }));
vi.mock("pg", () => ({ default: { Client: class { constructor() { this.query = query; this.connect = connect; this.end = end; } } } }));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); process.exitCode = 0; });
it("creates the survey table inside the startup transaction before serving requests", async () => {
  vi.stubEnv("PAYMENTS_DATABASE_URL", "postgres://test.invalid/test");
  vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "production");
  connect.mockResolvedValue(); end.mockResolvedValue();
  query.mockImplementation(async sql => sql.startsWith("SELECT to_regclass") ? { rows: [{ orders: "gop_payment_orders", accounts: "gop_accounts" }] } : { rows: [] });
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../../../scripts/migrate-payment-periods.mjs");
  const statements = query.mock.calls.map(call => call[0]);
  const index = statements.findIndex(sql => sql.includes("CREATE TABLE IF NOT EXISTS gop_source_survey"));
  expect(index).toBeGreaterThan(statements.indexOf("BEGIN"));
  expect(index).toBeLessThan(statements.indexOf("COMMIT"));
  expect(statements[index]).not.toMatch(/DROP|TRUNCATE/);
});
