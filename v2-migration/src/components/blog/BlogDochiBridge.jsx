"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { actionCopyFor } from "@/components/seo/ContentActionPanel";
import { productEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import { getBrandFacts } from "@/lib/brandFacts";
import { readSessionSlugs } from "@/components/blog/BlogReadTracker";
import { idToSlug } from "@/lib/routeMap";
import { PUBLISHED_BLOG_TOOL_MAP } from "@/lib/contentToolRegistry";
import { BLOG_INSIGHT_PLACEMENTS } from "@/lib/blogInsightRegistry";
import { TEMPLATE_PAGES } from "@/lib/templateCatalog";

// 첫 글에서 두 번 내려 읽은 뒤 관련 분석으로 연결한다.
// 링크만 제공하여 블로그에서 분석 데이터나 업로더를 로드하지 않는다.
// 닫기는 해당 글만, 오늘 다시 보지 않기는 로컬 자정까지 모든 글에 적용한다.
const SCROLL_PAUSE_MS = 180;
const SESSION_DISMISS_KEY = "gop:blog:bridge-dismissed";
const TODAY_OFF_KEY = "gop:blog:bridge-off-date";
export function blogLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
function hiddenToday() {
  try { return window.localStorage.getItem(TODAY_OFF_KEY) === blogLocalDateKey(); }
  catch { return false; }
}

const COPY = {
  ko: {
    intro: "읽은 내용을 데이터에 적용해 보세요.",
    fields: "필요한 컬럼 먼저 보기",
    practice: "이 글의 예제로 분석 체험",
    close: "닫기",
    label: "관련 분석 안내",
    stop: "오늘 다시 보지 않기",
    desktop: "표와 차트는 PC 화면이 편해요. 지금 저장해 두셨다가 열어보셔도 돼요.",
  },
  en: {
    intro: "Apply what you read to your data.",
    fields: "See the columns you’ll need",
    practice: "Try this article’s example",
    close: "Close",
    label: "Related analysis",
    stop: "Don’t show again today",
    desktop: "Tables and charts are easier on a wider screen — saving this for later works too.",
  },
};

function readFlag(storage, key) {
  try {
    return storage?.getItem(key) === "1";
  } catch {
    // 저장소를 못 읽으면 노출 쪽으로 폴백한다 — 안내가 한 번 더 뜨는 편이
    // 영영 안 뜨는 것보다 낫다(§12.29b).
    return false;
  }
}

function writeFlag(storage, key) {
  try {
    storage?.setItem(key, "1");
  } catch {
    // 저장 실패는 다음 세션에 한 번 더 뜨는 것으로 끝난다.
  }
}

// 노출 조건은 전부 순수 판정으로 빼 둔다 — 트리거 값을 바꿀 때 화면을 켜 보지 않고
// 테스트로 확인할 수 있어야 한다.
export function shouldOpenBridge({ downwardScrolls = 0, dismissed, disabled }) {
  if (dismissed || disabled) return false;
  return downwardScrolls >= 2;
}

export function templatePathFor(toolId) {
  const page = TEMPLATE_PAGES.find((item) => item.toolId === toolId);
  return page ? `/templates/${page.slug}` : null;
}

export default function BlogDochiBridge({ slug, toolId, locale = "ko", targetSelector = ".blog-prose" }) {
  const copy = COPY[locale === "en" ? "en" : "ko"];
  const action = actionCopyFor(PUBLISHED_BLOG_TOOL_MAP[slug] || toolId, locale);
  const [openSlug, setOpenSlug] = useState(null);
  const open = openSlug === slug;
  const [articleCount, setArticleCount] = useState(0);
  const prefix = locale === "en" ? "/en" : "";
  const toolHref = `${prefix}${idToSlug[action.toolId]}`;
  const templatePath = templatePathFor(action.toolId);
  const privacy = getBrandFacts(locale).find((fact) => fact.id === "privacy");

  useEffect(() => {
    if (!slug || typeof window === "undefined") return undefined;
    const dismissed = readFlag(window.sessionStorage, `${SESSION_DISMISS_KEY}:${slug}`);
    const disabled = hiddenToday();
    if (dismissed || disabled) return undefined;

    // 세션 글 수는 `BlogReadTracker`가 이미 기록한 값을 읽기만 한다(카운터 두 벌 금지).
    const count = readSessionSlugs(window.sessionStorage).length;
    const article = document.querySelector(targetSelector);
    if (!article) return undefined;

    let lastY = window.scrollY;
    let lastAt = -Infinity;
    let distance = 0;
    let counted = false;
    let downwardScrolls = 0;
    const onScroll = () => {
      const now = Date.now();
      const delta = window.scrollY - lastY;
      lastY = window.scrollY;
      if (delta <= 0) return;
      if (now - lastAt > SCROLL_PAUSE_MS) { distance = 0; counted = false; }
      lastAt = now;
      distance += delta;
      // 한 번의 휠/터치 동작에서 연속 발생하는 이벤트는 한 번으로 센다.
      if (distance < 24 || counted) return;
      counted = true;
      downwardScrolls += 1;
      if (!shouldOpenBridge({ downwardScrolls, dismissed: readFlag(window.sessionStorage, `${SESSION_DISMISS_KEY}:${slug}`), disabled: hiddenToday() })) return;
      setArticleCount(Math.max(1, count));
      setOpenSlug(slug);
      window.removeEventListener("scroll", onScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [slug, targetSelector]);

  useEffect(() => {
    if (!open) return;
    // 노출은 기존 이벤트를 그대로 쓴다 — 같은 행동을 새 이름으로 중복 집계하지 않는다.
    trackProductEventOnce("blog_cta_viewed", productEventKey(slug, "blog_bridge", locale), {
      tool_id: action.toolId,
      source: "blog",
      content_slug: slug,
      content_type: "blog",
      placement: "blog_bridge",
      locale,
      rank: articleCount,
    });
  }, [action.toolId, articleCount, locale, open, slug]);

  const dismiss = (state) => {
    if (typeof window !== "undefined") {
      if (state === "today") {
        try { window.localStorage.setItem(TODAY_OFF_KEY, blogLocalDateKey()); } catch { /* 현재 카드는 닫는다. */ }
      } else writeFlag(window.sessionStorage, `${SESSION_DISMISS_KEY}:${slug}`);
    }
    trackProductEvent("blog_bridge_dismissed", {
      source: "blog",
      content_slug: slug,
      content_type: "blog",
      placement: "blog_bridge",
      locale,
      state,
    });
    setOpenSlug(null);
  };

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (event.key !== "Escape") return;
      writeFlag(window.sessionStorage, `${SESSION_DISMISS_KEY}:${slug}`);
      setOpenSlug(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, slug]);

  const trackClick = (targetToolId, target) => {
    trackProductEvent("blog_tool_cta_clicked", {
      tool_id: targetToolId,
      source: "blog",
      content_slug: slug,
      content_type: "blog",
      placement: target,
      locale,
    });
  };

  if (!open) return null;

  return (
    <aside className="blog-dochi-bridge" role="dialog" aria-modal="false" aria-label={copy.label}>
      <div className="blog-dochi-bridge__body">
        <p className="blog-dochi-bridge__lead">{copy.intro}</p>
        <h2>{action.title}</h2>
        <p className="blog-dochi-bridge__desc">{action.desc}</p>
        <div className="blog-dochi-bridge__links">

          <Link href={toolHref} className="blog-dochi-bridge__cta" onClick={() => trackClick(action.toolId, "blog_bridge")}>
            {action.cta} <span aria-hidden>→</span>
          </Link>
          {BLOG_INSIGHT_PLACEMENTS[slug] && <a href="#blog-practice" className="blog-dochi-bridge__secondary" onClick={() => { trackClick(BLOG_INSIGHT_PLACEMENTS[slug].toolId, "blog_bridge_practice"); setOpenSlug(null); writeFlag(window.sessionStorage, `${SESSION_DISMISS_KEY}:${slug}`); }}>{copy.practice} <span aria-hidden>→</span></a>}
          {templatePath && (
            <Link
              href={`${prefix}${templatePath}`}
              className="blog-dochi-bridge__secondary"
              onClick={() => trackClick(action.toolId, "blog_bridge_template")}
            >
              {copy.fields} <span aria-hidden>→</span>
            </Link>
          )}
        </div>
        <p className="blog-dochi-bridge__note">{privacy?.claim} <span className="blog-dochi-bridge__note-desktop">{copy.desktop}</span></p>
        <button type="button" className="blog-dochi-bridge__stop" onClick={() => dismiss("today")}>{copy.stop}</button>
      </div>
      <button type="button" className="blog-dochi-bridge__close" aria-label={copy.close} onClick={() => dismiss("session")}>×</button>
    </aside>
  );
}
