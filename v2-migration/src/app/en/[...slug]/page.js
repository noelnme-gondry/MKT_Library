import { resolveSlugToId, idToPath, SITE_URL, hasEnVersion, enAlternates, EN_READY_GUIDE_IDS, isRoutePublished } from "@/lib/routeMap";
import { findMeta } from "@/store/useDataStore";
import { ITEM_TITLE_EN } from "@/lib/enNavCopy";
import { buildPageKeywords } from "@/lib/pageKeywords";
import { getRouteSeo } from "@/lib/routeSeo";
import { readSopData } from "@/lib/sopData";
import PageClient from "./PageClient";

// EN 가이드({id}.en.json)의 title/deck을 메타데이터로 재사용 — generateMetadata는
// 서버 전용이라 fs 직접 읽기 가능(public/은 그대로 정적 서빙, 여기선 빌드타임 참조만).
function readEnGuideMeta(routeId) {
  const data = readSopData(routeId, "en");
  const deck = String(data?.deck || "").replace(/<[^>]+>/g, "");
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

  return {
    title,
    description,
    keywords,
    ...(!isRoutePublished(routeId) ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical, ...(langs ? { languages: langs } : {}) },
    openGraph: { title, description, url: canonical, locale: "en_US", images: [`${SITE_URL}/og-card.png`] },
  };
}

export default function Page({ params }) {
  return <PageWithStructuredData params={params} />;
}

async function PageWithStructuredData({ params }) {
  const { slug } = await params;
  const routeId = resolveSlugToId(slug);
  const meta = routeId ? findMeta(routeId) : null;
  const initialSopData = routeId && EN_READY_GUIDE_IDS.has(routeId) ? readSopData(routeId, "en") : null;
  const isTool = Boolean(routeId && (routeId.startsWith("5-") || routeId.startsWith("9-")) && hasEnVersion(routeId));
  const structuredData = isTool && meta ? {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: meta.seoTitleEn || meta.titleEn || meta.title,
    description: meta.seoDescriptionEn || meta.seoDescription || meta.group?.desc,
    url: `${SITE_URL}/en${idToPath(routeId)}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    inLanguage: "en",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  } : null;
  return <>
    {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />}
    <PageClient params={params} initialSopData={initialSopData} />
  </>;
}
