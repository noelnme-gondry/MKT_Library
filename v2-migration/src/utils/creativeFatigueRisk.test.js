import { describe, expect, it } from "vitest";
import { CREATIVE_FATIGUE, CREATIVE_STATS } from "./creativeMath";
import { CREATIVE_CONFIG } from "./creativeConfig";

function buildRows({ creativeCount = 10, flat = false, days = 20 } = {}) {
  const rows = [];
  for (let c = 0; c < creativeCount; c++) {
    for (let day = 1; day <= days; day++) {
      const impressions = 2000;
      const ctr = flat
        ? 0.05
        : day <= 5
          ? 0.05
          : Math.max(0.01, 0.05 - (day - 5) * 0.005);
      rows.push({
        creative_id: `cr_${c}`,
        channel: c < creativeCount / 2 ? "Meta" : "Google",
        date: `2026-01-${String(day).padStart(2, "0")}`,
        impressions,
        clicks: Math.round(impressions * ctr),
        spend: 100 + c * 10,
      });
    }
  }
  return rows;
}

describe("CREATIVE_FATIGUE.buildRiskAnalysis", () => {
  it("learns channel risk zones from historical first signals", () => {
    const result = CREATIVE_FATIGUE.buildRiskAnalysis(
      buildRows(),
      CREATIVE_CONFIG.fatigueRisk,
    );

    expect(result.signals).toHaveLength(10);
    expect(result.historicalSignals).toHaveLength(10);
    expect(result.profiles.overall.sampleSize).toBe(10);
    expect(result.profiles.channels.Meta.sampleSize).toBe(5);
    expect(result.profiles.channels.Google.sampleSize).toBe(5);
    expect(result.profiles.overall.ageDays.median).toBeGreaterThanOrEqual(9);
    expect(result.profiles.overall.cumulativeImpressions.median).toBeGreaterThan(0);
    expect(result.profiles.overall.cumulativeSpend.median).toBeGreaterThan(0);
    expect(result.current.every((item) => item.isInRiskZone)).toBe(true);
  });

  it("backtests whether CTR falls further within 3 and 7 days", () => {
    const result = CREATIVE_FATIGUE.buildRiskAnalysis(
      buildRows(),
      CREATIVE_CONFIG.fatigueRisk,
    );

    expect(result.backtest[3].eligible).toBe(10);
    expect(result.backtest[3].hits).toBe(10);
    expect(result.backtest[3].hitRate).toBe(1);
    expect(result.backtest[7].eligible).toBe(10);
    expect(result.backtest[7].hits).toBe(10);
    expect(result.backtest[7].hitRate).toBe(1);
  });

  it("abstains when stable creatives provide no historical signal", () => {
    const result = CREATIVE_FATIGUE.buildRiskAnalysis(
      buildRows({ flat: true }),
      CREATIVE_CONFIG.fatigueRisk,
    );

    expect(result.signals).toHaveLength(0);
    expect(result.profiles.overall).toBeNull();
    expect(result.backtest[3].hitRate).toBeNull();
    expect(result.current.every((item) => item.isInRiskZone === false)).toBe(true);
  });

  it("aggregates duplicate creative-date rows before building cumulative dose", () => {
    const duplicated = buildRows({ creativeCount: 1 }).flatMap((row) => [
      { ...row, impressions: row.impressions / 2, clicks: row.clicks / 2, spend: row.spend / 2 },
      { ...row, impressions: row.impressions / 2, clicks: row.clicks / 2, spend: row.spend / 2 },
    ]);
    const result = CREATIVE_FATIGUE.buildRiskAnalysis(
      duplicated,
      { ...CREATIVE_CONFIG.fatigueRisk, minProfileSignals: 1 },
    );

    expect(result.snapshots).toHaveLength(20);
    expect(result.current[0].cumulativeImpressions).toBe(40000);
    expect(result.current[0].cumulativeSpend).toBe(2000);
  });

  it("keeps the same creative ID separate across channels", () => {
    const rows = buildRows({ creativeCount: 1 });
    const crossChannel = rows.flatMap((row) => [
      row,
      { ...row, channel: "TikTok" },
    ]);
    const result = CREATIVE_FATIGUE.buildRiskAnalysis(
      crossChannel,
      { ...CREATIVE_CONFIG.fatigueRisk, minProfileSignals: 1 },
    );

    expect(result.current).toHaveLength(2);
    expect(new Set(result.current.map((item) => item.channel))).toEqual(
      new Set(["Meta", "TikTok"]),
    );
    expect(result.current.every((item) => item.cumulativeImpressions === 40000)).toBe(true);
  });

  it("requires consecutive calendar days to confirm a decline signal", () => {
    const rows = buildRows({ creativeCount: 1 }).filter(
      (row) => !["2026-01-09", "2026-01-11"].includes(row.date),
    );
    const result = CREATIVE_FATIGUE.buildRiskAnalysis(
      rows,
      { ...CREATIVE_CONFIG.fatigueRisk, minProfileSignals: 1 },
    );

    expect(result.signals[0].date).not.toBe("2026-01-10");
    expect(result.signals[0].date).toBe("2026-01-14");
  });
});

describe("다채널 동일 소재 거짓 피로 회귀 (L5)", () => {
  // 같은 creative_id가 fb(CTR 5%)·ig(CTR 2%)에 매일 1행씩, 두 채널 모두 완전 평탄.
  // 옛 버그: creative_id로만 그룹핑 → 채널별 CTR이 시계열에 인터리브 → 톱니 하락으로
  // 건강 소재에 fatigued:true·거짓 ETA. (소재,날짜) 합산으로 방지(합산 CTR 2.5% 평탄).
  function multiChannelFlatRows(days = 20) {
    const rows = [];
    for (let day = 1; day <= days; day++) {
      const d = `2026-01-${String(day).padStart(2, "0")}`;
      rows.push({ creative_id: "cr_x", channel: "fb", date: d, impressions: 1000, clicks: 50, installs: 5 });
      rows.push({ creative_id: "cr_x", channel: "ig", date: d, impressions: 5000, clicks: 100, installs: 5 });
    }
    return rows;
  }
  it("fatigueDetect: 평탄 다채널 소재는 피로 아님", () => {
    const res = CREATIVE_STATS.fatigueDetect(multiChannelFlatRows(), "ctr", CREATIVE_CONFIG);
    const cr = res.find((r) => r.creative_id === "cr_x");
    expect(cr.fatigued).toBe(false);
    expect(cr.dropPct == null || cr.dropPct < CREATIVE_CONFIG.fatigue.dropPct).toBe(true);
  });
  it("buildAlerts: 평탄 다채널 소재는 CTR 추세 ≈ 0 (거짓 하락 아님)", () => {
    const alerts = CREATIVE_FATIGUE.buildAlerts(multiChannelFlatRows(), CREATIVE_CONFIG.fatigueAlert);
    const a = alerts.find((x) => x.creative_id === "cr_x");
    expect(a).toBeTruthy();
    expect(Math.abs(a.ctrTrendPctPerDay ?? 0)).toBeLessThan(0.005);
    expect(a.alert).toBe(false);
  });
});
