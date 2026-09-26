import { describe, expect, it } from "vitest";
import { EXPORT_MIN_WIDTH, exportPixelRatio } from "./FigurePngButton";

describe("캔버스 PNG 저장 배율", () => {
  it("좁은 화면일수록 배율을 올리되 2~4 안에서만", () => {
    expect(exportPixelRatio(266)).toBe(4); // 폰: 266px → 1064px
    expect(exportPixelRatio(600)).toBe(2);
    expect(exportPixelRatio(1400)).toBe(2); // 넓어도 최소 2배
    expect(exportPixelRatio(100)).toBe(4); // 상한
  });

  it("이미 화면 배율이 더 높으면 낮추지 않는다", () => {
    expect(exportPixelRatio(800, 3)).toBe(3);
  });

  it("폭을 모르면 지금 배율 그대로", () => {
    expect(exportPixelRatio(0, 1)).toBe(1);
  });

  it("폰 폭(320px 화면의 차트 266px)에서도 저장 이미지가 최소 폭 근처까지 온다", () => {
    expect(266 * exportPixelRatio(266)).toBeGreaterThan(EXPORT_MIN_WIDTH * 0.85);
  });
});
