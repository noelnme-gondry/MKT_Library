import { resolveSlugToId, idToPath, SITE_URL, enAlternates, isRouteIndexable } from "@/lib/routeMap";
import { findMeta } from "@/store/useDataStore";
import { buildPageKeywords } from "@/lib/pageKeywords";
import { getRouteSeo } from "@/lib/routeSeo";
import { getToolFeatureList, getToolOgImageUrl } from "@/lib/toolOg";
import { getToolFaq, getToolSearchContent } from "@/lib/toolSearchContent";
import { getGuideFaq, getGuidePrimaryTool, getGuideSearchContent, guidePostSlugs, guideTermSlugs, isGuideRouteId } from "@/lib/guideSearchContent";
import { withOpenGraphBase } from "@/lib/openGraph";
import { getSopEditorial } from "@/lib/sopEditorial";
import { blogSlugsForTool, glossarySlugsForTool } from "@/lib/toolContentLinks";
import { getAllPosts } from "@/lib/blog";
import { getComparesForTool } from "@/lib/compareContent";
import { getAllTerms } from "@/lib/glossary";
import PageClient from "./PageClient";

// 가이드 → 콘텐츠·도구 역링크. 가이드는 본문이 이미 롱폼이라 아웃바운드가 없으면
// 막다른 페이지가 된다 — 실제로 15개 전부 도구·블로그로 나가는 링크가 0건이었다.
function buildGuideEvidenceLinks(routeId) {
  const postBySlug = new Map(getAllPosts("ko").map((post) => [post.slug, post]));
  const termBySlug = new Map(getAllTerms("ko").map((term) => [term.slug, term]));
  const toolId = getGuidePrimaryTool(routeId);
  const toolSeo = toolId ? getRouteSeo(toolId, "ko") : null;
  const tools = toolId && toolSeo
    ? [{ type: "tool", href: idToPath(toolId), title: toolSeo.title, description: toolSeo.description }]
    : [];
  const posts = guidePostSlugs(routeId)
    .map((slug) => postBySlug.get(slug))
    .filter(Boolean)
    .map((post) => ({ type: "post", href: `/blog/${post.slug}`, title: post.title, description: post.description || "" }));
  const terms = guideTermSlugs(routeId)
    .map((slug) => termBySlug.get(slug))
    .filter(Boolean)
    .map((term) => ({ type: "term", href: `/glossary/${term.slug}`, title: term.term, description: term.shortDef || "" }));
  return [...tools, ...posts, ...terms];
}

// 도구 → 콘텐츠 역링크(제목·요약은 server 전용 로더에서 읽어 직렬화해 내려준다).
function buildEvidenceLinks(routeId) {
  if (!routeId) return [];
  if (isGuideRouteId(routeId)) return buildGuideEvidenceLinks(routeId);
  if (!(routeId.startsWith("5-") || routeId.startsWith("9-"))) return [];
  const postBySlug = new Map(getAllPosts("ko").map((post) => [post.slug, post]));
  const termBySlug = new Map(getAllTerms("ko").map((term) => [term.slug, term]));
  const posts = blogSlugsForTool(routeId)
    .map((slug) => postBySlug.get(slug))
    .filter(Boolean)
    .map((post) => ({ type: "post", href: `/blog/${post.slug}`, title: post.title, description: post.description || "" }));
  const terms = glossarySlugsForTool(routeId)
    .map((slug) => termBySlug.get(slug))
    .filter(Boolean)
    .map((term) => ({ type: "term", href: `/glossary/${term.slug}`, title: term.term, description: term.shortDef || "" }));
  // 방법 비교 역링크. "이 도구를 써야 하나"는 도구 안이 아니라 비교 페이지가 답한다.
  const compares = getComparesForTool(routeId, "ko")
    .map((page) => ({ type: "compare", href: `/compare/${page.slug}`, title: page.title, description: page.answer }));
  return [...posts, ...terms, ...compares];
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const routeId = resolveSlugToId(slug);
  if (!routeId || routeId === "home") {
    // 홈은 자기 자신을 canonical로 명시(루트). layout에서 canonical을 제거해 자식
    // 누수를 막았으므로 홈은 여기서 선언.
    const homeLangs = enAlternates("home");
    return {
      alternates: {
        canonical: `${SITE_URL}/`,
        ...(homeLangs ? { languages: homeLangs } : {}),
      },
    };
  }

  const meta = findMeta(routeId);
  const routeSeo = getRouteSeo(routeId, "ko");
  const title = routeSeo?.title || meta?.seoTitle || meta?.title || routeId;
  // meta.seoTitle/seoDescription은 **더 이상 SERP 오버라이드가 아니다**. routeSeo가
  // 색인 가능한 전 라우트를 덮으므로(routeSeo.test.js가 강제) 이 폴백은 preview
  // 라우트에서만 도달한다. 스토어의 그 필드들은 현재 ⌘K 검색 텍스트(GlobalModals)
  // 용도로 살아 있다 — "SERP 클릭 유도 오버라이드"라고 적혀 있던 옛 주석은 틀렸다.
  // routeSeo에 없는 preview 라우트는 항목 제목 + 그룹 desc로 폴백한다.
  const description =
    routeSeo?.description || meta?.seoDescription ||
    (meta?.title
      ? `${meta.title} — ${meta.group?.desc || ""}`.trim()
      : meta?.group?.desc);
  const canonical = `${SITE_URL}${idToPath(routeId)}`;
  const keywords = buildPageKeywords(meta);
  const langs = enAlternates(routeId);
  const socialImage = getToolOgImageUrl(SITE_URL, routeId, "ko");

  return {
    title,
    description,
    keywords,
    ...(!isRouteIndexable(routeId) ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical, ...(langs ? { languages: langs } : {}) },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [socialImage] }),
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default function Page({ params }) {
  return <PageWithStructuredData params={params} />;
}

