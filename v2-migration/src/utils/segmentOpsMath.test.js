import { describe, it, expect } from "vitest";
import { buildSegmentPanel } from "@/lib/segment-composition/segmentPanel";
import { buildDemoCsv } from "@/utils/demoData";
import {
  spendShiftFingerprint, costVolumeQuadrants, scanPeriodShifts, repeatabilityByMagnitude,
  COST_VOLUME_QUADRANT, OPS_REASON, OPS_THRESHOLDS,
} from "@/utils/segmentOpsMath";

const GENDER = {
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

const ROLES = { time: "date", entity: ["campaign"], scope: [], measures: { spend: "cost" } };
const panelOf = (rows) => buildSegmentPanel({ rows, roles: ROLES, dimensions: [GENDER] });
const cell = (date, campaign, total, female, cost) => ({
  date, campaign, total: String(total), female: String(female), male: String(total - female), cost: String(cost),
});

const PRE = ["2026-07-01"];
const POST = ["2026-08-01"];
const base = { dimensionId: "gender", memberId: "female", pre: PRE, post: POST };

describe("비용 이동 지문", () => {
  it("비용 비중과 구성 비중이 같은 방향으로 갔는지 말한다", () => {
    const panel = panelOf([
      cell("2026-07-01", "A", 1000, 100, 1000000), cell("2026-07-01", "B", 1000, 500, 1000000),
      cell("2026-08-01", "A", 500, 50, 500000), cell("2026-08-01", "B", 1500, 750, 1500000),
    ]);
    const result = spendShiftFingerprint({ panel, ...base });
    expect(result.available).toBe(true);
    const b = result.entities.find((entity) => entity.entityKey === "B");
    expect(b.spendShareDelta).toBeGreaterThan(0);
    expect(b.memberShareDelta).toBeGreaterThan(0);
    expect(b.sameDirection).toBe(true);
    // 로그비: ln(750/500) / ln(1.5M/1M) = 1
    expect(b.elasticity).toBeCloseTo(1, 12);
  });

  it("비용은 늘었는데 구성은 반대로 간 단위를 표시한다", () => {
    const panel = panelOf([
      cell("2026-07-01", "A", 1000, 500, 1000000), cell("2026-07-01", "B", 1000, 100, 1000000),
      cell("2026-08-01", "A", 1000, 300, 2000000), cell("2026-08-01", "B", 1000, 400, 1000000),
    ]);
    const result = spendShiftFingerprint({ panel, ...base });
    const a = result.entities.find((entity) => entity.entityKey === "A");
    expect(a.spendShareDelta).toBeGreaterThan(0);
    expect(a.memberShareDelta).toBeLessThan(0);
    expect(a.sameDirection).toBe(false);
    expect(result.reasons).toContain(OPS_REASON.DIRECTION_MIXED);
  });

  it("비용 컬럼이 없으면 숫자를 만들지 않는다", () => {
    const panel = buildSegmentPanel({
      rows: [
        cell("2026-07-01", "A", 1000, 100, 0), cell("2026-08-01", "A", 1000, 300, 0),
      ],
      roles: { ...ROLES, measures: {} },
      dimensions: [GENDER],
    });
    const result = spendShiftFingerprint({ panel, ...base });
    expect(result.available).toBe(false);
    expect(result.reasons).toContain(OPS_REASON.NO_SPEND);
  });

  it("비용이 멤버 행마다 반복돼도 단위 비용이 부풀지 않는다", () => {
    // long shape: 한 셀이 두 멤버 행으로 들어온다. 합산하면 2배가 된다.
    const longRows = [
      { date: "2026-07-01", campaign: "A", gender: "F", signups: "100", cost: "1000000" },
      { date: "2026-07-01", campaign: "A", gender: "M", signups: "900", cost: "1000000" },
      { date: "2026-08-01", campaign: "A", gender: "F", signups: "300", cost: "2000000" },
      { date: "2026-08-01", campaign: "A", gender: "M", signups: "700", cost: "2000000" },
    ];
    const panel = buildSegmentPanel({
      rows: longRows,
      roles: ROLES,
      dimensions: [{ id: "gender", label: "성별", sourceShape: "long_count", isExclusive: true, isExhaustive: true, categoryColumn: "gender", countColumn: "signups", members: [{ id: "F", label: "F", matchValues: ["F"] }, { id: "M", label: "M", matchValues: ["M"] }] }],
    });
    const result = spendShiftFingerprint({ panel, dimensionId: "gender", memberId: "F", pre: PRE, post: POST });
    const a = result.entities.find((entity) => entity.entityKey === "A");
    expect(a.spendPre).toBe(1000000);
    expect(a.spendPost).toBe(2000000);
  });
});

describe("CPA × 볼륨 2×2", () => {
  it("네 사분면을 실제 값으로 분류한다", () => {
    const panel = panelOf([
      // A: 볼륨↑ 단가↓ / B: 볼륨↑ 단가↑ / C: 볼륨↓ 단가↓ / D: 볼륨↓ 단가↑
      cell("2026-07-01", "A", 1000, 100, 1000000), cell("2026-08-01", "A", 1000, 200, 1500000),
      cell("2026-07-01", "B", 1000, 100, 1000000), cell("2026-08-01", "B", 1000, 120, 1500000),
      cell("2026-07-01", "C", 1000, 200, 2000000), cell("2026-08-01", "C", 1000, 100, 500000),
      cell("2026-07-01", "D", 1000, 200, 1000000), cell("2026-08-01", "D", 1000, 100, 900000),
    ]);
    const { rows } = costVolumeQuadrants({ panel, ...base });
    const quadrantOf = (key) => rows.find((row) => row.entityKey === key).quadrant;
    expect(quadrantOf("A")).toBe(COST_VOLUME_QUADRANT.SCALE_EFFICIENT);
    expect(quadrantOf("B")).toBe(COST_VOLUME_QUADRANT.SCALE_COSTLY);
    expect(quadrantOf("C")).toBe(COST_VOLUME_QUADRANT.SHRINK_EFFICIENT);
    expect(quadrantOf("D")).toBe(COST_VOLUME_QUADRANT.SHRINK_COSTLY);
  });

  it("한쪽 기간에만 있는 단위는 단가를 비교하지 않는다", () => {
    const panel = panelOf([
      cell("2026-07-01", "A", 1000, 100, 1000000),
      cell("2026-08-01", "A", 1000, 200, 900000), cell("2026-08-01", "NEW", 1000, 500, 800000),
    ]);
    const { rows } = costVolumeQuadrants({ panel, ...base });
    expect(rows.map((row) => row.entityKey)).toEqual(["A"]);
  });

  it("모수가 작으면 분류는 하되 사유를 남긴다", () => {
    const panel = panelOf([
      cell("2026-07-01", "A", 20, 5, 100000), cell("2026-08-01", "A", 25, 10, 120000),
    ]);
    const result = costVolumeQuadrants({ panel, ...base });
    expect(result.available).toBe(true);
    expect(result.reasons).toContain(OPS_REASON.LOW_ENTITY_POPULATION);
  });
});

describe("기간 스캔과 반복성", () => {
  const rows = [];
  const shares = [0.10, 0.11, 0.10, 0.30, 0.31, 0.30];
  shares.forEach((share, index) => {
    const date = `2026-0${index + 1}-01`;
    rows.push(cell(date, "A", 1000, Math.round(1000 * share), 1000000));
  });
  const panel = panelOf(rows);

  it("기간 쌍별 변화를 계산하고 큰 변동을 표시한다", () => {
    const scan = scanPeriodShifts({ panel, dimensionId: "gender", memberId: "female" });
    expect(scan.available).toBe(true);
    expect(scan.steps).toHaveLength(5);
    const big = scan.ranked[0];
    expect(big.from).toBe("2026-03-01");
    expect(big.to).toBe("2026-04-01");
    expect(big.delta).toBeCloseTo(0.2, 10);
    expect(big.isLarge).toBe(true);
  });

  it("여러 기간을 훑는다는 사실을 결과에 남긴다", () => {
    const scan = scanPeriodShifts({ panel, dimensionId: "gender", memberId: "female" });
    expect(scan.reasons).toContain(OPS_REASON.MULTIPLE_COMPARISONS);
    expect(scan.comparisons).toBe(5);
  });

  it("한 번뿐인 큰 변동을 반복으로 읽지 않는다", () => {
    const scan = scanPeriodShifts({ panel, dimensionId: "gender", memberId: "female" });
    const repeat = repeatabilityByMagnitude(scan);
    const large = repeat.strata.find((stratum) => stratum.label === "large");
    expect(large.count).toBe(1);
    expect(large.isRepeated).toBe(false);
  });

  it("같은 방향으로 반복되면 반복으로 표시한다", () => {
    const rising = [0.10, 0.20, 0.30, 0.40].map((share, index) => cell(`2026-0${index + 1}-01`, "A", 1000, Math.round(1000 * share), 1000000));
    const scan = scanPeriodShifts({ panel: panelOf(rising), dimensionId: "gender", memberId: "female" });
    const large = repeatabilityByMagnitude(scan).strata.find((stratum) => stratum.label === "large");
    expect(large.count).toBe(3);
    expect(large.isRepeated).toBe(true);
    expect(large.dominantDirection).toBe("up");
  });

  it("기간이 하나면 스캔하지 않는다", () => {
    const single = panelOf([cell("2026-07-01", "A", 1000, 100, 1000000)]);
    const scan = scanPeriodShifts({ panel: single, dimensionId: "gender", memberId: "female" });
    expect(scan.available).toBe(false);
    expect(scan.reasons).toContain(OPS_REASON.NOT_ENOUGH_PERIODS);
    expect(repeatabilityByMagnitude(scan).available).toBe(false);
  });

  it("임계는 설정 상수로 분리돼 있다", () => {
    expect(OPS_THRESHOLDS.largeShift).toBe(0.05);
    expect(OPS_THRESHOLDS.minPeriodPairs).toBe(3);
  });
});

describe("데모 데이터에서 실제로 신호가 나온다", () => {
  const demo = buildDemoCsv("segment_composition");
  const panel = buildSegmentPanel({
    rows: demo.raw,
    roles: { time: "date", entity: ["campaign"], scope: ["platform"], measures: { spend: "cost" } },
    dimensions: [{
      id: "gender", label: "성별", sourceShape: "long_count", isExclusive: true, isExhaustive: true,
      categoryColumn: "gender", countColumn: "signups",
      members: [{ id: "female", label: "Female", matchValues: ["Female"] }, { id: "male", label: "Male", matchValues: ["Male"] }],
    }],
  });
  const periods = [...new Set(demo.raw.map((row) => row.date))].sort();

  it("BRAND로 비용이 옮겨 가고 구성도 같은 방향으로 간다", () => {
    const result = spendShiftFingerprint({
      panel, dimensionId: "gender", memberId: "female",
      pre: [periods[0]], post: [periods[periods.length - 1]], scopeFilter: { platform: "Android" },
    });
    expect(result.available).toBe(true);
    const brand = result.entities.find((entity) => entity.entityKey === "BRAND");
    expect(brand.spendShareDelta).toBeGreaterThan(0);
    expect(brand.sameDirection).toBe(true);
  });

  it("구성 이동이 한 주에 몰리지 않고 여러 기간에 걸쳐 반복된다", () => {
    const scan = scanPeriodShifts({ panel, dimensionId: "gender", memberId: "female", scopeFilter: { platform: "Android" } });
    const repeat = repeatabilityByMagnitude(scan);
    const small = repeat.strata.find((stratum) => stratum.label === "small");
    expect(small.dominantDirection).toBe("up");
    expect(scan.steps.length).toBeGreaterThanOrEqual(OPS_THRESHOLDS.minPeriodPairs);
  });
});
