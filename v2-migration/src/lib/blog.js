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

// EN 글 렌더 HTML의 내부 블로그 링크(`/blog/<slug>`)를 `/en/blog/<slug>`로 재작성.
// 원고는 항상 KR 경로(`/blog/<slug>`)만 쓰면 되고, locale 접두사는 렌더러가 붙임 —
// "EN 파일에 /en/blog/ 직접 타이핑" 수동 규칙을 없애 재발(PR #303) 구조적으로 차단.
// 이미 /en/blog/로 쓰여 있어도 문자열 "href=\"/blog/"가 안 나타나 이중치환 없음.
function localizeInternalLinks(html, locale) {
  if (locale !== "en") return html;
  return html.replace(/(href=")\/blog\//g, "$1/en/blog/");
}

// ── 카테고리 정리(§UX) ─────────────────────────────────────────────────
// 난잡한 원본 태그(21종·대부분 count 1)를 6개 상위 카테고리로 통합. frontmatter는
// 불변 — 여기가 taxonomy SSOT라 파싱 시점에 매핑(되돌리기 쉬움, 글 내용 무관).
// 매핑 없는 태그는 그대로 통과, "퍼포먼스 마케팅"(거의 전 글)은 분류 기능 상실이라 제외.
const TAG_CATEGORY = {
  "예산 배분": "예산·효율", CPA: "예산·효율", ROAS: "예산·효율", 스케일업: "예산·효율", 포화: "예산·효율",
  "마케팅 지표": "측정·분석", "지표 기초": "측정·분석", "분석 방법론": "측정·분석", "실험 분석": "측정·분석", "증분 분석": "측정·분석", MMM: "측정·분석", "문제 진단": "측정·분석",
  "광고 소재": "소재·크리에이티브", "소재 피로도": "소재·크리에이티브",
  타겟팅: "타겟·오디언스", "오디언스 전략": "타겟·오디언스",
  AI: "AI·자동화", 머신러닝: "AI·자동화", 자동화: "AI·자동화",
  커리어: "커리어·성장", "주니어 마케터": "커리어·성장",
};
const TAG_DROP = new Set(["퍼포먼스 마케팅"]);

function consolidateTags(rawTags) {
  const out = [];
  const seen = new Set();
  for (const t of rawTags) {
    if (!t || TAG_DROP.has(t)) continue;
    const cat = TAG_CATEGORY[t] || t; // 매핑 없으면 원본 유지(EN 태그 등)
    if (!seen.has(cat)) {
      seen.add(cat);
      out.push(cat);
    }
  }
  return out;
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
    tags: consolidateTags(Array.isArray(data.tags) ? data.tags : []),
    ogImage: data.ogImage || "",
    draft: data.draft === true,
    html: localizeInternalLinks(marked.parse(content || ""), locale),
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
