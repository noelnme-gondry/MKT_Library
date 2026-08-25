import { describe, it, expect } from "vitest";
import {
  buildSegmentPanel,
  normalizePeriod,
  SEGMENT_ISSUE,
  SEGMENT_PANEL_SCHEMA_VERSION,
  ISSUE_LEVEL,
  PANEL_STATUS,
} from "@/lib/segment-composition/segmentPanel";
import {
  LONG_GENDER_ROWS,
  WIDE_GENDER_ROWS,
  RATE_GENDER_ROWS,
  LONG_TWO_AXIS_ROWS,
  NON_EXCLUSIVE_TAG_ROWS,
  BASE_ROLES,
  GENDER_LONG_DIMENSION,
  GENDER_WIDE_DIMENSION,
  GENDER_RATE_DIMENSION,
  AGE_LONG_DIMENSION,
  TAG_DIMENSION,
} from "@/lib/segment-composition/fixtures";

// provenance(원본 행 번호)는 shape마다 다를 수밖에 없다 — 정규화 동치를 볼 땐 제외한다.
const withoutSource = (records) => records.map(({ source, ...rest }) => rest);
const codesOf = (panel) => panel.quality.issues.map((issue) => issue.code);
const findRecord = (panel, time, campaign, memberId) => panel.records.find((record) => (
  record.time === time && record.entity["캠페인"] === campaign && record.memberId === memberId
));

describe("normalizePeriod", () => {
  it("날짜는 ISO로 정규화하고 주차 라벨은 원문 키로 남긴다", () => {
    expect(normalizePeriod("2026-7-1")).toEqual({ key: "2026-07-01", isDate: true });
    expect(normalizePeriod("2026/07/01")).toEqual({ key: "2026-07-01", isDate: true });
    expect(normalizePeriod("2026-W27")).toEqual({ key: "2026-W27", isDate: false });
    expect(normalizePeriod("  ")).toBeNull();
  });

  it("존재하지 않는 날짜를 만들어 내지 않는다", () => {
    // 2026-02-30은 JS Date가 3월로 굴려 버린다 — 굴린 값을 날짜로 인정하면 안 된다.
    expect(normalizePeriod("2026-02-30")).toEqual({ key: "2026-02-30", isDate: false });
  });
});

describe("buildSegmentPanel — long count", () => {
  const panel = buildSegmentPanel({
    rows: LONG_GENDER_ROWS,
    roles: BASE_ROLES,
    dimensions: [GENDER_LONG_DIMENSION],
  });

  it("계약 버전과 상태를 보고한다", () => {
    expect(panel.schemaVersion).toBe(SEGMENT_PANEL_SCHEMA_VERSION);
    expect(panel.quality.status).toBe(PANEL_STATUS.READY);
    expect(panel.quality.periods).toEqual(["2026-07-01", "2026-08-01"]);
    expect(panel.records).toHaveLength(8);
  });

  it("멤버 인원수와 셀 분모를 그대로 실어 나른다", () => {
    const record = findRecord(panel, "2026-07-01", "CPS", "female");
    expect(record.count).toBe(120);
    expect(record.denominator).toBe(1400); // 포괄 선언이므로 멤버 합에서 유도
    expect(record.isCountEstimated).toBe(false);
    expect(record.entity).toEqual({ 캠페인: "CPS" });
    expect(record.scope).toEqual({ OS: "Android" });
    expect(record.source.rowNumbers).toEqual([2]);
  });

  it("멤버 행마다 반복된 광고비를 합산하지 않는다", () => {
    // 합산하면 2,800,000이 5,600,000이 되어 5-2·5-21의 CPA가 통째로 거짓이 된다.
    const record = findRecord(panel, "2026-07-01", "CPS", "female");
    expect(record.optionalMeasures.spend).toBe(2800000);
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.MEASURE_REPEATED_ACROSS_MEMBERS);
  });

  it("선언한 멤버 순서를 지킨다", () => {
    const firstCell = panel.records.filter((record) => record.time === "2026-07-01" && record.entity["캠페인"] === "BRAND");
    expect(firstCell.map((record) => record.memberId)).toEqual(["female", "male"]);
  });
});

