import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import {
  SOURCE_SURVEY_MAX_LENGTH,
  isSourceSurveyLocale,
  normalizeSourceSurveyAnswer,
  shouldShowSourceSurvey,
} from "./sourceSurvey";

describe("유입 경로 서베이 답변 정규화", () => {
  it("줄바꿈·연속 공백을 한 칸으로 접고 양끝을 턴다", () => {
    expect(normalizeSourceSurveyAnswer("  네이버에서\n\n  'MMM' 검색  ")).toBe("네이버에서 'MMM' 검색");
  });

  it("빈 답변·공백뿐인 답변·문자열이 아닌 값은 null이다", () => {
    for (const value of ["", "   ", "\n\t", null, undefined, 12, {}, []]) {
      expect(normalizeSourceSurveyAnswer(value)).toBeNull();
    }
  });

  it("상한에서 자른다", () => {
    const long = "가".repeat(SOURCE_SURVEY_MAX_LENGTH + 50);
    expect(normalizeSourceSurveyAnswer(long)).toHaveLength(SOURCE_SURVEY_MAX_LENGTH);
  });

  it("상한 이하는 그대로 둔다", () => {
    const exact = "나".repeat(SOURCE_SURVEY_MAX_LENGTH);
    expect(normalizeSourceSurveyAnswer(exact)).toBe(exact);
  });

  it("로케일은 화이트리스트만 통과한다", () => {
    expect(isSourceSurveyLocale("ko")).toBe(true);
    expect(isSourceSurveyLocale("en")).toBe(true);
    for (const value of ["jp", "", null, "KO"]) expect(isSourceSurveyLocale(value)).toBe(false);
  });
});

describe("노출 판정", () => {
  const allow = { storageAllows: true, welcomeOpen: false, delayElapsed: true, closed: false };

  it("네 조건이 모두 맞을 때만 뜬다", () => {
    expect(shouldShowSourceSurvey(allow)).toBe(true);
  });

  // 조건마다 하나씩 뒤집어 본다 — "한 곳만 검사"로 통과하지 않게.
  it.each([
    ["이미 답했거나 끈 사람", { storageAllows: false }],
    ["도치 인사가 떠 있는 동안", { welcomeOpen: true }],
    ["열기 판정 전(마운트 직후 한 틱)", { delayElapsed: false }],
    ["사용자가 닫은 뒤", { closed: true }],
  ])("%s 에는 뜨지 않는다", (_label, override) => {
    expect(shouldShowSourceSurvey({ ...allow, ...override })).toBe(false);
  });

  it("인자 없이 부르면 뜨지 않는다(기본값은 안전한 쪽)", () => {
    expect(shouldShowSourceSurvey()).toBe(false);
  });
});

describe("상한은 서버 스키마와 같은 값이다", () => {
  // 한쪽만 바꾸면 화면이 받은 답변을 서버 CHECK 제약이 거절한다.
  // 스키마는 저장소 루트에 있고 손으로 적용하므로 값 정합을 여기서 고정한다.
  it("scripts/source-survey-schema.sql 의 CHECK 와 일치한다", () => {
    const sql = readFileSync("../scripts/source-survey-schema.sql", "utf8");
    const match = /char_length\(answer\)\s+BETWEEN\s+1\s+AND\s+(\d+)/.exec(sql);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBe(SOURCE_SURVEY_MAX_LENGTH);
  });
});
