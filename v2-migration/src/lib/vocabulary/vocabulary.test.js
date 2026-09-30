import { describe, expect, it } from "vitest";
import { STANDARD_FIELDS } from "@/utils/csvConstants";
import { publishedToolIds } from "@/lib/routeMap";
import { MATCH_RANK, isChosungQuery, matchText, toChosung, toJamo } from "./hangulMatch";
import { COMMON_WORDS, findCaseVariants, isAxisCandidate } from "./commonWords";
import { SUGGEST_RANK, buildVocabulary, listCandidates, missingRequirements, suggest } from "./vocabulary";

const vocab = buildVocabulary(COMMON_WORDS);
const toolSpec = {
  toolId: "5-21",
  blocks: [
    { id: "verdict", label: { ko: "결론", en: "Conclusion" } },
    { id: "tbl.channel", label: { ko: "채널 표", en: "Channel table" } },
    { id: "caveat.identity", label: { ko: "항등식 확인", en: "Identity check" }, locked: true },
  ],
};
const context = {
  toolId: "5-21",
  toolSpec,
  mappedFields: new Set(["date", "channel", "platform", "cost", "installs"]),
  dimensions: [
    { field: "platform", label: { ko: "OS", en: "OS" }, values: ["iOS", "Android"] },
    { field: "channel", label: { ko: "채널", en: "Channel" }, values: ["Meta", "TikTok"] },
  ],
  caseVariants: [{ field: "platform", values: ["iOS", "ios"] }],
};
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
    const list = suggest(vocab, "", { ...partial, limit: 50 });
    const firstDisabled = list.findIndex((item) => !item.enabled);
    expect(firstDisabled).toBeGreaterThan(0);
    expect(list.slice(firstDisabled).every((item) => !item.enabled)).toBe(true);
  });

  it("잠긴 블록(항등식 확인)은 숨기기 단어 자체가 없다", () => {
    const hides = listCandidates(vocab, context).filter((item) => item.id === "view.hide");
    expect(hides.map((item) => item.params.block)).toEqual(["verdict", "tbl.channel"]);
  });

  it("대소문자만 다른 값은 합치기 단어로 제안한다", () => {
    expect(labelsOf(suggest(vocab, "ios", context))).toContain("iOS·ios 합치기");
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
    const valueWords = COMMON_WORDS.filter((entry) => entry.id.startsWith("filter.") || entry.id === "data.mergeValues");
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

describe("차원 후보 헬퍼", () => {
  it("축 후보: 값 2개 이상, 행 수의 절반 이하", () => {
    expect(isAxisCandidate({ distinctCount: 2, rowCount: 100 })).toBe(true);
    expect(isAxisCandidate({ distinctCount: 1, rowCount: 100 })).toBe(false);
    expect(isAxisCandidate({ distinctCount: 90, rowCount: 100 })).toBe(false);
    expect(isAxisCandidate({ distinctCount: 300, rowCount: 10000 })).toBe(false);
  });

  it("대소문자·공백만 다른 값을 묶되 순서는 데이터 순서", () => {
    expect(findCaseVariants(["iOS", "Android", "ios", " iOS ", "android", "Web"]))
      .toEqual([["iOS", "ios", " iOS "], ["Android", "android"]]);
    expect(findCaseVariants(["KR", "US"])).toEqual([]);
  });
});
