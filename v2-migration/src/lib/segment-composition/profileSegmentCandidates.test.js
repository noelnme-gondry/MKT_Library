import { describe, it, expect } from "vitest";
import {
  profileSegmentCandidates, suggestWideMemberGroups,
  CANDIDATE_STATUS, CANDIDATE_REASON,
} from "@/lib/segment-composition/profileSegmentCandidates";
import { profileColumns } from "@/lib/data-import/profileColumns";
import { LONG_TWO_AXIS_ROWS, WIDE_GENDER_ROWS } from "@/lib/segment-composition/fixtures";

const headersOf = (rows) => Object.keys(rows[0]);
const statusOf = (result, header) => result.columns.find((column) => column.header === header)?.status;
const reasonsOf = (result, header) => result.columns.find((column) => column.header === header)?.reasons || [];

describe("long 파일의 축 후보", () => {
  const result = profileSegmentCandidates({
    headers: headersOf(LONG_TWO_AXIS_ROWS),
    rows: LONG_TWO_AXIS_ROWS,
    options: { timeColumn: "일자" },
  });

  it("저카디널리티 문자열 컬럼을 축 후보로 제안한다", () => {
    expect(statusOf(result, "성별")).toBe(CANDIDATE_STATUS.CANDIDATE);
    expect(statusOf(result, "연령대")).toBe(CANDIDATE_STATUS.CANDIDATE);
    expect(result.candidates.map((column) => column.header)).toEqual(expect.arrayContaining(["성별", "연령대"]));
  });

  it("날짜·지표 컬럼은 축이 될 수 없다고 사유를 붙여 거른다", () => {
    expect(statusOf(result, "일자")).toBe(CANDIDATE_STATUS.REJECTED);
    expect(reasonsOf(result, "일자")).toContain(CANDIDATE_REASON.DATE_COLUMN);
    expect(statusOf(result, "가입")).toBe(CANDIDATE_STATUS.REJECTED);
    expect(reasonsOf(result, "가입")).toContain(CANDIDATE_REASON.MEASURE_LIKE);
    expect(reasonsOf(result, "광고비")).toContain(CANDIDATE_REASON.MEASURE_LIKE);
  });

  it("기간 역할을 아직 안 골랐어도 날짜 컬럼은 축 후보가 아니다", () => {
    // `parseFloat("2026-07-01")`이 2026을 뽑아 날짜 컬럼이 숫자로도 보인다 —
    // 숫자 판정에 기대면 날짜가 후보로 새어 들어온다.
    const undeclared = profileSegmentCandidates({ headers: headersOf(LONG_TWO_AXIS_ROWS), rows: LONG_TWO_AXIS_ROWS });
    expect(statusOf(undeclared, "일자")).toBe(CANDIDATE_STATUS.REJECTED);
    expect(reasonsOf(undeclared, "일자")).toContain(CANDIDATE_REASON.DATE_COLUMN);
  });

  it("고유값과 예시 값을 함께 돌려준다 — 사용자가 눈으로 확인해야 하므로", () => {
    const gender = result.columns.find((column) => column.header === "성별");
    expect(gender.cardinality).toBe(2);
    expect(gender.sampleValues).toEqual(["Female", "Male"]);
  });
});

