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
      target: "Regs",
      importance: [{ name: "Meta", kind: "media", importance: 4.2 }],
      channelModels: [
        {
          key: "meta", label: "Meta", observedMin: 1_000_000, observedMax: 8_000_000,
          recentSpend: 4_000_000, activeWeeks: 100, uniqueSpendValues: 20, spendCv: 0.3,
          collinearityGroup: ["meta"], coefficient: 0.2, positiveFoldShare: 1, foldChannelCoefficients: [0.18, 0.21],
          terms: [{ alpha: 0.3, coefficient: 0.2, foldCoefficients: [0.18, 0.21], lastAdstock: 5_000_000 }],
        },
        {
          key: "google", label: "Google", observedMin: 1_000_000, observedMax: 7_000_000,
          recentSpend: 3_000_000, activeWeeks: 95, uniqueSpendValues: 18, spendCv: 0.28,
          collinearityGroup: ["google"], coefficient: 0.14, positiveFoldShare: 1, foldChannelCoefficients: [0.12, 0.15],
          terms: [{ alpha: 0.6, coefficient: 0.14, foldCoefficients: [0.12, 0.15], lastAdstock: 6_000_000 }],
        },
      ],
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
      rollingBacktest: { cuts: [78, 96], horizon: 12 },
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
    expect(await screen.findByText("채널별 예측 반응곡선")).toBeTruthy();
    expect(screen.getByText("예산 추천 안전 게이트")).toBeTruthy();
    expect(screen.getByText("WebR 조건부 예산 배분")).toBeTruthy();
    expect(screen.queryByText(/Classic/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Bayesian MMM/ }));
    expect(screen.getByText(/채널 기여·반응곡선·예산 진단은 Bayesian MMM 결과/)).toBeTruthy();
  });

  it("keeps the English panel free of Korean UI copy", async () => {
    const { container } = render(<WebRMmmAdvanced mmm={mmmFixture()} signature="sig" locale="en" />);
    expect(await screen.findByText("Automatic MMM model comparison")).toBeTruthy();
    expect(container.textContent).not.toMatch(/[가-힣]/);
  });
});
