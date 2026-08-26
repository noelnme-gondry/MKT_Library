import { describe, it, expect } from "vitest";
import { autoDeclare, defaultPeriods, periodKeys } from "@/lib/segment-composition/autoDeclare";
import { buildSegmentPanel } from "@/lib/segment-composition/segmentPanel";
import { rankDimensions } from "@/utils/segmentCompositionMath";
import { buildDemoCsv } from "@/utils/demoData";
import { LONG_TWO_AXIS_ROWS, WIDE_GENDER_ROWS } from "@/lib/segment-composition/fixtures";

const headersOf = (rows) => Object.keys(rows[0]);
const roleOf = (result, column) => result.notes.find((note) => note.column === column)?.role;

describe("실제 플랫폼형 CSV를 손대지 않고 선언한다", () => {
  const demo = buildDemoCsv("segment_composition");
  const result = autoDeclare({ headers: demo.headers, rows: demo.raw });

  it("기간·인원수·비용·단위·범위를 한 번에 잡는다", () => {
    expect(result.ok).toBe(true);
    expect(result.roles.time).toBe("date");
    expect(result.roles.entity).toEqual(["campaign"]);
    expect(result.roles.scope).toEqual(["platform"]);
    expect(result.roles.measures.spend).toBe("cost");
    expect(roleOf(result, "signups")).toBe("count");
  });

  it("남은 구분 컬럼 전부를 축으로 선언한다 — 하나만 고르라고 하지 않는다", () => {
    expect(result.dimensions.map((dimension) => dimension.id).sort()).toEqual(["age_band", "gender"]);
    result.dimensions.forEach((dimension) => expect(dimension.countColumn).toBe("signups"));
  });

  it("선언한 그대로 패널이 만들어지고 두 축이 랭킹된다", () => {
    const panel = buildSegmentPanel({ rows: demo.raw, roles: result.roles, dimensions: result.dimensions });
    expect(panel.records.length).toBeGreaterThan(0);
    const { pre, post } = defaultPeriods(demo.raw, result.roles.time);
    const ranked = rankDimensions({ panel, pre: [pre], post: [post] });
    expect(ranked).toHaveLength(2);
    expect(ranked.every((entry) => entry.totalVariation != null)).toBe(true);
  });

  it("무엇을 무엇으로 잡았는지 컬럼별로 말한다", () => {
    const columns = result.notes.map((note) => note.column);
    expect(columns).toEqual(expect.arrayContaining(["date", "signups", "cost", "campaign", "platform", "gender", "age_band"]));
    result.notes.forEach((note) => expect(note.why.length).toBeGreaterThan(3));
  });
});

describe("한글 헤더도 같은 규칙으로 잡는다", () => {
  const result = autoDeclare({ headers: headersOf(LONG_TWO_AXIS_ROWS), rows: LONG_TWO_AXIS_ROWS });

  it("표준키가 아닌 실무 헤더에서도 동작한다", () => {
    expect(result.roles.time).toBe("일자");
    expect(result.roles.entity).toEqual(["캠페인"]);
    // OS가 Android 하나뿐이라 나눌 게 없다 → 범위로 선언하지 않는다(값이 하나인 축은 후보가 아니다).
    expect(result.roles.scope).toEqual([]);
    expect(result.roles.measures.spend).toBe("광고비");
    expect(result.dimensions.map((dimension) => dimension.id).sort()).toEqual(["성별", "연령대"]);
  });
});

describe("역할 컬럼은 세그먼트 cardinality 제한과 분리한다", () => {
  it("식별자 컬럼보다 사람이 읽는 캠페인명을 분석 단위로 고른다", () => {
    const rows = [
      { date: "2026-07-01", campaign_id: "c-8f3a91", campaign: "Brand", gender: "F", signups: "10" },
      { date: "2026-07-01", campaign_id: "c-51bd02", campaign: "Prospecting", gender: "M", signups: "12" },
      { date: "2026-08-01", campaign_id: "c-8f3a91", campaign: "Brand", gender: "F", signups: "11" },
      { date: "2026-08-01", campaign_id: "c-51bd02", campaign: "Prospecting", gender: "M", signups: "13" },
    ];
    const result = autoDeclare({ headers: Object.keys(rows[0]), rows });

    expect(result.roles.entity).toEqual(["campaign"]);
    expect(result.dimensions.map((dimension) => dimension.id)).toEqual(["gender"]);
    expect(result.review.map((column) => column.header)).not.toContain("campaign_id");
  });

  it("긴 자유 텍스트는 이름이 역할 어휘에 걸려도 분석 단위로 쓰지 않는다", () => {
    const rows = [
      { date: "2026-07-01", creative_copy: "여름 할인 혜택을 자세히 설명하는 매우 긴 광고 문구입니다 A", gender: "F", signups: "10" },
      { date: "2026-07-01", creative_copy: "신규 가입 혜택을 자세히 설명하는 매우 긴 광고 문구입니다 B", gender: "M", signups: "12" },
      { date: "2026-08-01", creative_copy: "재방문 고객 혜택을 자세히 설명하는 매우 긴 광고 문구입니다 C", gender: "F", signups: "11" },
      { date: "2026-08-01", creative_copy: "브랜드 프로모션을 자세히 설명하는 매우 긴 광고 문구입니다 D", gender: "M", signups: "13" },
    ];
    const result = autoDeclare({ headers: Object.keys(rows[0]), rows });

    expect(result.roles.entity).toEqual([]);
    expect(result.dimensions.map((dimension) => dimension.id)).toEqual(["gender"]);
  });

  it("숫자가 섞인 긴 자유 텍스트도 분석 단위로 쓰지 않는다", () => {
    const rows = Array.from({ length: 120 }, (_, index) => ({
      date: index < 60 ? "2026-07-01" : "2026-08-01",
      creative_copy: `Creative ${index + 1} audience insight and experiment summary for cohort ${index + 1}`,
      gender: index % 2 ? "F" : "M",
      signups: "10",
    }));
    const result = autoDeclare({ headers: Object.keys(rows[0]), rows });

    expect(result.roles.entity).toEqual([]);
    expect(result.dimensions.map((dimension) => dimension.id)).toEqual(["gender"]);
  });

  it("캠페인이 20개를 넘어도 분석 단위로 선언한다", () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      date: index < 15 ? "2026-07-01" : "2026-08-01",
      campaign: `campaign-${index + 1}`,
      gender: index % 2 ? "F" : "M",
      signups: "10",
    }));
    const result = autoDeclare({ headers: Object.keys(rows[0]), rows });

    expect(result.roles.entity).toEqual(["campaign"]);
    expect(result.dimensions.map((dimension) => dimension.id)).toEqual(["gender"]);
  });

  it("숫자 접미사가 있는 120개 캠페인도 분석 단위로 선언한다", () => {
    const rows = Array.from({ length: 120 }, (_, index) => ({
      date: index < 60 ? "2026-07-01" : "2026-08-01",
      campaign: `Campaign ${index + 1}`,
      gender: index % 2 ? "F" : "M",
      signups: "10",
    }));
    const result = autoDeclare({ headers: Object.keys(rows[0]), rows });

    expect(result.roles.entity).toEqual(["campaign"]);
    expect(result.dimensions.map((dimension) => dimension.id)).toEqual(["gender"]);
  });
});

