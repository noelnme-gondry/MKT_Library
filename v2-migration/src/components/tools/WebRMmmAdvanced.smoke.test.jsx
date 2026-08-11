/* @vitest-environment jsdom */
import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WebRMmmAdvanced, { webRMmmDisplayLabel } from "@/components/tools/WebRMmmAdvanced";
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
      lambdaFactor: 0.01,
      nonzeroFeatures: 7,
      wmape: 8,
      baselineWmape: 10,
      relativeGain: 0.2,
      recommendation: "predictive_replacement_candidate",
      target: "Regs",
      foldWmapes: [7.5, 8.5],
      fit: {
        labels: ["W1", "W2", "W3"], actual: [500, 520, 540], fitted: [505, 518, 538],
        r2: 0.96, rmse: 3.4, wmape: 0.7,
        drivers: [
          { name: "Baseline", kind: "baseline", values: [450, 450, 450], meanContribution: 450, rmsContribution: 450, rmsShare: 0.8 },
          { name: "Trend", kind: "control", values: [10, 20, 30], meanContribution: 20, rmsContribution: 21.6, rmsShare: 0.04 },
          { name: "Seasonality", kind: "control", values: [5, -3, 2], meanContribution: 1.3, rmsContribution: 3.6, rmsShare: 0.01 },
          { name: "meta_spend", kind: "media", values: [40, 51, 56], meanContribution: 49, rmsContribution: 49.5, rmsShare: 0.09 },
        ],
      },
      importance: [{ name: "Meta", kind: "media", importance: 4.2 }],
      coefficients: [
        { name: "trend", group: "Trend", coefficient: 0.2, foldCoefficients: [0.18, 0.22] },
        { name: "annual_sin_1", group: "Seasonality", coefficient: 0.1, foldCoefficients: [0.08, 0.12] },
        { name: "media_meta_adstock_0.3", group: "meta_spend", coefficient: 0.2, foldCoefficients: [0.18, 0.21] },
      ],
      channelModels: [
        {
          key: "meta", label: "Meta", observedMin: 1_000_000, observedMax: 8_000_000,
          recentSpend: 4_000_000, recentActiveWeeks: 12, activeWeeks: 100, uniqueSpendValues: 20, spendCv: 0.3,
          collinearityGroup: ["meta"], coefficient: 0.2, hasCompleteFoldEvidence: true, positiveFoldShare: 1, foldChannelCoefficients: [0.18, 0.21],
          terms: [{ alpha: 0.3, coefficient: 0.2, foldCoefficients: [0.18, 0.21], lastAdstock: 5_000_000 }],
        },
        {
          key: "google", label: "Google", observedMin: 1_000_000, observedMax: 7_000_000,
          recentSpend: 3_000_000, recentActiveWeeks: 12, activeWeeks: 95, uniqueSpendValues: 18, spendCv: 0.28,
          collinearityGroup: ["google"], coefficient: 0.14, hasCompleteFoldEvidence: true, positiveFoldShare: 1, foldChannelCoefficients: [0.12, 0.15],
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

  it("turns raw spend headers into readable display labels without changing model keys", () => {
    expect(webRMmmDisplayLabel("google_spend", "ko")).toBe("Google");
    expect(webRMmmDisplayLabel("annual_sin_1", "en")).toBe("Annual Sin 1");
  });

  it("automatically compares both models, selects the winner, and allows an explicit choice", async () => {
    function Harness() {
      const [selectedModel, setSelectedModel] = useState("bayesian");
      return <WebRMmmAdvanced mmm={mmmFixture()} signature="sig" selectedModel={selectedModel} onSelectModel={setSelectedModel} />;
    }
    render(<Harness />);

    await waitFor(() => expect(runWebRMmmElasticNet).toHaveBeenCalledWith(expect.objectContaining({ ok: true })));
    expect(await screen.findByText("예측 정확도 승자: WebR Elastic-net")).toBeTruthy();
    expect(await screen.findByText("1. 실제 성과를 얼마나 설명했나")).toBeTruthy();
    expect(screen.getByText("2. 무엇이 성과를 설명했나")).toBeTruthy();
    expect(screen.getByText("3. 채널 계수는 검증구간에서도 유지됐나")).toBeTruthy();
    expect(screen.getByText("4. 지출을 바꾸면 예측이 어떻게 달라지나")).toBeTruthy();
    expect(screen.getByText("5. 예산 변경을 추천해도 안전한가")).toBeTruthy();
    expect(screen.getByText("예산 추천 안전 게이트")).toBeTruthy();
    expect(screen.getByText("WebR 조건부 예산 배분")).toBeTruthy();
    expect(screen.queryByText(/Classic/)).toBeNull();
    expect(screen.getAllByRole("radio").filter((radio) => radio.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Meta" }).getAttribute("aria-pressed")).toBe("true");
    const bayesian = screen.getByRole("radio", { name: /Bayesian MMM/ });
    fireEvent.click(bayesian);
    expect(screen.getByText(/채널 기여·반응곡선·예산 진단은 Bayesian MMM 결과/)).toBeTruthy();
    fireEvent.keyDown(bayesian, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: /WebR Elastic-net/ }).getAttribute("aria-checked")).toBe("true");
    expect(document.body.textContent).not.toContain("confidence interval");
  });

  it("keeps the English panel free of Korean UI copy", async () => {
    const { container } = render(<WebRMmmAdvanced mmm={mmmFixture()} signature="sig" locale="en" />);
    expect(await screen.findByText("MMM result model")).toBeTruthy();
    expect(container.textContent).not.toMatch(/[가-힣]/);
  });
});
