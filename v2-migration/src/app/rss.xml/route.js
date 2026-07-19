import { ROUTES, SITE_URL, isRoutePublished } from "@/lib/routeMap";
import { findMeta } from "@/store/useDataStore";
import { getAllPosts } from "@/lib/blog";

// Next 16 route handler → /rss.xml. 네이버 서치어드바이저 RSS 제출용.
// sitemap.js와 동일하게 routeMap SSOT + IA(findMeta) 기반이라 도구/SOP 추가 시
// 자동 반영(표류 없음). 홈은 채널(link)로 쓰고 item에서는 제외.
const CHANNEL_TITLE = "Growth Opt Playbook | 마케팅 데이터 분석툴";
const CHANNEL_DESC =
  "캠페인 CSV로 성과·예산 배분·A/B·MMM을 분석하는 무료 퍼포먼스 마케팅 도구와 실무 SOP.";

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 태그(<strong> 등) 제거 — IA desc/title은 평문이지만 방어적으로 스트립.
function stripTags(s) {
  return String(s ?? "").replace(/<[^>]*>/g, "").trim();
}

export const dynamic = "force-static";
const PRODUCT_PUB_DATE = new Date("2026-07-20T00:00:00Z").toUTCString();

export function GET() {
  const posts = getAllPosts();
  const latestContentDate = posts.map((post) => post.updated || post.date).filter(Boolean).sort().at(-1);
  const lastBuildDate = latestContentDate ? new Date(latestContentDate).toUTCString() : PRODUCT_PUB_DATE;

  // 블로그 글이 RSS의 본령 — 발행 글을 먼저(최신순), 그 아래 도구 페이지.
  const blogItems = posts
    .map((p) => {
      const link = `${SITE_URL}/blog/${p.slug}`;
      const pub = p.date ? new Date(p.date).toUTCString() : PRODUCT_PUB_DATE;
      return `    <item>
      <title>${xmlEscape(stripTags(p.title))}</title>
      <link>${xmlEscape(link)}</link>
      <description>${xmlEscape(stripTags(p.description))}</description>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${pub}</pubDate>
    </item>`;
    })
    .join("\n");

  const seen = new Set();
  const toolItems = ROUTES.filter((r) => {
    if (!isRoutePublished(r) || r.slug === "/" || seen.has(r.slug)) return false;
    seen.add(r.slug);
    return !!findMeta(r.id);
  })
    .map((r) => {
      const meta = findMeta(r.id);
      const title = stripTags(meta?.title || r.id);
      const desc = stripTags(
        meta?.title ? `${meta.title} — ${meta.group?.desc || ""}` : meta?.group?.desc || "",
      );
      const link = SITE_URL + r.slug;
      return `    <item>
      <title>${xmlEscape(title)}</title>
      <link>${xmlEscape(link)}</link>
      <description>${xmlEscape(desc)}</description>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${PRODUCT_PUB_DATE}</pubDate>
    </item>`;
    })
    .join("\n");

  const items = [blogItems, toolItems].filter(Boolean).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(CHANNEL_TITLE)}</title>
    <link>${xmlEscape(SITE_URL + "/")}</link>
    <description>${xmlEscape(CHANNEL_DESC)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
