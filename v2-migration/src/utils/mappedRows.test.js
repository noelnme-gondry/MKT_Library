import { describe, expect, it } from "vitest";
import { mapRowsToStandard } from "./mappedRows";

describe("mapRowsToStandard", () => {
  it("projects mapped fields and keeps cost/spend aliases", () => {
    expect(mapRowsToStandard([{ Amount: "10", Users: "2", Ignore: "x" }], {
      Amount: "cost",
      Users: "installs",
      Ignore: "__ignore__",
    })).toEqual([{ cost: "10", installs: "2", spend: "10" }]);
  });

  // 감사 P0-1: Excel·GA 내보내기의 천단위 콤마가 하류 Number()를 전부 NaN으로 만들어
  // 총비용 ₩0·설치 0으로 무너졌다. 이 골든이 없어서 살아남았다.
  it("strips thousand separators on numeric fields", () => {
    expect(mapRowsToStandard([{ Cost: "72,341,057", Installs: "2,488" }], {
      Cost: "cost",
      Installs: "installs",
    })).toEqual([{ cost: "72341057", installs: "2488", spend: "72341057" }]);
  });

  it("strips currency symbols and spaces", () => {
    const [row] = mapRowsToStandard([{ Cost: "₩ 1 234 567", Rev: "$12,000.50" }], {
      Cost: "cost",
      Rev: "revenue_d7",
    });
    expect(Number(row.cost)).toBe(1234567);
    expect(Number(row.revenue_d7)).toBe(12000.5);
  });

  it("normalizes supported currency wrappers without extracting digits from arbitrary text", () => {
    const [row] = mapRowsToStandard([{ Cost: "1,350,000원", Clicks: "USD 1,200", Impressions: "abc123" }], {
      Cost: "cost",
      Clicks: "clicks",
      Impressions: "impressions",
    });
    expect(row).toMatchObject({ cost: "1350000", spend: "1350000", clicks: "1200", impressions: "abc123" });
  });

  // 디멘션 값은 건드리지 않는다 — 캠페인명이 "1,000"이어도 원본 유지.
  it("leaves non-numeric standard fields untouched", () => {
    expect(mapRowsToStandard([{ C: "1,000", D: "2026-01-01" }], {
      C: "campaign",
      D: "date",
    })).toEqual([{ campaign: "1,000", date: "2026-01-01" }]);
  });

  it("normalizes valid mapped dates while preserving explicit month grain", () => {
    expect(mapRowsToStandard([
      { Date: "08/31/2026" },
      { Date: "2026-08" },
      { Date: "02/31/2026" },
    ], { Date: "date" })).toEqual([
      { date: "2026-08-31" },
      { date: "2026-08" },
      { date: "02/31/2026" },
    ]);
  });

  // percent는 소비처(computeWeightedRetention)가 비율/인원수를 판별한다.
  // 여기서 "%"를 벗기면 12.5%가 인원수 12.5로 오독된다.
  it("leaves percent fields untouched", () => {
    expect(mapRowsToStandard([{ R: "12.5%" }], { R: "ret_d7" })).toEqual([{ ret_d7: "12.5%" }]);
  });

  it("leaves genuinely non-numeric strings untouched", () => {
    expect(mapRowsToStandard([{ Cost: "n/a" }], { Cost: "cost" })).toEqual([{ cost: "n/a", spend: "n/a" }]);
  });
});
