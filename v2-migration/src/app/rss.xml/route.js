import { SITE_URL } from "@/lib/routeMap";
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

function cdata(s) {
  return `<![CDATA[${String(s ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

// 태그(<strong> 등) 제거 — IA desc/title은 평문이지만 방어적으로 스트립.
function stripTags(s) {
  return String(s ?? "").replace(/<[^>]*>/g, "").trim();
}

export const dynamic = "force-static";
const PRODUCT_UPDATED_AT = new Date("2026-07-29T00:00:00Z");
const PRODUCT_PUB_DATE = PRODUCT_UPDATED_AT.toUTCString();

export function GET() {
  const posts = getAllPosts();
  const latestContentDate = posts.map((post) => post.updated || post.date).filter(Boolean).sort().at(-1);
  const latestTimestamp = latestContentDate ? new Date(latestContentDate).getTime() : 0;
  const lastBuildDate = new Date(Math.max(PRODUCT_UPDATED_AT.getTime(), latestTimestamp)).toUTCString();

  // RSS는 블로그 본문 전체를 피드로 제공한다. 요약만 있는 도구 페이지는 sitemap으로
  // 발견시키고 RSS에 섞지 않는다. 네이버는 RSS item 본문 전체 공개를 권장한다.
  const blogItems = posts
    .map((p) => {
      const link = `${SITE_URL}/blog/${p.slug}`;
      const pub = p.date ? new Date(p.date).toUTCString() : PRODUCT_PUB_DATE;
      return `    <item>
      <title>${xmlEscape(stripTags(p.title))}</title>
      <link>${xmlEscape(link)}</link>
      <description>${cdata(p.rssHtml)}</description>
      <content:encoded>${cdata(p.rssHtml)}</content:encoded>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${pub}</pubDate>
    </item>`;
    })
    .join("\n");

  const items = blogItems;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(CHANNEL_TITLE)}</title>
    <link>${xmlEscape(SITE_URL + "/")}</link>
    <atom:link href="${xmlEscape(SITE_URL + "/rss.xml")}" rel="self" type="application/rss+xml" />
    <description>${xmlEscape(CHANNEL_DESC)}</description>
    <language>ko-KR</language>
    <managingEditor>gondry.montauk@gmail.com (Growth Opt Playbook)</managingEditor>
    <webMaster>gondry.montauk@gmail.com (Growth Opt Playbook)</webMaster>
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
