import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import Footer from "@/components/Footer";
import AnalyticsScripts from "@/components/AnalyticsScripts";
import ConsentBanner from "@/components/ConsentBanner";
import { consentDefaultSnippet } from "@/lib/consent";
import { SIDEBAR_COLLAPSED_CLASS, SIDEBAR_STORAGE_KEY, collapsedByDefaultPaths } from "@/lib/sidebarCollapse";
import SkipLink from "@/components/SkipLink";
import { BRAND } from "@/lib/brandFacts";
import WorkspaceStorageBootstrap from "@/components/WorkspaceStorageBootstrap";

/* eslint-disable @next/next/no-head-element -- shared by the two App Router root layouts */

const wantedSans = localFont({
  src: "../../public/fonts/WantedSansVariable.woff2",
  variable: "--font-wanted-sans",
  weight: "400 1000",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Arial", "sans-serif"],
});
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });

const SITE_URL = "https://growthoptplaybook.com";

// 사이드바 초기 상태는 첫 페인트 전에 정해야 한다 — 마운트 후에 접으면 도구 화면이
// 열릴 때마다 내비가 한 번 번쩍인다. 경로 목록은 라우트에서 파생한다(§7 손목록 금지).
const SIDEBAR_DEFAULT_COLLAPSED_PATHS = collapsedByDefaultPaths();

export default function RootDocument({ children, locale = "ko" }) {
  const isEnglish = locale === "en";
  const language = isEnglish ? "en" : "ko";
  return (
    <html lang={language} suppressHydrationWarning className={`${wantedSans.variable} ${jetBrainsMono.variable} dark`}>
      <head>
        {/* 기본 테마가 라이트인데 theme-color만 다크로 고정돼 있어 모바일 브라우저
            상단 크롬만 검게 떴다. 실제로 칠해지는 배경(--background)에 맞춘다. */}
        <meta name="theme-color" content="#f8f9fa" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)" />
        <meta name="naver-site-verification" content="c4cc3586f416c84363563356e79f834ca11544a7" />
        <link rel="alternate" type="application/rss+xml" title={isEnglish ? "Growth Opt Playbook — English" : "Growth Opt Playbook"} href={isEnglish ? "/en/rss.xml" : "/rss.xml"} />
        <link rel="alternate" type="text/plain" title="Growth Opt Playbook for AI readers" href="/llms.txt" />
      </head>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('mkt-library-theme');var d=t?t==='dark':!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(!d)document.body.classList.add('light-mode')}catch(e){document.body.classList.add('light-mode')}" }} />
        <script dangerouslySetInnerHTML={{ __html: `try{var P=${JSON.stringify(SIDEBAR_DEFAULT_COLLAPSED_PATHS)};var v=localStorage.getItem(${JSON.stringify(SIDEBAR_STORAGE_KEY)});var p=(location.pathname||'/').replace(/^\\/en(?=\\/|$)/,'').replace(/\\/+$/,'')||'/';var c=(v==='collapsed'||v==='expanded')?v==='collapsed':P.indexOf(p)>=0;if(c)document.body.classList.add(${JSON.stringify(SIDEBAR_COLLAPSED_CLASS)})}catch(e){}` }} />
        <SkipLink />
        <WorkspaceStorageBootstrap />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  url: isEnglish ? `${SITE_URL}/en` : `${SITE_URL}/`,
                  name: BRAND.name,
                  description: isEnglish ? "Performance marketing decision workspace" : "퍼포먼스 마케팅 주간 의사결정 워크스페이스",
                  inLanguage: isEnglish ? "en" : "ko-KR",
                },
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}/#org`,
                  name: BRAND.name,
                  url: `${SITE_URL}/`,
                  logo: `${SITE_URL}/icons/dochi-512.png`,
                },
              ],
            }),
          }}
        />
        {/* noscript 경로는 호스트 게이트를 못 건다 — 게이트가 클라이언트 컴포넌트라
            JS가 꺼진 브라우저에서는 렌더 자체가 안 되고, 그러면 운영에서도 이 iframe이
            사라진다. JS 없는 로컬 브라우징은 사실상 없으므로 여기는 그대로 둔다. */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-T6C7QW75"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          ></iframe>
        </noscript>
        {/* Consent Mode v2 기본값 — 반드시 GTM·GA4보다 먼저 실행돼야 한다.
            EEA/UK는 region 기본 거부(판정은 Google이 IP로 수행), 그 외 지역은 허용. */}
        <script
          id="consent-default"
          dangerouslySetInnerHTML={{ __html: consentDefaultSnippet() }}
        />
        <AnalyticsScripts />
        {children}
        <ConsentBanner locale={locale} />
        <Footer />
      </body>
    </html>
  );
}
