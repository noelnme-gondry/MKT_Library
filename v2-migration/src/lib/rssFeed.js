import { SITE_URL } from "@/lib/routeMap";
import { getAllPosts } from "@/lib/blog";

const PRODUCT_UPDATED_AT = new Date("2026-07-29T00:00:00Z");
const CONTACT = "gondry.montauk@gmail.com (Growth Opt Playbook)";

const CHANNELS = {
  ko: {
    title: "Growth Opt Playbook | 마케팅 의사결정 워크스페이스",
    description: "캠페인 CSV로 성과 원인을 찾고 다음 행동을 정한 뒤 실제 결과까지 검토하는 퍼포먼스 마케팅 도구와 실무 SOP.",
    language: "ko-KR",
    path: "/rss.xml",
    postPrefix: "/blog/",
  },
  en: {
    title: "Growth Opt Playbook | Performance Marketing Decision Workspace",
    description: "Browser-only performance marketing analysis tools and practical guides for finding the next action from campaign data.",
    language: "en-US",
    path: "/en/rss.xml",
    postPrefix: "/en/blog/",
  },
};

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(value) {
  const cdataEnd = "]" + "]" + ">";
  const safeValue = String(value ?? "").split(cdataEnd).join(`${cdataEnd}<![CDATA[>`);
  return `<![CDATA[${safeValue}${cdataEnd}`;
}

function stripTags(value) {
  return String(value ?? "").replace(/<[^>]*>/g, "").trim();
}

export function buildRssFeed(locale = "ko") {
  const config = CHANNELS[locale] || CHANNELS.ko;
  const posts = getAllPosts(locale);
  const latestContentDate = posts.map((post) => post.updated || post.date).filter(Boolean).sort().at(-1);
  const latestTimestamp = latestContentDate ? new Date(latestContentDate).getTime() : 0;
  const lastBuildDate = new Date(Math.max(PRODUCT_UPDATED_AT.getTime(), latestTimestamp)).toUTCString();
  const items = posts.map((post) => {
    const link = `${SITE_URL}${config.postPrefix}${post.slug}`;
    const pubDate = post.date ? new Date(post.date).toUTCString() : PRODUCT_UPDATED_AT.toUTCString();
    return `    <item>
      <title>${xmlEscape(stripTags(post.title))}</title>
      <link>${xmlEscape(link)}</link>
      <description>${cdata(post.rssHtml)}</description>
      <content:encoded>${cdata(post.rssHtml)}</content:encoded>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${pubDate}</pubDate>
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(config.title)}</title>
    <link>${xmlEscape(`${SITE_URL}${locale === "en" ? "/en" : "/"}`)}</link>
    <atom:link href="${xmlEscape(`${SITE_URL}${config.path}`)}" rel="self" type="application/rss+xml" />
    <description>${xmlEscape(config.description)}</description>
    <language>${config.language}</language>
    <managingEditor>${CONTACT}</managingEditor>
    <webMaster>${CONTACT}</webMaster>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

export function rssResponse(locale = "ko") {
  return new Response(buildRssFeed(locale), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