describe("Long / Wide 동치", () => {
  it("같은 사실을 적은 두 shape이 같은 패널을 만든다", () => {
    const long = buildSegmentPanel({ rows: LONG_GENDER_ROWS, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] });
    const wide = buildSegmentPanel({ rows: WIDE_GENDER_ROWS, roles: BASE_ROLES, dimensions: [GENDER_WIDE_DIMENSION] });
    expect(withoutSource(wide.records)).toEqual(withoutSource(long.records));
    expect(wide.dimensions[0].contract).toEqual(long.dimensions[0].contract);
  });

  it("wide는 한 행이 여러 멤버를 만들므로 중복 집계 표식이 없다", () => {
    const wide = buildSegmentPanel({ rows: WIDE_GENDER_ROWS, roles: BASE_ROLES, dimensions: [GENDER_WIDE_DIMENSION] });
    expect(codesOf(wide)).not.toContain(SEGMENT_ISSUE.AGGREGATED_DUPLICATE_ROWS);
  });
});

describe("두 축이 한 파일에 있을 때", () => {
  const panel = buildSegmentPanel({
    rows: LONG_TWO_AXIS_ROWS,
    roles: BASE_ROLES,
    dimensions: [GENDER_LONG_DIMENSION, AGE_LONG_DIMENSION],
  });

  it("각 축이 다른 축을 합쳐 독립적으로 marginalize 된다", () => {
    expect(findRecord(panel, "2026-07-01", "CPS", "female").count).toBe(120);
    expect(findRecord(panel, "2026-07-01", "CPS", "male").count).toBe(1280);
    expect(findRecord(panel, "2026-07-01", "CPS", "u29").count).toBe(870);
    expect(findRecord(panel, "2026-07-01", "CPS", "o30").count).toBe(530);
  });

  it("두 축의 분모가 같은 모수로 일치한다", () => {
    const gender = findRecord(panel, "2026-08-01", "BRAND", "female");
    const age = findRecord(panel, "2026-08-01", "BRAND", "u29");
    expect(gender.denominator).toBe(1000);
    expect(age.denominator).toBe(1000);
  });

  it("한 축의 성별 결과가 단일 축 파일과 동일하다", () => {
    const single = buildSegmentPanel({ rows: LONG_GENDER_ROWS, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] });
    const genderOnly = panel.records.filter((record) => record.dimensionId === "gender");
    expect(withoutSource(genderOnly)).toEqual(withoutSource(single.records));
  });

  it("여러 행이 한 셀로 접힌 사실을 숨기지 않는다", () => {
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.AGGREGATED_DUPLICATE_ROWS);
  });
});

describe("rate + 분모", () => {
  const panel = buildSegmentPanel({
    rows: RATE_GENDER_ROWS,
    roles: { ...BASE_ROLES, measures: {} },
    dimensions: [GENDER_RATE_DIMENSION],
  });

  it("복원 인원수를 추정치로 표시한다", () => {
    const record = findRecord(panel, "2026-07-01", "CPS", "female");
    expect(record.isCountEstimated).toBe(true);
    expect(record.rate).toBeCloseTo(0.0857, 10);
    // 0.0857 × 1400 = 119.98 — 120이 아니다. 정수인 척하지 않는다.
    expect(record.count).toBeCloseTo(119.98, 10);
    expect(Number.isInteger(record.count)).toBe(false);
  });

  it("반올림 복원이라는 사실을 결과에 남긴다", () => {
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.ESTIMATED_COUNT_FROM_RATE);
    expect(panel.quality.status).toBe(PANEL_STATUS.CAUTION);
  });

  it("퍼센트 표기는 선언된 단위로만 해석한다", () => {
    const percentRows = RATE_GENDER_ROWS.map((row) => ({ ...row, 여성비중: `${(Number(row.여성비중) * 100).toFixed(2)}%`, 남성비중: `${(Number(row.남성비중) * 100).toFixed(2)}%` }));
    const percentPanel = buildSegmentPanel({
      rows: percentRows,
      roles: { ...BASE_ROLES, measures: {} },
      dimensions: [GENDER_RATE_DIMENSION],
    });
    expect(findRecord(percentPanel, "2026-07-01", "CPS", "female").rate).toBeCloseTo(0.0857, 10);
  });

  it("분모가 없으면 비율 입력을 차단한다", () => {
    const blocked = buildSegmentPanel({
      rows: RATE_GENDER_ROWS,
      roles: { ...BASE_ROLES, measures: {} },
      dimensions: [{ ...GENDER_RATE_DIMENSION, denominatorColumn: null }],
    });
    expect(blocked.quality.status).toBe(PANEL_STATUS.BLOCKED);
    expect(codesOf(blocked)).toContain(SEGMENT_ISSUE.RATE_WITHOUT_DENOMINATOR);
    expect(blocked.records).toEqual([]);
  });

  it("같은 셀이 두 번 나오면 비율을 더하지 않고 차단한다", () => {
    const duplicated = [...RATE_GENDER_ROWS, RATE_GENDER_ROWS[0]];
    const panelWithDup = buildSegmentPanel({
      rows: duplicated,
      roles: { ...BASE_ROLES, measures: {} },
      dimensions: [GENDER_RATE_DIMENSION],
    });
    expect(codesOf(panelWithDup)).toContain(SEGMENT_ISSUE.DUPLICATE_RATE_CELL);
    expect(panelWithDup.quality.status).toBe(PANEL_STATUS.BLOCKED);
  });

  it("범위를 벗어난 비율은 clamp하지 않고 차단한다", () => {
    const broken = RATE_GENDER_ROWS.map((row, index) => (index === 0 ? { ...row, 여성비중: "8.57" } : row));
    const panelBroken = buildSegmentPanel({
      rows: broken,
      roles: { ...BASE_ROLES, measures: {} },
      dimensions: [GENDER_RATE_DIMENSION],
    });
    expect(codesOf(panelBroken)).toContain(SEGMENT_ISSUE.RATE_OUT_OF_RANGE);
    expect(panelBroken.records).toEqual([]);
  });
});

