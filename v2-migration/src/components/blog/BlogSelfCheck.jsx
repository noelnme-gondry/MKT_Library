"use client";

import { useEffect, useId, useRef, useState } from "react";
import { blogSelfCheckFor } from "@/lib/blogSelfCheck";
import { productEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";

// 시안 D — CSV로 계산할 수 없는 글의 30초 점검. 두 질문에 예/아니요를 누르면 글 본문이
// 이미 말한 판단 기준으로 한 줄 결론을 보여 준다. 상자 없이 여백과 글자 크기로만 본문과 가른다.
export default function BlogSelfCheck({ slug, locale = "ko" }) {
  const en = locale === "en";
  const check = blogSelfCheckFor(slug, locale);
  const [answers, setAnswers] = useState([null, null]);
  const id = useId();
  const ref = useRef(null);
  useEffect(() => {
    if (!check || !ref.current || typeof IntersectionObserver !== "function") return undefined;
    const target = ref.current;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      trackProductEventOnce("blog_cta_viewed", productEventKey(slug, "self_check", locale), { source: "blog", content_slug: slug, content_type: "blog", placement: "self_check", locale });
      observer.disconnect();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [check, locale, slug]);
  if (!check) return null;
  const key = answers.every((a) => a !== null) ? answers.map((a) => (a ? "y" : "n")).join("") : null;
  const result = key ? check.results[key] : null;
  const choose = (index, value) => {
    const next = answers.map((a, i) => (i === index ? value : a));
    setAnswers(next);
    if (next.every((a) => a !== null)) trackProductEvent("blog_check_answered", { source: "blog", content_slug: slug, content_type: "blog", placement: "self_check", state: next.map((a) => (a ? "y" : "n")).join(""), locale });
  };
  return <section ref={ref} className="blog-check" aria-labelledby={id}>
    <h2 id={id} className="blog-check__title">{check.title}</h2>
    {check.questions.map((question, index) => <fieldset key={question} className="blog-check__question">
      <legend>{question}</legend>
      <div className="blog-check__choices">
        {[true, false].map((value) => <button key={String(value)} type="button" aria-pressed={answers[index] === value} onClick={() => choose(index, value)}>
          {value ? (en ? "Yes" : "예") : (en ? "No" : "아니요")}
        </button>)}
      </div>
    </fieldset>)}
    <div className="blog-check__result" aria-live="polite">
      {result && <p><strong>{result[0]}</strong> {result[1]}</p>}
    </div>
  </section>;
}
