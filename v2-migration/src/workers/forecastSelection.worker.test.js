import { describe, expect, it } from "vitest";
import { buildAttributedForecastDataset } from "../utils/attributedForecastDataset";
import {
  backgroundCandidateCap,
  executeForecastSelectionTasks,
  hydrateForecastConfig,
  scanAnnualRegimeWindows,
  scanMmmRegimeWindows,
  slicePanel,
} from "./forecastSelection.worker";

function panelWithFeatures(channelCount, dummyCount = 0, stepCount = 0, externalCount = 0) {
  return {
    week: [1],
    ch: Object.fromEntries(Array.from({ length: channelCount }, (_, index) => [
      `channel-${index}`,
      [1],
    ])),
    dummy: Object.fromEntries(Array.from({ length: dummyCount }, (_, index) => [
      `dummy-${index}`,
      [0],
    ])),
    steps: Object.fromEntries(Array.from({ length: stepCount }, (_, index) => [
      `step-${index}`,
      [0],
    ])),
    external: Object.fromEntries(Array.from({ length: externalCount }, (_, index) => [
      `external-${index}`,
      [0],
    ])),
    targets: { Regs: [1] },
  };
}

describe("forecast selection worker contract", () => {
  it("expands the background search without making complexity unbounded", () => {
    expect(backgroundCandidateCap(panelWithFeatures(8))).toBe(40);
    expect(backgroundCandidateCap(panelWithFeatures(17))).toBe(24);
    expect(backgroundCandidateCap(panelWithFeatures(33))).toBe(16);
    expect(backgroundCandidateCap(panelWithFeatures(30, 2, 1))).toBe(16);
    expect(backgroundCandidateCap(panelWithFeatures(8, 0, 0, 9))).toBe(24);
    const hydrated = hydrateForecastConfig({ absorbed: ["channel-1"] });
    expect(hydrated.absorbed).toEqual(new Set(["channel-1"]));
    expect(typeof hydrated.hacAutoLag).toBe("function");
  });

  it("returns keyed honest failures instead of crashing the worker batch", () => {
    const task = {
      id: "short",
      panel: panelWithFeatures(1),
      cfg: { absorbed: new Set() },
      target: "Regs",
      horizon: 13,
    };
    const results = executeForecastSelectionTasks(structuredClone([task]));
    expect(results.short.enabled).toBe(false);
    expect(results.short.reason).toBe("insufficient-history");
    expect(results.short.horizon).toBe(13);
    expect(() => structuredClone(results)).not.toThrow();
  });

  it("keeps missing-source regime scans explicit", () => {
    expect(scanMmmRegimeWindows({ models: [] })).toMatchObject({
      available: false,
      reason: "missing-source",
    });
    expect(scanAnnualRegimeWindows({})).toMatchObject({
      available: false,
      reason: "missing-source",
    });
  });

  it("keeps external controls aligned when slicing to the current regime", () => {
    const panel = {
      ...panelWithFeatures(1),
      week: [1, 2, 3, 4],
      ch: { media: [10, 20, 30, 40] },
      reach: { media: [1, 2, 3, 4] },
      frequency: { media: [5, 6, 7, 8] },
      external: { market: [100, 200, 300, 400] },
      geo: ["A", "B", "C", "D"],
      targets: { Regs: [1, 2, 3, 4] },
    };
    expect(slicePanel(panel, 2)).toMatchObject({
      week: [3, 4],
      ch: { media: [30, 40] },
      reach: { media: [3, 4] },
      frequency: { media: [7, 8] },
      external: { market: [300, 400] },
      geo: ["C", "D"],
      targets: { Regs: [3, 4] },
    });
  });

  it("routes annual and attributed work without falling through to MMM selection", () => {
    const results = executeForecastSelectionTasks([
      { id: "annual", kind: "annual-router", args: {} },
      { id: "attributed", kind: "attributed-router", dataset: null, horizon: 13 },
    ]);
    expect(results).toHaveProperty("annual");
    expect(results).toHaveProperty("attributed");
    expect(results.annual).toBeNull();
    expect(results.attributed).toBeNull();
    expect(() => structuredClone(results)).not.toThrow();
  });

  it("tags unexpected task errors so the UI can use its painted sync fallback", () => {
    const panel = {};
    Object.defineProperty(panel, "week", {
      get() {
        throw new Error("synthetic worker failure");
      },
    });
    expect(executeForecastSelectionTasks([{
      id: "broken",
      panel,
      cfg: {},
      target: "Regs",
      horizon: 13,
    }]).broken).toMatchObject({
      workerError: true,
      kind: "mmm-selection",
      reason: "worker-task-error",
      message: "synthetic worker failure",
    });
  });

  it("returns cloneable non-null annual and attributed results", () => {
    const length = 120;
    const week = Array.from({ length }, (_, index) => index + 1);
    const values = week.map((value) =>
      2000 + value * 3 + Math.sin((2 * Math.PI * value) / 52) * 180);
    const panel = (ratio) => ({
      week,
      weekLabel: week.map((value) => `W${value}`),
      targets: { Regs: values.map((value) => value * ratio) },
    });
    const annual = executeForecastSelectionTasks([{
      id: "annual-live",
      kind: "annual-router",
      args: {
        totalPanel: panel(1),
        androidPanel: panel(0.6),
        iosPanel: panel(0.4),
        target: "Regs",
        horizon: 12,
      },
    }])["annual-live"];
    expect(annual?.selected).toBeTruthy();
    expect(() => structuredClone(annual)).not.toThrow();

    const start = Date.UTC(2023, 0, 2);
    const rows = [];
    for (let index = 0; index < 74; index++) {
      const date = new Date(start + index * 7 * 86400000).toISOString().slice(0, 10);
      ["ANDROID", "IOS"].forEach((platform, platformIndex) => {
        const cost = 100 + index * 2 + platformIndex * 20;
        rows.push({ week: date, platform, channel: "Organic", cost: 0, regs: 900 + index * 4 });
        rows.push({ week: date, platform, channel: "Meta", cost, regs: 18 + Math.sqrt(cost) * 5 });
      });
    }
    const dataset = buildAttributedForecastDataset(rows, {
      timeHeader: "week",
      platformHeader: "platform",
      channelHeader: "channel",
      spendHeader: "cost",
      targetHeader: "regs",
    }, { asOfDate: "2030-01-01" });
    const attributed = executeForecastSelectionTasks([{
      id: "attributed-live",
      kind: "attributed-router",
      dataset,
      horizon: 12,
    }])["attributed-live"];
    expect(attributed?.forecast?.predicted).toHaveLength(12);
    expect(() => structuredClone(attributed)).not.toThrow();
  });
});
