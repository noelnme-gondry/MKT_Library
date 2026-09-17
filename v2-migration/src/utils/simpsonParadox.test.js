// Simpson's paradox 가드 (2026-09-17)
// QA 요청서가 직접 지목한 자리: "mix shift 때문에 전체 성과가 변했는데 시스템이
// 개별 campaign 성과 악화라고 잘못 설명하지 않는가".
//
// 분해가 무잔차라는 것만으로는 이걸 보장하지 못한다 — 합이 맞아도 **구성 변화와
// 단위 내부 변화를 반대로 귀속**하면 화면은 엉뚱한 캠페인을 범인으로 지목한다(§8.12).
// 그래서 여기서는 합이 아니라 **각 항의 부호와 크기**를 단언한다.
import { describe, expect, it } from "vitest";
import { PVM_MATH } from "./pvmMath";
import { buildSegmentPanel } from "@/lib/segment-composition/segmentPanel";
import { decomposeMixRate } from "./segmentCompositionMath";

describe("5-21 PVM — 전 캠페인 CPA 개선 + 전체 CPA 악화", () => {
  // 싼 캠페인(A)에서 비싼 캠페인(B)으로 물량이 이동한다. 각 캠페인의 CPA는 둘 다
  // 좋아지는데 전체 CPA는 4배가 된다 — 원인은 전적으로 구성 이동이다.
  const before = [
    { ch: "A", spend: "900", res: "180" },  // CPA 5
    { ch: "B", spend: "100", res: "2" },    // CPA 50
  ];
  const after = [
    { ch: "A", spend: "200", res: "50" },   // CPA 4  (개선)
    { ch: "B", spend: "1800", res: "40" },  // CPA 45 (개선)
  ];
  const decomposed = PVM_MATH.decompose(
    PVM_MATH.aggregate(before, "ch", "res"),
    PVM_MATH.aggregate(after, "ch", "res"),
  );
  const byKey = Object.fromEntries(decomposed.entities.map((entity) => [entity.key, entity]));
  const sum = (field) => decomposed.entities.reduce((total, entity) => total + entity[field], 0);

  it("전제: 전체는 악화됐는데 개별은 전부 개선됐다", () => {
    // 이 전제가 깨지면 아래 단언들은 Simpson 상황을 보는 게 아니다.
    expect(decomposed.deltaCpa).toBeGreaterThan(0);
    decomposed.entities.forEach((entity) => {
      expect(entity.cpa2, `${entity.key} CPA`).toBeLessThan(entity.cpa1);
    });
  });

  it("악화를 구성(mix)에 귀속하고 단위 효율(rate)은 개선으로 둔다", () => {
    // 범인은 믹스다 — rate를 범인으로 지목하면 "전 캠페인이 개선됐는데 캠페인
    // 성과가 나빠졌다"는 모순된 화면이 된다.
    expect(sum("mix")).toBeGreaterThan(0);
    expect(sum("rate")).toBeLessThan(0);
    // 그리고 믹스가 압도적이어야 한다(부호만 맞고 크기가 비슷하면 원인 지목이 흔들린다).
    expect(Math.abs(sum("mix"))).toBeGreaterThan(Math.abs(sum("rate")) * 5);
  });

  it("두 경로를 모두 믹스 악화로 본다 — 비싼 쪽 증가와 싼 쪽 감소", () => {
    // mix = (cpāᵢ − C̄)·Δs 이므로 악화는 두 갈래다. 둘 다 양수여야 한다.
    expect(byKey.B.s2).toBeGreaterThan(byKey.B.s1);   // 비싼 쪽 비중 증가
    expect(byKey.B.mix).toBeGreaterThan(0);
    expect(byKey.A.s2).toBeLessThan(byKey.A.s1);      // 싼 쪽 비중 감소
    expect(byKey.A.mix).toBeGreaterThan(0);
  });

  it("무잔차 — 항의 합이 실제 변화와 같다", () => {
    expect(sum("mix") + sum("rate")).toBeCloseTo(decomposed.deltaCpa, 10);
    expect(sum("contribution")).toBeCloseTo(decomposed.deltaCpa, 10);
  });

  it("반대 방향도 대칭으로 성립한다 — 전 캠페인 악화 + 전체 개선", () => {
    const flipped = PVM_MATH.decompose(
      PVM_MATH.aggregate(after, "ch", "res"),
      PVM_MATH.aggregate(before, "ch", "res"),
    );
    const total = (field) => flipped.entities.reduce((acc, entity) => acc + entity[field], 0);
    expect(flipped.deltaCpa).toBeLessThan(0);
    flipped.entities.forEach((entity) => expect(entity.cpa2).toBeGreaterThan(entity.cpa1));
    expect(total("mix")).toBeLessThan(0);   // 구성이 개선을 만들었다
    expect(total("rate")).toBeGreaterThan(0); // 단위 효율은 나빠졌다
  });
});

