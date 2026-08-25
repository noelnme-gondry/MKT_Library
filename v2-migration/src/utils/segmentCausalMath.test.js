import { describe, it, expect } from "vitest";
import { buildSegmentPanel } from "@/lib/segment-composition/segmentPanel";
import {
  buildUnitPanel, evaluateCausalEligibility, eventStudy, placeboTest,
  clusterRobustSe, mediationAvailability,
  CAUSAL_REASON, CAUSAL_STATUS, CAUSAL_THRESHOLDS,
} from "@/utils/segmentCausalMath";

const GENDER = {
  id: "gender", label: "성별", sourceShape: "wide_count", isExclusive: true, isExhaustive: true,
  denominatorColumn: "total",
  members: [{ id: "female", label: "F", sourceColumn: "female" }, { id: "male", label: "M", sourceColumn: "male" }],
};
const ROLES = { time: "date", entity: ["campaign"], scope: ["os"], measures: {} };
const panelOf = (rows) => buildSegmentPanel({ rows, roles: ROLES, dimensions: [GENDER] });

const PERIODS = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"];
const CUTOFF = "2026-04-01";
const CAMPAIGNS = ["A", "B", "C"];

/* 합성 패널: 처리군(Android)만 개입 후 여성 비중이 +10%p 뛴다.
 * 대조군(iOS)은 같은 시점의 공통 충격만 받는다 — 고정효과가 그 충격을 흡수해야
 * 처리 효과만 남는다. 결정론(난수 없음): 단위·기간 오프셋은 인덱스 함수다. */
function syntheticRows({ effect = 0.10, commonShock = 0.05, drift = 0 } = {}) {
  const rows = [];
  PERIODS.forEach((date, timeIndex) => {
    const isPost = timeIndex >= PERIODS.indexOf(CUTOFF);
    CAMPAIGNS.forEach((campaign, campaignIndex) => {
      ["Android", "iOS"].forEach((os, osIndex) => {
        const level = 0.30 + campaignIndex * 0.02 + osIndex * 0.03;
        const treated = os === "Android";
        const share = level
          + (isPost ? commonShock : 0)
          + (treated && isPost ? effect : 0)
          + (treated ? drift * timeIndex : 0);
        const total = 1000;
        rows.push({ date, campaign, os, total: String(total), female: String(Math.round(total * share)), male: String(total - Math.round(total * share)) });
      });
    });
  });
  return rows;
}

const args = {
  dimensionId: "gender", memberId: "female", scopeColumn: "os",
  treatedValues: ["Android"], controlValues: ["iOS"], cutoff: CUTOFF,
};

describe("단위 패널 구성", () => {
  it("선언한 범위 값만 처리·대조로 넣는다", () => {
    const rows = [...syntheticRows(), { date: "2026-01-01", campaign: "A", os: "Web", total: "1000", female: "500", male: "500" }];
    const unitRows = buildUnitPanel({ panel: panelOf(rows), ...args });
    // Web은 선언 밖이라 들어오지 않는다 — "나머지 전부가 대조군"이라고 가정하지 않는다.
    expect(unitRows.some((row) => row.scopeValue === "Web")).toBe(false);
    expect(new Set(unitRows.map((row) => row.unitKey)).size).toBe(6);
  });

  it("결과변수는 그 칸의 멤버 비율이다", () => {
    const unitRows = buildUnitPanel({ panel: panelOf(syntheticRows()), ...args });
    const first = unitRows.find((row) => row.unitKey === "A│Android" && row.period === "2026-01-01");
    expect(first.share).toBeCloseTo(0.30, 10);
    expect(first.treated).toBe(1);
  });
});

