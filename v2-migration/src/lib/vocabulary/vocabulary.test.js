import { describe, expect, it } from "vitest";
import { STANDARD_FIELDS } from "@/utils/csvConstants";
import { publishedToolIds } from "@/lib/routeMap";
import { MATCH_RANK, directionParticle, isChosungQuery, objectParticle, matchText, toChosung, toJamo } from "./hangulMatch";
import { COMMON_WORDS } from "./commonWords";
import { buildDataContext, buildValueCanonicalizer, columnRef, parseFieldRef } from "./dataContext";
import { PVM_WORDS } from "./tools/pvmWords";
import { SUGGEST_RANK, buildVocabulary, listCandidates, missingRequirements, suggest, toSelection } from "./vocabulary";

const vocab = buildVocabulary([...COMMON_WORDS, ...PVM_WORDS]);
const toolSpec = {
  toolId: "5-21",
  blocks: [
    { id: "verdict", label: { ko: "결론", en: "Conclusion" } },
    { id: "tbl.channel", label: { ko: "채널 표", en: "Channel table" } },
    { id: "caveat.identity", label: { ko: "항등식 확인", en: "Identity check" }, locked: true },
  ],
};

// 유저 CSV 흉내: 헤더는 유저 표기(매체·캠페인명·OS·권역), OS 값은 대소문자가 섞였다.
function makeRows() {
  const rows = [];
  for (let i = 0; i < 40; i += 1) {
    rows.push({
      날짜: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
      매체: i % 2 ? "Meta" : "TikTok",
      캠페인명: `cmp_${i % 4}`,
      OS: i < 18 ? "iOS" : i < 23 ? "ios" : "Android",
      권역: i % 3 ? "수도권" : "지방",
      소재: `cr_${i % 6}`,
      비용: String(1000 + i),
      설치: String(10 + i),
    });
  }
  return rows;
}
const MAPPING = { 날짜: "date", 매체: "channel", 캠페인명: "campaign_name", 소재: "creative_id", OS: "platform", 비용: "cost", 설치: "installs" };
const context = buildDataContext({ rows: makeRows(), mapping: MAPPING, toolId: "5-21", toolSpec });
const labelsOf = (list, locale = "ko") => list.map((item) => item.label[locale]);

describe("한글 자모·초성 분해", () => {
  it("겹받침·겹모음은 키 단위로 펼친다", () => {
    expect(toJamo("닭")).toBe("ㄷㅏㄹㄱ");
    expect(toJamo("원")).toBe("ㅇㅜㅓㄴ");
    expect(toJamo("까")).toBe("ㄲㅏ");
  });

  it("초성열은 한글만 초성으로 바꾸고 나머지는 소문자·구분 기호 제거", () => {
    expect(toChosung("채널+캠페인별")).toBe("ㅊㄴㅋㅍㅇㅂ");
    expect(toChosung("OS별")).toBe("osㅂ");
    expect(isChosungQuery("ㅊㄴ")).toBe(true);
    expect(isChosungQuery("채ㄴ")).toBe(false);
  });
});

describe("matchText — 입력 한 글자마다의 순위", () => {
  it.each([
    ["채", "채널별", MATCH_RANK.PREFIX],
    ["채널캠", "채널+캠페인별", MATCH_RANK.PREFIX],
    // IME 조합 중: "채널"을 치는 도중 화면에는 "챈"이 떠 있다.
    ["챈", "채널별", MATCH_RANK.JAMO_PREFIX],
    ["채너", "채널별", MATCH_RANK.JAMO_PREFIX],
    ["ㅊ", "채널별", MATCH_RANK.JAMO_PREFIX],
    ["ㅊㄴ", "채널별", MATCH_RANK.CHOSUNG],
    ["cpa", "CPA 기준", MATCH_RANK.PREFIX],
    ["캠페", "채널+캠페인별", MATCH_RANK.CONTAINS],
    ["캠펭", "채널+캠페인별", MATCH_RANK.CONTAINS],
  ])("%s → %s", (query, text, rank) => {
    expect(matchText(query, text)).toBe(rank);
  });

  it("맞지 않으면 null — 한 키 자모는 단어 중간에서 찾지 않는다(잡음 방지)", () => {
    expect(matchText("국", "채널별")).toBeNull();
    expect(matchText("ㅋ", "채널+캠페인별")).toBeNull();
  });
});

