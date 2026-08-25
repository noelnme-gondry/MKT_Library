import { describe, it, expect } from "vitest";
import { buildSegmentPanel } from "@/lib/segment-composition/segmentPanel";
import {
  LONG_GENDER_ROWS, WIDE_GENDER_ROWS, RATE_GENDER_ROWS, LONG_TWO_AXIS_ROWS, NON_EXCLUSIVE_TAG_ROWS,
  BASE_ROLES, GENDER_LONG_DIMENSION, GENDER_WIDE_DIMENSION, GENDER_RATE_DIMENSION,
  AGE_LONG_DIMENSION, TAG_DIMENSION,
} from "@/lib/segment-composition/fixtures";
import {
  compareDistribution, decomposeMixRate, rollupMixRate, netNewProfile, rankDimensions,
  DIMENSION_STATUS, SEGMENT_REASON, SEGMENT_THRESHOLDS,
} from "@/utils/segmentCompositionMath";

const PRE = ["2026-07-01"];
const POST = ["2026-08-01"];

// 분해 전용 합성 패널: entity 비중과 entity 내부 비율을 따로 흔들어 볼 수 있게 wide로 만든다.
const GENDER_DIMENSION = {
  id: "gender",
  label: "성별",
  sourceShape: "wide_count",
  isExclusive: true,
  isExhaustive: true,
  denominatorColumn: "total",
  members: [
    { id: "female", label: "F", sourceColumn: "female" },
    { id: "male", label: "M", sourceColumn: "male" },
  ],
};

const widePanel = (rows) => buildSegmentPanel({
  rows,
  roles: { time: "date", entity: ["campaign"], scope: [], measures: {} },
  dimensions: [GENDER_DIMENSION],
});

const cell = (date, campaign, total, female) => ({
  date, campaign, total: String(total), female: String(female), male: String(total - female),
});

const genderPanel = buildSegmentPanel({ rows: WIDE_GENDER_ROWS, roles: BASE_ROLES, dimensions: [GENDER_WIDE_DIMENSION] });

describe("T01 구성 무변화", () => {
  it("TVD 0, 모든 %p 0", () => {
    const panel = widePanel([
      cell("2026-07-01", "A", 1000, 100), cell("2026-07-01", "B", 1000, 500),
      cell("2026-08-01", "A", 2000, 200), cell("2026-08-01", "B", 2000, 1000),
    ]);
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    expect(result.status).toBe(DIMENSION_STATUS.READY);
    expect(result.totalVariation).toBeCloseTo(0, 12);
    result.members.forEach((member) => expect(member.shareDelta).toBeCloseTo(0, 12));
  });
});