describe("5-29 구성 변화 — 전 단위 비율 하락 + 전체 비율 상승", () => {
  const DIMENSION = {
    id: "gender", label: "성별", sourceShape: "wide_count",
    isExclusive: true, isExhaustive: true, denominatorColumn: "total",
    members: [
      { id: "female", label: "F", sourceColumn: "female" },
      { id: "male", label: "M", sourceColumn: "male" },
    ],
  };
  const cell = (date, campaign, total, female) => ({
    date, campaign, total: String(total), female: String(female), male: String(total - female),
  });
  const panel = buildSegmentPanel({
    rows: [
      // A는 여성 비율이 낮고(10%) B는 높다(60%). 사후에 각 캠페인의 여성 비율은
      // 떨어지는데(9%·55%) 물량이 B로 쏠려 전체 여성 비율은 올라간다.
      cell("2026-07-01", "A", 1000, 100), cell("2026-07-01", "B", 100, 60),
      cell("2026-08-01", "A", 100, 9), cell("2026-08-01", "B", 1000, 550),
    ],
    roles: { time: "date", entity: ["campaign"], scope: [], measures: {} },
    dimensions: [DIMENSION],
  });
  const decomposition = decomposeMixRate({
    panel, dimensionId: "gender", memberId: "female",
    pre: ["2026-07-01"], post: ["2026-08-01"],
  });

  it("전제: 전체 비율은 올랐는데 단위별 비율은 전부 내렸다", () => {
    expect(decomposition.available).toBe(true);
    expect(decomposition.totals.delta).toBeGreaterThan(0);
    decomposition.entities.forEach((entity) => {
      expect(entity.rPost, `${entity.entity} rate`).toBeLessThan(entity.rPre);
    });
  });

  it("상승을 구성(mix)에 귀속하고 단위 비율(rate)은 하락으로 둔다", () => {
    expect(decomposition.totals.mix).toBeGreaterThan(0);
    expect(decomposition.totals.rate).toBeLessThan(0);
  });

  it("무잔차 — mix + rate + interaction = 실제 변화", () => {
    const { mix, rate, interaction, delta } = decomposition.totals;
    expect(mix + rate + interaction).toBeCloseTo(delta, 12);
  });
});

describe("PVM 믹스 서술 — 네 사분면이 사실과 맞는다", () => {
  // mix 부호 하나로는 문장을 만들 수 없다. 악화도 개선도 각각 두 경로가 있고,
  // 경로를 안 가르면 "비중이 줄었는데 늘었다"·"최저가인데 비싼 편" 같은 거짓이 나간다.
  const plain = (entity) => PVM_MATH.classifyNarrative(entity, "X").replace(/<[^>]+>/g, "");
  // rate를 0으로 두어 믹스 문장만 나오게 한다(dualEffect·leadMix 분기 배제).
  const entity = ({ s1, s2, mix }) => ({ s1, s2, mix, rate: 0, cpa1: 10, cpa2: 10, contribution: mix });

  it.each([
    { name: "비싼 것의 비중 증가 → 악화", s1: 0.2, s2: 0.5, mix: 5, up: true, costly: true },
    { name: "싼 것의 비중 감소 → 악화", s1: 0.8, s2: 0.4, mix: 5, up: false, costly: false },
    { name: "싼 것의 비중 증가 → 개선", s1: 0.2, s2: 0.6, mix: -5, up: true, costly: false },
    { name: "비싼 것의 비중 감소 → 개선", s1: 0.7, s2: 0.3, mix: -5, up: false, costly: true },
  ])("$name", ({ s1, s2, mix, up, costly }) => {
    const text = plain(entity({ s1, s2, mix }));
    // 방향은 실제 비중 변화와 같아야 한다 — 반대말이 들어가면 실패.
    expect(text).toContain(up ? "늘었고" : "줄었고");
    expect(text).not.toContain(up ? "줄었고" : "늘었고");
    // 가격 위치도 마찬가지.
    expect(text).toContain(costly ? "비싼" : "저렴한");
    expect(text).not.toContain(costly ? "저렴한" : "비싼");
    // 효과 방향은 mix 부호를 따른다.
    expect(text).toContain(mix >= 0 ? "끌어올림" : "끌어내림");
  });

  it("비중이 그대로면 방향을 주장하지 않는다", () => {
    const text = plain(entity({ s1: 0.4, s2: 0.4, mix: 0 }));
    expect(text).toContain("그대로");
    expect(text).not.toContain("늘었고");
    expect(text).not.toContain("줄었고");
  });

  it("Simpson 픽스처의 실제 서술이 사실과 맞는다", () => {
    const decomposed = PVM_MATH.decompose(
      PVM_MATH.aggregate([{ ch: "A", spend: "900", res: "180" }, { ch: "B", spend: "100", res: "2" }], "ch", "res"),
      PVM_MATH.aggregate([{ ch: "A", spend: "200", res: "50" }, { ch: "B", spend: "1800", res: "40" }], "ch", "res"),
    );
    const cheapShrinking = decomposed.entities.find((item) => item.key === "A");
    const narrative = plain(cheapShrinking);
    // 비중이 줄어든 최저가 캠페인 — 예전엔 "늘었고 … 비싼 편"으로 나갔다.
    expect(narrative).toContain("줄었고");
    expect(narrative).toContain("저렴한");
  });
});
