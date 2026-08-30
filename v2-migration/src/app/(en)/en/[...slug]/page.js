import { resolveSlugToId, idToPath, SITE_URL, hasEnVersion, enAlternates, EN_READY_GUIDE_IDS, isRouteIndexable } from "@/lib/routeMap";
import { findMeta } from "@/store/useDataStore";
import { ITEM_TITLE_EN } from "@/lib/enNavCopy";
import { buildPageKeywords } from "@/lib/pageKeywords";
import { getRouteSeo } from "@/lib/routeSeo";
import { getToolFeatureList, getToolOgImageUrl } from "@/lib/toolOg";
import { getToolFaq, getToolSearchContent } from "@/lib/toolSearchContent";
import { getGuideFaq, getGuidePrimaryTool, getGuideSearchContent, guidePostSlugs, guideTermSlugs, isGuideRouteId } from "@/lib/guideSearchContent";
import { readSopData } from "@/lib/sopData";
import { withOpenGraphBase } from "@/lib/openGraph";
import { getSopEditorial } from "@/lib/sopEditorial";
import { blogSlugsForTool, glossarySlugsForTool } from "@/lib/toolContentLinks";
import { getAllPosts } from "@/lib/blog";
import { getComparesForTool } from "@/lib/compareContent";
import { getAllTerms } from "@/lib/glossary";
import { stripHtmlTags } from "@/lib/htmlText";
import PageClient from "./PageClient";

// 가이드 → 콘텐츠·도구 역링크. KR 미러(§(ko)/[[...slug]]/page.js)와 같은 계약.
function buildGuideEvidenceLinks(routeId) {
  const postBySlug = new Map(getAllPosts("en").map((post) => [post.slug, post]));
  const termBySlug = new Map(getAllTerms("en").map((term) => [term.slug, term]));
  const toolId = getGuidePrimaryTool(routeId);
  const toolSeo = toolId && hasEnVersion(toolId) ? getRouteSeo(toolId, "en") : null;
  const tools = toolId && toolSeo
    ? [{ type: "tool", href: `/en${idToPath(toolId)}`, title: toolSeo.title, description: toolSeo.description }]
    : [];
  const posts = guidePostSlugs(routeId)
    .map((slug) => postBySlug.get(slug))
    .filter(Boolean)
    .map((post) => ({ type: "post", href: `/en/blog/${post.slug}`, title: post.title, description: post.description || "" }));
  const terms = guideTermSlugs(routeId)
    .map((slug) => termBySlug.get(slug))
    .filter(Boolean)
    .map((term) => ({ type: "term", href: `/en/glossary/${term.slug}`, title: term.term, description: term.shortDef || "" }));
  return [...tools, ...posts, ...terms];
}

// 도구 → 콘텐츠 역링크(제목·요약은 server 전용 로더에서 읽어 직렬화해 내려준다).
function buildEvidenceLinks(routeId) {
  if (!routeId) return [];
  if (isGuideRouteId(routeId)) return buildGuideEvidenceLinks(routeId);
  if (!(routeId.startsWith("5-") || routeId.startsWith("9-"))) return [];
  const postBySlug = new Map(getAllPosts("en").map((post) => [post.slug, post]));
  const termBySlug = new Map(getAllTerms("en").map((term) => [term.slug, term]));
  const posts = blogSlugsForTool(routeId)
    .map((slug) => postBySlug.get(slug))
    .filter(Boolean)
    .map((post) => ({ type: "post", href: `/en/blog/${post.slug}`, title: post.title, description: post.description || "" }));
  const terms = glossarySlugsForTool(routeId)
    .map((slug) => termBySlug.get(slug))
    .filter(Boolean)
    .map((term) => ({ type: "term", href: `/en/glossary/${term.slug}`, title: term.term, description: term.shortDef || "" }));
  // 방법 비교 역링크. "이 도구를 써야 하나"는 도구 안이 아니라 비교 페이지가 답한다.
  const compares = getComparesForTool(routeId, "en")
    .map((page) => ({ type: "compare", href: `/en/compare/${page.slug}`, title: page.title, description: page.answer }));
  return [...posts, ...terms, ...compares];
}

// EN 가이드({id}.en.json)의 title/deck을 메타데이터로 재사용 — generateMetadata는
// 서버 전용이라 fs 직접 읽기 가능(public/은 그대로 정적 서빙, 여기선 빌드타임 참조만).
function readEnGuideMeta(routeId) {
  const data = readSopData(routeId, "en");
  const deck = stripHtmlTags(data?.deck);
  return { title: data?.title || null, description: deck || null };
}

