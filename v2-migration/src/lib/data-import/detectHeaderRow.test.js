import { describe, expect, it } from "vitest";
import { tableToRecords } from "./detectHeaderRow";

describe("tableToRecords", () => {
  it("skips an explanatory title row and makes duplicate headers safe", () => {
    const out = tableToRecords([["2026년 7월 광고 리포트"], [], ["일자", "비용", "비용"], ["2026-07-01", "100", "200"]]);
    expect(out).toMatchObject({ headerIndex: 2, headers: ["일자", "비용", "비용_2"], raw: [{ 일자: "2026-07-01", 비용: "100", 비용_2: "200" }] });
  });
});
