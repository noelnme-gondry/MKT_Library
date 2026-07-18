import { resolveSlugToId, idToPath, SITE_URL, enAlternates } from "@/lib/routeMap";
import { findMeta } from "@/store/useDataStore";
import { buildPageKeywords } from "@/lib/pageKeywords";
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
  const title = meta?.seoTitle || meta?.title || routeId;
  // seoTitle/seoDescription: SERP 클릭 유도용 결과지향 문구(선택적 오버라이드).
  // 없으면 기존 방식(항목 제목 + 그룹 desc, 중복 설명 방지)으로 폴백.
  const description =
    meta?.seoDescription ||
    (meta?.title
      ? `${meta.title} — ${meta.group?.desc || ""}`.trim()
      : meta?.group?.desc);
  const canonical = `${SITE_URL}${idToPath(routeId)}`;
  const keywords = buildPageKeywords(meta);
  const langs = enAlternates(routeId);

  return {
    title,
    description,
    keywords,
    alternates: { canonical, ...(langs ? { languages: langs } : {}) },
    openGraph: { title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] },
  };
}

export default function Page({ params }) {
  return <PageClient params={params} />;
}
