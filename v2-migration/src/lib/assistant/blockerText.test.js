import { describe, it, expect } from "vitest";
import { blockersText, blockerFieldLabels } from "@/lib/assistant/blockerText";

/**
 * 자격 판정기가 두 벌이라(§7 "같은 이름의 엔진이 두 벌") 결과 모양이 다르다.
 * 실제로 `analysis-router` 쪽 포매터를 `assistant` 결과에 끼웠다가 `undefined.join`으로
 * /start가 통째로 죽었다. 모양을 여기서 고정한다.
 */
describe("blockersText", () => {
  it("빠진 컬럼을 사람이 읽는 라벨로 말한다", () => {
    const result = { blockers: [{ code: "missing_fields", alternatives: [["cost"]] }], missing: ["cost"] };
    const ko = blockersText(result, "ko");
    expect(ko.startsWith("필요: ")).toBe(true);
    // 내부 키를 그대로 내보내지 않는다 — 사용자는 자기 CSV 컬럼명으로 생각한다.
    expect(ko).not.toContain("cost");
    expect(blockerFieldLabels(result, "ko")).toHaveLength(1);
  });

  it("alternatives만 있고 missing이 비어도 죽지 않는다", () => {
    const result = { blockers: [{ code: "missing_fields", alternatives: [["cost"]] }] };
    expect(() => blockersText(result, "ko")).not.toThrow();
    expect(blockerFieldLabels(result, "ko")).toEqual([]);
  });

  it("analysis-router 모양(fields)을 받아도 던지지 않는다", () => {
    // 두 엔진을 바꿔 끼운 실제 사고의 재현 — 문구는 덜 구체적이어도 화면은 살아야 한다.
    const routerShape = { blockers: [{ code: "missing_fields", fields: ["cost"] }] };
    expect(() => blockersText(routerShape, "ko")).not.toThrow();
    expect(() => blockersText(routerShape, "en")).not.toThrow();
  });

  it("행·기간 부족은 현재 값과 필요한 값을 함께 말한다", () => {
    expect(blockersText({ blockers: [{ code: "min_rows", required: 30, current: 4 }] }, "ko")).toContain("30");
    expect(blockersText({ blockers: [{ code: "min_rows", required: 30, current: 4 }] }, "ko")).toContain("4");
    expect(blockersText({ blockers: [{ code: "min_periods", required: 8 }] }, "en")).toContain("8");
  });

  it("막힌 이유를 모르면 지어내지 않는다", () => {
    expect(blockersText({ blockers: [] }, "ko")).toContain("확인");
    expect(blockersText({ blockers: [{ code: "something_new" }] }, "ko")).toContain("추가 데이터");
  });

  it("EN은 한글 없이 답한다", () => {
    for (const blocker of [{ code: "missing_fields", alternatives: [["cost"]] }, { code: "grain_mismatch" }, { code: "no_rows" }, { code: "min_rows", required: 3, current: 1 }]) {
      expect(blockersText({ blockers: [blocker], missing: ["cost"] }, "en")).not.toMatch(/[가-힣]/);
    }
  });
});
