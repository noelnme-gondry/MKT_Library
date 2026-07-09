"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// SPA(App Router) 라우트 변경 시 GA4 page_view 전송. next/link 소프트 내비는 페이지
// 리로드가 없어 layout의 gtag('config')가 최초 1회만 발화 → 인앱 링크로 이동한 딥
// 페이지(/content/* 등)가 GA에 "추적 안 됨"으로 보이던 문제 해결. 최초 로드는 config가
// 이미 page_view를 보내므로 건너뛰고, 이후 경로 변경만 수동 전송(초기 중복 방지).
const GA_ID = "G-DK12TNR0GW";

export default function GaPageviews() {
  const pathname = usePathname();
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: typeof document !== "undefined" ? document.title : undefined,
      send_to: GA_ID,
    });
  }, [pathname]);
  return null;
}
