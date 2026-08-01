import { describe, expect, it } from "vitest";
import {
  buildChartFieldOptions,
  buildCustomChartConfig,
  buildCustomScorecardModel,
  formatCustomScorecardValue,
} from "./customChartConfig.js";

describe("custom chart scorecard", () => {
  const mapping = { Spend: "cost", Installs: "installs" };
  const rows = [
    { cost: 100, installs: 10 },
    { cost: 200, installs: 20 },
  ];

  it("현재 필터 전체를 한 번 집계해 단일 실제값을 계산한다", () => {
    const opts = buildChartFieldOptions(mapping, []);
    const model = buildCustomScorecardModel(
      { type: "scorecard", metric: "cpi" },
      rows,
      { ...opts, cohort: 7, denomBasis: "installs" },
    );
    expect(model).toMatchObject({ label: "CPI/CPA", unit: "currency", value: 10 });
    expect(formatCustomScorecardValue(model, "KRW", "ko")).toBe("₩10");
  });

  it("계산 불가 값은 0으로 꾸미지 않는다", () => {
    const opts = buildChartFieldOptions(mapping, []);
    const model = buildCustomScorecardModel(
      { type: "scorecard", metric: "cpi" },
      [{ cost: 100, installs: 0 }],
      { ...opts, cohort: 7, denomBasis: "installs" },
    );
    expect(model.value).toBeNull();
    expect(formatCustomScorecardValue(model, "KRW", "ko")).toBe("—");
  });

  it("영문 차트 빌더 옵션은 차원·지표 라벨을 영어로 제공한다", () => {
    const opts = buildChartFieldOptions({ Channel: "channel", Spend: "cost", Installs: "installs" }, [], "en");
    expect(opts.availDims.find((item) => item.key === "channel").label).toBe("Channel");
    expect(opts.dimLabelOf("channel")).toBe("Channel");
    expect(opts.metricOptions.map((item) => item.label)).toEqual(["Cost", "Installs", "CPI / CPA"]);
    expect(opts.metricLabelOf("cpi")).toBe("CPI / CPA");
  });

  it("라인 차트는 공용 반응형 계약과 의미 토큰을 사용한다", () => {
    const opts = buildChartFieldOptions({ Channel: "channel", Spend: "cost", Installs: "installs" }, []);
    const config = buildCustomChartConfig(
      { type: "line", dim: "channel", metric: "cpi" },
      [{ channel: "Meta", cost: 100, installs: 10 }, { channel: "Google", cost: 180, installs: 20 }],
      opts,
    );
    expect(config.options.responsive).toBe(true);
    expect(config.options.maintainAspectRatio).toBe(false);
    expect(config.data.datasets[0].fill).toBe(false);
    expect(config.data.datasets[0].backgroundColor).toBe(config.data.datasets[0].borderColor);
    expect(config.data.datasets[0].borderColor).not.toContain("var(");
  });

  it("파이 차트 범례도 공용 글꼴과 툴팁을 재사용한다", () => {
    const opts = buildChartFieldOptions({ Channel: "channel", Spend: "cost" }, []);
    const config = buildCustomChartConfig(
      { type: "pie", dim: "channel", metric: "cost" },
      [{ channel: "Meta", cost: 100 }, { channel: "Google", cost: 180 }],
      opts,
    );
    expect(config.options.maintainAspectRatio).toBe(false);
    expect(config.options.plugins.legend.labels.font.family).toContain("DM Sans");
    expect(config.options.plugins.tooltip.backgroundColor).toBe("rgba(0,0,0,0.85)");
  });
});
