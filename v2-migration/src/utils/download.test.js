import { describe, expect, it } from "vitest";

import { withAttribution } from "./download";

describe("download attribution", () => {
  it("appends one source line to text exports", () => {
    const result = withAttribution("결론: 검색 예산을 줄이세요.\n");
    expect(result.endsWith("---\n생성: Growth Opt Playbook — https://growthoptplaybook.com\n")).toBe(true);
    expect(result.startsWith("결론: 검색 예산을 줄이세요.")).toBe(true);
  });

  it("localizes the line", () => {
    expect(withAttribution("Cut search spend.", "en")).toContain("Generated with Growth Opt Playbook");
  });

  // 재다운로드·재가공에서 출처 줄이 쌓이면 문서가 지저분해진다.
  it("does not stack when the source is already present", () => {
    const once = withAttribution("본문");
    expect(withAttribution(once)).toBe(once);
  });

  it("handles empty and nullish input without throwing", () => {
    expect(withAttribution("")).toContain("growthoptplaybook.com");
    expect(withAttribution(null)).toContain("growthoptplaybook.com");
  });
});
