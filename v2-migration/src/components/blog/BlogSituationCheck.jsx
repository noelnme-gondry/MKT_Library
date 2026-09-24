"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { blogSituationCheckFor } from "@/lib/blogSituationCheck";
import { idToSlug } from "@/lib/routeMap";
import { toolIndexEntry } from "@/lib/toolIndex";
import { productEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";

// 시안 B — 글 끝의 확인용 상황 점검. 자기 상황을 하나 고르면 답 한 줄과 이어서 볼 곳이 나온다.
// 라디오 한 줄씩, 선택은 파란 원과 글자색으로만 표시한다(상자·배경 강조 없음).
export default function BlogSituationCheck({ slug, toolId, locale = "ko" }) {
  const en = locale === "en";
  const check = blogSituationCheckFor(slug, toolId, locale);
  const [picked, setPicked] = useState(null);
  const id = useId();
  const ref = useRef(null);
  useEffect(() => {
    if (!check || !ref.current || typeof IntersectionObserver !== "function") return undefined;
    const target = ref.current;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      trackProductEventOnce("blog_cta_viewed", productEventKey(slug, "situation_check", locale), { source: "blog", content_slug: slug, content_type: "blog", placement: "situation_check", locale });
      observer.disconnect();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [check, locale, slug]);
  if (!check) return null;
  const option = picked === null ? null : check.options[picked];
  const prefix = en ? "/en" : "";
  const href = option ? (option.tool ? `${prefix}${idToSlug[option.tool]}` : `${prefix}${option.path}`) : null;
  const ctaLabel = option ? (option.tool ? (toolIndexEntry(option.tool, locale)?.name || (en ? "Open analysis" : "분석 열기")) : (en ? "Read the guide" : "관련 안내 보기")) : null;
  const choose = (index) => {
    setPicked(index);
    trackProductEvent("blog_check_answered", { source: "blog", content_slug: slug, content_type: "blog", placement: "situation_check", state: `option_${index + 1}`, locale });
  };
  return <section ref={ref} className="blog-check blog-check--situation" aria-labelledby={id}>
    <h2 id={id} className="blog-check__title">{check.question}</h2>
    <div className="blog-check__options" role="radiogroup" aria-labelledby={id}>
      {check.options.map((item, index) => <button key={item.label} type="button" role="radio" aria-checked={picked === index} tabIndex={picked === null ? (index === 0 ? 0 : -1) : (picked === index ? 0 : -1)}
        onClick={() => choose(index)}
        onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
          event.preventDefault();
          const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
          const next = ((picked ?? index) + step + check.options.length) % check.options.length;
          choose(next);
          event.currentTarget.parentElement.children[next]?.focus();
        }}>
        <span className="blog-check__dot" aria-hidden="true" />{item.label}
      </button>)}
    </div>
    <div className="blog-check__result" aria-live="polite">
      {option && <>
        <p>{option.answer}</p>
        <Link href={href} className="btn primary" onClick={() => trackProductEvent("blog_tool_cta_clicked", { tool_id: option.tool || "guide", source: "blog", content_slug: slug, content_type: "blog", placement: "situation_check", locale })}>{ctaLabel}</Link>
      </>}
    </div>
  </section>;
}
