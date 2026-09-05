/* anime.js v4 래퍼 — 랜딩·연출 전용 모션 유틸.
 *
 * 설계 규칙 (§7 함정 반영):
 *  1) anime.js는 **동적 import**로만 로드한다. 정적 import 하면 이 모듈을 참조하는
 *     셸(Header 등)을 타고 블로그·용어사전 같은 문서 페이지까지 번들이 흘러간다
 *     (chart.js에서 이미 겪은 사고 — AGENTS.md §12.29).
 *  2) `prefers-reduced-motion: reduce`면 애니메이션을 아예 만들지 않고, 대신 요소를
 *     최종 상태로 즉시 확정한다. "모션을 끈다"가 "화면이 비어 있다"가 되면 안 된다.
 *  3) SSR(window 없음)에서는 전부 no-op. 초기 숨김 상태는 CSS가 아니라 JS가 붙이는
 *     클래스(`is-motion-armed`)로만 적용해 JS 실패 시 콘텐츠가 영구히 안 보이는
 *     상황을 만들지 않는다(점진적 향상).
 */

export const MOTION = {
  // 이징·듀레이션 토큰. 도구별로 제각각 값을 쓰면 제품 전체 리듬이 깨진다.
  ease: "outQuart",
  easeSoft: "outCubic",
  fast: 320,
  base: 520,
  slow: 900,
  stagger: 70,
  /* 초기 숨김을 유지할 최대 시간(ms). anime 청크가 이 안에 도착하지 않으면 연출을
     버리고 콘텐츠를 보여준다 — 연출보다 콘텐츠가 먼저다. 로컬·정상 회선에서는
     수십 ms면 도착하므로 실제로는 거의 발동하지 않는다. */
  armBudget: 600,
};

/** 사용자가 모션 축소를 켰는지. SSR·구형 브라우저에서는 false. */
export function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 모션을 실행해도 되는 환경인가 (DOM 있음 + 모션 축소 아님). */
export function canAnimate() {
  return typeof window !== "undefined" && typeof document !== "undefined" && !prefersReducedMotion();
}

let animePromise = null;

/**
 * anime.js v4를 지연 로드한다. 실패(오프라인 청크 로드 실패 등)하면 null을 돌려주고,
 * 호출부는 모션 없이 정상 렌더로 진행한다 — 연출 때문에 페이지가 죽으면 안 된다.
 */
export function loadAnime() {
  if (!canAnimate()) return Promise.resolve(null);
  if (!animePromise) {
    animePromise = import("animejs")
      .then((mod) => mod)
      .catch(() => null);
  }
  return animePromise;
}

/* ── DOM 헬퍼 ─────────────────────────────────────────────────────────── */

/** root 안에서 selector에 맞는 엘리먼트 배열. root 자신도 후보에 포함. */
export function collect(root, selector) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  const found = Array.from(root.querySelectorAll(selector));
  if (typeof root.matches === "function" && root.matches(selector)) found.unshift(root);
  return found;
}

/**
 * 모션 시작 전 "숨김" 상태를 JS로 부여한다. CSS에 처음부터 opacity:0을 박아두면
 * JS가 실패했을 때 콘텐츠가 영영 안 보인다.
 */
export function armMotion(root) {
  if (!root || !canAnimate()) return false;
  root.classList.add("is-motion-armed");
  return true;
}

/** 모션이 끝났거나 실행하지 않기로 했을 때 최종(보이는) 상태로 확정. */
export function disarmMotion(root) {
  if (!root) return;
  root.classList.remove("is-motion-armed");
}
