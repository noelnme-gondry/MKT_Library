import { describe, it, expect } from "vitest";
import { fmtCurrency, fmtPct, fmtNum, fmtCompact, parseNum } from "./format";

describe("format", () => {
  it("fmtCurrency: ₩ 0 decimals, $ 2 decimals, precise small", () => {
    expect(fmtCurrency(72341057, { currency: "KRW" })).toBe("₩72,341,057");
    expect(fmtCurrency(1234.5, { currency: "USD" })).toBe("$1,234.50");
    expect(fmtCurrency(0.42, { currency: "USD", precise: true })).toBe("$0.42");
    expect(fmtCurrency(null)).toBe("—");
    expect(fmtCurrency("abc")).toBe("—");
  });

  it("fmtPct: ratio vs points", () => {
    expect(fmtPct(0.1234)).toBe("12.3%");
    expect(fmtPct(12.34, 1, { asRatio: false })).toBe("12.3%");
    expect(fmtPct(0.05, 2)).toBe("5.00%");
    expect(fmtPct(null)).toBe("—");
  });

  it("fmtNum: thousands", () => {
    expect(fmtNum(1234567)).toBe("1,234,567");
    expect(fmtNum(12.345, 2)).toBe("12.35");
  });

  it("fmtCompact: 만·억", () => {
    expect(fmtCompact(12000)).toBe("1.2만");
    expect(fmtCompact(340000000)).toBe("3.4억");
    expect(fmtCompact(500)).toBe("500");
    expect(fmtCompact(-12000)).toBe("-1.2만");
  });

  it("parseNum: strips commas/symbols, null on empty", () => {
    expect(parseNum("72,341,057")).toBe(72341057); // NOT 72 (§7 함정)
    expect(parseNum("₩1,200")).toBe(1200);
    expect(parseNum("12.5%")).toBe(12.5);
    expect(parseNum("")).toBe(null);
    expect(parseNum(null)).toBe(null);
    expect(parseNum("abc")).toBe(null);
  });
});
