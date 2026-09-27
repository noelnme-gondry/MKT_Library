"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import { blogConversionFor, blogExampleFormId } from "@/lib/blogConversion";
import { productEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";

export function useBlogCtaView(slug, locale, placement, toolId) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver !== "function") return undefined;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      trackProductEventOnce("blog_cta_viewed", productEventKey(slug, placement, locale), { content_slug: slug, content_type: "blog", tool_id: toolId, placement, locale });
      observer.disconnect();
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [slug, locale, placement, toolId]);
  return ref;
}

const JourneyContext = createContext(null);
export function BlogJourneyProvider({ children }) {
  const [busy, setBusy] = useState(false);
  const value = useMemo(() => [busy, setBusy], [busy]);
  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}
export function useBlogJourneyBusy() {
  const local = useState(false);
  return useContext(JourneyContext) || local;
}
// Native form association keeps every entry on the same sample loader and guard.
export function BlogSampleButton({ slug, locale = "ko", placement = "article_entry", disabled = false }) {
  const [busy] = useBlogJourneyBusy();
  const preparing = useAppStore(s => s.projectSwitching || (s.decisionPersistenceEnabled && !s.projectsReady && !s.projectError));
  const copy = blogConversionFor(slug, locale);
  return <button type="submit" form={blogExampleFormId(slug)} className="btn primary" data-placement={placement} disabled={disabled || busy || preparing}>
    {busy ? (locale === "en" ? "Loading…" : "불러오는 중…") : copy?.action || (locale === "en" ? "Open example results" : "예시 결과 보기")}
  </button>;
}
export default function BlogConversionEntry({ slug, locale = "ko", sample, toolId }) {
  const en = locale === "en";
  const ref = useBlogCtaView(slug, locale, "article_entry", toolId);
  return <div ref={ref} className="blog-conversion-entry">
    {sample ? <>
      <BlogSampleButton slug={slug} locale={locale} />
      <p>{en ? "Try the analysis with sample data. Free, with no sign-in or file needed." : "가입 없이, 파일 없이. 샘플 결과부터 확인하세요."}</p>
    </> : <>
      <a className="btn primary" href="#blog-self-check" onClick={() => trackProductEvent("blog_section_opened", { content_slug: slug, content_type: "blog", placement: "article_entry", state: "self_check", locale })}>{en ? "Check with two questions" : "두 질문으로 점검하기"}</a>
      <p>{en ? "Answer two questions to find what to check next." : "두 질문에 답하면 다음에 확인할 항목을 알려드립니다."}</p>
    </>}
  </div>;
}
