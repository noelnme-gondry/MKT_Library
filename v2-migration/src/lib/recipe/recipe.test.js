import { describe, expect, it } from "vitest";
import { COMMON_WORDS } from "@/lib/vocabulary/commonWords";
import { buildVocabulary } from "@/lib/vocabulary/vocabulary";
import {
  RECIPE_VERSION,
  addStep,
  defaultRecipeState,
  foldSteps,
  parseRecipe,
  partitionForSync,
  removeStep,
  serializeRecipe,
  validateRecipeState,
} from "./recipe";

// 도구 전용 단어 흉내(PVM 어댑터가 S3에서 붙일 모양).
const TOOL_WORDS = [
  { id: "level.channel", kind: "level", slot: "level", requires: ["channel"], label: { ko: "채널별", en: "By channel" }, apply: (s) => ({ ...s, data: { ...s.data, levels: ["channel"] } }) },
  { id: "level.channel_campaign", kind: "level", slot: "level", label: { ko: "채널+캠페인별", en: "By channel + campaign" }, apply: (s) => ({ ...s, data: { ...s.data, levels: ["channel", "campaign_id"] } }) },
  { id: "metric.cpi", kind: "metric", slot: "metric", label: { ko: "CPI 기준", en: "CPI" }, apply: (s) => ({ ...s, data: { ...s.data, metric: "cpi" } }) },
  { id: "metric.roas", kind: "metric", slot: "metric", label: { ko: "ROAS 기준", en: "ROAS" }, apply: (s) => ({ ...s, data: { ...s.data, metric: "roas" } }) },
  { id: "view.hide.identity", kind: "view", label: { ko: "항등식 숨기기", en: "Hide identity" }, apply: (s) => ({ ...s, view: { ...s.view, hidden: [...s.view.hidden, "caveat.identity"] } }) },
];
const vocab = buildVocabulary([...COMMON_WORDS, ...TOOL_WORDS]);
const spec = {
  toolId: "5-21",
  maxLevels: 3,
  metrics: ["cpa", "cpi"],
  periodKinds: ["lookback", "monthOverMonth", "range"],
  exportFormats: ["xlsx", "csv", "png"],
  blocks: [
    { id: "verdict", label: { ko: "결론" } },
    { id: "tbl.channel", label: { ko: "채널 표" } },
    { id: "caveat.identity", label: { ko: "항등식 확인" }, locked: true },
  ],
  defaults: { levels: ["channel"], metric: "cpa", period: { kind: "lookback", weeks: 1, basis: "calendar" } },
};

describe("기본 상태", () => {
  it("도구 선언에서 파생하고, 한계 문구는 기본 포함", () => {
    const state = defaultRecipeState(spec);
    expect(state.data).toEqual({ levels: ["channel"], metric: "cpa", period: { kind: "lookback", weeks: 1, basis: "calendar" }, filters: [], caseSensitive: false });
    expect(state.export).toEqual({ format: "xlsx", includeCaveats: true, withFormulas: true });
    expect(validateRecipeState(state, spec).ok).toBe(true);
  });

  it("기본 상태가 선언을 바꾸지 않는다(복사본)", () => {
    const state = defaultRecipeState(spec);
    state.data.levels.push("x");
    expect(spec.defaults.levels).toEqual(["channel"]);
  });
});

describe("단계 추가·교체·삭제 = 칩 목록", () => {
  it("같은 자리 단어는 교체된다(채널별 → 채널+캠페인별)", () => {
    let steps = addStep([], { id: "level.channel" }, vocab);
    steps = addStep(steps, { id: "period.lookback.2" }, vocab);
    steps = addStep(steps, { id: "level.channel_campaign" }, vocab);
    expect(steps.map((s) => s.id)).toEqual(["period.lookback.2", "level.channel_campaign"]);
  });

  it("완전히 같은 단계는 한 번만, 자리 없는 단계는 누적", () => {
    const meta = { id: "filter.only.analysis", params: { field: "channel", values: ["Meta"] } };
    const tiktok = { id: "filter.only.analysis", params: { field: "channel", values: ["TikTok"] } };
    let steps = addStep([], meta, vocab);
    steps = addStep(steps, meta, vocab);
    steps = addStep(steps, tiktok, vocab);
    expect(steps).toHaveLength(2);
    const { state } = foldSteps(steps, vocab, spec);
    expect(state.data.filters).toEqual([{ field: "channel", op: "in", scope: "analysis", values: ["Meta", "TikTok"] }]);
  });

  it("모르는 단어는 추가되지 않는다", () => {
    expect(addStep([], { id: "nope" }, vocab)).toEqual([]);
  });

  it("칩을 지우면 그 조작이 취소된다", () => {
    const steps = [{ id: "period.lookback.3", params: {} }, { id: "view.top.5", params: {} }];
    const { state } = foldSteps(removeStep(steps, 0), vocab, spec);
    expect(state.data.period.weeks).toBe(1);
    expect(state.view.topN).toBe(5);
  });
});

