import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { OTHER_LABEL, VARIANCE_CONFIG, buildVariance } from "./varianceBridge";
import { buildSnapshot } from "./snapshot";
import { PVM_MATH } from "@/utils/pvmMath";

const CUR = { start: "2026-08-31", end: "2026-09-06", days: 7 };
const PREV = { start: "2026-08-24", end: "2026-08-30", days: 7 };

function snap(period, rows) {
  return buildSnapshot({ period, rows: rows.map((r) => ({ date: period.start, ...r })) });
}

const PREVIOUS = [
  { channel: "Google", campaign: "UAC A", cost: 30_000, actions: 3_600 },
  { channel: "Meta", campaign: "AAP", cost: 36_000, actions: 5_000 },
  { channel: "ASA", campaign: "Brand", cost: 5_000, actions: 700 },
];
/** UAC A만 효율이 크게 나빠진다 */
const CURRENT = [
  { channel: "Google", campaign: "UAC A", cost: 38_000, actions: 3_700 },
  { channel: "Meta", campaign: "AAP", cost: 37_000, actions: 5_100 },
  { channel: "ASA", campaign: "Brand", cost: 5_000, actions: 730 },
];

function run(current = CURRENT, previous = PREVIOUS, options = {}) {
  return buildVariance({ current: snap(CUR, current), previous: snap(PREV, previous), ...options });
}

