"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { productEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";

export default function AnalysisEntryLink({ href, toolId, locale, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver !== "function") return undefined;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      trackProductEventOnce("blog_cta_viewed", productEventKey("marketing-analysis", toolId, locale), {
        tool_id: toolId, content_slug: "marketing-analysis", content_type: "compare", locale, placement: "analysis_question",
      });
      observer.disconnect();
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [locale, toolId]);
  return <Link ref={ref} className="btn primary" href={href} onClick={() => trackProductEvent("blog_tool_cta_clicked", {
    tool_id: toolId, content_slug: "marketing-analysis", content_type: "compare", locale, placement: "analysis_question", source: "compare",
  })}>{children}</Link>;
}
