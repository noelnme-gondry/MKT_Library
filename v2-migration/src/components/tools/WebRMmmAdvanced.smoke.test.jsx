/* @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WebRMmmAdvanced from "@/components/tools/WebRMmmAdvanced";
import { runWebRMmmElasticNet } from "@/lib/analysis/webr/mmmElasticNet";

vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));
vi.mock("@/lib/analysis/webr/mmmElasticNet", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    runWebRMmmElasticNet: vi.fn(async () => ({
      status: "complete",
      n: 120,
      folds: 2,
      horizon: 12,
      alpha: 0.5,
      nonzeroFeatures: 7,
      wmape: 8,
      baselineWmape: 10,
      relativeGain: 0.2,
      recommendation: "predictive_replacement_candidate",
      importance: [{ name: "Meta", kind: "media", importance: 4.2 }],
    })),
  };
});

function mmmFixture() {
  const week = Array.from({ length: 120 }, (_, index) => index + 1);
  const spend = week.map((_, index) => 100 + (index % 8) * 10);
  return {
    panel: {
      week,
      targets: { Regs: week.map((_, index) => 500 + index * 2 + spend[index]) },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
      ch: { meta: spend },
      dummy: {},
      steps: {},
      external: {},
    },
    target: "Regs",
    run: {
      methodLabel: "Classic MMM",
      aggregateRollingBacktest: { cuts: [78, 96], horizon: 12 },
      backtest: { wmape: 10 },
    },
  };
}

describe("WebRMmmAdvanced render smoke", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs the WebR challenger and limits a win to the predictive layer", async () => {
    render(<WebRMmmAdvanced mmm={mmmFixture()} signature="sig" />);
    fireEvent.click(screen.getByRole("button", { name: "WebR MMM 맞대결 실행" }));

    expect(runWebRMmmElasticNet).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(await screen.findByText("예측 엔진 교체 후보")).toBeTruthy();
    expect(screen.getByText(/채널 기여·예산 결정은 별도 검증 전까지/)).toBeTruthy();
  });

  it("keeps the English panel free of Korean UI copy", () => {
    const { container } = render(<WebRMmmAdvanced mmm={mmmFixture()} signature="sig" locale="en" />);
    expect(container.textContent).toContain("Elastic-net MMM challenger");
    expect(container.textContent).not.toMatch(/[가-힣]/);
  });
});