describe("계약 게이트", () => {
  it("배타·포괄 축은 전 분석을 연다", () => {
    const panel = buildSegmentPanel({ rows: WIDE_GENDER_ROWS, roles: BASE_ROLES, dimensions: [GENDER_WIDE_DIMENSION] });
    expect(panel.dimensions[0].contract).toEqual({
      canTotalVariation: true,
      canMixRate: true,
      canMemberRate: true,
      canClaimFullPopulation: true,
    });
  });

  it("비배타 축은 TVD와 모집단 단정을 막고 보유율만 연다", () => {
    const panel = buildSegmentPanel({
      rows: NON_EXCLUSIVE_TAG_ROWS,
      roles: { time: "일자", entity: ["캠페인"], scope: [], measures: {} },
      dimensions: [TAG_DIMENSION],
    });
    expect(panel.dimensions[0].contract).toEqual({
      canTotalVariation: false,
      canMixRate: true,
      canMemberRate: true,
      canClaimFullPopulation: false,
    });
    // 멤버 합이 모수를 넘는 것은 비배타 축에서 정상이다 — 오류로 접지 않는다.
    expect(codesOf(panel)).not.toContain(SEGMENT_ISSUE.MEMBER_SUM_MISMATCH);
  });

  it("분석 단위 역할이 없으면 Mix/Rate를 열지 않는다", () => {
    const panel = buildSegmentPanel({
      rows: WIDE_GENDER_ROWS,
      roles: { ...BASE_ROLES, entity: [] },
      dimensions: [GENDER_WIDE_DIMENSION],
    });
    expect(panel.dimensions[0].contract.canMixRate).toBe(false);
    expect(panel.dimensions[0].contract.canTotalVariation).toBe(true);
  });

  it("캠페인을 매핑하지 않으면 wide 행의 모수를 합쳐 전체 구성으로 접는다", () => {
    // 두 캠페인 행이 한 셀로 접힌다 → 모수는 반복이 아니라 서로 다른 부분모집단이므로 합.
    const panel = buildSegmentPanel({
      rows: WIDE_GENDER_ROWS,
      roles: { time: "일자", entity: [], scope: ["OS"], measures: { spend: "광고비" } },
      dimensions: [GENDER_WIDE_DIMENSION],
    });
    const female = panel.records.find((record) => record.time === "2026-07-01" && record.memberId === "female");
    expect(female.count).toBe(420);
    expect(female.denominator).toBe(2000);
    expect(female.optionalMeasures.spend).toBe(4000000);
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.AGGREGATED_DUPLICATE_ROWS);
  });

  it("포괄 선언이 없고 분모도 없으면 분모를 지어내지 않는다", () => {
    const panel = buildSegmentPanel({
      rows: LONG_GENDER_ROWS,
      roles: BASE_ROLES,
      dimensions: [{ ...GENDER_LONG_DIMENSION, isExhaustive: false }],
    });
    expect(panel.records.every((record) => record.denominator === null)).toBe(true);
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.DENOMINATOR_UNAVAILABLE);
    expect(panel.dimensions[0].contract.canMemberRate).toBe(false);
  });
});

