import { ALLOC_MATH } from "@/utils/allocationMath";
import { SAT_CONFIG } from "@/utils/satMath";

// 곡선 선분이 관측 지출 범위를 하나라도 벗어나는지 판별한다. Chart.js는 선분 단위로
// 스타일을 적용하므로, 양 끝점 모두가 [xMin, xMax] 안일 때만 관측 구간으로 취급한다.
export function isAllocCurveSegmentEstimated(x0, x1, xMin, xMax) {
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  return lo < xMin || hi > xMax;
}

/*
 * 채널 반응 곡선(PRISM 뷰 P4) — 순수 렌더 헬퍼(골든 아님, 엔진 수학 불변).
 * x = 일 지출, y = 예상 결과수(= x / predictSafeCpr(x)). 곡선은 이미 골든으로 잠긴
 * ALLOC_MATH.predictSafeCpr 재사용이라 새 수학 없음.
 *
 * 마커 4종:
 *  - now   : 최근 실제 일 지출에서의 모형 예측 결과
 *  - plan  : 이 도구가 배분한 일 지출(계획점)
 *  - knee  : 관측 구간 내 최대 한계효율 대비 하락 지점 — 한계수확(₩당 결과)이 정점의 kneeFrac 이하로 처음 떨어지는 지출
 *            (수확체감/오목 곡선에서만 존재, 아니면 null — 억지 마커 금지 §8)
 *  - onset : 관측 구간에서 국소 한계CPA / 평균CPA가 satHigh를 아래에서 넘는 첫 격자점
 *            (첫 관측 구간부터 초과하면 시작점 식별 불가 → null)
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

  // 진단은 관측 범위 안의 독립 격자만 사용한다. 0~xMin / xMax~cap의
  // clamp 연결부와 사용자 계획 금액은 진단 임계·최댓값을 바꾸면 안 된다.
  const observed = xMax > xMin && xMin >= 0
    ? Array.from({ length: steps + 1 }, (_, i) => {
      const x = xMin + (xMax - xMin) * i / steps;
      return { x, y: resultsAt(x) };
    }) : [];
  // 국소 한계수확(₩당 추가 결과) — 인접 격자점 차분.
  const marg = new Array(observed.length).fill(0);
  let peakMarginal = 0;
  let peakIdx = 0;
  for (let i = 1; i < observed.length; i++) {
    const d = observed[i].x - observed[i - 1].x;
    const dr = observed[i].y - observed[i - 1].y;
    marg[i] = d > 0 ? dr / d : 0;
    if (marg[i] > peakMarginal) {
      peakMarginal = marg[i];
      peakIdx = i;
    }
  }

  // knee: 정점 이후 한계수확이 정점의 kneeFrac 미만으로 처음 떨어지는 x.
  let knee = null;
  if (peakMarginal > 0) {
    for (let i = peakIdx + 1; i < observed.length; i++) {
      if (marg[i] < peakMarginal * kneeFrac) {
        knee = observed[i].x;
        break;
      }
    }
  }

  // onset: 관측 안에서 기준 아래→위로 넘는 경우만. 첫 구간부터 초과하면 시작점 미식별.
  let onset = null;
  let status = "unavailable";
  for (let i = 1; i < observed.length; i++) {
    const x = observed[i].x;
    const avgRes = observed[i].y;
    if (!(x > 0) || !(avgRes > 0)) continue;
    const avgCpr = x / avgRes;
    if (!(avgCpr > 0)) continue;
    const marginalCpr = marg[i] > 1e-12 ? 1 / marg[i] : Infinity;
    const above = marginalCpr / avgCpr >= satHigh;
    if (status === "unavailable" && above) {
      status = "above_at_start";
      break;
    }
    if (above) {
      onset = x;
      status = "crossing";
      break;
    }
    status = "below_threshold";
  }

  const mark = (v) => (v > 0 && v <= cap ? { x: v, y: resultsAt(v) } : null);
  return {
    points,
    xMin,
    xMax,
    cap,
    saturation: { status, threshold: satHigh },
    kneeFraction: kneeFrac,
    markers: {
      now: mark(now),
      plan: mark(plan),
      knee: knee != null ? { x: knee, y: resultsAt(knee) } : null,
      onset: onset != null ? { x: onset, y: resultsAt(onset) } : null,
    },
  };
}