describe("T02~T04 Mix / Rate / Interaction 무잔차 분해", () => {
  const identityHolds = (decomposition) => {
    const { mix, rate, interaction, delta } = decomposition.totals;
    expect(mix + rate + interaction).toBeCloseTo(delta, 12);
    const entitySum = decomposition.entities.reduce((sum, entity) => sum + entity.total, 0);
    expect(entitySum).toBeCloseTo(delta, 12);
  };

  it("T02 Mix만 변화 — 단위 내부 비율이 그대로면 Rate·Interaction은 0", () => {
    // A는 10%, B는 50%로 두 기간 모두 고정. 예산만 A→B로 옮겨 간 상황.
    const panel = widePanel([
      cell("2026-07-01", "A", 1000, 100), cell("2026-07-01", "B", 1000, 500),
      cell("2026-08-01", "A", 500, 50), cell("2026-08-01", "B", 1500, 750),
    ]);
    const decomposition = decomposeMixRate({ panel, dimensionId: "gender", memberId: "female", pre: PRE, post: POST });
    expect(decomposition.available).toBe(true);
    expect(decomposition.totals.rate).toBeCloseTo(0, 12);
    expect(decomposition.totals.interaction).toBeCloseTo(0, 12);
    expect(decomposition.totals.mix).toBeCloseTo(decomposition.totals.delta, 12);
    expect(decomposition.totals.delta).toBeCloseTo(0.1, 12); // 30% → 40%
    identityHolds(decomposition);
  });

  it("T03 Rate만 변화 — 단위 비중이 그대로면 Mix·Interaction은 0", () => {
    const panel = widePanel([
      cell("2026-07-01", "A", 1000, 100), cell("2026-07-01", "B", 1000, 500),
      cell("2026-08-01", "A", 1000, 200), cell("2026-08-01", "B", 1000, 400),
    ]);
    const decomposition = decomposeMixRate({ panel, dimensionId: "gender", memberId: "female", pre: PRE, post: POST });
    expect(decomposition.totals.mix).toBeCloseTo(0, 12);
    expect(decomposition.totals.interaction).toBeCloseTo(0, 12);
    expect(decomposition.totals.rate).toBeCloseTo(decomposition.totals.delta, 12);
    identityHolds(decomposition);
  });

  it("T04 둘 다 변화 — 세 항의 합이 전체 변화와 일치한다", () => {
    const decomposition = decomposeMixRate({ panel: genderPanel, dimensionId: "gender", memberId: "female", pre: PRE, post: POST });
    expect(decomposition.totals.preRate).toBeCloseTo(420 / 2000, 12);
    expect(decomposition.totals.postRate).toBeCloseTo(900 / 2500, 12);
    identityHolds(decomposition);
    /* 손계산 참조(구현과 다른 경로):
     *   pre  CPS w=0.7 r=120/1400   BRAND w=0.3 r=0.5
     *   post CPS w=0.6 r=200/1500   BRAND w=0.4 r=0.7
     *   Mix  = (-0.1)(120/1400) + (0.1)(0.5)                    = 0.041428571428571...
     *   Rate = 0.7(200/1500 - 120/1400) + 0.3(0.2)              = 0.093333333333333...
     *   Int  = (-0.1)(200/1500 - 120/1400) + (0.1)(0.2)         = 0.015238095238095...
     *   합 = 0.15 = ΔR */
    expect(decomposition.totals.mix).toBeCloseTo(0.04142857142857143, 12);
    expect(decomposition.totals.rate).toBeCloseTo(0.09333333333333334, 12);
    expect(decomposition.totals.interaction).toBeCloseTo(0.015238095238095238, 12);
    // 캠페인 간 이동보다 캠페인 내부 변화가 더 크다 — 어느 한쪽으로 몰아 주지 않는다.
    expect(decomposition.totals.rate).toBeGreaterThan(decomposition.totals.mix);
  });

  it("롤업은 단순 합산이라 항등식이 그대로 남는다", () => {
    const decomposition = decomposeMixRate({ panel: genderPanel, dimensionId: "gender", memberId: "female", pre: PRE, post: POST });
    const rolled = rollupMixRate(decomposition, () => "전체");
    expect(rolled).toHaveLength(1);
    expect(rolled[0].mix).toBeCloseTo(decomposition.totals.mix, 12);
    expect(rolled[0].total).toBeCloseTo(decomposition.totals.delta, 12);
  });

  it("한쪽에만 있는 분석 단위도 항등식을 깨지 않고 진입·이탈로 표시된다", () => {
    const panel = widePanel([
      cell("2026-07-01", "A", 1000, 100),
      cell("2026-08-01", "A", 1000, 100), cell("2026-08-01", "NEW", 1000, 900),
    ]);
    const decomposition = decomposeMixRate({ panel, dimensionId: "gender", memberId: "female", pre: PRE, post: POST });
    const entry = decomposition.entities.find((entity) => entity.entityKey === "NEW");
    expect(entry.kind).toBe("entry");
    expect(decomposition.reasons).toContain(SEGMENT_REASON.ENTITY_ENTERED);
    const { mix, rate, interaction, delta } = decomposition.totals;
    expect(mix + rate + interaction).toBeCloseTo(delta, 12);
  });

  it("분석 단위가 하나뿐이면 분해를 열되 사유를 남긴다", () => {
    const panel = widePanel([cell("2026-07-01", "A", 1000, 100), cell("2026-08-01", "A", 1000, 300)]);
    const decomposition = decomposeMixRate({ panel, dimensionId: "gender", memberId: "female", pre: PRE, post: POST });
    expect(decomposition.reasons).toContain(SEGMENT_REASON.SINGLE_ENTITY);
    expect(decomposition.totals.mix).toBeCloseTo(0, 12);
  });

  it("분모가 없는 축에서는 분해 자체를 열지 않는다", () => {
    const panel = buildSegmentPanel({
      rows: LONG_GENDER_ROWS,
      roles: { ...BASE_ROLES, measures: {} },
      dimensions: [{ ...GENDER_LONG_DIMENSION, isExhaustive: false }],
    });
    const decomposition = decomposeMixRate({ panel, dimensionId: "gender", memberId: "female", pre: PRE, post: POST });
    expect(decomposition.available).toBe(false);
    expect(decomposition.reasons).toContain(SEGMENT_REASON.MIX_RATE_UNAVAILABLE);
  });
});

