import { describe, expect, it } from "vitest";
import { COMMON_WORDS } from "@/lib/vocabulary/commonWords";
import { PVM_WORDS } from "@/lib/vocabulary/tools/pvmWords";
import { buildVocabulary } from "@/lib/vocabulary/vocabulary";
import { columnRef } from "@/lib/vocabulary/dataContext";
import { foldSteps } from "./recipe";
import {
  applyPvmView,
  caveatExclusionNote,
  columnRefsInState,
  defaultPvmKeys,
  exportLimitations,
  keysToLevels,
  legacyPvmSteps,
  monthOverMonthRanges,
  preparePvmRows,
  pvmBlocks,
  pvmKeysFromState,
  unappliedViewFilters,
} from "./pvmRecipe";

const vocab = buildVocabulary([...COMMON_WORDS, ...PVM_WORDS]);
const mapped = (...keys) => new Set(keys);

describe("기본 축 = 기존 5-21 동작", () => {
  it.each([
    [["channel"], { ch: "channel", cmp: null, cr: null }],
    [["channel", "campaign_name"], { ch: "channel", cmp: "campaign_id", cr: null }],
    [["channel", "campaign_id", "creative_id"], { ch: "channel", cmp: "campaign_id", cr: "creative_id" }],
    // 캠페인 없이 소재만 있어도 채널→소재(기존 계약).
    [["channel", "creative_id"], { ch: "channel", cmp: null, cr: "creative_id" }],
  ])("채널 있음: %j", (keys, expected) => {
    expect(defaultPvmKeys(mapped(...keys))).toEqual(expected);
  });

  it.each([
    [["campaign_name"], { ch: "campaign_id", cmp: null, cr: null }],
    [["campaign_name", "creative_id"], { ch: "campaign_id", cmp: null, cr: "creative_id" }],
    [["platform", "country"], { ch: "platform", cmp: null, cr: null }],
    [["country"], { ch: "country", cmp: null, cr: null }],
  ])("채널이 없으면 있는 첫 축으로 시작: %j", (keys, expected) => {
    expect(defaultPvmKeys(mapped(...keys))).toEqual(expected);
  });
});

describe("레시피 축 → 엔진 keys", () => {
  const spec = { toolId: "5-21", maxLevels: 3, metrics: ["cpa", "cpi"], blocks: pvmBlocks(), defaults: { levels: ["channel"] } };

  it("OS로 먼저 나누기 + 채널+캠페인별 = OS → 채널 → 캠페인", () => {
    const { state, applied } = foldSteps([
      { id: "level.pvm.channelCampaign" },
      { id: "level.dimensionAbove", params: { field: "platform" } },
    ], vocab, spec);
    expect(applied).toHaveLength(2);
    expect(pvmKeysFromState(state, { levelsCustom: true, mappedFields: mapped() })).toEqual({ ch: "platform", cmp: "channel", cr: "campaign_id" });
  });

  it("캠페인별(campaign_name 축)은 5-21 행의 campaign_id로 읽는다", () => {
    const { state } = foldSteps([{ id: "level.field", params: { field: "campaign_name" } }], vocab, spec);
    expect(pvmKeysFromState(state, { levelsCustom: true, mappedFields: mapped() })).toEqual({ ch: "campaign_id", cmp: null, cr: null });
  });

  it("레벨 단계가 없으면 기본 축", () => {
    const { state } = foldSteps([], vocab, spec);
    expect(pvmKeysFromState(state, { levelsCustom: false, mappedFields: mapped("channel", "creative_id") })).toEqual({ ch: "channel", cmp: null, cr: "creative_id" });
  });

  it("매핑 안 된 CSV 컬럼 축·필터를 찾아낸다", () => {
    const { state } = foldSteps([
      { id: "level.field", params: { field: columnRef("권역") } },
      { id: "filter.only.analysis", params: { field: columnRef("앱 버전"), values: ["2.0"] } },
      { id: "filter.only.analysis", params: { field: "channel", values: ["Meta"] } },
    ], vocab, spec);
    expect(columnRefsInState(state)).toEqual(["col:권역", "col:앱 버전"]);
  });
});

