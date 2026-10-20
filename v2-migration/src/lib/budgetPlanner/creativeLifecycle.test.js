import { describe, expect, it } from "vitest";
import { CREATIVE_CONFIG } from "@/utils/creativeConfig";
import { CREATIVE_FATIGUE } from "@/utils/creativeMath";
import { buildCreativeLifecycle } from "./creativeLifecycle";
import { configFor, resolvePlannerConfig } from "./plannerConfig";
import { dailyByNode, normalizePlannerRows } from "./plannerData";
import { addDays } from "./plannerStats";

const cfg = resolvePlannerConfig().config;
const levels = cfg.hierarchy.levels;
const START = "2026-06-01";
const AS_OF = addDays(START, 69);

/** 소재 하나의 일별 행. cost·cpr·impressions는 날짜 인덱스 t의 함수. */
function creative({ campaign, id, from, to = 69, cost, cpr, impressions = (t, c) => c * 1.0, ctr = () => 0.01 }) {
  const rows = [];
  for (let t = from; t <= to; t += 1) {
    const c = cost(t);
    if (!(c > 0)) continue;
    const imp = impressions(t, c);
    rows.push({
      date: addDays(START, t), country: "KR", platform: "iOS", channel: "Meta", campaign_name: campaign, creative_id: id,
      cost: c, installs: c / cpr(t), impressions: imp, clicks: imp * ctr(t),
    });
  }
  return rows;
}

function lifecycleOf(rawRows, patch = {}) {
  const config = resolvePlannerConfig(patch).config;
  const { rows } = normalizePlannerRows(rawRows, { metric: "installs" });
  const nodes = dailyByNode(rows, "campaign_name", levels);
  const out = buildCreativeLifecycle(rows, config, {
    levels, allocateLevel: "campaign_name", asOf: AS_OF, dataStart: START, nodes,
    configForPath: (path) => configFor(config, { country: path.country, channel: path.channel }),
  });
  return { out, find: (id) => out.entries.find((entry) => entry.creativeId === id), node: (campaign) => out.byNode.get(JSON.stringify(["KR", "iOS", "Meta", campaign])) };
}

describe("소재 식별과 상태", () => {
  it("데이터 첫날부터 쓰던 소재는 신규가 아니다(UNKNOWN_AGE)", () => {
    const { find } = lifecycleOf(creative({ campaign: "C", id: "old", from: 0, cost: () => 10000, cpr: () => 1000 }));
    expect(find("old")).toMatchObject({ state: "UNKNOWN_AGE", unknownAge: true, age: null });
  });

  it("relaunchGapDays 이상 쉬었다 다시 쓰면 재출시로 나이를 0부터 센다", () => {
    const rows = creative({ campaign: "C", id: "back", from: 0, cost: (t) => (t < 20 || t >= 60 ? 10000 : 0), cpr: () => 1000 });
    const { find } = lifecycleOf(rows);
    expect(find("back")).toMatchObject({ relaunched: true, launch: addDays(START, 60), age: 9, unknownAge: false });
  });

  it("지출을 거의 못 받은 신규 소재는 LOSER가 아니라 STALLED", () => {
    const rows = [
      ...creative({ campaign: "S", id: "inc", from: 0, cost: () => 100000, cpr: () => 1000 }),
      ...creative({ campaign: "S", id: "tiny", from: 60, cost: () => 1000, cpr: () => 3000 }),
    ];
    const { find } = lifecycleOf(rows);
    expect(find("tiny").state).toBe("STALLED");
    expect(find("tiny").judgment).toBeUndefined();
  });

  it("판정 전에 꺼진 소재는 ENDED_UNJUDGED이고 출시 프로파일 표본에서 빠진다", () => {
    const rows = [
      ...creative({ campaign: "E", id: "inc", from: 0, cost: () => 20000, cpr: () => 1000 }),
      ...creative({ campaign: "E", id: "short", from: 50, to: 53, cost: () => 10000, cpr: () => 2000 }),
    ];
    const { find } = lifecycleOf(rows);
    expect(find("short")).toMatchObject({ state: "ENDED_UNJUDGED", ended: true });
  });
});

describe("신규 소재 판정 — 같은 날 기존 소재와 비교, 사전 수축", () => {
  const incumbent = (campaign) => creative({ campaign, id: `${campaign}-inc`, from: 0, cost: () => 20000, cpr: () => 1000 });

  it("초반 전환 25건으로 CPR 800이 나와도 사전 수축 뒤엔 WINNER가 아니다", () => {
    const rows = [...incumbent("P"), ...creative({ campaign: "P", id: "lucky", from: 55, cost: () => 20000 / 15, cpr: () => 800 })];
    const entry = lifecycleOf(rows).find("lucky");
    expect(entry.sinceLaunch.result).toBeCloseTo(25, 6);
    expect(entry.sinceLaunch.cost / entry.sinceLaunch.result).toBeCloseTo(800, 6); // 원자료로는 기존 대비 −20%
    // CPR_post = (k·CPR_prior + 비용) / (k + 결과) = (10·1300 + 20000) / 35
    expect(entry.judgment.cprPost).toBeCloseTo((10 * 1300 + 20000) / 35, 6);
    expect(entry.judgment.priorAssumed).toBe(true);
    expect(entry.state).toBe("PAR");
  });

  it("결과가 충분히 쌓인 좋은 소재는 WINNER", () => {
    const rows = [...incumbent("W"), ...creative({ campaign: "W", id: "good", from: 55, cost: () => 200000 / 15, cpr: () => 1000 / 1.4 })];
    const entry = lifecycleOf(rows).find("good");
    expect(entry.state).toBe("WINNER");
    expect(entry.judgment.cprPost).toBeLessThan(900);
  });

  it("비교할 기존 소재가 없으면 NO_BASELINE", () => {
    const rows = creative({ campaign: "N", id: "alone", from: 40, cost: () => 10000, cpr: () => 1000 });
    expect(lifecycleOf(rows).find("alone").state).toBe("NO_BASELINE");
  });
});

