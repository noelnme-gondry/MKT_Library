import { resolveSlugToId, idToPath, SITE_URL } from "@/lib/routeMap";
import { findMeta } from "@/store/useDataStore";
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
  const description = meta?.group?.desc;
  const canonical = `${SITE_URL}${idToPath(routeId)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
  };
}

export default function Page({ params }) {
  return <PageClient params={params} />;
}