describe("행 준비 — 대소문자 합치기·분석 범위 필터", () => {
  const keys = { ch: "platform", cmp: "channel", cr: null };
  const rows = [
    { platform: "iOS", channel: "Meta", spend: "10" },
    { platform: "ios", channel: "meta ", spend: "20" },
    { platform: "iOS", channel: "Meta", spend: "30" },
    { platform: "Android", channel: "TikTok", spend: "40" },
  ];

  it("기본은 대소문자·공백만 다른 값을 최다 표기로 합치고 합친 묶음을 돌려준다", () => {
    const { rows: out, merged } = preparePvmRows(rows, { keys });
    expect(out.map((row) => row.platform)).toEqual(["iOS", "iOS", "iOS", "Android"]);
    expect(out.map((row) => row.channel)).toEqual(["Meta", "Meta", "Meta", "TikTok"]);
    expect(merged).toEqual([
      { field: "platform", to: "iOS", from: ["iOS", "ios"] },
      { field: "channel", to: "Meta", from: ["Meta", "meta "] },
    ]);
    // 입력 행은 바꾸지 않는다.
    expect(rows[1].platform).toBe("ios");
  });

  it("대소문자 구분하기면 그대로", () => {
    const { rows: out, merged } = preparePvmRows(rows, { keys, caseSensitive: true });
    expect(out).toBe(rows);
    expect(merged).toEqual([]);
  });

  it("분석 범위 필터는 합친 값 기준·대소문자 무시, 보기 필터는 행을 거르지 않는다", () => {
    const filters = [
      { field: "channel", op: "in", scope: "analysis", values: ["META"] },
      { field: "platform", op: "in", scope: "view", values: ["Android"] },
    ];
    const { rows: out } = preparePvmRows(rows, { keys, filters });
    expect(out.map((row) => row.spend)).toEqual(["10", "20", "30"]);
  });

  it("제외 필터", () => {
    const { rows: out } = preparePvmRows(rows, { keys, filters: [{ field: "platform", op: "notIn", scope: "analysis", values: ["iOS"] }] });
    expect(out.map((row) => row.spend)).toEqual(["40"]);
  });
});

describe("지난달과 비교 기간", () => {
  it.each([
    ["2026-09-17", { start: "2026-08-01", end: "2026-08-17" }, { start: "2026-09-01", end: "2026-09-17" }],
    // 지난달이 짧으면 말일에서 자른다.
    ["2026-03-31", { start: "2026-02-01", end: "2026-02-28" }, { start: "2026-03-01", end: "2026-03-31" }],
    ["2024-03-30", { start: "2024-02-01", end: "2024-02-29" }, { start: "2024-03-01", end: "2024-03-30" }],
    // 연도를 넘는다.
    ["2026-01-10", { start: "2025-12-01", end: "2025-12-10" }, { start: "2026-01-01", end: "2026-01-10" }],
  ])("%s", (max, periodA, periodB) => {
    expect(monthOverMonthRanges(max)).toEqual({ periodA, periodB });
  });

  it("날짜가 아니면 null", () => {
    expect(monthOverMonthRanges("")).toBeNull();
    expect(monthOverMonthRanges("2026/09/01")).toBeNull();
  });
});

