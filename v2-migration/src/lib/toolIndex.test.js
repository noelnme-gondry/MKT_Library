import { describe, expect, it } from "vitest";
import { allToolIndexEntries, PUBLISHED_TOOL_IDS, toolIndexByStage, toolIndexEntry } from "@/lib/toolIndex";

describe("toolIndex", () => {
  it("발행된 분석 도구를 하나도 빠뜨리지 않는다", () => {
    // 스테이지에 등록하지 않은 도구는 목록 어디에도 안 나온다 = 영영 못 찾는다.
    const listed = allToolIndexEntries().map((entry) => entry.id).sort();
    expect(listed).toEqual([...PUBLISHED_TOOL_IDS].sort());
  });

  it("같은 도구를 두 스테이지에 넣지 않는다", () => {
    const ids = allToolIndexEntries().map((entry) => entry.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it.each(["ko", "en"])("%s 모든 항목이 이름·질문·답을 갖는다", (locale) => {
    // 짧은 이름을 쓰기로 한 이상, 질문과 답이 비면 무엇을 하는 도구인지 알 길이 없다.
    const missing = allToolIndexEntries(locale)
      .filter((entry) => !entry.name || !entry.question || !entry.answer)
      .map((entry) => entry.id);
    expect(missing, `이름·질문·답 누락: ${missing.join(", ")}`).toEqual([]);
  });

  it("모든 항목이 실재하는 경로를 가리킨다", () => {
    for (const entry of allToolIndexEntries()) {
      expect(entry.href, entry.id).toMatch(/^\/[a-z0-9/-]+$/);
      expect(entry.href, `${entry.id}가 홈으로 폴백됨`).not.toBe("/");
    }
  });

  it("필요한 컬럼을 사람이 읽는 라벨로 낸다", () => {
    const entry = toolIndexEntry("5-27");
    expect(entry.needs.length).toBeGreaterThan(0);
    // 표준키(store_source)가 그대로 노출되면 안 된다.
    expect(entry.needs.join(" ")).not.toMatch(/_/);
  });

  it("발행되지 않은 id는 null", () => {
    expect(toolIndexEntry("9-2")).toBeNull();
    expect(toolIndexEntry("없는-id")).toBeNull();
  });

  it("스테이지 순서는 여정 순서를 따른다", () => {
    expect(toolIndexByStage().map((stage) => stage.id)).toEqual(["monitor", "explain", "choose", "prove", "learn"]);
  });
});
