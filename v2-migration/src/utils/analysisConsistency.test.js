// 분석 정합 가드 (2026-09-16 분석 정확성 감사에서 재현된 결함 3건)
// 값이 아니라 **근거**를 고정한다(§7): "같은 지표는 어디서 읽어도 같은 값",
// "근사를 못 믿는 구간에서는 정확검정이 판정한다".
import { describe, it, expect } from "vitest";
import { STATS } from "./abTestMath";
import { buildDashboardVerdict } from "./dashboardVerdict";
import { calculateKPIs, getMonFilteredRows, effectiveDenomBasis } from "./dashboardAggregator";
import { AB_LOW_CONVERSION, AB_LARGE_SAMPLE, buildEfficiencyCsv } from "./__fixtures__/qaFixtures";
import { mapRowsToStandard } from "./mappedRows";
import { parseNumericStrict, parseNumericOrZero } from "./parseNumeric";
import { parseNum } from "./format";
import { allocParseNum } from "./budgetAllocTool";
import { PVM_MATH } from "./pvmMath";
import { mmmParseNumericValue } from "./mmmInputUtils";

const rowOf = (mass) => mass.rows.find((r) => !r.isControl);
const armsOf = ({ nA, xA, nB, xB }) => [
  { name: "A", n: nA, x: xA, isControl: true },
  { name: "B", n: nB, x: xB },
];

describe("A/B 판정 경로 정합 — 대량 검정이 수동 경로와 같은 검정을 쓴다", () => {
  it("저전환 구간: 근사 p가 아니라 정확검정 p로 판정한다", () => {
    const { nA, xA, nB, xB } = AB_LOW_CONVERSION; // 50/0 vs 50/5
    // 전제: 이 입력이 실제로 "근사를 못 믿는" 구간이어야 검사가 의미를 갖는다.
    expect(STATS.shouldPreferExactTest(nA, xA, nB, xB)).toBe(true);
    const exactP = STATS.fisherExact2x2(nA, xA, nB, xB).pValue;
    const approxP = STATS.twoPropZTest(nA, xA, nB, xB).pValue;
    // 두 검정이 실제로 판정을 가르는 입력인지도 고정한다 — 갈리지 않으면
    // 이 테스트는 아무것도 지키지 않는다.
    expect(approxP).toBeLessThan(0.05);
    expect(exactP).toBeGreaterThan(0.05);

    const b = rowOf(STATS.massReadout(armsOf(AB_LOW_CONVERSION)));
    expect(b.testMethod).toBe("fisher");
    expect(b.rawPValue).toBeCloseTo(exactP, 12);
    expect(b.sig).toBe(false);
  });

  it("근사가 믿을 만한 구간에서는 그대로 z를 쓴다", () => {
    const { nA, xA, nB, xB } = AB_LARGE_SAMPLE;
    expect(STATS.shouldPreferExactTest(nA, xA, nB, xB)).toBe(false);
    const b = rowOf(STATS.massReadout(armsOf(AB_LARGE_SAMPLE)));
    expect(b.testMethod).toBe("normal");
    expect(b.rawPValue).toBeCloseTo(STATS.twoPropZTest(nA, xA, nB, xB).pValue, 12);
  });

  it("정수가 아닌 셀은 정확검정을 못 쓰므로 사실을 남긴다", () => {
    const b = rowOf(STATS.massReadout([
      { name: "A", n: 50, x: 0.5, isControl: true },
      { name: "B", n: 50, x: 5 },
    ]));
    expect(b.testMethod).toBe("normal");
    expect(b.approxUnreliable).toBe(true);
  });

  it("Holm 보정은 라우팅된 p 위에서 돈다", () => {
    const mass = STATS.massReadout([
      { name: "C", n: 50, x: 0, isControl: true },
      { name: "V1", n: 50, x: 5 },
      { name: "V2", n: 50, x: 4 },
    ]);
    for (const row of mass.rows.filter((r) => !r.isControl)) {
      expect(row.testMethod).toBe("fisher");
      // 보정 p는 원 p보다 작아질 수 없다.
      expect(row.pValue).toBeGreaterThanOrEqual(row.rawPValue - 1e-12);
    }
  });
});

