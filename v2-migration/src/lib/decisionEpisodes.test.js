import { describe, expect, it } from "vitest";
import {
  DECISION_REVIEW_SCHEMA_VERSION,
  appendDecisionEpisode,
  decisionEpisodeList,
  parseDecisionEpisodes,
  sanitizeDecisionReviewRecord,
  serializeDecisionEpisodes,
} from "./decisionReview";

// v11 관측 이력. 한 결정은 여러 번 관측되는데 `actual`·`learning`이 레코드당 한
// 칸뿐이라 두 번째 관측이 첫 관측을 말없이 덮어썼다(5-18 예측의 "관측값 적용"에는
// 완료 게이트조차 없었다). 이 골든이 지키는 계약은 셋이다:
//   ① 자유 텍스트가 구분자를 품어도 왕복에서 살아 돌아온다
//   ② 관측을 더해도 앞의 관측이 남는다
//   ③ `actual`은 최신 관측의 미러다(소비처 13곳이 그대로 동작하는 근거)
describe("관측 이력은 덮어쓰지 않고 쌓인다", () => {
  it("긴 한글 관측도 최신 항목을 온전히 보존하고 저장 왕복이 안정적이다", () => {
    let record = { action: "예산 점검", toolId: "5-3" };
    for (let index = 0; index < 8; index += 1) {
      record = { ...record, ...appendDecisionEpisode(record, {
        actual: `${index}주차 ${"관측".repeat(70)}`,
        learning: "배운점".repeat(100),
      }) };
    }
    const restored = sanitizeDecisionReviewRecord(record);
    const latest = decisionEpisodeList(restored).at(-1);
    expect(latest.actual).toBe(record.actual);
    expect(latest.learning).toBe(record.learning);
    expect(restored.episodes).toBe(record.episodes);
    expect(decisionEpisodeList(restored)).toHaveLength(8);
  });
  it("관측 이력과 분석 근거를 보존하는 v13 스키마다", () => {
    expect(DECISION_REVIEW_SCHEMA_VERSION).toBe(14);
  });

  it("구분자·줄바꿈·콤마가 든 자유 텍스트가 왕복에서 그대로 살아온다", () => {
    // 가드레일(v10)은 지표명·연산자·숫자라 구분자가 섞일 일이 없었지만 관측은
    // 사람이 쓰는 문장이다. 이 입력이 인코딩 없이는 세 조각으로 찢어진다.
    const actual = "CPA 1,200원; 목표 미달|재검토";
    const learning = "다음엔\n둘로 나눠 본다";
    const serialized = serializeDecisionEpisodes([{ observedAt: "2026-09-16T00:00:00.000Z", actual, learning }]);
    expect(serialized).not.toContain("목표 미달|재검토");   // 원문이 날것으로 들어가지 않는다
    const [episode] = parseDecisionEpisodes(serialized);
    expect(episode.actual).toBe(actual);
    expect(episode.learning).toBe(learning);
  });

  it("두 번째 관측이 첫 관측을 덮지 않는다", () => {
    const first = appendDecisionEpisode({}, { actual: "1주차 CPA 1,200원", learning: "아직 이르다" });
    const second = appendDecisionEpisode({ ...first }, { actual: "2주차 CPA 950원", learning: "내려가기 시작" });
    const list = parseDecisionEpisodes(second.episodes);
    expect(list).toHaveLength(2);
    expect(list[0].actual).toBe("1주차 CPA 1,200원");
    expect(list[1].actual).toBe("2주차 CPA 950원");
  });

  it("actual·learning은 최신 관측의 미러다", () => {
    const first = appendDecisionEpisode({}, { actual: "1주차", learning: "A" });
    const second = appendDecisionEpisode({ ...first }, { actual: "2주차", learning: "B" });
    expect(second.actual).toBe("2주차");
    expect(second.learning).toBe("B");
  });

  it("v10 레코드는 기존 한 벌을 첫 관측으로 읽는다", () => {
    const list = decisionEpisodeList({ actual: "옛 관측", learning: "옛 배움", reviewedAt: "2026-09-01T00:00:00.000Z" });
    expect(list).toHaveLength(1);
    expect(list[0].actual).toBe("옛 관측");
    expect(list[0].observedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("episodes가 있으면 actual 미러를 다시 더하지 않는다", () => {
    // 미러를 또 세면 최신 관측이 두 번 나온다 — 이 설계에서 제일 쉬운 실수다.
    const patch = appendDecisionEpisode({}, { actual: "한 번만" });
    const list = decisionEpisodeList({ episodes: patch.episodes, actual: patch.actual, learning: patch.learning });
    expect(list).toHaveLength(1);
  });

  it("관측 내용이 없으면 에피소드가 되지 않는다", () => {
    expect(appendDecisionEpisode({}, { learning: "배움만 있고 관측이 없다" })).toBeNull();
    expect(parseDecisionEpisodes("2026-09-16T00:00:00.000Z||")).toEqual([]);
  });

  it("12개를 넘으면 오래된 것부터 버리고 최신을 남긴다", () => {
    let record = {};
    for (let index = 1; index <= 15; index += 1) {
      record = { ...record, ...appendDecisionEpisode(record, { actual: `관측 ${index}` }) };
    }
    const list = parseDecisionEpisodes(record.episodes);
    expect(list).toHaveLength(12);
    expect(list[0].actual).toBe("관측 4");
    expect(list[11].actual).toBe("관측 15");
    expect(record.actual).toBe("관측 15");
  });

  it("sanitize가 이력을 보존한다(저장·CSV 왕복의 근거)", () => {
    const patch = appendDecisionEpisode({}, { actual: "관측; 하나", learning: "배움|둘" });
    const record = sanitizeDecisionReviewRecord({ action: "예산 20% 증액", ...patch });
    expect(record.episodes).toBe(patch.episodes);
    const [episode] = parseDecisionEpisodes(record.episodes);
    expect(episode.actual).toBe("관측; 하나");
    expect(episode.learning).toBe("배움|둘");
  });

  it("손상된 퍼센트 시퀀스를 만나도 던지지 않는다", () => {
    const list = parseDecisionEpisodes("2026-09-16T00:00:00.000Z|%E0%A4%A|x");
    expect(list).toHaveLength(1);
    expect(list[0].actual).toBe("%E0%A4%A");
  });
});
