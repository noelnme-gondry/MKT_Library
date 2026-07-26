import { describe, expect, it } from "vitest";
import {
  DASHBOARD_VERDICT_WORKER_THRESHOLD,
  runDashboardVerdict,
  shouldUseDashboardVerdictWorker,
} from "./dashboardVerdictWorkerClient";

describe("dashboard verdict worker client", () => {
  it("gates worker usage by row count", () => {
    expect(shouldUseDashboardVerdictWorker(DASHBOARD_VERDICT_WORKER_THRESHOLD - 1)).toBe(false);
    expect(shouldUseDashboardVerdictWorker(DASHBOARD_VERDICT_WORKER_THRESHOLD)).toBe(true);
  });

  it("keeps the small-input result path deterministic", async () => {
    const result = await runDashboardVerdict({ csvData: { raw: [] } });
    expect(result.insufficient).toBe(true);
  });
});
