import { SITE_URL } from "@/lib/routeMap";
import { getAllPosts } from "@/lib/blog";
import { getAllTerms } from "@/lib/glossary";
import { stripHtmlTags } from "@/lib/htmlText";

const PRODUCT_UPDATED_AT = new Date("2026-07-29T00:00:00Z");
const CONTACT = "gondry.montauk@gmail.com (Growth Opt Playbook)";

const CHANNELS = {
  ko: {
    title: "Growth Opt Playbook | 마케팅 의사결정 워크스페이스",
    description: "캠페인 CSV로 성과 원인을 찾고 다음 행동을 정한 뒤 실제 결과까지 검토하는 퍼포먼스 마케팅 도구와 실무 SOP.",
    language: "ko-KR",
    path: "/rss.xml",
    postPrefix: "/blog/",
    glossaryPrefix: "/glossary/",
  },
  en: {
    title: "Growth Opt Playbook | Performance Marketing Decision Workspace",
    description: "Browser-only performance marketing analysis tools and practical guides for finding the next action from campaign data.",
    language: "en-US",
    path: "/en/rss.xml",
    postPrefix: "/en/blog/",
    glossaryPrefix: "/en/glossary/",
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
  return stripHtmlTags(value).trim();
}

export function buildRssFeed(locale = "ko") {
  const config = CHANNELS[locale] || CHANNELS.ko;
  // 블로그 + 용어사전을 한 피드에. 용어사전도 sitemap과 동일하게 색인 대상인데
  // 피드에서만 빠져 있으면 RSS로 수집하는 크롤러(네이버 서치어드바이저)에는
  // 존재하지 않는 문서가 된다. 정렬은 날짜 내림차순, 동률이면 URL로 결정적.
  const posts = getAllPosts(locale);
  const terms = getAllTerms(locale);
  const entries = [
    ...posts.map((post) => ({
      title: stripTags(post.title),
      link: `${SITE_URL}${config.postPrefix}${post.slug}`,
      html: post.rssHtml,
      date: post.date,
      sortDate: post.updated || post.date,
    })),
    ...terms.map((term) => ({
      title: stripTags(term.seoTitle || term.term),
      link: `${SITE_URL}${config.glossaryPrefix}${term.slug}`,
      html: term.html,
      date: term.date,
      sortDate: term.date,
    })),
  ].sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)) || a.link.localeCompare(b.link));

  const latestContentDate = entries.map((entry) => entry.sortDate).filter(Boolean).sort().at(-1);
  const latestTimestamp = latestContentDate ? new Date(latestContentDate).getTime() : 0;
  const lastBuildDate = new Date(Math.max(PRODUCT_UPDATED_AT.getTime(), latestTimestamp)).toUTCString();
  const items = entries.map((entry) => {
    const pubDate = entry.date ? new Date(entry.date).toUTCString() : PRODUCT_UPDATED_AT.toUTCString();
    return `    <item>
      <title>${xmlEscape(entry.title)}</title>
      <link>${xmlEscape(entry.link)}</link>
      <description>${cdata(entry.html)}</description>
      <content:encoded>${cdata(entry.html)}</content:encoded>
      <guid isPermaLink="true">${xmlEscape(entry.link)}</guid>
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
