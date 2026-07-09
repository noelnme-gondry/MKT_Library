import "./globals.css";
import Script from "next/script";
import Footer from "@/components/Footer";
import GaPageviews from "@/components/GaPageviews";
import AdInterstitial from "@/components/AdInterstitial";
import AdFreeInit from "@/components/AdFreeInit";

export const metadata = {
  // GSC "페이지 제목 40자 이내·설명 80자 이내" 경고 해소 + 유저가 한눈에 "뭐 하는
  // 사이트인지" 알 수 있게 재작성(SOP 문서 사이트가 아니라 CSV 분석 도구 중심으로 포지셔닝).
  title: {
    default: "Growth Ops Playbook | 마케팅 데이터 분석툴", // 33자
    template: "%s | Growth Ops Playbook",
  },
  description: "캠페인 CSV만 올리면 성과·예산 배분·A/B 테스트를 분석하는 무료 퍼포먼스 마케팅 도구 모음", // 53자
  keywords: "퍼포먼스 마케팅, 마케팅 데이터 분석, 마케팅 분석툴, 데이터 분석, 콘텐츠 마케팅, 구글 애널리틱스, GA4, SEO, 검색엔진최적화, ROAS, 그로스 해킹, CRM 마케팅, 데이터 드리븐, 마케팅 대시보드, 마케팅 예산 배분, MMM, 마케팅 믹스 모델링, 퍼포먼스 마케팅 SOP",
  authors: [{ name: "Growth Ops Playbook" }],
  robots: {
    index: true,
    follow: true,
  },
  // metadataBase로 상대 canonical 해석. layout에 canonical을 직접 박으면 자식
  // 페이지(privacy/terms 등)가 그대로 상속받아 "홈을 canonical로 선언" → GSC
  // "적절한 표준 태그가 포함된 대체 페이지"로 색인 제외됨. canonical은 페이지별로.
  metadataBase: new URL("https://growthoptplaybook.com"),
  openGraph: {
    type: "website",
    url: "https://growthoptplaybook.com/",
    title: "Growth Ops Playbook | 마케팅 데이터 분석툴",
    description: "캠페인 CSV로 바로 분석하는 무료 퍼포먼스 마케팅 데이터 도구", // 35자
    siteName: "Growth Ops Playbook",
    locale: "ko_KR",
    images: [
      {
        url: "https://growthoptplaybook.com/og-card.png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Growth Ops Playbook | 마케팅 데이터 분석툴",
    description: "캠페인 CSV로 바로 분석하는 무료 퍼포먼스 마케팅 데이터 도구",
    images: ["https://growthoptplaybook.com/og-card.png"],
  },
  other: {
    "google-adsense-account": "ca-pub-3073450406371629",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="dark">
      <head>
        <meta name="theme-color" content="#121315" />
        <meta name="naver-site-verification" content="c4cc3586f416c84363563356e79f834ca11544a7" />
        <link rel="alternate" type="application/rss+xml" title="Growth Ops Playbook" href="/rss.xml" />
        {/* 구글 검색결과 파비콘은 data-URI를 못 읽음 → 크롤 가능한 파일 URL(/favicon.svg)로 제공.
            SVG 파비콘은 구글·모던 브라우저 지원. apple-touch-icon은 iOS 홈화면·공유용. */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        {/* PapaParse·Chart.js·XLSX는 v2에서 npm 모듈로 직접 import(파일별 import) — index.html 시절
            CDN <Script beforeInteractive> 태그는 미사용·불필요(App Router에서 "script tag while rendering"
            콘솔 에러 유발)라 제거. Supabase는 전체 무료 전환으로 미사용(TODO(B2B) 재도입 시 layout에 재추가). */}
      </head>
      <body>
        {/* 구조화 데이터 (JSON-LD) — 검색엔진이 사이트·조직을 인식(SEO). SSR로 초기 HTML에 포함. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": "https://growthoptplaybook.com/#website",
                  url: "https://growthoptplaybook.com/",
                  name: "Growth Ops Playbook",
                  description: "퍼포먼스 마케팅 SOP & 데이터 분석 도구",
                  inLanguage: "ko-KR",
                },
                {
                  "@type": "Organization",
                  "@id": "https://growthoptplaybook.com/#org",
                  name: "Growth Ops Playbook",
                  url: "https://growthoptplaybook.com/",
                  logo: "https://growthoptplaybook.com/og-card.png",
                },
                {
                  "@type": "SoftwareApplication",
                  name: "Growth Ops Playbook",
                  applicationCategory: "BusinessApplication",
                  operatingSystem: "Web",
                  offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
                  description: "GA4 세팅·ROAS 개선·MMM·예산배분 등 퍼포먼스 마케팅 실무 대시보드와 SOP 가이드.",
                },
              ],
            }),
          }}
        />
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-T6C7QW75"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          ></iframe>
        </noscript>
        
        {/* GTM */}
        <Script id="gtm" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-T6C7QW75');
          `}
        </Script>

        {/* GA4 */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-DK12TNR0GW" strategy="afterInteractive" />
        <Script id="ga4" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-DK12TNR0GW');
          `}
        </Script>

        {/* AdSense */}
        <Script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3073450406371629" crossOrigin="anonymous" strategy="afterInteractive" />

        <GaPageviews />
        <AdFreeInit />
        <AdInterstitial />
        {children}
        <Footer />
      </body>
    </html>
  );
}
