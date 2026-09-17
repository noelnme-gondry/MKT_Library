// 형제 엔진 변형검사 (2026-09-17)
// 2026-09-16 감사에서 복제·스케일·순서 불변을 5-2에만 걸었다(`kpiInvariants.test.js`).
// 같은 불변식은 분해 엔진에도 성립해야 하는데 아무도 안 보고 있었다 — 한 엔진에서
// 찾은 구멍은 형제에도 있다(§7 "같은 패턴의 파일을 전부 grep해서 한 번에 고칠 것").
//
// 변형검사는 정답을 몰라도 **관계**를 검증한다: 입력을 알려진 방식으로 흔들었을 때
// 출력이 따라야 하는 규칙을 고정하므로, 골든 픽스처가 못 잡는 스케일·순서 의존을 잡는다.
import { describe, expect, it } from "vitest";
import { PVM_MATH } from "./pvmMath";
import { storeFunnel, aggregateBySource, decomposeStoreConversion } from "./asoStoreMath";
import { buildSegmentPanel } from "@/lib/segment-composition/segmentPanel";
import { decomposeMixRate } from "./segmentCompositionMath";

const BEFORE = [
  { ch: "A", cmp: "a1", spend: "900", res: "180" },
  { ch: "B", cmp: "b1", spend: "100", res: "20" },
  { ch: "A", cmp: "a2", spend: "300", res: "40" },
];
const AFTER = [
  { ch: "A", cmp: "a1", spend: "400", res: "100" },
  { ch: "B", cmp: "b1", spend: "900", res: "90" },
  { ch: "A", cmp: "a2", spend: "200", res: "20" },
];
const pvm = (before, after) => PVM_MATH.decompose(
  PVM_MATH.aggregate(before, "ch", "res"),
  PVM_MATH.aggregate(after, "ch", "res"),
);
const scaleField = (rows, field, factor) => rows.map((row) => ({ ...row, [field]: String(Number(row[field]) * factor) }));
const totals = (decomposed, field) => decomposed.entities.reduce((sum, entity) => sum + entity[field], 0);

describe("5-21 PVM 변형검사", () => {
  const base = pvm(BEFORE, AFTER);

  it("행 순서를 바꿔도 결과가 같다", () => {
    const shuffled = pvm([BEFORE[2], BEFORE[0], BEFORE[1]], [AFTER[1], AFTER[2], AFTER[0]]);
    expect(shuffled.deltaCpa).toBeCloseTo(base.deltaCpa, 12);
    expect(totals(shuffled, "mix")).toBeCloseTo(totals(base, "mix"), 12);
    expect(totals(shuffled, "rate")).toBeCloseTo(totals(base, "rate"), 12);
  });

  it("양 기간을 그대로 복제하면 CPA·분해가 불변이다", () => {
    const doubled = pvm([...BEFORE, ...BEFORE], [...AFTER, ...AFTER]);
    expect(doubled.CPA1).toBeCloseTo(base.CPA1, 12);
    expect(doubled.CPA2).toBeCloseTo(base.CPA2, 12);
    expect(totals(doubled, "mix")).toBeCloseTo(totals(base, "mix"), 12);
    expect(totals(doubled, "rate")).toBeCloseTo(totals(base, "rate"), 12);
  });

  it("양 기간 비용 ×10 → CPA·mix·rate 모두 ×10", () => {
    const scaled = pvm(scaleField(BEFORE, "spend", 10), scaleField(AFTER, "spend", 10));
    expect(scaled.CPA1).toBeCloseTo(base.CPA1 * 10, 10);
    expect(scaled.deltaCpa).toBeCloseTo(base.deltaCpa * 10, 10);
    expect(totals(scaled, "mix")).toBeCloseTo(totals(base, "mix") * 10, 10);
    expect(totals(scaled, "rate")).toBeCloseTo(totals(base, "rate") * 10, 10);
  });

  it("단위 이름을 바꿔도 전체 합계는 같다", () => {
    const renamed = (rows) => rows.map((row) => ({ ...row, ch: `${row.ch}-renamed` }));
    const result = pvm(renamed(BEFORE), renamed(AFTER));
    expect(result.deltaCpa).toBeCloseTo(base.deltaCpa, 12);
    expect(totals(result, "contribution")).toBeCloseTo(totals(base, "contribution"), 12);
  });

  it("어떤 변형에서도 무잔차가 유지된다", () => {
    for (const decomposed of [base, pvm([...BEFORE, ...BEFORE], [...AFTER, ...AFTER]), pvm(scaleField(BEFORE, "res", 3), scaleField(AFTER, "res", 3))]) {
      expect(totals(decomposed, "mix") + totals(decomposed, "rate")).toBeCloseTo(decomposed.deltaCpa, 10);
    }
  });
});

