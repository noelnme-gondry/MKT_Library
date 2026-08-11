"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useDataStore";

// 모바일 유입 대응 "가벼운 처방"(범위 밖 = 전면 반응형 재설계). 대시보드+전 분석
// 도구(5-x·9-x)에 viewport 폭 기준으로 정보성 배너 노출. 기능 잠금 없음(논블로킹).
// 닫기는 §12.13 피드백 넛지와 동일 패턴 — 세션 한정 메모리 플래그, localStorage 미저장
// (새로고침하면 다시 보임).
const MOBILE_QUERY = "(max-width: 768px)";

const COPY = {
  ko: {
    text: (
      <>
        📱 이 도구는 PC 화면에 최적화돼 있어요. 지금 화면에서도 쓸 수 있지만, 표·차트는
        <span style={{ color: "var(--text-primary)" }}> 넓은 화면</span>이 더 편해요.
      </>
    ),
    dismissAria: "안내 닫기",
  },
  en: {
    text: (
      <>
        📱 This tool is optimized for desktop. It still works here, but tables and charts
        are easier to read on a <span style={{ color: "var(--text-primary)" }}>wider screen</span>.
      </>
    ),
    dismissAria: "Dismiss notice",
  },
};

export default function MobileToolNudge({ locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  // SSR과 동일하게 false로 시작(hydration mismatch 회피) 후 마운트 시 실제 값 반영.
  const [isMobile, setIsMobile] = useState(false);
  const dismissed = useAppStore((state) => state.mobileNudgeDismissed);
  const dismissMobileNudge = useAppStore((state) => state.dismissMobileNudge);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(MOBILE_QUERY);
    // 마운트 시 1회 초기값 동기화(§12.26 setState-in-effect 선례와 동일 패턴), 이후는
    // change 리스너로 갱신.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(mql.matches);
    const onChange = (e) => setIsMobile(e.matches);
    // 구형 Safari 폴백(addListener) — addEventListener 없으면 조용히 스킵.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    if (typeof mql.addListener === "function") {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, []);

  if (!isMobile || dismissed) return null;

  return (
    <div role="note" data-mobile-nudge className="mobile-tool-nudge">
      <span style={{ flex: 1 }}>{T.text}</span>
      <button
        type="button"
        onClick={dismissMobileNudge}
        aria-label={T.dismissAria}
        className="mobile-tool-nudge__close"
      >
        ✕
      </button>
    </div>
  );
}