describe("T05·T06 신규·소멸 멤버", () => {
  const rowsWithNewMember = [
    ...LONG_GENDER_ROWS,
    { 일자: "2026-08-01", 캠페인: "CPS", OS: "Android", 성별: "Unknown", 가입: "50", 광고비: "3,000,000" },
  ];

  it("T05 POST에만 있는 멤버를 조용히 빼지 않는다", () => {
    const panel = buildSegmentPanel({ rows: rowsWithNewMember, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] });
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    const unknown = result.members.find((member) => member.memberId === "Unknown");
    expect(unknown.isNew).toBe(true);
    expect(unknown.preCount).toBeNull();
    expect(unknown.preShare).toBeNull();
    expect(unknown.postCount).toBe(50);
    expect(result.reasons).toContain(SEGMENT_REASON.MEMBER_ENTERED);
    expect(result.status).toBe(DIMENSION_STATUS.CAUTION);
  });

  it("T06 PRE에만 있는 멤버는 소멸로 표시하고 비중 합을 지킨다", () => {
    const rows = rowsWithNewMember.map((row) => (row.성별 === "Unknown" ? { ...row, 일자: "2026-07-01" } : row));
    const panel = buildSegmentPanel({ rows, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] });
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    const unknown = result.members.find((member) => member.memberId === "Unknown");
    expect(unknown.isLost).toBe(true);
    expect(unknown.postShare).toBeNull();
    expect(result.reasons).toContain(SEGMENT_REASON.MEMBER_EXITED);
    const preShareSum = result.members.reduce((sum, member) => sum + (member.preShare ?? 0), 0);
    expect(preShareSum).toBeCloseTo(1, 12);
  });
});

describe("T07 Long / Wide 동치", () => {
  it("두 shape의 분포 결과가 같다", () => {
    const longPanel = buildSegmentPanel({ rows: LONG_GENDER_ROWS, roles: BASE_ROLES, dimensions: [GENDER_LONG_DIMENSION] });
    const fromLong = compareDistribution({ panel: longPanel, dimensionId: "gender", pre: PRE, post: POST });
    const fromWide = compareDistribution({ panel: genderPanel, dimensionId: "gender", pre: PRE, post: POST });
    expect(fromWide).toEqual(fromLong);
  });

  it("전체 여성 비중 21.0% → 36.0%를 그대로 재현한다", () => {
    const result = compareDistribution({ panel: genderPanel, dimensionId: "gender", pre: PRE, post: POST });
    const female = result.members.find((member) => member.memberId === "female");
    expect(female.preShare).toBeCloseTo(0.21, 12);
    expect(female.postShare).toBeCloseTo(0.36, 12);
    expect(female.shareDelta).toBeCloseTo(0.15, 12);
    expect(result.totalVariation).toBeCloseTo(0.15, 12);
    expect(female.shareOfShift).toBeCloseTo(0.5, 12);
  });
});

