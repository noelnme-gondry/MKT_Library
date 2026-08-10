/* 랜딩 진입 모션 오케스트레이션 (anime.js v4).
 *
 * 트리거는 anime의 스크롤 옵저버가 아니라 **네이티브 IntersectionObserver**를 쓴다.
 * 이미 뷰포트 안에 있는 요소에도 즉시 발화하는 동작이 명확해서, "스크롤을 안 했더니
 * 섹션이 영영 투명하게 남는" 사고를 구조적으로 막을 수 있다. 실제 애니메이션(스태거·
 * 이징·SVG draw)만 anime이 담당한다.
 *
 * 실패 안전: anime 로드 실패·모션 축소 설정이면 `is-motion-armed`를 즉시 벗겨
 * 정적 최종 상태로 보여준다(점진적 향상).
 */

import { MOTION, armMotion, canAnimate, collect, disarmMotion, loadAnime } from "@/utils/motion";

/* 스크롤 진입 시 순차 등장시킬 그룹. 셀렉터는 LandingPage.jsx의 실제 클래스와 1:1.
 * 주의: `.dc-return`(지난 판단 패널)은 store 하이드레이션 이후에 조건부로 나타난다.
 * 마운트 시점에 옵저버를 달 수 없어 "숨긴 채 영영 안 나오는" 위험이 있으므로 모션
 * 대상에서 제외한다 — 항상 렌더되는 섹션만 관리한다. */
const REVEAL_GROUPS = [
  ".dc-loop__grid .dc-loop-card",
  ".dc-question-grid .dc-question-card",
  ".dc-library__grid .dc-library-card",
  ".dc-resource-strip",
];

/* 섹션 헤더(eyebrow + 제목 + 데크)는 카드보다 살짝 먼저 올라온다. */
const REVEAL_HEADS = [".dc-section-head"];

/**
 * 랜딩 루트에 진입 모션을 붙인다.
 * @param {HTMLElement|null} root `.decision-console-landing` 엘리먼트
 * @returns {() => void} cleanup — 언마운트·로케일 전환 시 반드시 호출
 */
export function runLandingMotion(root) {
  if (!root) return () => {};
  if (!canAnimate()) {
    disarmMotion(root);
    return () => {};
  }

  armMotion(root);

  let cancelled = false;
  const observers = [];
  const animations = [];

  loadAnime().then((anime) => {
    if (cancelled) return;
    if (!anime) {
      // 청크 로드 실패 — 모션 없이 최종 상태로 확정하고 조용히 끝낸다.
      disarmMotion(root);
      return;
    }

    const { animate, createTimeline, stagger, svg } = anime;

    /* ── 1. 히어로 진입 타임라인 ─────────────────────────────────────── */
    const tl = createTimeline({ defaults: { ease: MOTION.ease, duration: MOTION.base } });
    const heroStep = (selector, params, position) => {
      const targets = collect(root, selector);
      if (targets.length) tl.add(targets, params, position);
    };

    heroStep(".dc-hero__copy .dc-eyebrow", { opacity: [0, 1], y: [10, 0], duration: MOTION.fast });
    heroStep("#dc-hero-title span", { opacity: [0, 1], y: [26, 0], delay: stagger(90) }, "-=200");
    heroStep(".dc-hero__deck", { opacity: [0, 1], y: [16, 0] }, "-=340");
    heroStep(".dc-hero__trust li", { opacity: [0, 1], y: [10, 0], scale: [0.94, 1], duration: MOTION.fast, delay: stagger(60) }, "-=300");
    heroStep(".dc-hero__actions .dc-action-route", { opacity: [0, 1], y: [18, 0], delay: stagger(80) }, "-=240");
    heroStep(".dc-hero__utility-actions, .dc-privacy", { opacity: [0, 1], y: [10, 0], duration: MOTION.fast, delay: stagger(60) }, "-=260");
    heroStep(".dc-instrument", { opacity: [0, 1], y: [28, 0], scale: [0.985, 1], duration: MOTION.slow }, 120);
    animations.push(tl);

    /* ── 2. 히어로 미니차트 SVG 라인 드로잉 ──────────────────────────── */
    const paths = collect(root, ".dc-mini-chart path");
    if (paths.length && typeof svg?.createDrawable === "function") {
      // baseline(비교선)을 먼저, primary(실적선)를 뒤에 그려 시선이 실적선에서 멈추게 한다.
      const ordered = [...paths].sort((a, b) => {
        const score = (el) => (el.classList.contains("dc-chart-baseline") ? 0 : 1);
        return score(a) - score(b);
      });
      animations.push(
        animate(svg.createDrawable(ordered), {
          draw: ["0 0", "0 1"],
          // armed 상태에서 opacity:0으로 숨겨 두므로, 그리기 시작과 함께 짧게 띄운다.
          // (draw 트윈은 지연 중 from-state를 보장하지 않아 순간 노출이 생길 수 있음)
          opacity: { from: 0, to: 1, duration: MOTION.fast },
          duration: MOTION.slow,
          ease: "inOutQuad",
          delay: stagger(220, { start: 420 }),
        }),
      );
    }
    const endpoint = collect(root, ".dc-mini-chart circle");
    if (endpoint.length) {
      animations.push(
        animate(endpoint, {
          opacity: [0, 1],
          scale: [0, 1],
          duration: MOTION.fast,
          ease: "outBack",
          delay: 1180,
        }),
      );
      // 최신 데이터 지점을 아주 약하게 맥동시켜 "살아 있는 화면"으로 읽히게 한다.
      animations.push(
        animate(endpoint, {
          r: [4, 5.4],
          duration: 1400,
          ease: "inOutSine",
          loop: true,
          alternate: true,
          delay: 1600,
        }),
      );
    }

    /* ── 3. 스크롤 진입 리빌 ─────────────────────────────────────────── */
    const revealOnce = (targets, params) => {
      if (!targets.length) return;
      if (typeof window.IntersectionObserver !== "function") {
        animations.push(animate(targets, params));
        return;
      }
      const pending = new Set(targets);
      const observer = new window.IntersectionObserver(
        (entries) => {
          const arrived = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
          if (!arrived.length) return;
          arrived.forEach((el) => {
            pending.delete(el);
            observer.unobserve(el);
          });
          animations.push(animate(arrived, params));
          if (!pending.size) observer.disconnect();
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
      );
      targets.forEach((el) => observer.observe(el));
      observers.push(observer);
    };

    REVEAL_HEADS.forEach((selector) => {
      revealOnce(collect(root, selector), {
        opacity: [0, 1],
        y: [18, 0],
        duration: MOTION.base,
        ease: MOTION.easeSoft,
      });
    });
    REVEAL_GROUPS.forEach((selector) => {
      revealOnce(collect(root, selector), {
        opacity: [0, 1],
        y: [24, 0],
        duration: MOTION.base,
        ease: MOTION.ease,
        delay: stagger(MOTION.stagger),
      });
    });
  });

  return () => {
    cancelled = true;
    observers.forEach((observer) => observer.disconnect());
    animations.forEach((instance) => {
      // anime v4 인스턴스는 revert()로 인라인 스타일까지 원복된다.
      if (typeof instance?.revert === "function") instance.revert();
      else if (typeof instance?.pause === "function") instance.pause();
    });
    disarmMotion(root);
  };
}