describe("suggest — 사전 후보", () => {
  it("'O'를 치면 OS 축 단어가 위에 뜬다", () => {
    const labels = labelsOf(suggest(vocab, "O", context));
    expect(labels.slice(0, 2)).toEqual(["OS별", "OS로 먼저 나누기"]);
  });

  it("데이터 값으로 필터 단어를 만든다 — 'me' → Meta만 분석/제외/보기", () => {
    const labels = labelsOf(suggest(vocab, "me", context));
    expect(labels).toEqual(expect.arrayContaining(["Meta만 분석", "Meta 제외하고 분석", "Meta만 보기"]));
    // 라벨 접두 일치가 먼저 — 영어 라벨 부분 일치("…without Meta")는 그 뒤다.
    expect(labels.slice(0, 3).every((label) => label.startsWith("Meta"))).toBe(true);
  });

  it("라벨 접두 > 별칭 순서이고 같은 입력이면 같은 순서다(결정론)", () => {
    const a = suggest(vocab, "지난", context);
    const b = suggest(vocab, "지난", context);
    expect(labelsOf(a)).toEqual(labelsOf(b));
    expect(a[0].label.ko).toBe("지난달과 비교");
    expect(a[0].rank).toBe(SUGGEST_RANK.LABEL_PREFIX);
    // "지난주"는 직전주 단어의 별칭이다.
    const alias = a.find((item) => item.id === "period.lookback.1");
    expect(alias?.rank).toBe(SUGGEST_RANK.ALIAS);
  });

  it("한국어 화면에서 영어 라벨로도 찾는다", () => {
    expect(labelsOf(suggest(vocab, "excel", context))[0]).toBe("엑셀로 받기(수식 포함)");
  });

  it("못 쓰는 단어는 숨기지 않고 enabled:false + 필요한 컬럼", () => {
    const noDate = { ...context, mappedFields: new Set(["channel", "cost"]) };
    const hit = suggest(vocab, "직전", noDate)[0];
    expect(hit.id).toBe("period.lookback.1");
    expect(hit.enabled).toBe(false);
    expect(hit.missing).toEqual(["date"]);
  });

  it("같은 순위에서는 쓸 수 있는 단어가 먼저다", () => {
    const partial = { ...context, mappedFields: new Set(["channel"]) };
    const list = suggest(vocab, "", { ...partial, limit: 500 });
    const firstDisabled = list.findIndex((item) => !item.enabled);
    expect(firstDisabled).toBeGreaterThan(0);
    expect(list.slice(firstDisabled).every((item) => !item.enabled)).toBe(true);
  });

  it("잠긴 블록(항등식 확인)은 숨기기 단어 자체가 없다", () => {
    const hides = listCandidates(vocab, context).filter((item) => item.id === "view.hide");
    expect(hides.map((item) => item.params.block)).toEqual(["verdict", "tbl.channel"]);
  });

  it("대소문자만 다른 값은 알아서 한 값으로 — 'ios'를 쳐도 iOS 필터 하나만", () => {
    const labels = labelsOf(suggest(vocab, "ios", context));
    expect(labels).toContain("iOS만 분석");
    expect(labels.some((label) => label.startsWith("ios"))).toBe(false);
  });

  it("상한은 기본 8개", () => {
    expect(suggest(vocab, "", context)).toHaveLength(8);
  });
});

describe("공용 단어 사전 계약 (사전에서 파생)", () => {
  it("모든 requires 키는 실제 표준 필드다", () => {
    const keys = COMMON_WORDS.flatMap((entry) => (entry.requires || []).flatMap((req) => (typeof req === "string" ? [req] : req.oneOf)));
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(Object.hasOwn(STANDARD_FIELDS, key), key).toBe(true);
  });

  it("tools를 선언한 단어는 발행 도구만 가리킨다", () => {
    const published = new Set(publishedToolIds());
    for (const entry of COMMON_WORDS) for (const id of entry.tools || []) expect(published.has(id), `${entry.id}:${id}`).toBe(true);
  });

  it("사용자 데이터 값을 담는 틀 단어는 carriesUserValues로 표시돼 있다", () => {
    const valueWords = COMMON_WORDS.filter((entry) => entry.id.startsWith("filter."));
    expect(valueWords.length).toBeGreaterThan(0);
    expect(valueWords.every((entry) => entry.carriesUserValues === true)).toBe(true);
  });

  it("id 중복·잘못된 kind는 사전 생성에서 막힌다", () => {
    expect(() => buildVocabulary([...COMMON_WORDS, COMMON_WORDS[0]])).toThrow(/duplicate/);
    expect(() => buildVocabulary([{ ...COMMON_WORDS[0], id: "x", kind: "nope" }])).toThrow(/kind/);
  });

  it("missingRequirements는 oneOf를 이해한다", () => {
    expect(missingRequirements(["date", { oneOf: ["installs", "actions"] }], new Set(["date", "actions"]))).toEqual([]);
    expect(missingRequirements([{ oneOf: ["installs", "actions"] }], new Set())).toHaveLength(1);
  });
});

describe("입력 순서 — 사용자 요구(2026-09-30)", () => {
  it("'채' → 채널별, 채널+캠페인별, 채널+캠페인+소재별 순서", () => {
    expect(labelsOf(suggest(vocab, "채", context)).slice(0, 3)).toEqual(["채널별", "채널+캠페인별", "채널+캠페인+소재별"]);
  });

  it("'캠' → 캠페인별이 먼저, 채널+캠페인별은 그 아래", () => {
    const labels = labelsOf(suggest(vocab, "캠", context));
    expect(labels[0]).toBe("캠페인별");
    expect(labels.indexOf("채널+캠페인별")).toBeGreaterThan(0);
  });

  it("소재 컬럼이 없으면 3단 조합은 흐리게 + 필요한 컬럼", () => {
    const { 소재: _dropped, ...noCreative } = MAPPING;
    void _dropped;
    const ctx = buildDataContext({ rows: makeRows(), mapping: noCreative, toolId: "5-21" });
    const combo = suggest(vocab, "채", ctx).find((item) => item.id === "level.pvm.channelCampaignCreative");
    expect(combo.enabled).toBe(false);
    expect(combo.missing).toEqual(["creative_id"]);
  });
});