describe("자격 심사", () => {
  it("대조군이 없으면 계수를 만들지 않는다", () => {
    const panel = panelOf(syntheticRows());
    const gate = evaluateCausalEligibility({ panel, ...args, controlValues: [] });
    expect(gate.status).toBe(CAUSAL_STATUS.BLOCKED);
    expect(gate.reasons).toContain(CAUSAL_REASON.NO_CONTROL);
    const study = eventStudy({ panel, ...args, controlValues: [] });
    expect(study.available).toBe(false);
    expect(study.coefficients).toEqual([]);
  });

  it("개입 시점이 없거나 관측 범위 밖이면 막는다", () => {
    const panel = panelOf(syntheticRows());
    expect(evaluateCausalEligibility({ panel, ...args, cutoff: null }).reasons).toContain(CAUSAL_REASON.NO_CUTOFF);
    expect(evaluateCausalEligibility({ panel, ...args, cutoff: "2030-01-01" }).reasons).toContain(CAUSAL_REASON.CUTOFF_OUT_OF_RANGE);
  });

  it("개입 전 기간이 모자라면 막는다", () => {
    const panel = panelOf(syntheticRows());
    const gate = evaluateCausalEligibility({ panel, ...args, cutoff: "2026-02-01" });
    expect(gate.reasons).toContain(CAUSAL_REASON.NOT_ENOUGH_PRE);
    expect(gate.status).toBe(CAUSAL_STATUS.BLOCKED);
  });

  it("군집이 적으면 계산은 하되 사유를 남긴다", () => {
    const panel = panelOf(syntheticRows());
    const gate = evaluateCausalEligibility({ panel, ...args });
    expect(gate.clusters).toBe(6);
    expect(gate.reasons).toContain(CAUSAL_REASON.FEW_CLUSTERS);
    expect(gate.status).toBe(CAUSAL_STATUS.CAUTION);
  });

  it("심사 항목을 통과 여부와 함께 돌려준다 — 무엇이 없어서 못 하는지 보이게", () => {
    const gate = evaluateCausalEligibility({ panel: panelOf(syntheticRows()), ...args, controlValues: [] });
    const failed = gate.checks.filter((check) => !check.ok).map((check) => check.id);
    expect(failed).toContain("has_control");
    expect(gate.checks.find((check) => check.id === "enough_pre").ok).toBe(true);
  });
});

describe("이벤트 스터디", () => {
  const panel = panelOf(syntheticRows());
  const study = eventStudy({ panel, ...args });

  it("공통 시점 충격을 흡수하고 처리 효과만 남긴다", () => {
    expect(study.available).toBe(true);
    // 처리군에만 준 +10%p가 그대로 나와야 한다. 대조군도 같이 받은 +5%p는
    // 기간 고정효과가 흡수하므로 계수에 섞이면 안 된다.
    study.coefficients.filter((coefficient) => !coefficient.isPre).forEach((coefficient) => {
      expect(coefficient.estimate).toBeCloseTo(0.10, 6);
    });
    expect(study.averagePostEffect).toBeCloseTo(0.10, 6);
  });

  it("개입 전 계수는 0 근처에 머문다", () => {
    study.coefficients.filter((coefficient) => coefficient.isPre).forEach((coefficient) => {
      expect(Math.abs(coefficient.estimate)).toBeLessThan(1e-6);
    });
    expect(study.preTrend.violated).toBe(false);
  });

  it("사전 추세가 이미 벌어져 있으면 결과를 열지 않는다", () => {
    const drifting = eventStudy({ panel: panelOf(syntheticRows({ drift: 0.03 })), ...args });
    expect(drifting.preTrend.violated).toBe(true);
    expect(drifting.status).toBe(CAUSAL_STATUS.BLOCKED);
    expect(drifting.reasons).toContain(CAUSAL_REASON.PRE_TREND_VIOLATED);
  });

  it("효과가 없으면 '효과 없음'이 아니라 확인되지 않음으로 남는다", () => {
    const nullEffect = eventStudy({ panel: panelOf(syntheticRows({ effect: 0 })), ...args });
    expect(nullEffect.available).toBe(true);
    nullEffect.coefficients.filter((coefficient) => !coefficient.isPre).forEach((coefficient) => {
      expect(Math.abs(coefficient.estimate)).toBeLessThan(1e-6);
      // 구간이 0을 포함한다 = 확인되지 않음. 코드 어디에도 "효과 없음" 판정은 없다.
      expect(coefficient.ciLow).toBeLessThanOrEqual(0);
      expect(coefficient.ciHigh).toBeGreaterThanOrEqual(0);
    });
    expect(nullEffect).not.toHaveProperty("noEffect");
  });

  it("군집 견고 표준오차를 단위 기준으로 계산한다", () => {
    expect(study.clusters).toBe(6);
    expect(study.observations).toBe(36);
    study.coefficients.forEach((coefficient) => {
      expect(Number.isFinite(coefficient.se)).toBe(true);
      expect(coefficient.se).toBeGreaterThanOrEqual(0);
    });
  });

  it("군집이 2개 미만이면 견고 SE를 만들지 않는다", () => {
    const X = [[1, 0], [1, 1]];
    expect(clusterRobustSe({ X, resid: [0.1, -0.1], XtXi: [[1, 0], [0, 1]], clusterIds: ["a", "a"] })).toBeNull();
  });

  it("결정론 — 같은 입력을 두 번 돌리면 완전히 같다", () => {
    const again = eventStudy({ panel: panelOf(syntheticRows()), ...args });
    expect(JSON.stringify(again.coefficients)).toBe(JSON.stringify(study.coefficients));
  });
});

