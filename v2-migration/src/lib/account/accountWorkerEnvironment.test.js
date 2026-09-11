import { afterEach, expect, it, vi } from "vitest";
const start = vi.hoisted(() => vi.fn());
vi.mock("./accountMailWorker", () => ({ startAccountMailWorker: start }));
import { register } from "../../instrumentation";
import { accountsEnabled } from "./accountServer";
afterEach(() => { vi.unstubAllEnvs(); start.mockClear(); });
it.each(["pr-862", "staging", ""])("does not start production mail in %s", async environment => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_RUNTIME", "nodejs"); vi.stubEnv("GOP_SERVICE_WORKER", "true"); vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", environment);
  await register(); expect(start).not.toHaveBeenCalled();
});
it("does not expose inherited account credentials in a PR deployment", () => {
  vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "pr-862"); vi.stubEnv("ACCOUNTS_ENABLED", "true"); vi.stubEnv("GOOGLE_CLIENT_ID", "fixture"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "fixture"); vi.stubEnv("PAYMENTS_DATABASE_URL", "fixture");
  expect(accountsEnabled()).toBe(false);
});
it("starts the enabled Railway production worker", async () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_RUNTIME", "nodejs"); vi.stubEnv("GOP_SERVICE_WORKER", "true"); vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "production");
  await register(); expect(start).toHaveBeenCalledOnce();
});
