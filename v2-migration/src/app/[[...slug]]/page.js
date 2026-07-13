import { resolveSlugToId, idToPath, SITE_URL } from "@/lib/routeMap";
import { findMeta } from "@/store/useDataStore";
import { buildPageKeywords } from "@/lib/pageKeywords";
import PageClient from "./PageClient";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const routeId = resolveSlugToId(slug);
  if (!routeId || routeId === "home") {
    // 홈은 자기 자신을 canonical로 명시(루트). layout에서 canonical을 제거해 자식
    // 누수를 막았으므로 홈은 여기서 선언.
    return { alternates: { canonical: `${SITE_URL}/` } };
  }

  const meta = findMeta(routeId);
  const title = meta?.title || routeId;
  // 항목 제목을 앞세워 그룹 내 페이지끼리 description 중복 방지(중복 설명=SEO 감점).
  const description = meta?.title
    ? `${meta.title} — ${meta.group?.desc || ""}`.trim()
    : meta?.group?.desc;
  const canonical = `${SITE_URL}${idToPath(routeId)}`;
  const keywords = buildPageKeywords(meta);

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
  };
}

export default function Page({ params }) {
  return <PageClient params={params} />;
}
