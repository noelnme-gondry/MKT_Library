import { describe, expect, it } from "vitest";
import { buildDemoCsv } from "./demoData";
import { MMM_METH_CONFIG, mmmBayesianLikeRun, mmmResolveAbsorb } from "./mmmMath";
import { buildMmmWeeklyPerformance } from "./mmmWeeklyPerformance";

/*
 * MMM 점추정은 MAP 하나다(§7 "절단 사후분포의 평균을 점예측으로 쓰지 말 것").
 * 2026-10 감사 전에는 주별 분해·적합선은 MAP, 채널 기여표·반응곡선은 0으로 눌러 붙인
 * draw의 평균이라 같은 결과 안에서 Performance 합과 채널 합이 최대 2배 갈렸고, 효과 0인
 * 채널도 기여가 양수로 떴다. 실제 잠식 채널(계수가 0 경계에 붙음)은 구간 폭이 0이라
 * "식별됨 0%"로 표시됐다.
 */
function demoRun() {
  const d = buildDemoCsv("response");
  const keys = d.headers.filter((header) => header.endsWith("_spend"));
  const panel = {
    week: d.raw.map((_, index) => index + 1),
    ch: Object.fromEntries(keys.map((key) => [key, d.raw.map((row) => Number(row[key]) || 0)])),
    channels: keys.map((key) => ({ key, label: key, kind: key === "brand_spend" ? "brand" : "perf" })),
    targets: { Regs: d.raw.map((row) => Number(row.signups) || 0) },
    dummy: {}, steps: {},
  };
  const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
  cfg.absorbed = mmmResolveAbsorb(panel, cfg).absorbed;
  return { panel, run: mmmBayesianLikeRun(panel, cfg, "Regs", false, { enableBaselineSelection: true, skipTransformUncertainty: true, enableBusinessContributionPrior: true }) };
}

describe("MMM point estimates are MAP everywhere", () => {
  const { panel, run } = demoRun();

  it("channel table totals equal the weekly decomposition's media buckets", () => {
    const channelTotal = Object.values(run.channelContributions).reduce((sum, item) => sum + item.totalMean, 0);
    const bucketTotal = run.weeks.reduce((sum, week) => sum + (week.contrib.Performance || 0) + (week.contrib.Brand || 0), 0);
    expect(channelTotal).toBeGreaterThan(0);
    expect(Math.abs(channelTotal - bucketTotal) / bucketTotal).toBeLessThan(1e-6);
    const table = buildMmmWeeklyPerformance(panel, run.channelContributions);
    const tableTotal = table.reduce((sum, row) => sum + row.totalPredicted, 0);
    expect(Math.abs(tableTotal - bucketTotal) / bucketTotal).toBeLessThan(1e-6);
  });

  it("response curves and channel totals use the MAP coefficient, not the clamped-draw mean", () => {
    const posterior = run.posteriorApproximation.coefficientPosterior;
    run.channelMeta.forEach((channel) => {
      const coefficient = posterior[channel.key];
      expect(run.saturationByChannel[channel.key].ln_coef).toBe(coefficient.map);
      const index = run.names.indexOf(`media_${channel.key}`);
      expect(Math.max(0, run.absoluteBeta[index])).toBe(coefficient.map);
    });
    // 경계(MAP = 0) 채널은 draw 평균이 양수여도 기여 0이어야 한다.
    const boundary = run.channelMeta.filter((channel) => posterior[channel.key].map <= 1e-12);
    expect(boundary.length).toBeGreaterThan(0);
    boundary.forEach((channel) => {
      expect(posterior[channel.key].mean).toBeGreaterThanOrEqual(0);
      expect(run.channelContributions[channel.key].totalMean).toBe(0);
    });
  });

  it("labels a channel pinned at zero as boundary, never identified", () => {
    const identification = run.posteriorApproximation.channelIdentification;
    // 데모의 tiktok은 실제 잠식(음의 효과)으로 생성됐다 — 비음수 모형에선 0 경계에 붙는다.
    expect(identification.tiktok_spend.map).toBe(0);
    expect(identification.tiktok_spend.verdict).toBe("BOUNDARY/UNIDENTIFIED");
    ["google_spend", "meta_spend", "brand_spend"].forEach((key) => {
      expect(identification[key].verdict).toBe("IDENTIFIED");
    });
  });
});
