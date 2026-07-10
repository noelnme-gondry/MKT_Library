// 블로그 콘텐츠 로더 — 빌드타임 fs 기반 (SERVER 전용, 클라이언트에서 import 금지).
// content/blog(-en)/*.md 를 gray-matter로 파싱 + marked로 HTML 렌더.
// SOP(JSON)와 완전 분리된 독립 파이프라인. routeMap(ROUTES)과 무관하게 fs만 읽음.
// locale: "ko"(기본, content/blog) | "en"(content/blog-en) — 같은 slug로 KR/EN 짝 파일 매칭.
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

const BLOG_DIRS = {
  ko: path.join(process.cwd(), "content", "blog"),
  en: path.join(process.cwd(), "content", "blog-en"),
};

// 자체 작성 신뢰 MD라 위험은 낮지만, 방어적으로 기본 옵션만 사용(raw HTML 통과를
// 굳이 확장하지 않음). gfm=마크다운 표/자동링크 지원.
marked.setOptions({ gfm: true, breaks: false });

function readDir(locale) {
  try {
    return fs.readdirSync(BLOG_DIRS[locale]);
  } catch {
    // 디렉토리 없거나 접근 불가 → 글 0편으로 취급.
    return [];
  }
}

function parseFile(fileName, locale) {
  const filePath = path.join(BLOG_DIRS[locale], fileName);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const slug = data.slug || fileName.replace(/\.md$/, "");
  return {
    slug,
    title: data.title || slug,
    description: data.description || "",
    date: data.date || "",
    keywords: data.keywords || "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    ogImage: data.ogImage || "",
    draft: data.draft === true,
    html: marked.parse(content || ""),
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

// 태그 → URL slug (공백만 하이픈으로, 한글은 유지 — %-인코딩되어 서빙됨).
export function tagSlug(tag) {
  return String(tag).trim().replace(/\s+/g, "-");
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
  return getAllPosts(locale).filter((p) => p.tags.some((t) => tagSlug(t) === slug));
}

// slug → 원본 태그 라벨(표시용). 없으면 slug 그대로.
export function tagLabelFromSlug(slug, locale = "ko") {
  const found = getAllTags(locale).find((t) => t.slug === slug);
  return found ? found.tag : slug;
}
