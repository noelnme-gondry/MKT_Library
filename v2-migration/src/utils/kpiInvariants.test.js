// 지표 정확성 회귀 가드 (2026-09-16 분석 정확성 감사)
// 골든(손계산) + 불변식(집계·순서·중복) + 변형검사(metamorphic). 여기 깨지면
// 화면의 숫자가 틀린 것이다 — 값이 아니라 근거를 고정한다(§7).
import { describe, it, expect } from "vitest";
import { calculateKPIs, aggregateByKey } from "./dashboardAggregator";
import { mapRowsToStandard } from "./mappedRows";
import { normalizeNumericValue } from "@/lib/data-import/normalizeValues";
import {
  BASIC_ROW, BASIC_EXPECTED, ASYMMETRIC_ROWS, ASYMMETRIC_WEIGHTED_CPI,
  ASYMMETRIC_NAIVE_MEAN_CPI, DIRTY_NUMBERS,
} from "./__fixtures__/qaFixtures";

describe("KPI 골든 — 손으로 계산한 정답", () => {
  it("한 행 픽스처의 모든 파생지표", () => {
    const k = calculateKPIs([{ ...BASIC_ROW }], 7, "installs");
    for (const [metric, expected] of Object.entries(BASIC_EXPECTED)) {
      expect(k[metric], metric).toBeCloseTo(expected, 12);
    }
  });

  it("전체 CPA는 가중(Σ비용÷Σ결과)이지 CPA의 단순평균이 아니다", () => {
    const k = calculateKPIs(ASYMMETRIC_ROWS.map((r) => ({ ...r })), 7, "installs");
    expect(k.cpi).toBeCloseTo(ASYMMETRIC_WEIGHTED_CPI, 12);
    // 단순평균으로 구현되면 47.5가 나온다 — 그 값이 나오면 실패해야 한다.
    expect(k.cpi).not.toBeCloseTo(ASYMMETRIC_NAIVE_MEAN_CPI, 6);
  });
});

describe("집계 불변식", () => {
  const rows = [
    { channel: "A", cost: 100, impressions: 900, clicks: 40, installs: 20, revenue_d7: 150 },
    { channel: "B", cost: 900, impressions: 1100, clicks: 60, installs: 10, revenue_d7: 450 },
    { channel: "A", cost: 50, impressions: 700, clicks: 25, installs: 5, revenue_d7: 90 },
  ];

  it("그룹별 합의 합 = 전체 합", () => {
    const grouped = aggregateByKey(rows, "channel", ["cost", "installs"]);
    const total = calculateKPIs(rows, 7, "installs");
    expect(grouped.reduce((s, g) => s + g.cost, 0)).toBe(total.cost);
    expect(grouped.reduce((s, g) => s + g.installs, 0)).toBe(total.installs);
  });

  it("행 순서를 바꿔도 결과가 같다", () => {
    const base = calculateKPIs(rows, 7, "installs");
    const shuffled = calculateKPIs([rows[2], rows[0], rows[1]], 7, "installs");
    expect(shuffled).toEqual(base);
  });

  it("차원 이름을 바꿔도 전체 지표는 같다", () => {
    const renamed = rows.map((r) => ({ ...r, channel: `${r.channel}-renamed` }));
    expect(calculateKPIs(renamed, 7, "installs")).toEqual(calculateKPIs(rows, 7, "installs"));
  });

  it("변형검사: 데이터 2배 복제 → 합은 2배, 비율은 불변", () => {
    const one = calculateKPIs(rows, 7, "installs");
    const two = calculateKPIs([...rows, ...rows], 7, "installs");
    expect(two.cost).toBe(one.cost * 2);
    expect(two.installs).toBe(one.installs * 2);
    for (const metric of ["cpi", "ctr", "cpc", "cpm", "roas", "cvr", "arpu"]) {
      expect(two[metric], metric).toBeCloseTo(one[metric], 10);
    }
  });

  it("변형검사: 금액 10배 → 비용지표 10배, ROAS·CTR 불변", () => {
    const one = calculateKPIs(rows, 7, "installs");
    const scaled = calculateKPIs(
      rows.map((r) => ({ ...r, cost: r.cost * 10, revenue_d7: r.revenue_d7 * 10 })),
      7, "installs",
    );
    for (const metric of ["cpi", "cpc", "cpm"]) {
      expect(scaled[metric], metric).toBeCloseTo(one[metric] * 10, 8);
    }
    expect(scaled.roas).toBeCloseTo(one.roas, 12);
    expect(scaled.ctr).toBeCloseTo(one.ctr, 12);
  });
});

describe("퇴화 입력은 거짓 숫자 대신 null", () => {
  it("분모 0 → null (Infinity·NaN 금지)", () => {
    const k = calculateKPIs([{ cost: 100, impressions: 0, clicks: 0, installs: 0 }], 7, "installs");
    for (const metric of ["cpm", "cpc", "cpi", "ctr", "cvr"]) {
      expect(k[metric], metric).toBeNull();
    }
  });

  it("빈 입력에서 어떤 지표도 Infinity·NaN이 아니다", () => {
    const k = calculateKPIs([], 7, "installs");
    for (const [metric, value] of Object.entries(k)) {
      if (typeof value === "number") expect(Number.isFinite(value), metric).toBe(true);
    }
  });
});

describe("숫자 표기 정규화 계약", () => {
  it.each(DIRTY_NUMBERS)("$input → $expected", ({ input, expected }) => {
    expect(normalizeNumericValue(input)?.value ?? null).toBe(expected);
  });

  it("콤마·통화기호가 붙은 CSV 값이 합계에 그대로 반영된다", () => {
    const rows = mapRowsToStandard(
      [{ Cost: "₩1,000", Installs: "100" }, { Cost: "$250.50", Installs: "50" }],
      { Cost: "cost", Installs: "installs" },
    );
    const k = calculateKPIs(rows, 7, "installs");
    expect(k.cost).toBeCloseTo(1250.5, 10);
    expect(k.cpi).toBeCloseTo(1250.5 / 150, 12);
  });
});
