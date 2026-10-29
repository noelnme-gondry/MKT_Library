"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackProductEvent } from "@/lib/analytics";
import { beginPartnerAdPage, isCurrentPartnerAdPage } from "@/lib/partnerAdMeasurement";

function isDisplayed(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || !element.getClientRects().length) return false;
  for (let node = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (node.hidden || style.display === "none" || ["hidden", "collapse"].includes(style.visibility)
      || style.opacity === "0" || style.contentVisibility === "hidden") return false;
  }
  return true;
}

export default function usePartnerAdView(ref, { placement, format, locale, mode }) {
  const pathname = usePathname();
  useEffect(() => {
    const element = ref.current;
    if (mode !== "live" || !element || !pathname || typeof IntersectionObserver !== "function") return;
    // 이동 중의 이전 컴포넌트·늦게 도착한 callback은 새 페이지를 측정하지 않는다.
    if (window.location.pathname !== pathname) return;
    const page = beginPartnerAdPage(pathname);
    if (page.slots.has(placement)) return;
    let stopped = false;
    let observer;
    const stop = () => {
      stopped = true;
      try { observer?.disconnect(); } catch { /* 관측 실패는 페이지 기능과 분리 */ }
      document.removeEventListener("visibilitychange", refresh);
    };
    const refresh = () => {
      if (stopped || document.visibilityState !== "visible") return;
      // 숨은 탭의 오래된 교차율 대신 복귀 시의 위치·잘린 영역을 다시 관측한다.
      try { observe(); } catch { stop(); }
    };
    const observe = () => {
      observer?.disconnect();
      const nextObserver = new IntersectionObserver(entries => {
        if (stopped || observer !== nextObserver || !isCurrentPartnerAdPage(page) || window.location.pathname !== pathname
          || document.visibilityState !== "visible" || page.slots.has(placement)) return;
        try {
          if (!entries.some(entry => entry.target === element && entry.isIntersecting && entry.intersectionRatio >= 0.5) || !isDisplayed(element)) return;
          const sent = trackProductEvent("ad_slot_view", { ad_slot: placement, ad_format: format, locale, page_path: pathname });
          if (sent) page.slots.add(placement);
          // 전송 실패는 수집 불가. 반복 재시도로 광고·분석 흐름에 부담을 주지 않는다.
          stop();
        } catch { stop(); }
      }, { threshold: [0.5] });
      // disconnect 뒤에 전달된 이전 큐도 새 관측을 대신하지 못하게 한다.
      observer = nextObserver;
      observer.observe(element);
    };
    try {
      observe();
      document.addEventListener("visibilitychange", refresh);
    } catch { stop(); }
    return stop;
  }, [ref, placement, format, locale, mode, pathname]);
}
