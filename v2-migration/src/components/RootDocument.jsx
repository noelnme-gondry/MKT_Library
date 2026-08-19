import Script from "next/script";
import { DM_Sans, JetBrains_Mono, Noto_Sans_KR, Space_Grotesk } from "next/font/google";
import Footer from "@/components/Footer";
import GaPageviews from "@/components/GaPageviews";
import ConsentBanner from "@/components/ConsentBanner";
import { consentDefaultSnippet } from "@/lib/consent";
import SkipLink from "@/components/SkipLink";

/* eslint-disable @next/next/no-head-element -- shared by the two App Router root layouts */

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });
const notoSansKr = Noto_Sans_KR({ weight: "variable", variable: "--font-noto-sans-kr", display: "swap", preload: false });

const SITE_URL = "https://growthoptplaybook.com";

export default function RootDocument({ children, locale = "ko" }) {
  const isEnglish = locale === "en";
  const language = isEnglish ? "en" : "ko";
  return (
    <html lang={language} suppressHydrationWarning className={`${dmSans.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable} ${notoSansKr.variable} dark`}>
      <head>
        <meta name="theme-color" content="#11141b" />
        <meta name="naver-site-verification" content="c4cc3586f416c84363563356e79f834ca11544a7" />
        <link rel="alternate" type="application/rss+xml" title={isEnglish ? "Growth Opt Playbook — English" : "Growth Opt Playbook"} href={isEnglish ? "/en/rss.xml" : "/rss.xml"} />
        <link rel="alternate" type="text/plain" title="Growth Opt Playbook for AI readers" href="/llms.txt" />
        {/* SVG를 못 읽는 크롤러(검색결과 파비콘 수집기 포함)를 위해 .ico를 함께 고지. */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('mkt-library-theme')!=='dark')document.body.classList.add('light-mode')}catch(e){document.body.classList.add('light-mode')}" }} />
        <SkipLink />
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
                  logo: `${SITE_URL}/favicon.svg`,
                },
              ],
            }),
          }}
        />
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
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T6C7QW75');`}
        </Script>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-DK12TNR0GW" strategy="afterInteractive" />
        <Script id="ga4" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-DK12TNR0GW',{send_page_view:false});`}
        </Script>
        <GaPageviews />
        {children}
        <ConsentBanner locale={locale} />
        <Footer />
      </body>
    </html>
  );
}