async function PageWithStructuredData({ params }) {
  const { slug } = await params;
  const routeId = resolveSlugToId(slug);
  const meta = routeId ? findMeta(routeId) : null;
  const routeSeo = routeId ? getRouteSeo(routeId, "ko") : null;
  const searchContent = routeId ? getToolSearchContent(routeId, "ko") : null;
  const editorial = routeId ? getSopEditorial(routeId, "ko") : null;
  const isTool = Boolean(routeId && (routeId.startsWith("5-") || routeId.startsWith("9-")));
  const toolUrl = routeId ? `${SITE_URL}${idToPath(routeId)}` : "";
  const structuredData = isTool && (meta || routeSeo) ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: routeSeo?.title || meta?.seoTitle || meta?.title || routeId,
        description: routeSeo?.description || meta?.seoDescription || meta?.group?.desc,
        url: toolUrl,
        image: getToolOgImageUrl(SITE_URL, routeId, "ko"),
        featureList: getToolFeatureList(routeId, "ko"),
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        inLanguage: "ko-KR",
        offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "분석 시작", item: `${SITE_URL}/start` },
          { "@type": "ListItem", position: 3, name: routeSeo?.title || meta?.title || routeId, item: toolUrl },
        ],
      },
    ],
  } : null;
  // 가이드도 FAQ·Breadcrumb을 낸다. isTool 게이트만 있던 시절 가이드 15개는
  // TechArticle 하나뿐이라 FAQPage도 BreadcrumbList도 없었다.
  const guideContent = routeId ? getGuideSearchContent(routeId, "ko") : null;
  const faqSource = searchContent?.faq?.length
    ? getToolFaq(routeId, "ko")
    : guideContent ? getGuideFaq(routeId, "ko") : [];
  const faqStructuredData = faqSource.length ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqSource.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  } : null;
  const guideBreadcrumb = guideContent ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "운영 가이드", item: `${SITE_URL}${idToPath("guide-index")}` },
      { "@type": "ListItem", position: 3, name: routeSeo?.title || meta?.title || routeId, item: toolUrl },
    ],
  } : null;
  const sopStructuredData = editorial ? {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: routeSeo?.title || meta?.seoTitle || meta?.title || routeId,
    description: routeSeo?.description || meta?.seoDescription || meta?.desc,
    url: toolUrl,
    inLanguage: "ko-KR",
    dateModified: editorial.reviewedAt,
    author: { "@type": "Organization", name: "Growth Opt Playbook", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Growth Opt Playbook", url: SITE_URL },
    citation: editorial.sources.map((source) => source.url),
  } : null;
  return <>
    {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />}
    {faqStructuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />}
    {guideBreadcrumb && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideBreadcrumb) }} />}
    {sopStructuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sopStructuredData) }} />}
    <PageClient params={params} evidenceLinks={buildEvidenceLinks(routeId)} />
  </>;
}
