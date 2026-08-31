import { describe, expect, it } from "vitest";
import { _mmmParseDate } from "./regForecastMath";

describe("_mmmParseDate", () => {
  it("parses supported calendar forms in UTC without timezone drift", () => {
    expect(_mmmParseDate("08/31/2026")?.toISOString().slice(0, 10)).toBe("2026-08-31");
    expect(_mmmParseDate("31/08/2026")?.toISOString().slice(0, 10)).toBe("2026-08-31");
    expect(_mmmParseDate("2026-08")?.toISOString().slice(0, 10)).toBe("2026-08-01");
  });

  it("rejects impossible dates instead of rolling into another month", () => {
    expect(_mmmParseDate("2026-02-31")).toBeNull();
    expect(_mmmParseDate("31/02/2026")).toBeNull();
    expect(_mmmParseDate("2026-13")).toBeNull();
  });
});
