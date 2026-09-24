"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { readDepthPercent } from "@/components/blog/BlogReadTracker";
import { productEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";

// 시안 C — 읽는 중에만 뜨는 한 줄 바. 도치 브리지(화면 가운데 팝업)를 대신한다.
// 글의 35%를 넘기면 화면 아래에 붙고, 이어 줄 대상(예시 결과·30초 점검)이 화면에
// 보이는 동안과 글 끝에 닿은 뒤에는 숨는다. 닫으면 그 방문(세션)에서는 모든 글에서 다시 뜨지 않는다.
// 전면 오버레이가 아니다 — 본문을 가리지 않는 높이로, 모바일 검색 인터스티셜 판정을 피한다.
export const READING_BAR_MIN_DEPTH = 35;
const DISMISS_KEY = "gop:blog:reading-bar-dismissed";

// 글 끝(상황 확인·구독)이 화면에 들어오면 내린다 — 그 자리의 버튼을 덮지 않게.
export function shouldShowReadingBar({ depthPercent, targetVisible, dismissed, articleEnded = false }) {
  return !dismissed && !targetVisible && !articleEnded && depthPercent >= READING_BAR_MIN_DEPTH;
}

function readDismissed() {
  try { return window.sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

export default function BlogReadingBar({ slug, locale = "ko", targetId, title, detail, articleSelector = ".blog-prose" }) {
  const en = locale === "en";
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!targetId || typeof window === "undefined") return undefined;
    if (readDismissed()) return undefined;
    const article = document.querySelector(articleSelector);
    const target = document.getElementById(targetId);
    if (!article || !target) return undefined;
    let targetVisible = false, frame = 0;
    const evaluate = () => {
      frame = 0;
      const rect = article.getBoundingClientRect();
      const depthPercent = readDepthPercent(rect.top + window.scrollY, rect.height, window.scrollY, window.innerHeight);
      setVisible(shouldShowReadingBar({ depthPercent, targetVisible, dismissed: readDismissed(), articleEnded: rect.bottom <= window.innerHeight }));
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(evaluate); };
    const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => { targetVisible = entries.some((entry) => entry.isIntersecting); schedule(); }) : null;
    observer?.observe(target);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => { observer?.disconnect(); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); if (frame) window.cancelAnimationFrame(frame); };
  }, [articleSelector, targetId]);

  useEffect(() => {
    if (!visible) return;
    trackProductEventOnce("blog_cta_viewed", productEventKey(slug, "reading_bar", locale), { source: "blog", content_slug: slug, content_type: "blog", placement: "reading_bar", locale });
  }, [locale, slug, visible]);

  if (!visible || dismissed) return null;
  const go = () => {
    trackProductEvent("blog_tool_cta_clicked", { tool_id: "blog-section", source: "blog", content_slug: slug, content_type: "blog", placement: "reading_bar", locale });
    const target = document.getElementById(targetId);
    target?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    target?.focus?.({ preventScroll: true });
  };
  const dismiss = () => {
    try { window.sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* 이번 화면에서만 닫는다. */ }
    trackProductEvent("blog_bridge_dismissed", { source: "blog", content_slug: slug, content_type: "blog", placement: "reading_bar", state: "session", locale });
    setDismissed(true);
  };
  return <div className="blog-reading-bar" role="region" aria-label={en ? "Jump to this article's example" : "이 글의 예시로 이동"}>
    <div className="blog-reading-bar__text">
      <strong>{title}</strong>
      {detail && <span>{detail}</span>}
    </div>
    <button type="button" className="btn primary" onClick={go}>{en ? "View" : "보기"}</button>
    <button type="button" className="blog-reading-bar__close" aria-label={en ? "Close" : "닫기"} onClick={dismiss}><X size={18} aria-hidden="true" /></button>
  </div>;
}