describe("피로도 예외", () => {
  it("노출이 늘어나는 중인 신규 소재: 기존 지수는 피로로 잡지만(재현) 플래너는 RAMPING으로 보류한다", () => {
    const grow = (t) => 4000 * Math.pow(1.17, t - 52);
    const rows = [
      ...creative({ campaign: "R", id: "inc", from: 0, cost: () => 100000, cpr: () => 1000 }),
      ...creative({ campaign: "R", id: "ramp", from: 52, cost: grow, cpr: () => 1000 }),
    ];
    const { find } = lifecycleOf(rows);
    const ramp = find("ramp");
    const raw = rows.filter((row) => row.creative_id === "ramp").slice(-14);
    const legacy = CREATIVE_FATIGUE.compositeIndex(CREATIVE_FATIGUE.buildDailySeries(raw), CREATIVE_CONFIG.fatigueAlert);
    expect(legacy.score).toBeGreaterThanOrEqual(CREATIVE_CONFIG.fatigueAlert.alertScore);
    expect(ramp.state).toBe("RAMPING");
    expect(ramp.fatigue).toBeNull();
  });

  it("큰 소재를 끈 직후 남은 소재의 노출 급증: 기존 지수는 피로로 잡지만(재현) 플래너는 CTR로만 본다", () => {
    const rows = [
      ...creative({ campaign: "X", id: "stay", from: 0, cost: (t) => (t <= 55 ? 50000 : 50000 + (t - 55) * 20000), cpr: () => 1000 }),
      ...creative({ campaign: "X", id: "big", from: 0, to: 55, cost: () => 150000, cpr: () => 1000 }),
    ];
    const { find } = lifecycleOf(rows);
    const stay = find("stay");
    const raw = rows.filter((row) => row.creative_id === "stay").slice(-14);
    const legacy = CREATIVE_FATIGUE.compositeIndex(CREATIVE_FATIGUE.buildDailySeries(raw), CREATIVE_CONFIG.fatigueAlert);
    expect(legacy.score).toBeGreaterThanOrEqual(CREATIVE_CONFIG.fatigueAlert.alertScore);
    expect(find("big").ended).toBe(true);
    expect(stay.fatigue).toMatchObject({ ctrOnly: true, fatigued: false });
  });

  it("CTR이 실제로 떨어지는 기존 소재는 재분배 기간에도 피로로 잡힌다", () => {
    const rows = [
      ...creative({ campaign: "F", id: "tired", from: 0, cost: () => 50000, cpr: () => 1000, ctr: (t) => (t < 52 ? 0.02 : 0.02 * Math.pow(0.9, t - 52)) }),
      ...creative({ campaign: "F", id: "big", from: 0, to: 55, cost: () => 50000, cpr: () => 1000 }),
    ];
    expect(lifecycleOf(rows).find("tired").fatigue).toMatchObject({ ctrOnly: true, fatigued: true });
  });
});

describe("학습일과 출시 프로파일", () => {
  it("학습 중 소재 지출 비중이 기준 이상인 날을 노드 학습일·변경 제한일로 표시한다", () => {
    const rows = [
      ...creative({ campaign: "L", id: "inc", from: 0, cost: () => 10000, cpr: () => 1000 }),
      ...creative({ campaign: "L", id: "fresh", from: 66, cost: () => 10000, cpr: () => 1500 }),
    ];
    const node = lifecycleOf(rows).node("L");
    expect([...node.learningDates].sort()).toEqual([66, 67, 68, 69].map((t) => addDays(START, t)));
    expect(node.freezeDates.has(AS_OF)).toBe(true);
  });

  it("과거 출시 3건에서 나이 구간별 CPR 배율을 배우고, 자기 자신은 빼고(leave-one-out) 계산한다", () => {
    const launchCpr = (from) => (t) => (t - from <= 2 ? 1500 : t - from <= 6 ? 1200 : 1000);
    const rows = [
      ...creative({ campaign: "H", id: "base", from: 0, cost: () => 30000, cpr: () => 1000 }),
      ...[10, 25, 40].flatMap((from, i) => creative({ campaign: "H", id: `past${i}`, from, cost: () => 10000, cpr: launchCpr(from) })),
      ...creative({ campaign: "H", id: "young", from: 66, cost: () => 10000, cpr: launchCpr(66) }),
    ];
    const { find } = lifecycleOf(rows);
    const young = find("young");
    expect(young.profile.assumed).toBe(false);
    expect(young.profile.buckets.map((bucket) => bucket.cprRatio)).toEqual([1.5, 1.2, 1]);
    // past0 입장: 0–2일 구간은 다른 출시 3건(past1·past2·young)이 있어 배운 값,
    // 3–6일·7–13일은 young이 아직 그 나이가 아니라 2건뿐(<3)이라 기본값이다. 자기 표본은 쓰지 않는다.
    const past0 = find("past0").profile;
    expect(past0.buckets.map((bucket) => bucket.cprRatio)).toEqual([1.5, ...cfg.creative.launch.defaultLaunchProfile.cprRatio.slice(1)]);
    expect(past0.assumed).toBe(true);
  });
});