describe("foldSteps — 단계를 접어 상태 만들기", () => {
  it("기간 비교 단어와 기준 주 단어는 서로의 값을 보존한다", () => {
    const { state } = foldSteps([{ id: "period.basis.rolling7" }, { id: "period.lookback.3" }], vocab, spec);
    expect(state.data.period).toEqual({ kind: "lookback", weeks: 3, basis: "rolling7" });
  });

  it("OS로 먼저 나누기 = 지금 축 위에 얹고 상한 3단", () => {
    const { state } = foldSteps([
      { id: "level.channel_campaign" },
      { id: "level.dimensionAbove", params: { field: "platform" } },
    ], vocab, spec);
    expect(state.data.levels).toEqual(["platform", "channel", "campaign_id"]);
  });

  it("OS로 먼저 나누기는 칩 순서와 무관하게 기본 축 위에 얹힌다", () => {
    const { state } = foldSteps([
      { id: "level.dimensionAbove", params: { field: "platform" } },
      { id: "level.channel" },
    ], vocab, spec);
    expect(state.data.levels).toEqual(["platform", "channel"]);
  });

  it("도구가 선언하지 않은 지표는 거절하고 앞 상태를 유지한다", () => {
    const { state, applied, rejected } = foldSteps([{ id: "metric.cpi" }, { id: "metric.roas" }], vocab, spec);
    // 같은 자리라 roas가 cpi를 교체했고, roas는 선언 밖이라 거절 → 기본값 cpa 유지.
    expect(applied).toEqual([]);
    expect(rejected.map((r) => r.code)).toEqual(["METRIC_NOT_SUPPORTED"]);
    expect(state.data.metric).toBe("cpa");
  });

  it("잠긴 블록(항등식 확인)은 어떤 단어로도 숨길 수 없다", () => {
    const { state, rejected } = foldSteps([{ id: "view.hide.identity" }], vocab, spec);
    expect(rejected[0].code).toBe("LOCKED_BLOCK");
    expect(state.view.hidden).toEqual([]);
  });

  it("선언 밖 내보내기 형식은 거절", () => {
    expect(foldSteps([{ id: "export.format.docx" }], vocab, spec).rejected[0].code).toBe("FORMAT_NOT_SUPPORTED");
  });

  it("한계 문구 빼기는 유저 선택으로 가능", () => {
    expect(foldSteps([{ id: "export.caveats.exclude" }], vocab, spec).state.export.includeCaveats).toBe(false);
  });

  it("대소문자는 기본으로 합치고, 원하면 구분한다", () => {
    expect(foldSteps([], vocab, spec).state.data.caseSensitive).toBe(false);
    expect(foldSteps([{ id: "data.caseSensitive" }], vocab, spec).state.data.caseSensitive).toBe(true);
  });

  it("매핑+축 후보(selectOnly)는 단계로 저장되지 않는다", () => {
    const step = { id: "level.assignField", params: { field: "channel", column: "매체" } };
    expect(addStep([], step, vocab)).toEqual([]);
    expect(foldSteps([step], vocab, spec).rejected[0].code).toBe("SELECT_ONLY");
  });

  it("모르는 단어·깨진 단계는 사유와 함께 rejected", () => {
    const { rejected } = foldSteps([{ id: "nope" }, null, { id: "view.top.5", params: { x: { y: 1 } } }], vocab, spec);
    expect(rejected.map((r) => r.code)).toEqual(["UNKNOWN_ENTRY", "INVALID_STEP", "INVALID_STEP"]);
  });

  it("같은 단계 목록이면 같은 상태(결정론)", () => {
    const steps = [{ id: "level.dimension", params: { field: "platform" } }, { id: "view.only.worse" }];
    expect(foldSteps(steps, vocab, spec)).toEqual(foldSteps(steps, vocab, spec));
  });
});

