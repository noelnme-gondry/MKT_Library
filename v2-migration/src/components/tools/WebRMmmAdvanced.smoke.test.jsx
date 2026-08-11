/* @vitest-environment jsdom */
import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      methodLabel: "Bayesian MMM",
      aggregateRollingBacktest: { cuts: [78, 96], horizon: 12 },
      backtest: { wmape: 10 },
    },
  };
}

describe("WebRMmmAdvanced render smoke", () => {
  beforeEach(() => vi.clearAllMocks());

  it("automatically compares both models, selects the winner, and allows an explicit choice", async () => {
    function Harness() {
      const [selectedModel, setSelectedModel] = useState("bayesian");
      return <WebRMmmAdvanced mmm={mmmFixture()} signature="sig" selectedModel={selectedModel} onSelectModel={setSelectedModel} />;
    }
    render(<Harness />);

    await waitFor(() => expect(runWebRMmmElasticNet).toHaveBeenCalledWith(expect.objectContaining({ ok: true })));
    expect(await screen.findByText("예측 정확도 승자: WebR Elastic-net")).toBeTruthy();
    expect(await screen.findByText("WebR 예측 중요도")).toBeTruthy();
    expect(screen.getByText("Robyn은 현재 브라우저 WebR에서 실행할 수 없습니다")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Bayesian MMM/ }));
    expect(screen.getByText(/채널 기여·반응곡선·예산 진단은 Bayesian MMM 결과/)).toBeTruthy();
  });

  it("keeps the English panel free of Korean UI copy", async () => {
    const { container } = render(<WebRMmmAdvanced mmm={mmmFixture()} signature="sig" locale="en" />);
    expect(await screen.findByText("Automatic MMM model comparison")).toBeTruthy();
    expect(container.textContent).not.toMatch(/[가-힣]/);
  });
});
