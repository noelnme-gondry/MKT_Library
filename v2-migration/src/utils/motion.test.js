import { describe, expect, it } from "vitest";

import { MOTION, armMotion, canAnimate, collect, disarmMotion, loadAnime, prefersReducedMotion } from "@/utils/motion";

/* node 환경(=DOM 없음)에서의 계약을 고정한다. 랜딩 모션은 렌더층 장식이라
   서버 렌더·테스트 환경에서 절대 throw 하지 않고 조용히 no-op 해야 한다. */
describe("motion utils — SSR/무DOM 안전성", () => {
  it("window가 없으면 모션 축소 판정은 false, 실행 가능 여부는 false", () => {
    expect(prefersReducedMotion()).toBe(false);
    expect(canAnimate()).toBe(false);
  });

  it("실행 불가 환경에서 loadAnime는 throw 대신 null을 돌려준다", async () => {
    await expect(loadAnime()).resolves.toBeNull();
  });

  it("arm/disarm은 잘못된 대상에도 예외를 던지지 않는다", () => {
    expect(armMotion(null)).toBe(false);
    expect(() => disarmMotion(null)).not.toThrow();
    expect(() => disarmMotion(undefined)).not.toThrow();
  });

  it("collect는 DOM이 아닌 입력에 빈 배열을 돌려준다", () => {
    expect(collect(null, ".x")).toEqual([]);
    expect(collect({}, ".x")).toEqual([]);
  });

  it("모션 토큰은 제품 전역 리듬이므로 값이 고정돼 있다", () => {
    expect(MOTION.ease).toBe("outQuart");
    expect(MOTION.fast).toBeLessThan(MOTION.base);
    expect(MOTION.base).toBeLessThan(MOTION.slow);
    expect(MOTION.stagger).toBeGreaterThan(0);
  });
});
