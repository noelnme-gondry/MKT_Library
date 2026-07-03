import { SITE_URL } from "@/lib/routeMap";

// robots.txt (Next 자동 생성 → /robots.txt). 전체 허용 + 사이트맵 위치 고지.
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
