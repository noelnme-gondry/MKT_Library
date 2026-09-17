import { describe, it, expect } from "vitest";

import { buildSourceSurveyRow } from "./sourceSurveyServer";
import { SOURCE_SURVEY_MAX_LENGTH } from "./sourceSurvey";

// 브라우저가 보낸 값은 전부 다시 조립한다 — 통과한 필드만 저장된다.
describe("저장 행 조립", () => {
  const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

  it("허용 필드만 남는다(보낸 객체를 펼치지 않는다)", () => {
    const row = buildSourceSurveyRow(
      { id: uuid, answer: " 지인 추천 ", locale: "en", email: "x@y.z", is_admin: true, created_at: "1999-01-01" },
      "/en/blog/some-post",
    );
    expect(Object.keys(row).sort()).toEqual(["answer", "entrySurface", "id", "locale"]);
    expect(row).toMatchObject({ id: uuid, answer: "지인 추천", locale: "en", entrySurface: "blog" });
  });

  it("경로를 그대로 저장하지 않고 고정 어휘로 분류한다", () => {
    // URL·검색어가 저장되면 안 된다. 분류 결과만 남는다.
    const row = buildSourceSurveyRow({ answer: "검색", locale: "ko" }, "/tools/campaign-pvm?utm_source=secret");
    expect(row.entrySurface).toBe("tool");
    expect(JSON.stringify(row)).not.toContain("utm_source");
  });

  it("모르는 로케일은 ko로 떨어진다", () => {
    expect(buildSourceSurveyRow({ answer: "a", locale: "jp" }, "/").locale).toBe("ko");
  });

  it("uuid 형식이 아닌 id는 서버가 새로 만든다", () => {
    for (const bad of ["../../etc", "1", "", null, "3f2504e0-4f89-41d3-9a0c-0305e82c330"]) {
      const row = buildSourceSurveyRow({ id: bad, answer: "a", locale: "ko" }, "/");
      expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(row.id).not.toBe(bad);
    }
  });

  it("같은 제출 id는 그대로 보존한다(재시도 중복을 DB가 막게)", () => {
    expect(buildSourceSurveyRow({ id: uuid.toUpperCase(), answer: "a", locale: "ko" }, "/").id).toBe(uuid);
  });

  it("상한을 넘는 답변은 잘려서 저장된다(서버 CHECK에 걸리지 않는다)", () => {
    const row = buildSourceSurveyRow({ answer: "가".repeat(1000), locale: "ko" }, "/");
    expect(row.answer).toHaveLength(SOURCE_SURVEY_MAX_LENGTH);
  });

  it("빈 답변은 거절한다", () => {
    for (const answer of ["", "   ", null, undefined, 5, { text: "a" }]) {
      expect(() => buildSourceSurveyRow({ answer, locale: "ko" }, "/")).toThrow("INVALID_SURVEY");
    }
    expect(() => buildSourceSurveyRow(null, "/")).toThrow("INVALID_SURVEY");
  });
});
