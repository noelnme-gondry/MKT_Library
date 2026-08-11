"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { trackProductEvent } from "@/lib/analytics";

// 데이터 준비를 어려워하는 유저를 1:1 DM 상담으로 유도하는 비차단 사이드 팝업.
// 도구 라우트(5-x·9-x)에서 데모 CSV를 본 뒤 스크롤로 조금 내려가면 우하단에
// 슬라이드-인. 화면을 가리지 않는 코너 카드(§요구: 옆에 팝업처럼). 닫기=세션 한정
// dismiss(§12.13 피드백 넛지 패턴, localStorage 미저장 → 새로고침 시 재노출).
const SCROLL_REVEAL = 400; // px — 데모를 보고 "조금 내린" 시점
const FALLBACK_MS = 15000; // 짧은 페이지 폴백(스크롤 없이도 결국 노출)
// 인스타 프로필(기존 랜딩과 동일 URL) — 프로필 진입 후 메시지. 직접 DM 딥링크가
// 필요하면 https://ig.me/m/gondry__workshop 로 교체 가능.
const IG_DM_URL = "https://www.instagram.com/gondry__workshop/";

const COPY = {
  ko: {
    aria: "데이터 준비 문의",
    close: "닫기",
    title: "내 데이터로 시작하기",
    cta: "데이터 준비를 1:1로 문의 →",
    guide: "CSV 준비 가이드 보기 →",
    guideHref: "/guide/csv-data-prep",
  },
  en: {
    aria: "Ask about data prep",
    close: "Close",
    title: "Start with your own data",
    cta: "Ask for 1:1 data prep help →",
    guide: "See the CSV prep guide →",
    guideHref: "/en/guide/csv-data-prep",
  },
};

export default function DmNudge({ locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  const dismissed = useAppStore((s) => s.dmNudgeDismissed);
  const dismiss = useAppStore((s) => s.dismissDmNudge);
  const from = useAppStore((s) => s.currentRouteId);
  const csvData = useAppStore((s) => s.csvData);
  const isDemo = String(csvData?.fileName || "").startsWith("demo_");
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(false); // 진입 애니메이션 트리거
  const viewSent = useRef(false);

  // 스크롤 임계 도달 또는 폴백 타이머로 1회 노출.
  useEffect(() => {
    if (dismissed || !isDemo) return;
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setVisible(true);
      window.removeEventListener("scroll", onScroll);
    };
    const onScroll = () => {
      if (window.scrollY > SCROLL_REVEAL) reveal();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const t = setTimeout(reveal, FALLBACK_MS);
    if (window.scrollY > SCROLL_REVEAL) reveal(); // 이미 스크롤된 채 진입한 경우
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, [dismissed, isDemo]);

  // 노출되면 진입 애니메이션 + GA view 이벤트(1회).
  useEffect(() => {
    if (!visible) return;
    const id = requestAnimationFrame(() => setShown(true));
    // raw gtag를 직접 부르면 analytics.js의 파라미터 화이트리스트를 우회한다.
    // (`from`은 허용 목록 밖이라 조용히 버려지기도 한다) → 공용 계측 경로로 통일.
    if (!viewSent.current) {
      viewSent.current = true;
      trackProductEvent("dm_nudge_view", { tool_id: from, placement: "dm_nudge" });
    }
    return () => cancelAnimationFrame(id);
  }, [visible, from]);

  if (dismissed || !isDemo || !visible) return null;

  const onCta = () => {
    trackProductEvent("dm_open", { tool_id: from, placement: "dm_nudge" });
  };

  return (
    <div
      role="complementary"
      aria-label={T.aria}
      data-dm-nudge
      className={`dm-nudge ${shown ? "is-visible" : ""}`}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={T.close}
        className="dm-nudge__close"
      >
        ✕
      </button>
      <div className="dm-nudge__title">
        {T.title}
      </div>
      <a
        href={IG_DM_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onCta}
        className="dm-nudge__cta"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {T.cta}
      </a>
      {/* 덜 강조된 자기서비스 탈출구 — DM 대신 직접 가이드로. */}
      <Link
        href={T.guideHref}
        onClick={() => {
          trackProductEvent("dm_guide_open", { tool_id: from, placement: "dm_nudge" });
        }}
        className="dm-nudge__guide"
      >
        {T.guide}
      </Link>
    </div>
  );
}
