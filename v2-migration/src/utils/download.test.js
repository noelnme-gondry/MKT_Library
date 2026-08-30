import { describe, expect, it } from "vitest";

import { csvBody, withAttribution } from "./download";

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

  it("does not mistake a lookalike URL for the attribution line", () => {
    const result = withAttribution("참고: https://growthoptplaybook.com.evil.example");
    expect(result).toContain("생성: Growth Opt Playbook — https://growthoptplaybook.com");
  });

  it("handles empty and nullish input without throwing", () => {
    expect(withAttribution("")).toContain("growthoptplaybook.com");
    expect(withAttribution(null)).toContain("growthoptplaybook.com");
  });
});

describe("csvBody", () => {
  // Excel이 한 행으로 뭉치거나 한글이 깨지는 두 사고가 반복돼서 조립을 한 곳으로 모았다(§7).
  it("joins with CRLF and leads with a BOM", () => {
    const csv = csvBody(["week", "value"], [["2026-W01", 10], ["2026-W02", 12]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe("\uFEFFweek,value\r\n2026-W01,10\r\n2026-W02,12\r\n");
  });

  // 캠페인명에 콤마가 흔하다. 이스케이프가 빠지면 그 행부터 열이 통째로 밀린다.
  it("quotes values that would break the column layout", () => {
    const csv = csvBody(["name", "note"], [["Brand, KR", 'He said "go"'], ["줄\n바꿈", ""]]);
    expect(csv).toContain('"Brand, KR"');
    expect(csv).toContain('"He said ""go"""');
    expect(csv).toContain('"줄\n바꿈"');
  });

  it("writes empty cells for null and undefined instead of the words", () => {
    expect(csvBody(["a", "b", "c"], [[null, undefined, 0]])).toBe("\uFEFFa,b,c\r\n,,0\r\n");
  });
});
