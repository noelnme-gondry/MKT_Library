import { resolveSlugToId, idToPath, SITE_URL, enAlternates, isRouteIndexable } from "@/lib/routeMap";
import { findMeta } from "@/store/useDataStore";
import { buildPageKeywords } from "@/lib/pageKeywords";
import { getRouteSeo } from "@/lib/routeSeo";
import { getToolFeatureList, getToolOgImageUrl } from "@/lib/toolOg";
import { getResponseSubtoolContent } from "@/lib/responseSubtoolContent";
import { withOpenGraphBase } from "@/lib/openGraph";
import { getSopEditorial } from "@/lib/sopEditorial";
import PageClient from "./PageClient";

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
  // seoTitle/seoDescription: SERP 클릭 유도용 결과지향 문구(선택적 오버라이드).
  // 없으면 기존 방식(항목 제목 + 그룹 desc, 중복 설명 방지)으로 폴백.
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
  const searchContent = routeId ? getResponseSubtoolContent(routeId, "ko") : null;
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
  const faqStructuredData = searchContent?.faq?.length ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: searchContent.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
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
    {sopStructuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sopStructuredData) }} />}
    <PageClient params={params} />
  </>;
}