describe("자동 확정하면 안 되는 컬럼", () => {
  const rows = [
    { date: "2026-07-01", user_id: "u-1", age: "23", is_paid: "1", interests: "여행,게임", plan: "Basic", memo: "이 사용자는 지난달에 가입했고 프로모션을 통해 유입되었습니다" },
    { date: "2026-07-01", user_id: "u-2", age: "31", is_paid: "0", interests: "게임", plan: "Pro", memo: "친구 추천으로 가입한 뒤 첫 주에 결제까지 완료한 사용자입니다" },
    { date: "2026-08-01", user_id: "u-3", age: "45", is_paid: "1", interests: "여행;음악", plan: "Basic", memo: "광고를 보고 방문했으나 결제 없이 이탈한 뒤 재방문한 사용자입니다" },
    { date: "2026-08-01", user_id: "u-4", age: "52", is_paid: "0", interests: "음악", plan: "Pro", memo: "오가닉 검색으로 들어와 무료 체험만 사용하고 있는 사용자입니다" },
  ];
  const result = profileSegmentCandidates({ headers: Object.keys(rows[0]), rows, options: { timeColumn: "date" } });

  it("ID 컬럼은 거른다", () => {
    expect(statusOf(result, "user_id")).toBe(CANDIDATE_STATUS.REJECTED);
    expect(reasonsOf(result, "user_id")).toContain(CANDIDATE_REASON.IDENTIFIER_LIKE);
  });

  it("연속형 숫자는 구간을 나눠야 하므로 확인 대상으로 남긴다", () => {
    const rowsWithManyAges = Array.from({ length: 30 }, (_, index) => ({ date: "2026-07-01", age: String(20 + index) }));
    const ages = profileSegmentCandidates({ headers: ["date", "age"], rows: rowsWithManyAges, options: { timeColumn: "date" } });
    expect(statusOf(ages, "age")).toBe(CANDIDATE_STATUS.NEEDS_REVIEW);
    expect(reasonsOf(ages, "age")).toContain(CANDIDATE_REASON.CONTINUOUS_NUMERIC);
  });

  it("0/1 컬럼은 성과 플래그일 수 있어 확정하지 않는다", () => {
    expect(statusOf(result, "is_paid")).toBe(CANDIDATE_STATUS.NEEDS_REVIEW);
    expect(reasonsOf(result, "is_paid")).toContain(CANDIDATE_REASON.BINARY_FLAG_AMBIGUOUS);
  });

  it("여러 값이 든 태그 컬럼은 비배타일 수 있어 확정하지 않는다", () => {
    expect(statusOf(result, "interests")).toBe(CANDIDATE_STATUS.NEEDS_REVIEW);
    expect(reasonsOf(result, "interests")).toContain(CANDIDATE_REASON.MULTI_VALUE_TAGS);
  });

  it("자유 텍스트는 축이 될 수 없다", () => {
    expect(statusOf(result, "memo")).toBe(CANDIDATE_STATUS.REJECTED);
    expect(reasonsOf(result, "memo")).toContain(CANDIDATE_REASON.FREE_TEXT);
  });

  it("정수로 코딩된 등급은 날짜로 오인해 버리지 않는다", () => {
    // 공용 프로파일러는 `new Date("1")`이 2001-01-01로 파싱되는 탓에 맨 정수를
    // 날짜로 본다. 여기서 날짜로 걸러 내면 정수 코드 세그먼트가 통째로 사라진다.
    const rows2 = [
      { date: "2026-07-01", tier: "1" }, { date: "2026-07-01", tier: "2" },
      { date: "2026-08-01", tier: "3" }, { date: "2026-08-01", tier: "1" },
    ];
    const result2 = profileSegmentCandidates({ headers: ["date", "tier"], rows: rows2, options: { timeColumn: "date" } });
    expect(reasonsOf(result2, "tier")).not.toContain(CANDIDATE_REASON.DATE_COLUMN);
    expect(statusOf(result2, "tier")).toBe(CANDIDATE_STATUS.CANDIDATE);
  });

  it("정상적인 저카디널리티 문자열은 그대로 후보로 남는다", () => {
    expect(statusOf(result, "plan")).toBe(CANDIDATE_STATUS.CANDIDATE);
  });

  it("한 기간에만 나타나는 축은 확인 대상으로 내린다", () => {
    const rowsOnePeriod = [
      { date: "2026-07-01", plan: "Basic" }, { date: "2026-07-01", plan: "Pro" },
      { date: "2026-08-01", plan: "Basic" },
    ];
    const result2 = profileSegmentCandidates({
      headers: ["date", "plan"],
      rows: rowsOnePeriod,
      options: { timeColumn: "date", prePeriods: ["2026-07-01"], postPeriods: ["2026-08-01"] },
    });
    expect(reasonsOf(result2, "plan")).toContain(CANDIDATE_REASON.MISSING_IN_PERIOD);
    expect(statusOf(result2, "plan")).toBe(CANDIDATE_STATUS.NEEDS_REVIEW);
  });

  it("결측이 많은 컬럼은 경고와 함께 남긴다", () => {
    const sparse = [
      { date: "2026-07-01", tier: "A" }, { date: "2026-07-01", tier: "B" },
      { date: "2026-08-01", tier: "" }, { date: "2026-08-01", tier: "" },
    ];
    const result3 = profileSegmentCandidates({ headers: ["date", "tier"], rows: sparse, options: { timeColumn: "date" } });
    expect(reasonsOf(result3, "tier")).toContain(CANDIDATE_REASON.HIGH_MISSING);
  });
});

describe("wide 멤버 컬럼 묶기 제안", () => {
  it("접미사를 공유하는 숫자 컬럼을 한 축의 멤버로 묶고 전체 컬럼은 분모로 뺀다", () => {
    const groups = suggestWideMemberGroups(profileColumns(headersOf(WIDE_GENDER_ROWS), WIDE_GENDER_ROWS));
    const genderGroup = groups.find((group) => group.members.some((member) => member.sourceColumn === "여성가입"));
    expect(genderGroup.members.map((member) => member.sourceColumn)).toEqual(["여성가입", "남성가입"]);
    // 전체가입을 멤버에 넣으면 자기 자신을 포함한 분포가 되어 비중이 절반으로 눌린다.
    expect(genderGroup.denominatorCandidate).toBe("전체가입");
  });

  it("접두사를 공유하는 컬럼도 묶는다", () => {
    const rows = [{ date: "2026-07-01", age_u29: "620", age_30_39: "510", age_40p: "270", total_signups: "1400" }];
    const groups = suggestWideMemberGroups(profileColumns(Object.keys(rows[0]), rows));
    const ageGroup = groups.find((group) => group.id === "age");
    expect(ageGroup.members.map((member) => member.sourceColumn)).toEqual(["age_u29", "age_30_39", "age_40p"]);
    expect(ageGroup.denominatorCandidate).toBeNull();
  });

  it("멤버가 하나뿐인 묶음은 제안하지 않는다", () => {
    const rows = [{ date: "2026-07-01", 여성가입: "120", 광고비: "2800000" }];
    const groups = suggestWideMemberGroups(profileColumns(Object.keys(rows[0]), rows));
    expect(groups).toEqual([]);
  });
});

describe("결정론", () => {
  it("같은 입력을 두 번 프로파일링하면 완전히 같다", () => {
    const first = profileSegmentCandidates({ headers: headersOf(LONG_TWO_AXIS_ROWS), rows: LONG_TWO_AXIS_ROWS, options: { timeColumn: "일자" } });
    const second = profileSegmentCandidates({ headers: headersOf(LONG_TWO_AXIS_ROWS), rows: LONG_TWO_AXIS_ROWS, options: { timeColumn: "일자" } });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
