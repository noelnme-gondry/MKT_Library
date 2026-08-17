// 용어사전 콘텐츠 로더 — 빌드타임 fs 기반 (SERVER 전용, 클라이언트에서 import 금지).
// content/glossary(-en)/*.md 를 gray-matter로 파싱 + marked로 HTML 렌더. blog.js와
// 동일한 파이프라인 패턴(§12.24)이되, 목적이 다름 — 블로그는 롱폼 가이드, 용어사전은
// "OOO란" 단답형 짧은 정의 페이지. locale: "ko"(기본, content/glossary) | "en"
// (content/glossary-en) — 같은 slug로 KR/EN 짝 파일 매칭(blog.js와 동일 규약).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import { localizedHref } from "@/lib/localizedHref";
import { primaryToolForContent } from "@/lib/contentToolRegistry";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const GLOSSARY_DIRS = {
  ko: path.resolve(MODULE_DIR, "../../content/glossary"),
  en: path.resolve(MODULE_DIR, "../../content/glossary-en"),
};

marked.setOptions({ gfm: true, breaks: false });

// EN 글 렌더 HTML의 내부 링크(/glossary/·/blog/)를 /en/ 접두로 재작성 — blog.js의
// localizeInternalLinks와 동일 패턴(PR #303 재발 방지). 원고는 항상 KR 경로만 쓰면 됨.
function localizeInternalLinks(html, locale) {
  if (locale !== "en") return html;
  return html.replace(/href="(\/[^"#]+)(#[^"]*)?"/g, (_, href, hash = "") => `href="${localizedHref(href, locale)}${hash}"`);
}

function readDir(locale) {
  try {
    return fs.readdirSync(GLOSSARY_DIRS[locale]);
  } catch {
    return [];
  }
}

function parseFile(fileName, locale) {
  const filePath = path.join(GLOSSARY_DIRS[locale], fileName);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const slug = data.slug || fileName.replace(/\.md$/, "");
  return {
    slug,
    term: data.term || slug,
    // term은 H1·DefinedTerm의 정식 엔티티명, seoTitle은 검색결과용 질문형
    // 제목이다. 둘을 섞으면 "…뜻 — 용어사전"처럼 제목이 중복되고, 구조화된
    // DefinedTerm 이름이 문장으로 오염된다.
    seoTitle: data.seoTitle || "",
    shortDef: data.shortDef || "",
    description: data.description || data.shortDef || "",
    date: data.date || "",
    keywords: data.keywords || "",
    // 카테고리(필터용) — 없으면 "기타"로 폴백(누락 방지, §정직).
    category: data.category || (locale === "en" ? "Other" : "기타"),
    // 이 용어를 더 깊게 다루는 기존 블로그 글 slug 배열(있으면 상세 페이지에 링크).
    relatedPosts: Array.isArray(data.relatedPosts) ? data.relatedPosts : [],
    // 용어집에 실제로 들어오는 쿼리는 "리텐션 뜻"·"d30 리텐션"처럼 이미 질문이다.
    // 그 질문에 그대로 답하는 FAQ를 두면 FAQPage 구조화 데이터로 나가고, 답을
    // 뽑아 쓰는 쪽(LLM·요약 스니펫)이 인용할 단위가 생긴다(§12.29 AEO).
    faq: Array.isArray(data.faq)
      ? data.faq.filter((item) => item?.q && item?.a).map((item) => ({ q: String(item.q), a: String(item.a) }))
      : [],
    primaryTool: data.primaryTool || primaryToolForContent(slug, "glossary"),
    draft: data.draft === true,
    html: localizeInternalLinks(marked.parse(content || ""), locale),
  };
}

// 발행 항목 전체, 용어명 가나다/알파벳순(사전이라 최신순보다 자연스러움).
export function getAllTerms(locale = "ko") {
  return readDir(locale)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => parseFile(f, locale))
    .filter((t) => !t.draft)
    .sort((a, b) => a.term.localeCompare(b.term, locale === "en" ? "en" : "ko"));
}

export function getTermBySlug(slug, locale = "ko") {
  return getAllTerms(locale).find((t) => t.slug === slug) || null;
}

// 카테고리 목록(용어 수 내림차순, 동률이면 가나다) — 필터 UI용. blog.js의
// getAllTags와 동일 패턴.
export function getAllCategories(locale = "ko") {
  const counts = new Map();
  for (const t of getAllTerms(locale)) {
    counts.set(t.category, (counts.get(t.category) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}
