import { describe, expect, it } from "vitest";
import { fmtCurrencyCompact, fmtCurrencyPrecise } from "./dashboardAggregator.js";

describe("dashboard currency formatting", () => {
  it("places negative signs before the currency and preserves small-value precision", () => {
    expect(fmtCurrencyPrecise(-46, "KRW")).toBe("−₩46.0");
    expect(fmtCurrencyPrecise(-0.4, "USD")).toBe("−$0.40");
    expect(fmtCurrencyPrecise(0, "KRW")).toBe("₩0");
  });
  it("keeps exact figures for detail while compacting long KRW KPI figures", () => {
    expect(fmtCurrencyPrecise(261835200, "KRW")).toBe("₩261,835,200");
    expect(fmtCurrencyCompact(261835200, "KRW", "ko")).toBe("₩2.6억");
    expect(fmtCurrencyCompact(261835200, "KRW", "en")).toBe("₩261.8M");
  });

  it("keeps compact USD cards proportionate to KRW cards", () => {
    expect(fmtCurrencyCompact(186_000, "USD", "en")).toBe("$186K");
  });
});