describe("엔진 계약을 지켜서 번역한다", () => {
  it("정지 캠페인의 계산용 0을 CPA 개선으로 표시하지 않는다", () => {
    const previous = [{ campaign: "Paused", cost: 1000, actions: 100 }, { campaign: "Active", cost: 1000, actions: 100 }];
    const current = [{ campaign: "Paused", cost: 0, actions: 0 }, { campaign: "Active", cost: 1000, actions: 100 }];
    const result = run(current, previous);
    expect(result.ok).toBe(true);
    expect(result.drivers.find(row => row.label === "Paused")).toMatchObject({ cpa1: 10, cpa2: null, cpaChangePct: null });
    const realZero = run(current.map(row => row.campaign === "Paused" ? { ...row, actions: 100 } : row), previous);
    expect(realZero.drivers.find(row => row.label === "Paused")).toMatchObject({ cpa1: 10, cpa2: 0, cpaChangePct: -1 });
  });
  it("분해가 성립하고 Σ기여 = ΔCPA다", () => {
    const result = run();
    expect(result.ok).toBe(true);
    expect(result.identity.sumContribution).toBeCloseTo(result.identity.deltaCpa, 10);
    expect(result.deltaCpa).toBeCloseTo(result.cpa2 - result.cpa1, 12);
  });

  it("효율 + 믹스 = ΔCPA", () => {
    const result = run();
    expect(result.split.efficiency + result.split.mix).toBeCloseTo(result.deltaCpa, 10);
  });

  it("비용을 spend로 갈아끼운다 — 이름만 비슷해서 그냥 넘기면 비용이 0이 된다", () => {
    // 엔진은 r.spend를 읽는다. 번역이 빠지면 CPA가 전부 0이 되어 ΔCPA도 0이 된다.
    const result = run();
    expect(result.cpa1).toBeGreaterThan(0);
    expect(result.cpa2).toBeGreaterThan(0);
    expect(Math.abs(result.deltaCpa)).toBeGreaterThan(0);

    // 소스에서도 번역이 실제로 일어나는지 본다(주석은 먼저 제거).
    const source = readFileSync(new URL("./varianceBridge.js", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(source).toMatch(/spend:\s*toFiniteNumber\(row\.cost\)/);
  });

  it("엔진 결과와 직접 호출한 값이 같다 — 브리지가 수학을 바꾸지 않는다", () => {
    const keys = { ch: "channel", cmp: "campaign", cr: null, resultField: "actions" };
    const toRows = (rows) => rows.map((r) => ({ channel: r.channel, campaign: r.campaign, spend: r.cost, actions: r.actions }));
    const direct = PVM_MATH.decomposeFinest(toRows(PREVIOUS), toRows(CURRENT), keys);
    const bridged = run();
    expect(bridged.deltaCpa).toBeCloseTo(direct.deltaCpa, 12);
    expect(bridged.cpa1).toBeCloseTo(direct.CPA1, 12);
  });
});

describe("소액 셀 하나가 분해 전체를 막지 않게 한다", () => {
  const TINY = { channel: "Google", campaign: "UAC B", cost: 800, actions: 0 };

  it("지출만 있고 전환이 0인 소액 캠페인이 있어도 분해된다", () => {
    // 가드가 없으면 PVM이 NOT_IDENTIFIED로 통째로 거부한다(실측 확인).
    const keys = { ch: "channel", cmp: "campaign", cr: null, resultField: "actions" };
    const raw = (rows) => rows.map((r) => ({ channel: r.channel, campaign: r.campaign, spend: r.cost, actions: r.actions }));
    expect(PVM_MATH.decomposeFinest(raw([...PREVIOUS, TINY]), raw([...CURRENT, TINY]), keys)).toBeNull();

    const result = run([...CURRENT, TINY], [...PREVIOUS, TINY]);
    expect(result.ok).toBe(true);
    expect(result.mergedCells).toContain("Google / UAC B");
  });

  it("합쳐도 Σ 항등식은 그대로다", () => {
    const result = run([...CURRENT, TINY], [...PREVIOUS, TINY]);
    expect(result.identity.sumContribution).toBeCloseTo(result.identity.deltaCpa, 10);
    expect(result.split.efficiency + result.split.mix).toBeCloseTo(result.deltaCpa, 10);
  });

  it("문턱은 config로 갈아끼울 수 있다", () => {
    // 문턱은 두 기간 합계 기준이다 — 주당 10건이면 합 20으로 기본 문턱(30) 아래.
    const rows = [{ channel: "Google", campaign: "작은 캠페인", cost: 100, actions: 10 }];
    expect(run([...CURRENT, ...rows], [...PREVIOUS, ...rows]).mergedCells).toContain("Google / 작은 캠페인");
    expect(
      run([...CURRENT, ...rows], [...PREVIOUS, ...rows], { config: { ...VARIANCE_CONFIG, noiseThreshold: 5 } }).mergedCells,
    ).not.toContain("Google / 작은 캠페인");
  });

  it("소액이 여럿이면 한 묶음으로 모인다", () => {
    const smalls = [
      { channel: "Google", campaign: "S1", cost: 300, actions: 2 },
      { channel: "Meta", campaign: "S2", cost: 400, actions: 3 },
    ];
    const result = run([...CURRENT, ...smalls], [...PREVIOUS, ...smalls]);
    const labels = result.drivers.map((d) => d.label);
    expect(result.mergedCells).toHaveLength(2);
    // 묶음은 하나의 셀로 들어간다 — 개별 이름으로는 나타나지 않는다.
    expect(labels).not.toContain("Google / S1");
    expect(labels.filter((label) => label.includes(OTHER_LABEL)).length).toBeLessThanOrEqual(1);
  });
});

describe("분해에서 뺀 것은 반드시 고지한다", () => {
  const TINY = { channel: "Google", campaign: "UAC B", cost: 800, actions: 0 };

  it("전환 0 셀을 뺐으면 어떤 셀을 얼마나 뺐는지 말한다", () => {
    const result = run([...CURRENT, TINY], [...PREVIOUS, TINY]);
    expect(result.ok).toBe(true);
    expect(result.coversAllSpend).toBe(false);
    expect(result.excluded.reason).toBe("zero_result_with_spend");
    expect(result.excluded.cost1).toBe(800);
    expect(result.excluded.cost2).toBe(800);
    expect(result.excluded.cells.length).toBeGreaterThan(0);
  });

  it("뺀 것이 없으면 전체를 덮는다고 말한다", () => {
    const result = run();
    expect(result.coversAllSpend).toBe(true);
    expect(result.excluded.cells).toEqual([]);
    expect(result.excluded.reason).toBeNull();
  });

  it("분해 범위 CPA와 전체 CPA를 함께 준다 — 차이를 화면이 말할 수 있게", () => {
    const result = run([...CURRENT, TINY], [...PREVIOUS, TINY]);
    // 전체 CPA에는 전환 0 캠페인의 지출이 들어 있어 분해 범위보다 높다.
    expect(result.overall.cpa2).toBeGreaterThan(result.cpa2);
    expect(result.overall.deltaCpa).not.toBeCloseTo(result.deltaCpa, 6);
    // 그래도 분해 자체의 항등식은 자기 범위 안에서 정확하다.
    expect(result.identity.sumContribution).toBeCloseTo(result.identity.deltaCpa, 10);
  });

  it("제외를 끄면 분해를 거부한다 — 조용히 빼지 않는 선택지가 있다", () => {
    const result = run([...CURRENT, TINY], [...PREVIOUS, TINY], {
      config: { ...VARIANCE_CONFIG, excludeZeroResultCells: false },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_identified");
    expect(result.blockedCells.map((cell) => cell.label)).toContain("기타(소액)");
  });

  it("모든 셀이 제외되면 분해하지 않는다", () => {
    const allZero = [{ campaign: "A", cost: 100, actions: 0 }, { campaign: "B", cost: 200, actions: 0 }];
    const result = run(allZero, allZero);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("all_cells_excluded");
  });
});

describe("풀 수 없으면 사유와 막은 셀을 그대로 준다", () => {
  it("한 주만 전환 0인 캠페인도 제외되고, 큰 금액이면 고지가 커진다", () => {
    // 지난주엔 전환이 있었는데 이번 주 0 — 캠페인 정지·소재 소진으로 흔하다.
    // 엔진의 계약 검증이 기간별이라 이 셀도 분해를 막는다.
    const big = { channel: "Google", campaign: "UAC C", cost: 20_000, actions: 0 };
    const result = run([...CURRENT, big], [...PREVIOUS, { ...big, actions: 500 }]);
    expect(result.ok).toBe(true);
    expect(result.excluded.cells).toContain("Google / UAC C");
    expect(result.excluded.cost2).toBe(20_000); // 화면이 이 금액을 반드시 보여야 한다
    expect(result.coversAllSpend).toBe(false);
    expect(result.identity.sumContribution).toBeCloseTo(result.identity.deltaCpa, 10);
  });

  it("비용이나 결과 컬럼이 없으면 data_missing", () => {
    const noCost = buildVariance({
      current: snap(CUR, [{ campaign: "A", actions: 100 }]),
      previous: snap(PREV, [{ campaign: "A", actions: 90 }]),
    });
    expect(noCost.reason).toBe("data_missing");
    expect(noCost.missing).toEqual(["cost"]);
  });

  it("스냅샷이 없으면 지어내지 않는다", () => {
    expect(buildVariance({}).reason).toBe("no_current_snapshot");
    expect(buildVariance({ current: snap(CUR, CURRENT) }).reason).toBe("no_previous_snapshot");
  });
});

describe("비율은 믿을 수 있을 때만 내준다", () => {
  it("보통은 효율·믹스 지분이 1로 합쳐진다", () => {
    const result = run();
    expect(result.split.shares.efficiency + result.split.shares.mix).toBeCloseTo(1, 10);
  });

  it("효율과 믹스가 상쇄돼 ΔCPA가 0에 가까우면 지분을 주지 않는다", () => {
    // 비싼 캠페인으로 비중이 크게 옮겨가면서(믹스 +) 각자의 효율은 좋아진 경우(효율 −)
    const previous = [
      { campaign: "싼 캠페인", cost: 10_000, actions: 2_500 },
      { campaign: "비싼 캠페인", cost: 30_000, actions: 3_000 },
    ];
    const current = [
      { campaign: "싼 캠페인", cost: 4_000, actions: 1_100 },
      { campaign: "비싼 캠페인", cost: 38_000, actions: 4_400 },
    ];
    const result = run(current, previous);
    expect(result.ok).toBe(true);
    const spread = Math.abs(result.split.efficiency) + Math.abs(result.split.mix);
    expect(Math.abs(result.deltaCpa)).toBeLessThan(VARIANCE_CONFIG.shareStability * spread);
    expect(result.split.shares).toBeNull();
    expect(result.split.sharesReason).toBe("offsetting");
    // 금액은 그대로 준다 — 화면이 비율 없이도 말할 수 있어야 한다.
    expect(Number.isFinite(result.split.efficiency)).toBe(true);
    expect(result.drivers.every((driver) => driver.share === null)).toBe(true);
  });
});

describe("드라이버", () => {
  it("기여 절댓값 순이고 상위 N개 + 나머지 한 줄이다", () => {
    const extra = [
      { channel: "TikTok", campaign: "T1", cost: 3_000, actions: 400 },
      { channel: "Naver", campaign: "N1", cost: 2_000, actions: 300 },
    ];
    const result = run([...CURRENT, ...extra], [...PREVIOUS, ...extra]);
    expect(result.drivers).toHaveLength(VARIANCE_CONFIG.topN + 1);
    const magnitudes = result.drivers.slice(0, VARIANCE_CONFIG.topN).map((d) => Math.abs(d.contribution));
    expect([...magnitudes].sort((a, b) => b - a)).toEqual(magnitudes);
    expect(result.drivers.at(-1).isRemainder).toBe(true);
    expect(result.drivers.at(-1).label).toBe("나머지 2개");
  });

  it("나머지가 없으면 그 줄을 만들지 않는다", () => {
    const result = run();
    expect(result.drivers).toHaveLength(3);
    expect(result.drivers.some((driver) => driver.isRemainder)).toBe(false);
  });

  it("드라이버 기여의 합은 ΔCPA와 같다 — 나머지 줄까지 포함해서", () => {
    const extra = [{ channel: "TikTok", campaign: "T1", cost: 3_000, actions: 400 }];
    const result = run([...CURRENT, ...extra], [...PREVIOUS, ...extra]);
    const total = result.drivers.reduce((sum, driver) => sum + driver.contribution, 0);
    expect(total).toBeCloseTo(result.deltaCpa, 10);
  });

  it("효율이 나빠진 캠페인이 맨 위로 온다", () => {
    const result = run();
    expect(result.drivers[0].label).toBe("Google / UAC A");
    expect(result.drivers[0].cpaChangePct).toBeGreaterThan(0);
    expect(result.split.lead).toBe("efficiency");
  });

  it("비중은 결과 비중이지 비용 비중이 아니다", () => {
    // s1/s2는 전환 건수의 비중이다. 비용 비중으로 읽으면 결론이 뒤집힌다.
    const result = run();
    const meta = result.drivers.find((driver) => driver.label === "Meta / AAP");
    const totalActions1 = PREVIOUS.reduce((sum, row) => sum + row.actions, 0);
    expect(meta.s1).toBeCloseTo(5_000 / totalActions1, 10);
  });

  it("나머지 줄에는 CPA를 지어내지 않는다", () => {
    const extra = [{ channel: "TikTok", campaign: "T1", cost: 3_000, actions: 400 }];
    const remainder = run([...CURRENT, ...extra], [...PREVIOUS, ...extra]).drivers.at(-1);
    expect(remainder.cpa1).toBeNull();
    expect(remainder.cpaChangePct).toBeNull();
  });
});

describe("결정론", () => {
  it("같은 입력이면 같은 출력", () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("행 순서가 달라도 같은 결과", () => {
    const forward = run();
    const reversed = run([...CURRENT].reverse(), [...PREVIOUS].reverse());
    expect(reversed.drivers.map((d) => d.label)).toEqual(forward.drivers.map((d) => d.label));
    expect(reversed.deltaCpa).toBeCloseTo(forward.deltaCpa, 12);
  });
});
