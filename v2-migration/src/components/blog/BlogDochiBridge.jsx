"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import DochiSprite from "@/components/assistant/DochiSprite";
import { actionCopyFor } from "@/components/seo/ContentActionPanel";
import { productEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import { getBrandFacts } from "@/lib/brandFacts";
import { readDepthPercent, readSessionSlugs } from "@/components/blog/BlogReadTracker";
import { idToSlug } from "@/lib/routeMap";
import { TEMPLATE_PAGES } from "@/lib/templateCatalog";

// 글을 이어 읽는 독자에게 본문 끝에서 한 번 말을 거는 도치.
//
// 왜 홈 도치(`DochiAssistant`)를 재사용하지 않는가: 그 컴포넌트는 마운트 즉시
// `startMyData()`를 불러 데모를 끄고(§12.8) `CsvUploader`를 통째로 싣는다. 블로그를
// 스쳐간 사람이 도구에 들어갔을 때 빈 화면을 보게 되고, 콘텐츠 페이지에 앱 번들이
// 흘러든다(§12.29). 여기 도치는 **링크만 준다** — 업로드는 목적지에서 한다.
//
// 노출 규칙(§12.29b와 같은 결): 전면 오버레이 금지(모바일 검색 인터스티셜),
// 첫 글에서는 뜨지 않고, 닫으면 그 세션 안에서 다시 뜨지 않는다.
const MIN_SESSION_ARTICLES = 2;
const MIN_DEPTH_PERCENT = 60;
const MIN_DWELL_MS = 30_000;
const SESSION_DISMISS_KEY = "gop:blog:bridge-dismissed";
const PERSISTENT_OFF_KEY = "gop:blog:bridge-off";

const COPY = {
  ko: {
    lead: (count) => `이번 세션에서 ${count}편째 읽고 계시네요.`,
    intro: "안녕하세요, 도치예요.",
    fields: "필요한 컬럼 먼저 보기",
    close: "닫기",
    label: "도치의 분석 안내",
    stop: "이 안내 그만 보기",
    desktop: "표와 차트는 PC 화면이 편해요. 지금 저장해 두셨다가 열어보셔도 돼요.",
  },
  en: {
    lead: (count) => `That’s article ${count} in this session.`,
    intro: "Hi, I’m Dochi.",
    fields: "See the columns you’ll need",
    close: "Close",
    label: "Analysis suggestion from Dochi",
    stop: "Stop showing this",
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
export function shouldOpenBridge({ articleCount, depthPercent, dwellMs, dismissed, disabled }) {
  if (dismissed || disabled) return false;
  return articleCount >= MIN_SESSION_ARTICLES
    && depthPercent >= MIN_DEPTH_PERCENT
    && dwellMs >= MIN_DWELL_MS;
}

export function templatePathFor(toolId) {
  const page = TEMPLATE_PAGES.find((item) => item.toolId === toolId);
  return page ? `/templates/${page.slug}` : null;
}

export default function BlogDochiBridge({ slug, toolId, locale = "ko", targetSelector = ".blog-prose" }) {
  const copy = COPY[locale === "en" ? "en" : "ko"];
  const action = actionCopyFor(toolId, locale);
  const [open, setOpen] = useState(false);
  const [articleCount, setArticleCount] = useState(0);
  const prefix = locale === "en" ? "/en" : "";
  const toolHref = `${prefix}${idToSlug[action.toolId]}`;
  const templatePath = templatePathFor(action.toolId);
  const privacy = getBrandFacts(locale).find((fact) => fact.id === "privacy");

  useEffect(() => {
    if (!slug || typeof window === "undefined") return undefined;
    const dismissed = readFlag(window.sessionStorage, SESSION_DISMISS_KEY);
    const disabled = readFlag(window.localStorage, PERSISTENT_OFF_KEY);
    if (dismissed || disabled) return undefined;

    // 세션 글 수는 `BlogReadTracker`가 이미 기록한 값을 읽기만 한다(카운터 두 벌 금지).
    const count = readSessionSlugs(window.sessionStorage).length;
    if (count < MIN_SESSION_ARTICLES) return undefined;

    const startedAt = Date.now();
    const article = document.querySelector(targetSelector);
    if (!article) return undefined;

    let frame = 0;
    let timer = 0;
    const evaluate = () => {
      frame = 0;
      const rect = article.getBoundingClientRect();
      const depthPercent = readDepthPercent(rect.top + window.scrollY, rect.height, window.scrollY, window.innerHeight);
      if (!shouldOpenBridge({ articleCount: count, depthPercent, dwellMs: Date.now() - startedAt, dismissed: false, disabled: false })) return;
      setArticleCount(count);
      setOpen(true);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(evaluate);
    };

    // 스크롤을 이미 끝낸 뒤 머무는 독자도 있으므로 체류 시간이 차는 순간에도 한 번 본다.
    timer = window.setTimeout(evaluate, MIN_DWELL_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
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
      writeFlag(window.sessionStorage, SESSION_DISMISS_KEY);
      if (state === "permanent") writeFlag(window.localStorage, PERSISTENT_OFF_KEY);
    }
    trackProductEvent("blog_bridge_dismissed", {
      source: "blog",
      content_slug: slug,
      content_type: "blog",
      placement: "blog_bridge",
      locale,
      state,
    });
    setOpen(false);
  };

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
    <aside className="blog-dochi-bridge" aria-label={copy.label}>
      <DochiSprite pose="point" className="blog-dochi-bridge__sprite" />
      <div className="blog-dochi-bridge__body">
        <p className="blog-dochi-bridge__lead">{copy.lead(articleCount)} {copy.intro}</p>
        <h2>{action.title}</h2>
        <p className="blog-dochi-bridge__desc">{action.desc}</p>
        <div className="blog-dochi-bridge__links">
          <Link href={toolHref} className="blog-dochi-bridge__cta" onClick={() => trackClick(action.toolId, "blog_bridge")}>
            {action.cta} <span aria-hidden>→</span>
          </Link>
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
        <button type="button" className="blog-dochi-bridge__stop" onClick={() => dismiss("permanent")}>{copy.stop}</button>
      </div>
      <button type="button" className="blog-dochi-bridge__close" aria-label={copy.close} onClick={() => dismiss("session")}>×</button>
    </aside>
  );
}