describe("보기 설정 — 표에만, 합계는 호출부가 전체로", () => {
  const keys = { ch: "channel", cmp: "campaign_id", cr: null };
  const rows = [
    { chKey: "Meta", cmpKey: "a", contribution: 30 },
    { chKey: "Meta", cmpKey: "b", contribution: -10 },
    { chKey: "TikTok", cmpKey: "c", contribution: 5 },
    { chKey: "TikTok", cmpKey: "d", contribution: -2 },
  ];
  const view = (patch = {}) => ({ hidden: [], labels: {}, topN: null, only: null, ...patch });

  it("악화만 → 기여 > 0", () => {
    expect(applyPvmView(rows, { view: view({ only: "worse" }), keys, levelIndex: 1 }).rows.map((row) => row.cmpKey)).toEqual(["a", "c"]);
  });

  it("상위 N은 정렬된 순서에서 자른다", () => {
    const out = applyPvmView(rows, { view: view({ topN: 2 }), keys, levelIndex: 1 });
    expect(out.rows.map((row) => row.cmpKey)).toEqual(["a", "b"]);
    expect(out.hiddenCount).toBe(2);
  });

  it("상위 축 보기 필터는 하위 표에도 걸린다(Meta만 보기 → 캠페인 표)", () => {
    const filters = [{ field: "channel", op: "in", scope: "view", values: ["meta"] }];
    expect(applyPvmView(rows, { view: view(), filters, keys, levelIndex: 1 }).rows.map((row) => row.cmpKey)).toEqual(["a", "b"]);
  });

  it("하위 축 보기 필터는 상위 표에 걸지 않는다", () => {
    const filters = [{ field: "campaign_name", op: "in", scope: "view", values: ["a"] }];
    const out = applyPvmView([{ chKey: "Meta", contribution: 20 }], { view: view(), filters, keys, levelIndex: 0 });
    expect(out.rows).toHaveLength(1);
    expect(out.unapplied).toEqual(filters);
  });

  it("분해 축이 아닌 컬럼의 보기 필터는 어느 표에도 못 건다", () => {
    const filters = [{ field: "country", op: "in", scope: "view", values: ["KR"] }, { field: "channel", op: "in", scope: "view", values: ["Meta"] }];
    expect(unappliedViewFilters(filters, keys)).toEqual([filters[0]]);
  });
});

describe("다운로드 한계 문구", () => {
  it("기본 포함", () => {
    expect(exportLimitations(["A", "B"], true)).toEqual(["A", "B"]);
  });

  it("빼면 뺐다는 한 줄만 남는다", () => {
    expect(exportLimitations(["A", "B"], false)).toEqual(["작성자가 분석 한계 2건을 제외했습니다."]);
    expect(exportLimitations(["A"], false, "en")).toEqual([caveatExclusionNote(1, "en")]);
    expect(exportLimitations([], false)).toEqual([]);
  });
});

describe("블록 선언", () => {
  it("항등식 확인과 첫 분해표는 숨길 수 없다", () => {
    const locked = pvmBlocks().filter((block) => block.locked).map((block) => block.id);
    expect(locked).toEqual(["tbl.level1", "caveat.identity"]);
  });

  it("표 이름은 축 이름에서 온다", () => {
    const blocks = pvmBlocks([{ ko: "OS", en: "OS" }, { ko: "채널", en: "Channel" }]);
    expect(blocks.find((block) => block.id === "tbl.level2").label.ko).toBe("채널별 결과");
  });
});

describe("예전 저장 입력 → 단계", () => {
  it("기본값이면 단계 없음, 바뀐 값만 단계로", () => {
    expect(legacyPvmSteps({})).toEqual([]);
    expect(legacyPvmSteps({ metricOverride: "cpi", weekBasis: "rolling7", lookback: 3 }).map((step) => step.id))
      .toEqual(["metric.pvm.cpi", "period.basis.rolling7", "period.lookback.3"]);
    expect(keysToLevels({ ch: "a", cmp: null, cr: "c" })).toEqual(["a", "c"]);
  });

  it("옮긴 단계는 모두 사전에 있다", () => {
    for (const step of legacyPvmSteps({ metricOverride: "cpa", weekBasis: "rolling7", lookback: 2 })) expect(vocab.has(step.id), step.id).toBe(true);
  });
});