describe("5-2 결론 카드 ↔ KPI 카드 지표 정합", () => {
  const csvData = buildEfficiencyCsv();
  const recentRows = (basis) => {
    const rows = getMonFilteredRows(csvData, {});
    const dates = [...new Set(rows.map((r) => r.date))].sort().slice(-7);
    return { rows: rows.filter((r) => dates.includes(r.date)), basis };
  };
  const verdictMetric = (v, key) => v.metricRows.find((r) => r.key === key);

  it.each([7, 30])("ROAS가 코호트 D%s를 따른다", (cohort) => {
    const basis = effectiveDenomBasis(csvData, "installs");
    const { rows } = recentRows(basis);
    const card = calculateKPIs(rows, cohort, basis);
    const v = buildDashboardVerdict({ csvData, filterState: {}, denomBasis: "installs", windowDays: 7, cohort });
    expect(verdictMetric(v, "roas").recent).toBeCloseTo(card.roas, 12);
    // 라벨도 어느 코호트인지 말해야 한다 — 같은 화면에 두 ROAS가 있으면 안 된다.
    expect(verdictMetric(v, "roas").label).toContain(`D${cohort}`);
  });

  it("D7과 D30이 실제로 다른 값이라 위 검사가 공허하지 않다", () => {
    const d7 = buildDashboardVerdict({ csvData, filterState: {}, denomBasis: "installs", windowDays: 7, cohort: 7 });
    const d30 = buildDashboardVerdict({ csvData, filterState: {}, denomBasis: "installs", windowDays: 7, cohort: 30 });
    expect(verdictMetric(d7, "roas").recent).not.toBeCloseTo(verdictMetric(d30, "roas").recent, 3);
  });

  it.each(["installs", "actions"])("CVR이 분모 기준(%s)을 따른다", (denomBasis) => {
    const basis = effectiveDenomBasis(csvData, denomBasis);
    const { rows } = recentRows(basis);
    const card = calculateKPIs(rows, 7, basis);
    const v = buildDashboardVerdict({ csvData, filterState: {}, denomBasis, windowDays: 7, cohort: 7 });
    expect(verdictMetric(v, "cvr").recent).toBeCloseTo(card.cvr, 12);
  });

  it("설치 기준과 가입 기준 CVR이 실제로 다르다", () => {
    const inst = buildDashboardVerdict({ csvData, filterState: {}, denomBasis: "installs", windowDays: 7, cohort: 7 });
    const act = buildDashboardVerdict({ csvData, filterState: {}, denomBasis: "actions", windowDays: 7, cohort: 7 });
    expect(verdictMetric(inst, "cvr").recent).not.toBeCloseTo(verdictMetric(act, "cvr").recent, 3);
  });

  it("CTR·지출은 분모 기준·코호트와 무관하게 같다", () => {
    const a = buildDashboardVerdict({ csvData, filterState: {}, denomBasis: "installs", windowDays: 7, cohort: 7 });
    const b = buildDashboardVerdict({ csvData, filterState: {}, denomBasis: "actions", windowDays: 7, cohort: 30 });
    expect(verdictMetric(b, "ctr").recent).toBeCloseTo(verdictMetric(a, "ctr").recent, 12);
    expect(verdictMetric(b, "cost").recent).toBeCloseTo(verdictMetric(a, "cost").recent, 12);
  });
});

describe("도구 간 숫자 정합 — 같은 CSV 셀은 어디서 읽어도 같다", () => {
  // 감사 전에는 `"1.000,25"`가 5-2에서 0, 5-21·5-3에서 1.00025였다. 둘 다 틀렸고
  // 서로 달랐다. 이제는 판별 못 하는 표기를 **모든 도구가 똑같이 거부**한다.
  const CELLS = ["1,000", "₩1,000", "$1,000.25", "(100)", "1 000", "1e3", "1.000,25", "abc"];

  it.each(CELLS)("'%s'를 모든 엔진이 같은 값으로 읽는다", (cell) => {
    const canonical = parseNumericStrict(cell);

    // 5-2 대시보드 (raw → mappedRows → 합산)
    const dashRows = mapRowsToStandard([{ Cost: cell, Installs: "1" }], { Cost: "cost", Installs: "installs" });
    const dash = calculateKPIs(dashRows, 7, "installs").cost;

    // 5-21 PVM (cost는 spend 키로 읽는다)
    const agg = PVM_MATH.aggregate(dashRows, "installs", "installs");
    const pvmEntry = [...agg.values()][0];

    // 5-3 예산 배분 · 표시층 · 5-27 ASO
    const alloc = allocParseNum(cell);
    const display = parseNum(cell);
    const aso = parseNumericOrZero(cell);

    if (canonical === null) {
      // 읽을 수 없으면 아무도 숫자를 지어내지 않는다.
      expect(dash, "dashboard").toBe(0);
      expect(pvmEntry.invalidFields, "pvm은 오염을 표시한다").toContain("cost");
      expect(alloc, "budget").toBeNull();
      expect(display, "display").toBeNull();
      expect(aso, "aso").toBe(0);
    } else {
      expect(dash, "dashboard").toBeCloseTo(canonical, 10);
      expect(pvmEntry.cost, "pvm").toBeCloseTo(canonical, 10);
      expect(pvmEntry.invalidFields).not.toContain("cost");
      expect(alloc, "budget").toBeCloseTo(canonical, 10);
      expect(display, "display").toBeCloseTo(canonical, 10);
      expect(aso, "aso").toBeCloseTo(canonical, 10);
    }
  });

  it("유럽식 소수 구분자는 조용히 1,000배 축소되지 않는다", () => {
    // 이 한 줄이 감사에서 찾은 실제 결함이다.
    expect(parseNumericStrict("1.000,25")).toBeNull();
    expect(allocParseNum("1.000,25")).toBeNull();
    expect(parseNum("1.000,25")).toBeNull();
    expect(mmmParseNumericValue("1.000,25")).toBeNaN();
  });

  it("MMM만 받는 압축 단위 접미사는 그대로 살아 있다", () => {
    // 공유 규칙으로 옮기면서 MMM 고유 기능을 잃지 않았는지 확인한다.
    expect(mmmParseNumericValue("1.2M")).toBe(1.2e6);
    expect(mmmParseNumericValue("5억")).toBe(5e8);
    expect(mmmParseNumericValue("1,234")).toBe(1234);
  });
});
