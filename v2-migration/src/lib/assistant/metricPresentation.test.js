import { expect, it } from "vitest";
import { metricChangeTone, formatComparisonMetric } from "./metricPresentation";
it("interprets costs and outcomes in opposite directions, without judging spend", () => {
  expect(metricChangeTone("cpa", .594)).toBe("worsened");
  expect(metricChangeTone("cpi", -.2)).toBe("improved");
  expect(metricChangeTone("roas", .2)).toBe("improved");
  expect(metricChangeTone("actions", -.039)).toBe("worsened");
  expect(metricChangeTone("spend", .531)).toBe("neutral");
  expect(metricChangeTone("cpa", null)).toBe("neutral");
});

it("uses engine metric keys and preserves currency, rates, and missing values", () => {
  expect(metricChangeTone("act", -.039)).toBe("worsened");
  expect(metricChangeTone("cost", .531)).toBe("neutral");
  expect(formatComparisonMetric("cpa", 10619.57, "ko", "KRW")).toBe("₩10,620");
  expect(formatComparisonMetric("cpa", 12.34, "en", "USD")).toBe("$12.34");
  expect(formatComparisonMetric("roas", .6, "en")).toBe("60%");
  expect(formatComparisonMetric("cpa", null)).toBe("—");
});
