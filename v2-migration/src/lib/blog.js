// 블로그 콘텐츠 로더 — 빌드타임 fs 기반 (SERVER 전용, 클라이언트에서 import 금지).
// content/blog(-en)/*.md 를 gray-matter로 파싱 + marked로 HTML 렌더.
// SOP(JSON)와 완전 분리된 독립 파이프라인. routeMap(ROUTES)과 무관하게 fs만 읽음.
// locale: "ko"(기본, content/blog) | "en"(content/blog-en) — 같은 slug로 KR/EN 짝 파일 매칭.
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";
import { localizedHref } from "@/lib/localizedHref";
import { primaryToolForContent, relatedGlossaryForPost } from "@/lib/contentToolRegistry";
import { getBlogSeo } from "@/lib/blogSeo";
import { getBlogEditorial } from "@/lib/blogEditorial";
import { decodeTextEntitiesOnce, stripHtmlTags } from "@/lib/htmlText";
import { wrapArticleTables } from "@/lib/articleTables";
import { consolidateTags, decodedTagSlug, tagSlug } from "./blogTags.mjs";
export { tagSlug } from "./blogTags.mjs";

// 자체 작성 신뢰 MD라 위험은 낮지만, 방어적으로 기본 옵션만 사용(raw HTML 통과를
// 굳이 확장하지 않음). gfm=마크다운 표/자동링크 지원.
marked.setOptions({ gfm: true, breaks: false });

function readDir(locale) {
  try {
    const directory = locale === "en" ? "blog-en" : "blog";
    return fs.readdirSync(path.join(process.cwd(), "content", directory));
  } catch {
    // 디렉토리 없거나 접근 불가 → 글 0편으로 취급.
    return [];
  }
}

// EN 글 렌더 HTML의 내부 블로그 링크(`/blog/<slug>`)를 `/en/blog/<slug>`로 재작성.
// 원고는 항상 KR 경로(`/blog/<slug>`)만 쓰면 되고, locale 접두사는 렌더러가 붙임 —
// "EN 파일에 /en/blog/ 직접 타이핑" 수동 규칙을 없애 재발(PR #303) 구조적으로 차단.
// 이미 /en/blog/로 쓰여 있어도 문자열 "href=\"/blog/"가 안 나타나 이중치환 없음.
function localizeInternalLinks(html, locale) {
  if (locale !== "en") return html;
  return html.replace(/href="(\/[^"#]+)(#[^"]*)?"/g, (_, href, hash = "") => `href="${localizedHref(href, locale)}${hash}"`);
}

function normalizeArticleHeadings(html) {
  return html.replace(/<h1([^>]*)>/g, "<h2$1>").replace(/<\/h1>/g, "</h2>");
}

function extractExternalSources(html) {
  const sources = [];
  const anchorPattern = /<a\s[^>]*href="(https:\/\/[^"#]+(?:#[^"]*)?)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = anchorPattern.exec(html || ""))) {
    const title = match[2]
      ? decodeTextEntitiesOnce(stripHtmlTags(match[2])).trim()
      : "";
    sources.push({ title: title || match[1], url: match[1] });
  }
  return sources;
}

function mergeSources(...groups) {
  const byUrl = new Map();
  for (const source of groups.flat()) {
    if (source?.title && source?.url && !byUrl.has(source.url)) byUrl.set(source.url, source);
  }
  return [...byUrl.values()];
}

function parseFile(fileName, locale) {
  const directory = locale === "en" ? "blog-en" : "blog";
  const filePath = path.join(process.cwd(), "content", directory, fileName);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const slug = data.slug || fileName.replace(/\.md$/, "");
  const seo = getBlogSeo(locale, slug, data);
  const editorial = getBlogEditorial(locale, slug, data);
  const html = wrapArticleTables(normalizeArticleHeadings(localizeInternalLinks(marked.parse(content || ""), locale))
    .replace(/<pre>/g, `<pre tabindex="0" role="region" aria-label="${locale === "en" ? "Formula or code" : "수식 또는 코드"}">`), locale);
  return {
    slug,
    searchTitleTerms: data.searchTitleTerms || [],
    title: seo?.title || data.title || slug,
    // 화면 h1. 레지스트리가 따로 적지 않았으면 제목과 같다(§blogSeo H1).
    h1: seo?.h1 || seo?.title || data.title || slug,
    description: seo?.description || data.description || "",
    seoAnswer: editorial.answer || data.description || "",
    searchIntent: seo?.intent || "",
    conditions: editorial.conditions,
    reviewer: editorial.reviewer,
    reviewedAt: editorial.reviewedAt,
    sources: mergeSources(editorial.sources, extractExternalSources(html)),
    date: data.date || "",
    updated: seo?.updated || data.updated || data.date || "",
    keywords: data.keywords || "",
    tags: consolidateTags(Array.isArray(data.tags) ? data.tags : [], locale),
    ogImage: data.ogImage || "",
    primaryTool: data.primaryTool || primaryToolForContent(slug, "blog"),
    template: data.template || "",
    relatedGlossary: Array.isArray(data.relatedGlossary) && data.relatedGlossary.length
      ? data.relatedGlossary
      : relatedGlossaryForPost(slug),
    // FAQPage 구조화 데이터 + 화면 아코디언 공용 소스. [{q,a}], q/a 둘 다 없는 항목은 방어적으로 제외.
    faq: Array.isArray(data.faq)
      ? data.faq.filter((item) => item && item.q && item.a)
      : [],
    draft: data.draft === true,
    // RSS는 요약이 아니라 본문 전체를 제공해야 한다. Naver Search Advisor의 RSS
    // 가이드에 맞춰 렌더된 HTML을 별도 필드로 보관한다(화면 html과 같은 원문).
    rssHtml: html,
    html,
  };
}

// 발행 글 전체(초안·언더스코어 프리픽스 제외), date 내림차순(최신 위·오래된 아래).
// 같은 날짜면 slug 내림차순으로 결정적 정렬(fs 읽기 순서 의존 제거). 파일 0개면 [].
export function getAllPosts(locale = "ko") {
  return readDir(locale)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => parseFile(f, locale))
    .filter((p) => !p.draft)
    .sort((a, b) => {
      const byDate = String(b.date).localeCompare(String(a.date));
      return byDate !== 0 ? byDate : String(b.slug).localeCompare(String(a.slug));
    });
}

// slug 단건. 없으면 null. 초안/제외 규칙은 getAllPosts와 동일.
export function getPostBySlug(slug, locale = "ko") {
  return getAllPosts(locale).find((p) => p.slug === slug) || null;
}

// 전체 태그 목록 [{ tag, slug, count }] — 글 많은 순, 동률이면 가나다.
export function getAllTags(locale = "ko") {
  const counts = new Map();
  for (const p of getAllPosts(locale)) {
    for (const t of p.tags) {
      if (!t) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, slug: tagSlug(tag), count }))
    .sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag));
}

// 특정 태그(slug 기준)의 글 목록. getAllPosts 정렬 승계. 없으면 [].
export function getPostsByTag(slug, locale = "ko") {
  const normalized = decodedTagSlug(slug);
  return getAllPosts(locale).filter((p) => p.tags.some((t) => tagSlug(t) === normalized));
}

// slug → 원본 태그 라벨(표시용). 없으면 slug 그대로.
export function tagLabelFromSlug(slug, locale = "ko") {
  const normalized = decodedTagSlug(slug);
  const found = getAllTags(locale).find((t) => t.slug === normalized);
  return found ? found.tag : normalized;
}