describe("값마다 컬럼이 나뉜 형태", () => {
  it("long 축이 없을 때만 wide 묶음을 축으로 잡는다", () => {
    const result = autoDeclare({ headers: headersOf(WIDE_GENDER_ROWS), rows: WIDE_GENDER_ROWS });
    expect(result.dimensions).toHaveLength(1);
    expect(result.dimensions[0].sourceShape).toBe("wide_count");
    expect(result.dimensions[0].members.map((member) => member.sourceColumn)).toEqual(["여성가입", "남성가입"]);
    // 전체가입은 멤버가 아니라 분모다 — 멤버에 넣으면 비중이 절반으로 눌린다.
    expect(result.dimensions[0].denominatorColumn).toBe("전체가입");
  });
});

describe("확신이 없는 컬럼은 자동 채택하지 않는다", () => {
  const rows = [
    { date: "2026-07-01", campaign: "A", plan: "Basic", is_paid: "1", interests: "여행,게임", signups: "120" },
    { date: "2026-07-01", campaign: "A", plan: "Pro", is_paid: "0", interests: "게임", signups: "80" },
    { date: "2026-08-01", campaign: "A", plan: "Basic", is_paid: "1", interests: "여행;음악", signups: "200" },
    { date: "2026-08-01", campaign: "A", plan: "Pro", is_paid: "0", interests: "음악", signups: "60" },
  ];
  const result = autoDeclare({ headers: Object.keys(rows[0]), rows });

  it("깨끗한 구분 컬럼만 축으로 올린다", () => {
    expect(result.dimensions.map((dimension) => dimension.id)).toEqual(["plan"]);
  });

  it("0/1 플래그와 다중값 태그는 확인 목록으로 남긴다", () => {
    const headers = result.review.map((item) => item.header);
    expect(headers).toContain("is_paid");
    expect(headers).toContain("interests");
  });
});

describe("자동으로 열 수 없을 때", () => {
  it("날짜가 없으면 ok=false와 무엇이 없는지 돌려준다", () => {
    const rows = [{ campaign: "A", gender: "F", signups: "10" }, { campaign: "A", gender: "M", signups: "20" }];
    const result = autoDeclare({ headers: Object.keys(rows[0]), rows });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("time");
  });

  it("인원수 컬럼이 없으면 축을 만들지 않는다", () => {
    const rows = [{ date: "2026-07-01", gender: "F" }, { date: "2026-08-01", gender: "M" }];
    const result = autoDeclare({ headers: Object.keys(rows[0]), rows });
    expect(result.dimensions).toEqual([]);
    expect(result.ok).toBe(false);
  });
});

describe("기본 비교 기간", () => {
  it("최근 기간과 직전 기간을 고른다", () => {
    const demo = buildDemoCsv("segment_composition");
    const periods = [...new Set(demo.raw.map((row) => row.date))].sort();
    expect(defaultPeriods(demo.raw, "date")).toEqual({ pre: periods[periods.length - 2], post: periods[periods.length - 1] });
  });

  it("기간이 하나뿐이면 비교하지 않는다", () => {
    expect(defaultPeriods([{ date: "2026-07-01" }], "date")).toEqual({ pre: "", post: "" });
  });

  it("비제로패딩 날짜도 패널과 같은 ISO 키로 정규화한다", () => {
    const rows = [{ date: "2026-7-1" }, { date: "2026-8-1" }];
    expect(periodKeys(rows, "date")).toEqual(["2026-07-01", "2026-08-01"]);
    expect(defaultPeriods(rows, "date")).toEqual({ pre: "2026-07-01", post: "2026-08-01" });
  });
});

describe("결정론", () => {
  it("같은 입력을 두 번 선언하면 완전히 같다", () => {
    const demo = buildDemoCsv("segment_composition");
    const first = autoDeclare({ headers: demo.headers, rows: demo.raw });
    const second = autoDeclare({ headers: demo.headers, rows: demo.raw });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
