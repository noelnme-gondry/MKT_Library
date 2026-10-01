import { describe, expect, it } from "vitest";
import { EXPORT_MIN_WIDTH, exportPixelRatio } from "./FigurePngButton";

describe("캔버스 PNG 저장 배율", () => {
  it("좁은 화면일수록 배율을 올리되 2~6 안에서만", () => {
    expect(exportPixelRatio(266)).toBe(5); // 폰: 266px → 1330px
    expect(exportPixelRatio(600)).toBe(2);
    expect(exportPixelRatio(1400)).toBe(2); // 넓어도 최소 2배
    expect(exportPixelRatio(100)).toBe(6); // 메모리 상한
  });

  it("이미 화면 배율이 더 높으면 낮추지 않는다", () => {
    expect(exportPixelRatio(800, 3)).toBe(3);
  });

  it("폭을 모르면 지금 배율 그대로", () => {
    expect(exportPixelRatio(0, 1)).toBe(1);
  });

  it.each([232, 266])("폰의 패딩을 제외한 차트 폭 %ipx에서도 저장 최소 폭을 충족한다", (width) => {
    expect(width * exportPixelRatio(width)).toBeGreaterThanOrEqual(EXPORT_MIN_WIDTH);
  });
});