describe("5-27 ASO 스토어 변형검사", () => {
  const rows = [
    { source: "Search", impressions: "10000", views: "4000", installs: "1200" },
    { source: "Browse", impressions: "8000", views: "2000", installs: "300" },
  ];
  const base = storeFunnel(rows);

  it("행 순서 불변", () => {
    expect(storeFunnel([rows[1], rows[0]])).toEqual(base);
  });

  it("복제하면 절대량은 2배, 전환율은 불변", () => {
    const doubled = storeFunnel([...rows, ...rows]);
    expect(doubled.impressions).toBe(base.impressions * 2);
    expect(doubled.installs).toBe(base.installs * 2);
    for (const rate of ["tapThrough", "viewToInstall", "impressionToInstall"]) {
      expect(doubled[rate], rate).toBeCloseTo(base[rate], 12);
    }
  });

  it("전 지표 ×10이면 전환율은 불변", () => {
    const scaled = rows.map((row) => ({
      ...row,
      impressions: String(Number(row.impressions) * 10),
      views: String(Number(row.views) * 10),
      installs: String(Number(row.installs) * 10),
    }));
    const result = storeFunnel(scaled);
    for (const rate of ["tapThrough", "viewToInstall", "impressionToInstall"]) {
      expect(result[rate], rate).toBeCloseTo(base[rate], 12);
    }
  });

  it("소스 집계는 순서와 무관하고 합이 보존된다", () => {
    const forward = aggregateBySource(rows);
    const reverse = aggregateBySource([rows[1], rows[0]]);
    expect([...reverse.keys()].sort()).toEqual([...forward.keys()].sort());
    const sumOf = (map, field) => [...map.values()].reduce((sum, entry) => sum + entry[field], 0);
    expect(sumOf(reverse, "cost")).toBe(sumOf(forward, "cost"));
    expect(sumOf(reverse, "result")).toBe(sumOf(forward, "result"));
    expect(sumOf(forward, "result")).toBe(base.installs);
  });

  it("전환 분해도 행 순서에 의존하지 않는다", () => {
    const after = rows.map((row) => ({ ...row, installs: String(Number(row.installs) * 2) }));
    const forward = decomposeStoreConversion(rows, after);
    const reverse = decomposeStoreConversion([rows[1], rows[0]], [after[1], after[0]]);
    // 분해 불가(null)면 양쪽 다 null이어야 한다 — 한쪽만 되는 건 순서 의존이다.
    expect(Boolean(forward)).toBe(Boolean(reverse));
    expect(forward).not.toBeNull();
    // 계약은 "키별 값이 같다"이지 "배열 순서가 같다"가 아니다. 엔티티 배열 순서는
    // 입력 순서를 따르는 표시 순서라, 그걸 단언하면 정렬을 바꾸는 순간 테스트가
    // 먼저 반대한다(§7 — 값이 아니라 근거를 고정할 것).
    expect(reverse.deltaCpa).toBeCloseTo(forward.deltaCpa, 12);
    expect(reverse.conversionDelta).toBeCloseTo(forward.conversionDelta, 12);
    const byKey = (decomposed) => Object.fromEntries(decomposed.entities.map((entity) => [entity.key, entity]));
    const [forwardMap, reverseMap] = [byKey(forward), byKey(reverse)];
    expect(Object.keys(reverseMap).sort()).toEqual(Object.keys(forwardMap).sort());
    for (const key of Object.keys(forwardMap)) {
      expect(reverseMap[key], key).toEqual(forwardMap[key]);
    }
  });
});

describe("5-29 구성 변화 변형검사", () => {
  const DIMENSION = {
    id: "gender", label: "성별", sourceShape: "wide_count",
    isExclusive: true, isExhaustive: true, denominatorColumn: "total",
    members: [
      { id: "female", label: "F", sourceColumn: "female" },
      { id: "male", label: "M", sourceColumn: "male" },
    ],
  };
  const build = (rows) => buildSegmentPanel({
    rows, roles: { time: "date", entity: ["campaign"], scope: [], measures: {} }, dimensions: [DIMENSION],
  });
  const cell = (date, campaign, total, female) => ({
    date, campaign, total: String(total), female: String(female), male: String(total - female),
  });
  const rows = [
    cell("2026-07-01", "A", 1000, 300), cell("2026-07-01", "B", 500, 100),
    cell("2026-08-01", "A", 800, 200), cell("2026-08-01", "B", 900, 300),
  ];
  const run = (source) => decomposeMixRate({
    panel: build(source), dimensionId: "gender", memberId: "female",
    pre: ["2026-07-01"], post: ["2026-08-01"],
  });
  const base = run(rows);

  it("전제: 분해가 실제로 열렸다", () => {
    // 열리지 않았으면 아래 비교는 null끼리 맞춰 보는 공허한 검사가 된다.
    expect(base.available).toBe(true);
    expect(base.entities.length).toBeGreaterThan(1);
  });

  it("행 순서 불변", () => {
    const shuffled = run([rows[3], rows[1], rows[2], rows[0]]);
    expect(shuffled.totals).toEqual(base.totals);
  });

  it("모든 인원 ×10이면 비율 분해가 불변이다", () => {
    const scaled = rows.map((row) => ({
      ...row,
      total: String(Number(row.total) * 10),
      female: String(Number(row.female) * 10),
      male: String(Number(row.male) * 10),
    }));
    const result = run(scaled);
    for (const field of ["preRate", "postRate", "delta", "mix", "rate", "interaction"]) {
      expect(result.totals[field], field).toBeCloseTo(base.totals[field], 12);
    }
  });

  it("어떤 변형에서도 무잔차가 유지된다", () => {
    for (const decomposition of [base, run([rows[2], rows[0], rows[3], rows[1]])]) {
      const { mix, rate, interaction, delta } = decomposition.totals;
      expect(mix + rate + interaction).toBeCloseTo(delta, 12);
    }
  });
});
