import { describe, expect, it } from "vitest";
import { analysisToolIds, publishedToolIds } from "@/lib/routeMap";
import { TOOL_DATA_NEED_IDS, toolDataNeed } from "./toolDataNeeds";

describe("도구별 필요한 데이터 한 문장", () => {
  const published = publishedToolIds();

  it("발행 도구 전부가 KO·EN 문장을 갖는다", () => {
    expect(published.length).toBeGreaterThan(15);
    for (const id of published) {
      expect(toolDataNeed(id, "ko"), id).not.toBe("");
      expect(toolDataNeed(id, "en"), id).not.toBe("");
    }
  });

  it("발행되지 않은 도구 문장을 남겨 두지 않는다", () => {
    // 흡수된 보기(5-22)는 결과 작업대·기록이 같은 문장을 읽는다(product-ssot §4.2a).
    expect(TOOL_DATA_NEED_IDS.filter((id) => !analysisToolIds().includes(id))).toEqual([]);
  });

  it("컬럼 이름 표기(괄호 속 기술 용어·슬래시 나열)를 쓰지 않는다", () => {
    for (const id of published) {
      const ko = toolDataNeed(id, "ko");
      expect(ko, id).not.toMatch(/\((분자|분모|Creative|A\/B|Arm|0\/1)\)|\/.*\//);
      expect(ko.length, id).toBeLessThanOrEqual(40);
    }
  });
});
