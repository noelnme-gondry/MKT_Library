import { describe, expect, it } from "vitest";
import { figureExportContext, figureHeaderLayout, wrapFigureText } from "./figureExportContext";

describe("figure export context", () => {
  it("keeps the actual comparison dates, sample status and withheld judgement", () => {
    expect(figureExportContext({ title: "iOS 구성 변화", toolTitle: "구성 분석", scope: { dateStart: "2026-08-08", dateEnd: "2026-08-14", comparisonStart: "2026-08-01", comparisonEnd: "2026-08-07" }, source: { importSource: "demo" }, resultState: "inconclusive" })).toEqual({
      title: "iOS 구성 변화", details: ["구성 분석", "분석 기간: 2026-08-08 – 2026-08-14", "비교 기간: 2026-08-01 – 2026-08-07", "예시 데이터", "판단 보류. 결과의 해석 조건을 함께 확인하세요."],
    });
  });
  it("does not turn the download date into an unknown analysis period", () => {
    expect(figureExportContext({ title: "Trend", toolTitle: "Trend", locale: "en", resultState: "ready" })).toEqual({ title: "Trend", details: [] });
  });
  it("wraps complete words first, and long unbroken labels only when necessary", () => {
    const measure = value => value.length * 10;
    expect(wrapFigureText("기간과 단위를 확인", 70, measure)).toEqual(["기간과 단위를", "확인"]);
    expect(wrapFigureText("abcdefghijk", 40, measure)).toEqual(["abcd", "efgh", "ijk"]);
  });
  it("reserves enough vertical space for narrow export titles and context", () => {
    const ctx = { measureText: value => ({ width: value.length * 8 }) };
    const header = figureHeaderLayout(ctx, { title: "A long analysis title", details: ["Period: 2026-08-08 – 2026-08-14"] }, 140, "sans-serif");
    expect(header.lines.length).toBeGreaterThan(2);
    expect(header.lines.every(line => ctx.measureText(line.text).width <= 108)).toBe(true);
    expect(header.height).toBeGreaterThan(header.lines.at(-1).y + 13);
  });
});
