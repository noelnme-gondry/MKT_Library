import { describe, expect, it } from "vitest";
import {
  buildChartFieldOptions,
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
});
