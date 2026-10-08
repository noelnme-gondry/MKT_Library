// 블로그 taxonomy SSOT: 콘텐츠 파싱과 옛 태그 URL의 영구 이동이 함께 사용한다.
// fs·별칭 import 없이 Next 설정에서도 읽을 수 있어야 한다.

// ── 카테고리 정리(§UX) ─────────────────────────────────────────────────
// 난잡한 원본 태그(21종·대부분 count 1)를 6개 상위 카테고리로 통합. frontmatter는
// 불변 — 여기가 taxonomy SSOT라 파싱 시점에 매핑(되돌리기 쉬움, 글 내용 무관).
// 매핑 없는 태그는 그대로 통과, "퍼포먼스 마케팅"(거의 전 글)은 분류 기능 상실이라 제외.
const TAG_CATEGORY = {
  "예산 배분": "예산·효율", 예산: "예산·효율", CPA: "예산·효율", ROAS: "예산·효율", 스케일업: "예산·효율", 포화: "예산·효율",
  "마케팅 지표": "측정·분석", "지표 기초": "측정·분석", 지표: "측정·분석", 기초: "측정·분석", 측정: "측정·분석", 분석: "측정·분석", "분석 방법론": "측정·분석", "실험 분석": "측정·분석", "증분 분석": "측정·분석", 증분: "측정·분석", MMM: "측정·분석", "문제 진단": "측정·분석", 모니터링: "측정·분석",
  소재: "소재·크리에이티브", "광고 소재": "소재·크리에이티브", "소재 피로도": "소재·크리에이티브",
  UA: "매체·운영", UAC: "매체·운영", ASA: "매체·운영", ASO: "매체·운영", iOS: "매체·운영",
  타겟팅: "타겟·퍼널", "오디언스 전략": "타겟·퍼널", "타겟·오디언스": "타겟·퍼널", 전환율: "타겟·퍼널",
  "AI·자동화": "성장·커리어", "커리어·성장": "성장·커리어", AI: "성장·커리어", 머신러닝: "성장·커리어", 자동화: "성장·커리어", 커리어: "성장·커리어", "주니어 마케터": "성장·커리어", 그로스: "성장·커리어", 리텐션: "성장·커리어",
};
const TAG_CATEGORY_EN = {
  "Budget Allocation": "Budget & efficiency", Scaling: "Budget & efficiency", CPA: "Budget & efficiency", ROAS: "Budget & efficiency",
  "Marketing Metrics": "Measurement & analysis", "Metrics Basics": "Measurement & analysis", "Analysis Methodology": "Measurement & analysis", "Analytics Methodology": "Measurement & analysis", "Experiment Analysis": "Measurement & analysis", "Incrementality Analysis": "Measurement & analysis", MMM: "Measurement & analysis", Diagnosis: "Measurement & analysis", Troubleshooting: "Measurement & analysis",
  "Creative Fatigue": "Creative", "Ad Creative": "Creative",
  Targeting: "Targeting & funnel", "Audience Strategy": "Targeting & funnel",
  AI: "Growth & career", Automation: "Growth & career", "Machine Learning": "Growth & career", Career: "Growth & career", "Junior Marketer": "Growth & career",
};
const TAG_DROP = new Set(["퍼포먼스 마케팅", "마케팅", "Performance Marketing"]);

export function consolidateTags(rawTags, locale) {
  const categoryMap = locale === "en" ? TAG_CATEGORY_EN : TAG_CATEGORY;
  const out = [];
  const seen = new Set();
  for (const t of rawTags) {
    if (!t || TAG_DROP.has(t)) continue;
    const cat = categoryMap[t] || t;
    if (!seen.has(cat)) {
      seen.add(cat);
      out.push(cat);
    }
  }
  return out;
}

// 태그 → URL slug (공백만 하이픈으로, 한글은 유지 — %-인코딩되어 서빙됨).
export function tagSlug(tag) {
  return String(tag).trim().replace(/\s+/g, "-");
}

export function decodedTagSlug(slug) {
  try {
    return decodeURIComponent(String(slug));
  } catch {
    return String(slug);
  }
}

// EN은 태그 상세를 제공하지 않는다. 기존 localizedHref 계약대로 /en/blog로 잇는다.
export function legacyBlogTagRedirects() {
  const ko = [...Object.entries(TAG_CATEGORY), ...[...TAG_DROP].map(tag => [tag, null])]
    .filter(([tag, category]) => tag !== category)
    .map(([tag, category]) => ({
      source: `/blog/tag/${encodeURIComponent(tagSlug(tag))}`,
      destination: category ? `/blog/tag/${encodeURIComponent(tagSlug(category))}` : "/blog",
      permanent: true,
    }));
  const enTags = new Set([...Object.keys(TAG_CATEGORY), ...Object.keys(TAG_CATEGORY_EN), ...TAG_DROP]);
  const en = [...enTags].map(tag => ({
    source: `/en/blog/tag/${encodeURIComponent(tagSlug(tag))}`,
    destination: "/en/blog",
    permanent: true,
  }));
  return [...ko, ...en];
}