describe("차단·경고 조건", () => {
  const rolesWithoutSpend = { ...BASE_ROLES, measures: {} };
  // 셀별 올바른 모수를 적되, CPS PRE 한 셀에서만 두 멤버 행이 서로 다른 모수를 말한다.
  const CELL_TOTAL = { "2026-07-01|CPS": "1,400", "2026-07-01|BRAND": "600", "2026-08-01|CPS": "1,500", "2026-08-01|BRAND": "1,000" };
  const rowsWithConflictingTotal = LONG_GENDER_ROWS.map((row, index) => ({
    ...row,
    전체가입: index === 1 ? "1,000" : CELL_TOTAL[`${row.일자}|${row.캠페인}`],
  }));

  it("음수 인원수를 0으로 접지 않고 차단한다", () => {
    const rows = LONG_GENDER_ROWS.map((row, index) => (index === 0 ? { ...row, 가입: "-5" } : row));
    const panel = buildSegmentPanel({ rows, roles: rolesWithoutSpend, dimensions: [GENDER_LONG_DIMENSION] });
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.NEGATIVE_COUNT);
    expect(panel.records).toEqual([]);
  });

  it("숫자로 읽을 수 없는 인원수를 차단한다", () => {
    const rows = LONG_GENDER_ROWS.map((row, index) => (index === 0 ? { ...row, 가입: "약 120명" } : row));
    const panel = buildSegmentPanel({ rows, roles: rolesWithoutSpend, dimensions: [GENDER_LONG_DIMENSION] });
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.NON_NUMERIC_COUNT);
  });

  it("분모가 0 이하면 나눗셈을 시도하지 않는다", () => {
    const rows = WIDE_GENDER_ROWS.map((row, index) => (index === 0 ? { ...row, 전체가입: "0", 여성가입: "0", 남성가입: "0" } : row));
    const panel = buildSegmentPanel({ rows, roles: rolesWithoutSpend, dimensions: [GENDER_WIDE_DIMENSION] });
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.NON_POSITIVE_DENOMINATOR);
    expect(panel.records).toEqual([]);
  });

  it("멤버 합과 선언 분모가 어긋나면 경고하되 계산은 이어 간다", () => {
    const rows = WIDE_GENDER_ROWS.map((row, index) => (index === 0 ? { ...row, 전체가입: "1,900" } : row));
    const panel = buildSegmentPanel({ rows, roles: rolesWithoutSpend, dimensions: [GENDER_WIDE_DIMENSION] });
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.MEMBER_SUM_MISMATCH);
    expect(panel.quality.status).toBe(PANEL_STATUS.CAUTION);
    expect(panel.records.length).toBeGreaterThan(0);
  });

  it("멤버 인원수가 분모를 넘으면 차단한다", () => {
    const rows = WIDE_GENDER_ROWS.map((row, index) => (index === 0 ? { ...row, 여성가입: "2,000" } : row));
    const panel = buildSegmentPanel({ rows, roles: rolesWithoutSpend, dimensions: [GENDER_WIDE_DIMENSION] });
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.COUNT_EXCEEDS_DENOMINATOR);
  });

  it("같은 셀에 다른 분모가 적혀 있으면 하나를 고르지 않는다", () => {
    const panel = buildSegmentPanel({
      rows: rowsWithConflictingTotal,
      roles: rolesWithoutSpend,
      dimensions: [{ ...GENDER_LONG_DIMENSION, denominatorColumn: "전체가입" }],
    });
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.DENOMINATOR_CONFLICT);
    // 1,400도 1,000도 고르지 않고 포괄 선언을 근거로 멤버 합으로 떨어진다.
    expect(findRecord(panel, "2026-07-01", "CPS", "female").denominator).toBe(1400);
  });

  it("포괄 선언이 없는 상태에서 분모가 충돌하면 분모를 비운다", () => {
    const panel = buildSegmentPanel({
      rows: rowsWithConflictingTotal,
      roles: rolesWithoutSpend,
      dimensions: [{ ...GENDER_LONG_DIMENSION, isExhaustive: false, denominatorColumn: "전체가입" }],
    });
    // 충돌한 셀만 분모가 비고, 나머지 셀은 그대로 남는다(전체를 죽이지 않는다).
    expect(findRecord(panel, "2026-07-01", "CPS", "female").denominator).toBeNull();
    expect(findRecord(panel, "2026-08-01", "CPS", "female").denominator).toBe(1500);
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.DENOMINATOR_UNAVAILABLE);
  });

  it("멤버마다 다른 비용은 합산 규칙이 없으므로 그 지표만 비운다", () => {
    const rows = LONG_GENDER_ROWS.map((row, index) => (index === 0 ? { ...row, 광고비: "1,000,000" } : row));
    const panel = buildSegmentPanel({ rows, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] });
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.MEASURE_GRAIN_AMBIGUOUS);
    expect(findRecord(panel, "2026-07-01", "CPS", "female").optionalMeasures.spend).toBeNull();
    expect(findRecord(panel, "2026-07-01", "BRAND", "female").optionalMeasures.spend).toBe(1200000);
  });

  it("날짜가 없는 행은 조용히 버리지 않고 사유를 남긴다", () => {
    const rows = [...LONG_GENDER_ROWS, { ...LONG_GENDER_ROWS[0], 일자: "" }];
    const panel = buildSegmentPanel({ rows, roles: rolesWithoutSpend, dimensions: [GENDER_LONG_DIMENSION] });
    expect(codesOf(panel)).toContain(SEGMENT_ISSUE.MISSING_TIME_VALUE);
    expect(panel.quality.rows).toEqual({ total: 9, used: 8 });
  });

  it("역할이 비면 빈 결과 대신 사유를 남긴다", () => {
    const panel = buildSegmentPanel({ rows: LONG_GENDER_ROWS, roles: {}, dimensions: [] });
    expect(panel.quality.status).toBe(PANEL_STATUS.BLOCKED);
    expect(codesOf(panel)).toEqual(expect.arrayContaining([
      SEGMENT_ISSUE.MISSING_TIME_ROLE,
      SEGMENT_ISSUE.MISSING_DIMENSION,
    ]));
  });

  it("차단 사유는 경고보다 먼저 나열된다", () => {
    const rows = LONG_GENDER_ROWS.map((row, index) => (index === 0 ? { ...row, 가입: "-5" } : row));
    const panel = buildSegmentPanel({ rows, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] });
    const levels = panel.quality.issues.map((issue) => issue.level);
    expect(levels[0]).toBe(ISSUE_LEVEL.BLOCK);
    expect(levels).toEqual([...levels].sort((a, b) => (
      { block: 0, warn: 1, info: 2 }[a] - { block: 0, warn: 1, info: 2 }[b]
    )));
  });
});

describe("결정론", () => {
  it("같은 입력을 두 번 정규화하면 완전히 같다", () => {
    const first = buildSegmentPanel({ rows: LONG_TWO_AXIS_ROWS, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION, AGE_LONG_DIMENSION] });
    const second = buildSegmentPanel({ rows: LONG_TWO_AXIS_ROWS, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION, AGE_LONG_DIMENSION] });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("행 순서가 바뀌어도 같은 패널을 만든다", () => {
    const base = buildSegmentPanel({ rows: LONG_GENDER_ROWS, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] });
    const shuffled = buildSegmentPanel({ rows: [...LONG_GENDER_ROWS].reverse(), roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] });
    expect(withoutSource(shuffled.records)).toEqual(withoutSource(base.records));
  });

  it("NaN·Infinity가 결과 숫자로 새어 나오지 않는다", () => {
    const panel = buildSegmentPanel({ rows: RATE_GENDER_ROWS, roles: { ...BASE_ROLES, measures: {} }, dimensions: [GENDER_RATE_DIMENSION] });
    panel.records.forEach((record) => {
      expect(Number.isFinite(record.count)).toBe(true);
      expect(Number.isFinite(record.denominator)).toBe(true);
    });
  });
});