describe("T08~T11 표본·계약 게이트", () => {
  it("T08 기간 분모가 임계 미만이면 0이 아니라 INSUFFICIENT_DATA", () => {
    const panel = widePanel([cell("2026-07-01", "A", 40, 10), cell("2026-08-01", "A", 50, 25)]);
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    expect(result.status).toBe(DIMENSION_STATUS.INSUFFICIENT_DATA);
    expect(result.reasons).toContain(SEGMENT_REASON.LOW_PERIOD_POPULATION);
    // 사유만 다를 뿐 "변화 없음"이 아니다 — 계산된 값은 그대로 보인다.
    expect(result.totalVariation).toBeCloseTo(0.25, 12);
  });

  it("멤버 분모가 작으면 CAUTION으로 내려간다", () => {
    const panel = widePanel([cell("2026-07-01", "A", 1000, 10), cell("2026-08-01", "A", 1000, 20)]);
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    expect(result.status).toBe(DIMENSION_STATUS.CAUTION);
    expect(result.reasons).toContain(SEGMENT_REASON.LOW_MEMBER_POPULATION);
  });

  it("T09 0분모 패널은 숫자 대신 상태로 답한다", () => {
    const panel = widePanel([cell("2026-07-01", "A", 0, 0), cell("2026-08-01", "A", 1000, 200)]);
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    expect(result.status).toBe(DIMENSION_STATUS.INSUFFICIENT_DATA);
    expect(result.totalVariation).toBeNull();
    expect(Number.isNaN(result.periods.pre.population)).toBe(false);
  });

  it("T10 비배타 축은 TVD를 계산하지 않는다", () => {
    const panel = buildSegmentPanel({
      rows: NON_EXCLUSIVE_TAG_ROWS,
      roles: { time: "일자", entity: ["캠페인"], scope: [], measures: {} },
      dimensions: [TAG_DIMENSION],
    });
    const result = compareDistribution({ panel, dimensionId: "interest", pre: PRE, post: POST });
    expect(result.totalVariation).toBeNull();
    expect(result.reasons).toContain(SEGMENT_REASON.NOT_EXHAUSTIVE);
    // 보유율 변화 자체는 정상적으로 답한다.
    const travel = result.members.find((member) => member.memberId === "travel");
    expect(travel.preShare).toBeCloseTo(900 / 1400, 12);
    expect(travel.postShare).toBeCloseTo(1100 / 1500, 12);
  });

  it("T11 모수 충돌은 INVALID_GRAIN으로 분리한다", () => {
    const rows = LONG_GENDER_ROWS.map((row, index) => ({
      ...row,
      전체가입: index === 1 ? "1,000" : { "2026-07-01|CPS": "1,400", "2026-07-01|BRAND": "600", "2026-08-01|CPS": "1,500", "2026-08-01|BRAND": "1,000" }[`${row.일자}|${row.캠페인}`],
    }));
    const panel = buildSegmentPanel({
      rows,
      roles: { ...BASE_ROLES, measures: {} },
      dimensions: [{ ...GENDER_LONG_DIMENSION, denominatorColumn: "전체가입" }],
    });
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    expect(result.status).toBe(DIMENSION_STATUS.INVALID_GRAIN);
    expect(result.reasons).toContain(SEGMENT_REASON.GRAIN_CONFLICT);
  });

  it("비율 입력은 추정치라는 사실을 상태로 끌고 온다", () => {
    const panel = buildSegmentPanel({
      rows: RATE_GENDER_ROWS,
      roles: { ...BASE_ROLES, measures: {} },
      dimensions: [GENDER_RATE_DIMENSION],
    });
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    expect(result.reasons).toContain(SEGMENT_REASON.ESTIMATED_COUNTS);
    expect(result.status).toBe(DIMENSION_STATUS.CAUTION);
    // 반올림 복원이라 정확히 0.15는 아니지만 결론이 뒤집힐 정도는 아니다.
    expect(result.totalVariation).toBeCloseTo(0.15, 3);
  });
});

describe("T12 순증 구간 프로파일", () => {
  it("늘어난 몫의 구성을 계산한다", () => {
    const result = compareDistribution({ panel: genderPanel, dimensionId: "gender", pre: PRE, post: POST });
    const profile = netNewProfile(result);
    expect(profile.available).toBe(true);
    expect(profile.increase).toBe(500);
    const female = profile.members.find((member) => member.memberId === "female");
    // 순증 500명 중 여성이 480명 — 늘어난 구간이 기존 구성과 완전히 다르다.
    expect(female.netCount).toBe(480);
    expect(female.netRate).toBeCloseTo(0.96, 12);
  });

  it("모집단이 줄었으면 계산하지 않는다", () => {
    const panel = widePanel([cell("2026-07-01", "A", 2000, 400), cell("2026-08-01", "A", 1000, 300)]);
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    const profile = netNewProfile(result);
    expect(profile.available).toBe(false);
    expect(profile.reasons).toContain(SEGMENT_REASON.POPULATION_NOT_GROWN);
  });

  it("증가분이 너무 작으면 열지 않는다", () => {
    const panel = widePanel([cell("2026-07-01", "A", 1000, 200), cell("2026-08-01", "A", 1010, 260)]);
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    const profile = netNewProfile(result);
    expect(profile.available).toBe(false);
    expect(profile.reasons).toContain(SEGMENT_REASON.NET_INCREASE_TOO_SMALL);
    expect(profile.increase).toBe(10);
    expect(SEGMENT_THRESHOLDS.minNetIncrease).toBe(30);
  });

  it("범위를 벗어난 값은 clamp하지 않고 해석 불가로 남긴다", () => {
    const panel = widePanel([cell("2026-07-01", "A", 1000, 100), cell("2026-08-01", "A", 1100, 250)]);
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    const profile = netNewProfile(result);
    const female = profile.members.find((member) => member.memberId === "female");
    expect(female.rawNetRate).toBeCloseTo(1.5, 12);
    expect(female.netRate).toBeNull();
    expect(female.interpretable).toBe(false);
    expect(profile.reasons).toContain(SEGMENT_REASON.NET_RATE_OUT_OF_RANGE);
  });
});