describe("validateRecipeState — 선언 밖 상태 거절", () => {
  const base = () => defaultRecipeState(spec);
  it.each([
    ["축 4단", (s) => { s.data.levels = ["a", "b", "c", "d"]; }, "INVALID_LEVELS"],
    ["축 중복", (s) => { s.data.levels = ["a", "a"]; }, "DUPLICATE_LEVEL"],
    ["없는 주 수", (s) => { s.data.period = { kind: "lookback", weeks: 9, basis: "calendar" }; }, "INVALID_PERIOD"],
    ["기간 역순", (s) => { s.data.period = { kind: "range", a: { start: "2026-09-10", end: "2026-09-01" }, b: { start: "2026-09-11", end: "2026-09-17" } }; }, "INVALID_PERIOD"],
    ["빈 필터 값", (s) => { s.data.filters = [{ field: "channel", op: "in", scope: "analysis", values: [] }]; }, "INVALID_FILTER"],
    ["대소문자 옵션 형식", (s) => { s.data.caseSensitive = "yes"; }, "INVALID_CASE_OPTION"],
    ["없는 블록 숨김", (s) => { s.view.hidden = ["nope"]; }, "UNKNOWN_BLOCK"],
    ["긴 이름", (s) => { s.view.labels = { verdict: "가".repeat(61) }; }, "INVALID_LABEL"],
    ["상위 0개", (s) => { s.view.topN = 0; }, "INVALID_TOP_N"],
  ])("%s", (_, mutate, code) => {
    const state = base();
    mutate(state);
    expect(validateRecipeState(state, spec).errors.map((e) => e.code)).toContain(code);
  });
});

describe("저장 형식", () => {
  it("직렬화 → 읽기 왕복", () => {
    const steps = [{ id: "level.channel", params: {} }, { id: "filter.only.view", params: { values: ["Meta"], field: "channel" } }];
    const saved = serializeRecipe({ toolId: "5-21", steps });
    expect(saved.version).toBe(RECIPE_VERSION);
    const parsed = parseRecipe(JSON.parse(JSON.stringify(saved)), { toolId: "5-21" });
    expect(parsed.ok).toBe(true);
    // params 키는 정렬돼 같은 단계는 같은 모양이 된다.
    expect(Object.keys(parsed.recipe.steps[1].params)).toEqual(["field", "values"]);
  });

  it.each([
    ["미래 버전", { version: RECIPE_VERSION + 1, toolId: "5-21", steps: [] }, "UNKNOWN_VERSION"],
    ["모르는 필드", { version: 1, toolId: "5-21", steps: [], rows: [] }, "UNKNOWN_FIELD"],
    ["다른 도구", { version: 1, toolId: "5-22", steps: [] }, "TOOL_MISMATCH"],
    ["깨진 단계", { version: 1, toolId: "5-21", steps: [{ id: "" }] }, "INVALID_STEPS"],
  ])("모르는 것은 건너뛰지 않고 거절: %s", (_, raw, code) => {
    expect(parseRecipe(raw, { toolId: "5-21" })).toEqual({ ok: false, code });
  });

  it("사용자 데이터 값을 담은 단계는 계정 동기화에서 빠진다", () => {
    const steps = [
      { id: "level.channel", params: {} },
      { id: "filter.only.analysis", params: { field: "channel", values: ["Meta"] } },
      { id: "filter.exclude.analysis", params: { field: "platform", values: ["iOS"] } },
      { id: "export.format.csv", params: {} },
    ];
    const { syncable, deviceOnly } = partitionForSync(steps, vocab);
    expect(syncable.map((s) => s.id)).toEqual(["level.channel", "export.format.csv"]);
    expect(deviceOnly.map((s) => s.id)).toEqual(["filter.only.analysis", "filter.exclude.analysis"]);
  });
});
