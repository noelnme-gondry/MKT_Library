import { getAllPosts } from "@/lib/blog";
import { getAllCalculators } from "@/lib/calculators";
import { getAllTerms } from "@/lib/glossary";
import { ROUTES, SITE_URL, hasEnVersion, idToPath, isRouteIndexable } from "@/lib/routeMap";
import { getRouteSeo } from "@/lib/routeSeo";

export const dynamic = "force-static";

const absoluteUrl = (path, locale = "ko") => {
  const prefix = locale === "en" ? "/en" : "";
  const normalized = path === "/" ? "" : path;
  return `${SITE_URL}${prefix}${normalized}`;
};

const markdownText = (value) => String(value || "")
  .replace(/\s+/g, " ")
  .replace(/([\\[\]])/g, "\\$1")
  .trim();

const markdownEntry = ({ title, url, description }) =>
  `- [${markdownText(title)}](${url})${description ? `: ${markdownText(description)}` : ""}`;

function analysisEntries(locale) {
  return ROUTES
    .filter((route) => isRouteIndexable(route))
    .filter((route) => route.slug === "/dashboard" || route.slug.startsWith("/tools/") || route.slug.startsWith("/content/"))
    .filter((route) => locale !== "en" || hasEnVersion(route.id))
    .map((route) => {
      const seo = getRouteSeo(route.id, locale);
      return seo ? {
        title: seo.title,
        description: seo.description,
        url: absoluteUrl(route.slug, locale),
      } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.url.localeCompare(b.url));
}

function blogEntries(locale) {
  return getAllPosts(locale).map((post) => ({
    title: post.title,
    description: post.description,
    url: absoluteUrl(`/blog/${post.slug}`, locale),
  }));
}

function calculatorEntries(locale) {
  return getAllCalculators(locale).map((calculator) => ({
    title: calculator.name,
    description: calculator.summary,
    url: absoluteUrl(`/calculator/${calculator.slug}`, locale),
  }));
}

function glossaryEntries(locale) {
  return getAllTerms(locale).map((term) => ({
    title: term.term,
    description: term.shortDef || term.description,
    url: absoluteUrl(`/glossary/${term.slug}`, locale),
  }));
}

function section(title, entries) {
  return [`## ${title}`, "", ...entries.map(markdownEntry)].join("\n");
}

export function buildLlmsText() {
  // /start와 /guide는 routeMap SSOT에서 파생한다. 나머지는 routeMap 밖의 독립
  // Next.js 페이지이며, 아래 링크 전체는 route.test.js에서 sitemap과 대조한다.
  // 개별 SOP는 /guide를 탐색 진입점으로 두고 sitemap에 전체 목록을 유지한다.
  const koStart = [
    { title: "내 CSV로 분석 시작", url: absoluteUrl(idToPath("start-gate")), description: "CSV 구조를 브라우저에서 확인하고 가능한 분석을 추천합니다." },
    { title: "CSV 없이 성과 원인 찾기", url: absoluteUrl("/diagnose"), description: "증상에서 확인 순서와 다음 도구를 찾습니다." },
    { title: "빠른 마케팅 계산", url: absoluteUrl("/calculator"), description: "목표 CPA, 손익분기 ROAS, LTV:CAC와 표본수를 계산합니다." },
    { title: "CSV 템플릿", url: absoluteUrl("/templates"), description: "분석 도구별 입력 컬럼 템플릿을 받습니다." },
    { title: "운영 가이드", url: absoluteUrl(idToPath("guide-index")), description: "측정, 매체 운영, 소재와 분석 SOP를 확인합니다." },
  ];
  const enStart = [
    { title: "Analyze my CSV", url: absoluteUrl(idToPath("start-gate"), "en"), description: "Profile a CSV in the browser and find the analyses it supports." },
    { title: "Diagnose without a CSV", url: absoluteUrl("/diagnose", "en"), description: "Turn a performance symptom into a check order and next tool." },
    { title: "Quick marketing calculations", url: absoluteUrl("/calculator", "en"), description: "Calculate target CPA, break-even ROAS, LTV:CAC, and sample size." },
    { title: "CSV templates", url: absoluteUrl("/templates", "en"), description: "Download input-column templates for each analysis." },
    { title: "Operating guides", url: absoluteUrl(idToPath("guide-index"), "en"), description: "Read measurement, campaign, creative, and analysis playbooks." },
  ];

  return [
    "# Growth Opt Playbook",
    "",
    "> Free, no-signup performance marketing analysis tools that turn campaign data into one next action.",
    "",
    "Growth Opt Playbook is built for performance marketers. Uploaded CSV and Google Sheets data is processed in the user's browser and is not sent to the application server. Korean is the primary language, and verified English routes are listed separately.",
    "",
    section("Start — Korean", koStart),
    "",
    section("Analysis tools — Korean", analysisEntries("ko")),
    "",
    section("Practical articles — Korean", blogEntries("ko")),
    "",
    section("Calculators — Korean", calculatorEntries("ko")),
    "",
    section("Glossary — Korean", glossaryEntries("ko")),
    "",
    section("Start — English", enStart),
    "",
    section("Analysis tools — English", analysisEntries("en")),
    "",
    section("Practical articles — English", blogEntries("en")),
    "",
    section("Calculators — English", calculatorEntries("en")),
    "",
    section("Glossary — English", glossaryEntries("en")),
    "",
    "## Optional",
    "",
    markdownEntry({ title: "Sitemap", url: `${SITE_URL}/sitemap.xml`, description: "Complete index of canonical public pages." }),
    markdownEntry({ title: "RSS feed", url: `${SITE_URL}/rss.xml`, description: "Full-text Korean practical articles." }),
    "",
  ].join("\n");
}

export function GET() {
  return new Response(buildLlmsText(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
