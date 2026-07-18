import { resolveSlugToId, idToPath, SITE_URL, hasEnVersion, enAlternates } from "@/lib/routeMap";
import { findMeta } from "@/store/useDataStore";
import { buildPageKeywords } from "@/lib/pageKeywords";
import PageClient from "./PageClient";

// KR [[...slug]]/page.js의 EN 미러. 이 트리는 EN_READY_TOOL_IDS에 있는 도구만
// 실제로 렌더하고(§plan), 나머지는 PageClient가 런타임에 KR로 redirect한다 —
// 여기서는 그 경우 EN 메타데이터를 아예 내지 않는다(반쪽 번역 페이지 인덱싱 방지).
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const routeId = resolveSlugToId(slug);
  if (!routeId || !hasEnVersion(routeId)) return {};

  const meta = findMeta(routeId);
  const title = meta?.seoTitleEn || meta?.titleEn || meta?.title || routeId;
  const description = meta?.seoDescriptionEn || meta?.seoDescription || meta?.title;
  const canonical = `${SITE_URL}/en${idToPath(routeId)}`;
  const keywords = buildPageKeywords(meta, "en");
  const langs = enAlternates(routeId);

  return {
    title,
    description,
    keywords,
    alternates: { canonical, ...(langs ? { languages: langs } : {}) },
    openGraph: { title, description, url: canonical, locale: "en_US", images: [`${SITE_URL}/og-card.png`] },
  };
}

export default function Page({ params }) {
  return <PageClient params={params} />;
}
