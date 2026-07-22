import { describe, expect, it } from "vitest";
import { wideToLong } from "./wideToLong";

describe("wideToLong", () => {
  it("pivots dated columns without guessing the metric meaning", () => {
    const result = wideToLong({
      headers: ["Campaign", "2026-07-01", "2026/07/08", "Notes"],
      raw: [{ Campaign: "Meta", "2026-07-01": "120000", "2026/07/08": "", Notes: "brand" }],
    });

    expect(result.headers).toEqual(["Campaign", "Notes", "date", "기간별 값"]);
    expect(result.raw).toEqual([{ Campaign: "Meta", Notes: "brand", date: "2026-07-01", "기간별 값": "120000" }]);
  });

  it("refuses ambiguous period labels that do not contain a full date", () => {
    expect(() => wideToLong({ headers: ["Campaign", "Week 1", "Week 2"], raw: [] })).toThrow("At least two");
  });
});
