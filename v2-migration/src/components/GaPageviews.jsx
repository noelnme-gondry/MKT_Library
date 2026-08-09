"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { resolvePathToId } from "@/lib/routeMap";
import { trackProductEvent } from "@/lib/analytics";

// SPA(App Router) page_view SSOT. layout의 config는 send_page_view:false라서,
// 최초 진입과 history 변경 모두 여기서 정확히 한 번 보낸다. GA enhanced measurement나
// GTM의 별도 history trigger까지 켜면 다시 중복되므로 이 경로만 유지한다.
const GA_ID = "G-DK12TNR0GW";
const GA_READY_RETRY_MS = 250;
const GA_READY_MAX_ATTEMPTS = 20;

function runWhenGtagReady(callback) {
  let attempts = 0;
  let timerId = null;
  const trySend = () => {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      callback();
      return;
    }
    attempts += 1;
    if (attempts < GA_READY_MAX_ATTEMPTS && typeof window !== "undefined") {
      timerId = window.setTimeout(trySend, GA_READY_RETRY_MS);
    }
  };
  trySend();
  return () => {
    if (timerId != null && typeof window !== "undefined") window.clearTimeout(timerId);
  };
}

export default function GaPageviews() {
  const pathname = usePathname();
  const lastPagePath = useRef(null);
  const lastToolPath = useRef(null);
  useEffect(() => {
    if (lastPagePath.current === pathname) return;
    return runWhenGtagReady(() => {
      if (lastPagePath.current === pathname) return;
      window.gtag("event", "page_view", {
        page_path: pathname,
        page_location: window.location.href,
        page_title: typeof document !== "undefined" ? document.title : undefined,
        send_to: GA_ID,
      });
      lastPagePath.current = pathname;
    });
  }, [pathname]);

  // page_view는 페이지 단위, tool_view는 제품 퍼널 단위다. 최초 진입도 기록하되
  // 같은 history path를 Strict Mode/재렌더로 중복 기록하지 않는다.
  useEffect(() => {
    const toolId = resolvePathToId(pathname);
    if (!toolId || !/^(5|9)-/.test(toolId) || lastToolPath.current === pathname) return;
    return runWhenGtagReady(() => {
      if (lastToolPath.current === pathname) return;
      const sent = trackProductEvent("tool_view", { tool_id: toolId, source: "route", locale: pathname.startsWith("/en/") ? "en" : "ko" });
      if (sent) lastToolPath.current = pathname;
    });
  }, [pathname]);
  return null;
}
