import { PUBLISHED_BLOG_TOOL_MAP, PUBLISHED_GLOSSARY_TOOL_MAP } from "./contentToolRegistry";

// 콘텐츠 → 도구(단방향)만 있던 연결의 역방향. 목록을 새로 나열하지 않고
// 기존 레지스트리에서 **파생**한다(한 곳에 추가하면 다른 곳도 고쳐야 하는 구조 금지).
// 도구 화면 하단에서 "이 분석의 근거 읽기"로 쓰인다.
const MAX_POSTS = 3;
const MAX_TERMS = 2;

function reverseIndex(map) {
  const index = new Map();
  for (const [slug, toolId] of Object.entries(map)) {
    if (!index.has(toolId)) index.set(toolId, []);
    index.get(toolId).push(slug);
  }
  return index;
}

// 역방향 전용 보충. forward 매핑(글 → 하나의 전환 도구)은 편집 결정이라 바꾸지 않고,
// 그 도구가 1순위가 아닐 뿐 근거로는 유효한 글을 도구 화면에서만 추가로 노출한다.
// 5-24·9-1·5-18-paid-organic·5-18-forecast는 전용 발행 글이 아직 없어(콘텐츠 공백)
// 방법론이 겹치는 글로 연결한다. 없는 글을 지어내는 대신 공백을 공백으로 둔다.
const SUPPLEMENTARY_BLOG_BY_TOOL = {
  "5-24": ["incrementality-measurement", "uplift-holdout-guide", "correlation-vs-causation"],
  "9-1": ["ad-creative-testing", "hook-3-seconds-framework"],
  "5-18-paid-organic": ["cannibalization-organic-paid", "offline-ad-online-impact"],
  "5-18-forecast": ["marketing-mix-modeling", "budget-marginal-efficiency"],
  "5-18-trend": ["campaign-anomaly-detection"],
};

const SUPPLEMENTARY_GLOSSARY_BY_TOOL = {
  "5-24": ["incrementality", "uplift"],
  "9-1": ["ctr", "cvr"],
  "5-18-paid-organic": ["cannibalization"],
  "5-18-forecast": ["response-curve", "adstock"],
  "5-18-trend": ["mmm"],
};

function mergeIndex(base, supplementary) {
  const merged = new Map(base);
  for (const [toolId, slugs] of Object.entries(supplementary)) {
    const existing = merged.get(toolId) || [];
    merged.set(toolId, [...existing, ...slugs.filter((slug) => !existing.includes(slug))]);
  }
  return merged;
}

const BLOG_BY_TOOL = mergeIndex(reverseIndex(PUBLISHED_BLOG_TOOL_MAP), SUPPLEMENTARY_BLOG_BY_TOOL);
const GLOSSARY_BY_TOOL = mergeIndex(reverseIndex(PUBLISHED_GLOSSARY_TOOL_MAP), SUPPLEMENTARY_GLOSSARY_BY_TOOL);

// 구 5-18 허브는 이제 목록에 없는 매핑 화면이다. 콘텐츠는 각 분석(5-18-mmm 등)이
// 직접 갖고, 허브로 들어온 요청만 기여 분해 쪽 콘텐츠를 빌려 쓴다.
function normalizeToolId(toolId) {
  return toolId === "5-18" ? "5-18-mmm" : toolId;
}

export function blogSlugsForTool(toolId) {
  return (BLOG_BY_TOOL.get(normalizeToolId(toolId)) || []).slice(0, MAX_POSTS);
}

export function glossarySlugsForTool(toolId) {
  return (GLOSSARY_BY_TOOL.get(normalizeToolId(toolId)) || []).slice(0, MAX_TERMS);
}

export function hasContentForTool(toolId) {
  return blogSlugsForTool(toolId).length > 0 || glossarySlugsForTool(toolId).length > 0;
}
