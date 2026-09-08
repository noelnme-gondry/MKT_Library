"use client";

import { useEffect } from "react";

import { productEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import { isRouteIndexable, resolvePathToId } from "@/lib/routeMap";

// 블로그 읽기 계측. 렌더하는 것이 없다(부작용 전용).
//
// 왜 필요한가: 블로그에서 나가는 이벤트가 `blog_tool_cta_clicked` 하나뿐이라
// "글은 읽히는데 분석으로 안 이어진다"를 확인할 분모가 없었다. 어디까지 읽고 이탈하는지,
// 한 세션에 글을 몇 편 여는지를 알아야 중간 개입 지점을 데이터로 정할 수 있다.
//
// 개인정보: 슬러그·로케일·구간만 보낸다(§2.2). 세션 글 목록은 sessionStorage에만 남고
// 탭을 닫으면 사라진다. 스크롤 위치·체류시간 원값은 전송하지 않는다.
const DEPTHS = [25, 50, 75, 100];
const SESSION_KEY = "gop:blog:session-slugs";

// 세션 내 읽은 글 슬러그 집합. 저장소를 못 쓰면(사생활 보호 모드 등) 조용히 빈 배열로
// 폴백한다 — 계측 때문에 페이지가 죽는 일은 없어야 한다.
export function readSessionSlugs(storage) {
  try {
    const raw = storage?.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function recordSessionSlug(storage, slug) {
  const current = readSessionSlugs(storage);
  const next = current.includes(slug) ? current : [...current, slug];
  try {
    storage?.setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    // 저장 실패는 계측 손실일 뿐이라 삼킨다.
  }
  return next;
}

// 문서 상단부터 대상 요소 끝까지를 100%로 본 읽기 진행률.
// 화면에 다 들어오는 짧은 글에서 100%가 즉시 찍히는 건 사실이라 그대로 둔다.
export function readDepthPercent(articleTop, articleHeight, scrollY, viewportHeight) {
  const end = articleTop + articleHeight;
  const start = articleTop;
  const span = Math.max(1, end - start);
  const seen = scrollY + viewportHeight - start;
  return Math.max(0, Math.min(100, Math.round((seen / span) * 100)));
}

export function reachedDepths(percent) {
  return DEPTHS.filter((depth) => percent >= depth);
}

export default function BlogReadTracker({ slug, locale = "ko", contentType = "blog", targetSelector = ".blog-prose" }) {
  useEffect(() => {
    if (!slug || typeof window === "undefined") return undefined;

    // 세션 내 몇 번째 글인가 — 도치 브리지 트리거(2편째)의 기준선이 되는 값이다.
    const slugs = recordSessionSlug(window.sessionStorage, slug);
    const rank = slugs.indexOf(slug) + 1;
    if (rank >= 2) {
      trackProductEventOnce("blog_session_articles", productEventKey(slug, rank, locale), {
        content_slug: slug,
        content_type: contentType,
        source: contentType,
        locale,
        rank,
      });
    }

    const article = document.querySelector(targetSelector);
    if (!article) return undefined;

    // 실제 본문 링크만 관찰한다. 외부 URL·새 탭은 현재 탭의 분석에 귀속하지 않는다.
    const targets = new Map();
    for (const link of article.querySelectorAll("a[href]")) {
      let url;
      try { url = new URL(link.href, window.location.href); } catch { continue; }
      if (url.origin !== window.location.origin) continue;
      // Weekly Review는 catch-all routeMap 밖의 독립 App Router 페이지다.
      const toolId = /^\/(en\/)?weekly-review\/?$/.test(url.pathname) ? "weekly-review" : resolvePathToId(url.pathname);
      if (toolId !== "weekly-review" && !(isRouteIndexable(toolId) && /^[59]-/.test(toolId))) continue;
      targets.set(link, { tool_id: toolId, locale: url.pathname.startsWith("/en/") ? "en" : "ko",
        content_slug: slug, content_type: contentType, placement: "article_body" });
    }
    const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        const params = targets.get(entry.target);
        trackProductEventOnce("blog_cta_viewed", productEventKey(slug, params.tool_id, params.locale, "article_body"), params);
      }
    }) : null;
    for (const link of targets.keys()) observer?.observe(link);
    const onLinkClick = (event) => {
      const link = event.target.closest?.("a[href]");
      const params = targets.get(link);
      if (!params || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank" || link.hasAttribute("download")) return;
      trackProductEvent("blog_tool_cta_clicked", params);
    };
    article.addEventListener("click", onLinkClick);

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = article.getBoundingClientRect();
      const percent = readDepthPercent(
        rect.top + window.scrollY,
        rect.height,
        window.scrollY,
        window.innerHeight,
      );
      for (const depth of reachedDepths(percent)) {
        trackProductEventOnce("blog_read_depth", productEventKey(slug, depth, locale), {
          content_slug: slug,
          content_type: contentType,
          source: contentType,
          locale,
          state: `depth_${depth}`,
        });
      }
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      observer?.disconnect();
      article.removeEventListener("click", onLinkClick);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [contentType, locale, slug, targetSelector]);

  return null;
}