describe("축 랭킹", () => {
  const twoAxisPanel = buildSegmentPanel({
    rows: LONG_TWO_AXIS_ROWS,
    roles: BASE_ROLES,
    dimensions: [GENDER_LONG_DIMENSION, AGE_LONG_DIMENSION],
  });

  it("증거 상태 → TVD 순으로 정렬하고 합성 점수를 만들지 않는다", () => {
    const ranked = rankDimensions({ panel: twoAxisPanel, pre: PRE, post: POST });
    expect(ranked.map((entry) => entry.dimensionId)).toEqual(["gender", "age"]);
    expect(ranked[0].totalVariation).toBeGreaterThan(ranked[1].totalVariation);
    ranked.forEach((entry) => expect(entry).not.toHaveProperty("score"));
  });

  it("표본이 모자란 축은 변화가 커도 뒤로 밀린다", () => {
    const rows = [
      ...LONG_TWO_AXIS_ROWS,
      { 일자: "2026-07-01", 캠페인: "CPS", OS: "Android", 등급: "VIP", 가입2: "5", 광고비: "2,800,000" },
    ];
    const panel = buildSegmentPanel({
      rows,
      roles: BASE_ROLES,
      dimensions: [
        GENDER_LONG_DIMENSION,
        { id: "tier", label: "등급", sourceShape: "long_count", isExclusive: true, isExhaustive: true, categoryColumn: "등급", countColumn: "가입2" },
      ],
    });
    const ranked = rankDimensions({ panel, pre: PRE, post: POST });
    expect(ranked[0].dimensionId).toBe("gender");
    expect(ranked[ranked.length - 1].dimensionId).toBe("tier");
    expect(ranked[ranked.length - 1].status).toBe(DIMENSION_STATUS.INSUFFICIENT_DATA);
  });

  it("기간 선택자는 목록과 범위를 모두 받는다", () => {
    const byList = compareDistribution({ panel: genderPanel, dimensionId: "gender", pre: PRE, post: POST });
    const byRange = compareDistribution({
      panel: genderPanel,
      dimensionId: "gender",
      pre: { from: "2026-06-01", to: "2026-07-15" },
      post: { from: "2026-07-16", to: "2026-08-31" },
    });
    expect(byRange).toEqual(byList);
  });

  it("경쟁 범위 필터가 걸리면 그 범위만 계산한다", () => {
    const rows = [
      ...WIDE_GENDER_ROWS,
      { 일자: "2026-07-01", 캠페인: "CPS", OS: "iOS", 전체가입: "1,000", 여성가입: "900", 남성가입: "100", 광고비: "1,000,000" },
      { 일자: "2026-08-01", 캠페인: "CPS", OS: "iOS", 전체가입: "1,000", 여성가입: "100", 남성가입: "900", 광고비: "1,000,000" },
    ];
    const panel = buildSegmentPanel({ rows, roles: BASE_ROLES, dimensions: [GENDER_WIDE_DIMENSION] });
    const android = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST, scopeFilter: { OS: "Android" } });
    const base = compareDistribution({ panel: genderPanel, dimensionId: "gender", pre: PRE, post: POST });
    expect(android.members).toEqual(base.members);
  });
});

describe("T14 결정론", () => {
  it("같은 입력을 두 번 계산하면 완전히 같다", () => {
    const first = rankDimensions({ panel: genderPanel, pre: PRE, post: POST });
    const second = rankDimensions({ panel: genderPanel, pre: PRE, post: POST });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("NaN·Infinity가 결과에 새어 나오지 않는다", () => {
    const panel = widePanel([cell("2026-07-01", "A", 1000, 0), cell("2026-08-01", "A", 1000, 1000)]);
    const result = compareDistribution({ panel, dimensionId: "gender", pre: PRE, post: POST });
    result.members.forEach((member) => {
      expect(Number.isFinite(member.preShare)).toBe(true);
      expect(Number.isFinite(member.postShare)).toBe(true);
    });
    const decomposition = decomposeMixRate({ panel, dimensionId: "gender", memberId: "female", pre: PRE, post: POST });
    Object.values(decomposition.totals).forEach((value) => expect(Number.isFinite(value)).toBe(true));
  });
});
