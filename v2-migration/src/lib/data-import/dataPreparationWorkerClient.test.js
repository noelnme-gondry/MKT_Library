import { describe, expect, it } from "vitest";
import {
  DATA_PREPARATION_WORKER_THRESHOLD,
  prepareImportedData,
  shouldUseDataPreparationWorker,
} from "./dataPreparationWorkerClient";

describe("data preparation worker client", () => {
  it("uses a deterministic size gate", () => {
    expect(shouldUseDataPreparationWorker(DATA_PREPARATION_WORKER_THRESHOLD - 1)).toBe(false);
    expect(shouldUseDataPreparationWorker(DATA_PREPARATION_WORKER_THRESHOLD)).toBe(true);
    expect(shouldUseDataPreparationWorker(null)).toBe(false);
  });

  it("keeps the main-thread fallback byte-stable for small inputs", async () => {
    const result = await prepareImportedData({
      toolId: "5-2",
      headers: ["date", "cost", "installs"],
      raw: [{ date: "2026-01-01", cost: "100", installs: "2" }],
    });
    expect(result.insights.mapping).toMatchObject({ date: "date", cost: "cost", installs: "installs" });
    expect(result.canonicalData.summary.outputRows).toBe(1);
    expect(result.mappedRows[0].spend).toBe("100");
  });
});