describe("위약 검정", () => {
  it("개입 전 구간이 짧으면 검정 자체를 열지 않는다", () => {
    const gate = evaluateCausalEligibility({ panel: panelOf(syntheticRows()), ...args });
    const placebo = placeboTest({ eligibility: gate });
    // PRE 3기간 < minPre(3) + minPost(2) → 가짜 시점을 넣을 자리가 없다.
    expect(placebo.available).toBe(false);
    expect(placebo.reasons).toContain(CAUSAL_REASON.NOT_ENOUGH_PRE);
  });

  it("개입 전 구간이 충분하면 가짜 시점에서 효과가 나오지 않아야 한다", () => {
    const longPeriods = ["2025-08-01", "2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01", ...PERIODS];
    const rows = [];
    longPeriods.forEach((date, timeIndex) => {
      const isPost = timeIndex >= longPeriods.indexOf(CUTOFF);
      CAMPAIGNS.forEach((campaign, campaignIndex) => {
        ["Android", "iOS"].forEach((os, osIndex) => {
          const treated = os === "Android";
          const share = 0.30 + campaignIndex * 0.02 + osIndex * 0.03 + (isPost ? 0.05 : 0) + (treated && isPost ? 0.10 : 0);
          rows.push({ date, campaign, os, total: "1000", female: String(Math.round(1000 * share)), male: String(1000 - Math.round(1000 * share)) });
        });
      });
    });
    const gate = evaluateCausalEligibility({ panel: panelOf(rows), ...args });
    const placebo = placeboTest({ eligibility: gate });
    expect(placebo.available).toBe(true);
    // PRE 8기간의 가운데(index 4)를 가짜 시점으로 잡는다.
    expect(placebo.fakeCutoff).toBe("2025-12-01");
    // 가짜 시점 뒤 계수가 실제로 추정됐고(공허한 통과가 아니고) 전부 무의미해야 한다.
    const fakePost = placebo.coefficients.filter((coefficient) => !coefficient.isPre);
    expect(fakePost.length).toBeGreaterThan(0);
    fakePost.forEach((coefficient) => expect(Math.abs(coefficient.estimate)).toBeLessThan(1e-6));
    expect(placebo.passed).toBe(true);
  });
});

describe("매개 경로", () => {
  it("식별할 수 없으므로 숫자를 만들지 않는다", () => {
    const result = mediationAvailability();
    expect(result.available).toBe(false);
    expect(result.reasons).toContain(CAUSAL_REASON.MEDIATION_NOT_IDENTIFIED);
  });
});

describe("임계 상수", () => {
  it("설정으로 분리돼 있다", () => {
    expect(CAUSAL_THRESHOLDS.minPrePeriods).toBe(3);
    expect(CAUSAL_THRESHOLDS.minClusters).toBe(6);
  });
});
