import { describe, expect, it } from "vitest";
import { configFor, mergePlannerConfig, PLANNER_CONFIG, PLANNER_VERDICTS, plannerConfigSignature, resolvePlannerConfig } from "./plannerConfig";

const paths = (result) => (result.ok ? [] : result.errors.map((error) => `${error.path}:${error.reason}`));

describe("plannerConfig", () => {
  it("기본값은 검증을 통과하고 얼어 있다", () => {
    const result = resolvePlannerConfig();
    expect(result.ok).toBe(true);
    expect(Object.isFrozen(PLANNER_CONFIG.optimizer.statePolicy)).toBe(true);
    expect(Object.isFrozen(result.config.creative.launch)).toBe(true);
  });

  it("모르는 키·범위 밖 값·관계 위반을 경로와 함께 거절한다", () => {
    expect(paths(resolvePlannerConfig({ optimizer: { maxDailyIncreas: 0.3 } }))).toContain("optimizer.maxDailyIncreas:unknown_key");
    expect(paths(resolvePlannerConfig({ optimizer: { maxDailyDecrease: 1.5 } }))).toContain("optimizer.maxDailyDecrease:fraction_out_of_range");
    expect(paths(resolvePlannerConfig({ conformity: { zBand: -1 } }))).toContain("conformity.zBand:negative");
    expect(paths(resolvePlannerConfig({ forecast: { lowerQ: 0.9, upperQ: 0.8 } }))).toContain("forecast.lowerQ:must_be_below_upperQ");
    expect(paths(resolvePlannerConfig({ events: { windowDays: 10 } }))).toContain("events.windowDays:multiple_of_7_required");
    expect(paths(resolvePlannerConfig({ forecast: { spendPacing: "weekly" } }))).toContain("forecast.spendPacing:unknown_value");
    expect(paths(resolvePlannerConfig({ diagnosis: { priority: PLANNER_VERDICTS.slice(1) } }))).toContain("diagnosis.priority:must_list_every_verdict_once");
    expect(paths(resolvePlannerConfig({ optimizer: { groupShares: { "country:KR": [0.8, 0.2] } } }))).toContain("optimizer.groupShares.country:KR:level_value_and_0_1_bounds_required");
    expect(paths(resolvePlannerConfig({ curve: { minPoints: 2.5 } }))).toContain("curve.minPoints:positive_integer_required");
    expect(paths(resolvePlannerConfig({ dow: { enabled: "yes" } }))).toContain("dow.enabled:type_boolean_required");
  });

  it("채널 덮어쓰기도 같은 규칙으로 검사하고, 덮어쓸 수 없는 절은 막는다", () => {
    expect(paths(resolvePlannerConfig({ overrides: { channel: { Meta: { hierarchy: { roles: { allocate: "channel" } } } } } })))
      .toContain("overrides.channel.Meta.hierarchy:section_not_overridable");
    expect(paths(resolvePlannerConfig({ overrides: { channel: { Kakao: { optimizer: { maxDailyDecrease: 3 } } } } })))
      .toContain("overrides.channel.Kakao → optimizer.maxDailyDecrease:fraction_out_of_range");
    expect(paths(resolvePlannerConfig({ overrides: { country_channel: { KR: { optimizer: { stepPct: 0.01 } } } } })))
      .toContain("overrides.country_channel.KR:key_must_be_country|channel");
  });

  it("노드 실효 config는 기본 → 채널 → 국가×채널 순으로 덮어쓴다", () => {
    const { config } = resolvePlannerConfig({
      overrides: { country_channel: { "JP|Meta": { optimizer: { maxDailyIncrease: 0.05 } } } },
    });
    expect(configFor(config, { country: "KR", channel: "TikTok" }).optimizer.maxDailyIncrease).toBe(PLANNER_CONFIG.optimizer.maxDailyIncrease);
    expect(configFor(config, { country: "KR", channel: "Meta" }).optimizer.learningMinWeeklyResults).toBe(50);
    const jpMeta = configFor(config, { country: "JP", channel: "Meta" }).optimizer;
    expect(jpMeta.maxDailyIncrease).toBe(0.05);
    expect(jpMeta.learningMinWeeklyResults).toBe(50);
  });

  it("병합은 배열을 통째로 바꾸고 객체는 키별로 합친다", () => {
    const merged = mergePlannerConfig(PLANNER_CONFIG, { optimizer: { locked: ["a"] }, forecast: { horizonDays: 7 } });
    expect(merged.optimizer.locked).toEqual(["a"]);
    expect(merged.optimizer.maxDailyIncrease).toBe(PLANNER_CONFIG.optimizer.maxDailyIncrease);
    expect(merged.forecast.upperQ).toBe(PLANNER_CONFIG.forecast.upperQ);
  });

  it("서명은 같은 config에서 같고 값 하나만 바뀌어도 달라진다", () => {
    const a = resolvePlannerConfig().config;
    const b = resolvePlannerConfig({}).config;
    const c = resolvePlannerConfig({ forecast: { horizonDays: 15 } }).config;
    expect(plannerConfigSignature(a)).toBe(plannerConfigSignature(b));
    expect(plannerConfigSignature(a)).not.toBe(plannerConfigSignature(c));
    expect(plannerConfigSignature(a)).toMatch(/^1\.0\.0-[0-9a-f]{8}$/);
  });
});
