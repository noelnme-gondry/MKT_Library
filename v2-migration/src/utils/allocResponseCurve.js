import { ALLOC_MATH } from "@/utils/allocationMath";
import { SAT_CONFIG } from "@/utils/satMath";

/*
 * 채널 반응 곡선(PRISM 뷰 P4) — 순수 렌더 헬퍼(골든 아님, 엔진 수학 불변).
 * x = 일 지출, y = 예상 결과수(= x / predictSafeCpr(x)). 곡선은 이미 골든으로 잠긴
 * ALLOC_MATH.predictSafeCpr 재사용이라 새 수학 없음.
 *
 * 마커 4종:
 *  - now   : 최근 실제 일 지출(관측 현재점)
 *  - plan  : 이 도구가 배분한 일 지출(계획점)
 *  - knee  : 효율 최적 — 한계수확(₩당 결과)이 정점의 kneeFrac 이하로 처음 떨어지는 지출
 *            (수확체감/오목 곡선에서만 존재, 아니면 null — 억지 마커 금지 §8)
 *  - onset : 과포화 시작 — 국소 한계CPA / 평균CPA ≥ satHigh 가 처음 성립하는 지출
 *            (관측+추정 범위 안에서 안 넘으면 null — 정직)
 *
 * satHigh 는 5-22 SAT_CONFIG 와 동일 임계 재사용(도구 간 포화 정의 정합).
 */
export function allocResponseCurve(wrapper, opts = {}) {
  const {
    now = 0,
    plan = 0,
    steps = 60,
    capMult = 1.15,
    satHigh = SAT_CONFIG.satHigh,
    kneeFrac = 0.5,
  } = opts;
  if (!wrapper || !wrapper.model) return null;
  const xMin = wrapper.xMin != null ? wrapper.xMin : 0;
  const xMax = wrapper.xMax != null ? wrapper.xMax : 0;
  const cap = Math.max(xMax * capMult, plan * 1.1, now * 1.1, xMax, 1);
  if (!(cap > 0) || !(steps > 1)) return null;

  const resultsAt = (x) => {
    if (!(x > 0)) return 0;
    const cpr = ALLOC_MATH.predictSafeCpr(wrapper, x);
    return isFinite(cpr) && cpr > 0 ? x / cpr : 0;
  };

  const points = [];
  const dx = cap / steps;
  for (let i = 0; i <= steps; i++) {
    const x = i * dx;
    points.push({ x, y: resultsAt(x) });
  }

  // 국소 한계수확(₩당 추가 결과) — 인접 격자점 차분.
  const marg = new Array(points.length).fill(0);
  let peakMarginal = 0;
  let peakIdx = 0;
  for (let i = 1; i < points.length; i++) {
    const d = points[i].x - points[i - 1].x;
    const dr = points[i].y - points[i - 1].y;
    marg[i] = d > 0 ? dr / d : 0;
    if (marg[i] > peakMarginal) {
      peakMarginal = marg[i];
      peakIdx = i;
    }
  }

  // knee: 정점 이후 한계수확이 정점의 kneeFrac 미만으로 처음 떨어지는 x.
  let knee = null;
  if (peakMarginal > 0) {
    for (let i = peakIdx + 1; i < points.length; i++) {
      if (marg[i] < peakMarginal * kneeFrac) {
        knee = points[i].x;
        break;
      }
    }
  }

  // onset: 국소 한계CPA / 평균CPA ≥ satHigh 첫 지출(한계효용 ≤ 0 이면 Infinity → 즉시 성립).
  let onset = null;
  for (let i = 1; i < points.length; i++) {
    const x = points[i].x;
    const avgRes = points[i].y;
    if (!(x > 0) || !(avgRes > 0)) continue;
    const avgCpr = x / avgRes;
    if (!(avgCpr > 0)) continue;
    const marginalCpr = marg[i] > 1e-12 ? 1 / marg[i] : Infinity;
    if (marginalCpr / avgCpr >= satHigh) {
      onset = x;
      break;
    }
  }

  const mark = (v) => (v > 0 && v <= cap ? { x: v, y: resultsAt(v) } : null);
  return {
    points,
    xMin,
    xMax,
    cap,
    markers: {
      now: mark(now),
      plan: mark(plan),
      knee: knee != null ? { x: knee, y: resultsAt(knee) } : null,
      onset: onset != null ? { x: onset, y: resultsAt(onset) } : null,
    },
  };
}