describe("CSV 컬럼 → 단어 (dataContext)", () => {
  it("매핑된 축은 우리 용어로, 실제 컬럼명은 힌트로", () => {
    const channel = suggest(vocab, "채널별", context)[0];
    expect(channel.id).toBe("level.field");
    expect(channel.params).toEqual({ field: "channel" });
    expect(channel.hint.ko).toBe("컬럼: 매체");
    // 컬럼명으로 쳐도 찾는다.
    expect(suggest(vocab, "매체", context).map((item) => item.id)).toContain("level.field");
  });

  it("매핑 안 된 문자열 컬럼은 그 이름 그대로 축 단어가 된다", () => {
    const region = suggest(vocab, "권역", context)[0];
    expect(region.label.ko).toBe("권역별");
    expect(region.params.field).toBe(columnRef("권역"));
    expect(region.hint.ko).toBe("CSV 컬럼 그대로");
  });

  it("숫자·날짜 컬럼은 축 단어가 되지 않는다", () => {
    const fields = context.dimensions.map((dim) => dim.column);
    expect(fields).toEqual(["매체", "캠페인명", "소재", "OS", "권역"]);
  });

  it("대소문자 합친 사실을 화면이 알릴 수 있게 돌려준다", () => {
    const os = context.dimensions.find((dim) => dim.standardKey === "platform");
    expect(os.values).toEqual(["iOS", "Android"]);
    expect(os.merged).toEqual([{ to: "iOS", from: ["iOS", "ios"] }]);
  });

  it("표준 '채널'과 매핑 안 된 '채널' 컬럼이 둘 다 있으면 이름으로 구분", () => {
    const rows = makeRows().map((row, i) => ({ ...row, 채널: i % 2 ? "A" : "B" }));
    const ctx = buildDataContext({ rows, mapping: MAPPING, toolId: "5-21" });
    const labels = labelsOf(suggest(vocab, "채널", { ...ctx, limit: 20 }));
    expect(labels).toContain("채널별");
    expect(labels).toContain("채널 (CSV 컬럼)별");
  });

  it("축 필드가 비어 있고 이름이 별칭인 컬럼이 있으면 매핑+축을 한 번에 제안", () => {
    const { 매체: _ignored, ...mappingWithoutChannel } = MAPPING;
    void _ignored;
    const ctx = buildDataContext({ rows: makeRows(), mapping: mappingWithoutChannel, toolId: "5-21" });
    const offer = suggest(vocab, "채", ctx).find((item) => item.id === "level.assignField");
    expect(offer.label.ko).toBe("채널별 — '매체'를 채널로 지정");
    expect(toSelection(offer)).toEqual({
      mapping: { column: "매체", field: "channel" },
      step: { id: "level.field", params: { field: "channel" } },
    });
  });

  it("보통 후보의 선택은 단계 하나", () => {
    const pick = suggest(vocab, "직전", context)[0];
    expect(toSelection(pick)).toEqual({ mapping: null, step: { id: "period.lookback.1", params: {} } });
  });
});

describe("값 대표 표기·축 참조", () => {
  it("유저 컬럼 이름에 맞춰 조사를 고른다", () => {
    expect(objectParticle("매체")).toBe("를");
    expect(objectParticle("권역")).toBe("을");
    expect(objectParticle("media")).toBe("를");
    expect(objectParticle("region")).toBe("을");
    expect(directionParticle("OS")).toBe("로");
    expect(objectParticle("매체)")).toBe("을(를)");
    expect(directionParticle("채널")).toBe("로");
    expect(directionParticle("캠페인")).toBe("으로");
    expect(directionParticle("국가")).toBe("로");
  });

  it("가장 많이 나온 표기가 대표, 동률이면 먼저 나온 표기", () => {
    const c = buildValueCanonicalizer(["ios", "iOS", "iOS", " IOS ", "Android", "android"]);
    expect(c.values).toEqual([{ value: "iOS", count: 4 }, { value: "Android", count: 2 }]);
    expect(c.canonicalOf("ios")).toBe("iOS");
    expect(c.canonicalOf("android")).toBe("Android");
    expect(c.merged).toEqual([{ to: "iOS", from: ["ios", "iOS", " IOS "] }, { to: "Android", from: ["Android", "android"] }]);
  });

  it("축 참조는 표준 키와 CSV 컬럼을 구분한다", () => {
    expect(parseFieldRef("channel")).toEqual({ kind: "standard", key: "channel" });
    expect(parseFieldRef(columnRef("권역"))).toEqual({ kind: "column", header: "권역" });
  });
});
