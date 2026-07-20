"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { resolvePathToId } from "@/lib/routeMap";
import { trackProductEvent } from "@/lib/analytics";

// SPA(App Router) page_view SSOT. layout의 config는 send_page_view:false라서,
// 최초 진입과 history 변경 모두 여기서 정확히 한 번 보낸다. GA enhanced measurement나
// GTM의 별도 history trigger까지 켜면 다시 중복되므로 이 경로만 유지한다.
const GA_ID = "G-DK12TNR0GW";

export default function GaPageviews() {
  const pathname = usePathname();
  const lastPagePath = useRef(null);
  const lastToolPath = useRef(null);
  useEffect(() => {
    if (lastPagePath.current === pathname) return;
    lastPagePath.current = pathname;
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: typeof document !== "undefined" ? document.title : undefined,
      send_to: GA_ID,
    });
  }, [pathname]);

  // page_view는 페이지 단위, tool_view는 제품 퍼널 단위다. 최초 진입도 기록하되
  // 같은 history path를 Strict Mode/재렌더로 중복 기록하지 않는다.
  useEffect(() => {
    const toolId = resolvePathToId(pathname);
    if (!toolId || !/^(5|9)-/.test(toolId) || lastToolPath.current === pathname) return;
    lastToolPath.current = pathname;
    trackProductEvent("tool_view", { tool_id: toolId, source: "route" });
  }, [pathname]);
  return null;
}