// KR [[...slug]]/page.js의 EN 미러. 이 트리는 EN_READY_TOOL_IDS에 있는 도구만
// 실제로 렌더하고(§plan), 나머지는 PageClient가 런타임에 KR로 redirect한다 —
// 여기서는 그 경우 EN 메타데이터를 아예 내지 않는다(반쪽 번역 페이지 인덱싱 방지).
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const routeId = resolveSlugToId(slug);
  if (!routeId || !hasEnVersion(routeId)) return {};

  const meta = findMeta(routeId);
  const routeSeo = getRouteSeo(routeId, "en");
  const guideMeta = EN_READY_GUIDE_IDS.has(routeId) ? readEnGuideMeta(routeId) : { title: null, description: null };
  const title = routeSeo?.title || meta?.seoTitleEn || meta?.titleEn || guideMeta.title || ITEM_TITLE_EN[routeId] || meta?.title || routeId;
  const description = routeSeo?.description || meta?.seoDescriptionEn || guideMeta.description || meta?.seoDescription || meta?.title;
  const canonical = `${SITE_URL}/en${idToPath(routeId)}`;
  const keywords = buildPageKeywords(meta, "en");
  const langs = enAlternates(routeId);
  const socialImage = getToolOgImageUrl(SITE_URL, routeId, "en");

  return {
    title,
    description,
    keywords,
    ...(!isRouteIndexable(routeId) ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical, ...(langs ? { languages: langs } : {}) },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [socialImage] }, "en"),
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
  const routeSeo = routeId ? getRouteSeo(routeId, "en") : null;
  const searchContent = routeId ? getToolSearchContent(routeId, "en") : null;
  const editorial = routeId ? getSopEditorial(routeId, "en") : null;
  const initialSopData = routeId && EN_READY_GUIDE_IDS.has(routeId) ? readSopData(routeId, "en") : null;
  const isTool = Boolean(routeId && (routeId.startsWith("5-") || routeId.startsWith("9-")) && hasEnVersion(routeId));
  const toolUrl = routeId ? `${SITE_URL}/en${idToPath(routeId)}` : "";
  const structuredData = isTool && (meta || routeSeo) ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: routeSeo?.title || meta?.seoTitleEn || meta?.titleEn || meta?.title || routeId,
        description: routeSeo?.description || meta?.seoDescriptionEn || meta?.seoDescription || meta?.group?.desc,
        url: toolUrl,
        image: getToolOgImageUrl(SITE_URL, routeId, "en"),
        featureList: getToolFeatureList(routeId, "en"),
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        inLanguage: "en",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: "Start analysis", item: `${SITE_URL}/en/start` },
          { "@type": "ListItem", position: 3, name: routeSeo?.title || meta?.titleEn || meta?.title || routeId, item: toolUrl },
        ],
      },
    ],
  } : null;
  // 가이드도 FAQ·Breadcrumb을 낸다(KR 미러). isTool 게이트만 있던 시절 가이드는
  // TechArticle 하나뿐이라 FAQPage도 BreadcrumbList도 없었다.
  const guideContent = routeId && EN_READY_GUIDE_IDS.has(routeId) ? getGuideSearchContent(routeId, "en") : null;
  const faqSource = searchContent?.faq?.length
    ? getToolFaq(routeId, "en")
    : guideContent ? getGuideFaq(routeId, "en") : [];
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
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/en` },
      { "@type": "ListItem", position: 2, name: "Operating guides", item: `${SITE_URL}/en${idToPath("guide-index")}` },
      { "@type": "ListItem", position: 3, name: initialSopData?.title || routeSeo?.title || meta?.title || routeId, item: toolUrl },
    ],
  } : null;
  const sopStructuredData = editorial ? {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: initialSopData?.title || routeSeo?.title || meta?.seoTitleEn || meta?.titleEn || meta?.title || routeId,
    description: stripHtmlTags(initialSopData?.deck) || routeSeo?.description || meta?.seoDescriptionEn || meta?.seoDescription || meta?.desc,
    url: toolUrl,
    inLanguage: "en",
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
    <PageClient params={params} initialSopData={initialSopData} evidenceLinks={buildEvidenceLinks(routeId)} />
  </>;
}
