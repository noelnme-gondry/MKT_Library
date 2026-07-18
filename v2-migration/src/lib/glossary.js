// 용어사전 콘텐츠 로더 — 빌드타임 fs 기반 (SERVER 전용, 클라이언트에서 import 금지).
// content/glossary/*.md 를 gray-matter로 파싱 + marked로 HTML 렌더. blog.js와 동일한
// 파이프라인 패턴(§12.24)이되, 목적이 다름 — 블로그는 롱폼 가이드, 용어사전은 "OOO란"
// 단답형 짧은 정의 페이지(니치 키워드 경쟁 제로 선점, §growth-playbook #1).
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

const GLOSSARY_DIR = path.join(process.cwd(), "content", "glossary");

marked.setOptions({ gfm: true, breaks: false });

function readDir() {
  try {
    return fs.readdirSync(GLOSSARY_DIR);
  } catch {
    return [];
  }
}

function parseFile(fileName) {
  const filePath = path.join(GLOSSARY_DIR, fileName);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const slug = data.slug || fileName.replace(/\.md$/, "");
  return {
    slug,
    term: data.term || slug,
    shortDef: data.shortDef || "",
    description: data.description || data.shortDef || "",
    date: data.date || "",
    keywords: data.keywords || "",
    // 이 용어를 더 깊게 다루는 기존 블로그 글 slug 배열(있으면 상세 페이지에 링크).
    relatedPosts: Array.isArray(data.relatedPosts) ? data.relatedPosts : [],
    draft: data.draft === true,
    html: marked.parse(content || ""),
  };
}

// 발행 항목 전체, 용어명 가나다/알파벳순(사전이라 최신순보다 자연스러움).
export function getAllTerms() {
  return readDir()
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map(parseFile)
    .filter((t) => !t.draft)
    .sort((a, b) => a.term.localeCompare(b.term, "ko"));
}

export function getTermBySlug(slug) {
  return getAllTerms().find((t) => t.slug === slug) || null;
}
