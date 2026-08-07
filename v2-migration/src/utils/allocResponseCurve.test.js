import { describe, it, expect } from "vitest";
import { ALLOC_MATH } from "@/utils/allocationMath";
import { allocResponseCurve } from "@/utils/allocResponseCurve";

// fitChannel(component) 없이 wrapper 직접 구성 — predictSafeCpr가 읽는 필드만.
function wrap(points) {
  const train = points.map((p) => [p.x, p.y]);
  const model = ALLOC_MATH.fitBest(train, null);
  const xs = points.map((p) => p.x);
  return { model, kept: points, xMin: Math.min(...xs), xMax: Math.max(...xs) };
}

describe("allocResponseCurve (5-3 PRISM P4 반응 곡선 헬퍼)", () => {
  it("null wrapper / 모델 없음 → null", () => {
    expect(allocResponseCurve(null, {})).toBeNull();
    expect(allocResponseCurve({ xMin: 0, xMax: 10 }, {})).toBeNull();
  });

  it("격자점 steps+1개 + now/plan 마커가 범위 안에서 잡힌다", () => {
    // CPR 상승(수확체감): cost 100..1000, CPR = 5 + cost/500 → results 오목.
    const pts = [];
    for (let c = 100; c <= 1000; c += 100) pts.push({ x: c, y: 5 + c / 500 });
    const w = wrap(pts);
    const out = allocResponseCurve(w, { now: 300, plan: 600, steps: 40 });
    expect(out).not.toBeNull();
    expect(out.points.length).toBe(41);
    expect(out.markers.now.x).toBe(300);
    expect(out.markers.plan.x).toBe(600);
    // 결과는 음수 아님 + x 증가에 대해 단조 비감소(clamp 구간에서도).
    for (let i = 1; i < out.points.length; i++) {
      expect(out.points[i].y).toBeGreaterThanOrEqual(out.points[i - 1].y - 1e-9);
    }
    // 마커 x는 항상 (0, cap] 안.
    for (const m of Object.values(out.markers)) {
      if (m) {
        expect(m.x).toBeGreaterThan(0);
        expect(m.x).toBeLessThanOrEqual(out.cap);
      }
    }
  });

  it("CPR 일정(완전 선형 반응) → 과포화·knee 없음 (억지 마커 금지 §8)", () => {
    // results = cost/10 정확 선형 → CPR 상수 → 한계=평균 → satIndex≈1 < 1.3.
    const pts = [];
    for (let c = 100; c <= 1000; c += 100) pts.push({ x: c, y: 10 });
    const w = wrap(pts);
    const out = allocResponseCurve(w, { now: 200, plan: 500 });
    expect(out.markers.onset).toBeNull();
    expect(out.markers.knee).toBeNull();
  });

  it("강한 수확체감 → 과포화 시작(onset)이 관측 범위 안에서 잡힌다", () => {
    // CPR 급상승: results = sqrt형(오목) → 한계CPA가 평균 대비 커지는 지점 존재.
    const pts = [];
    for (let c = 100; c <= 2000; c += 100) {
      const results = 40 * Math.sqrt(c / 100); // 오목 포화
      pts.push({ x: c, y: c / results }); // y=CPR
    }
    const w = wrap(pts);
    const out = allocResponseCurve(w, { now: 300, plan: 1500 });
    expect(out.markers.onset).not.toBeNull();
    expect(out.markers.onset.x).toBeGreaterThan(0);
  });

  it("결정론 — 동일 입력 두 번 호출 시 byte-동일", () => {
    const pts = [];
    for (let c = 100; c <= 1000; c += 100) pts.push({ x: c, y: 5 + c / 500 });
    const w = wrap(pts);
    const a = allocResponseCurve(w, { now: 300, plan: 600 });
    const b = allocResponseCurve(w, { now: 300, plan: 600 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
