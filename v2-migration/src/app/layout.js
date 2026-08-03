import "./globals.css";
import Script from "next/script";
import { DM_Sans, JetBrains_Mono, Noto_Sans_KR, Space_Grotesk } from "next/font/google";
import Footer from "@/components/Footer";
import GaPageviews from "@/components/GaPageviews";
import SkipLink from "@/components/SkipLink";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });
// Latin-only display/body faces fall back to a different system font for most
// Korean UI, which flattens the intended type hierarchy. Keep one variable KR
// face in the stack; preload is disabled because the font is unicode-ranged and
// should only be fetched for glyphs the current page actually uses.
const notoSansKr = Noto_Sans_KR({
  weight: "variable",
  variable: "--font-noto-sans-kr",
  display: "swap",
  preload: false,
});

export const metadata = {
  // GSC "페이지 제목 40자 이내·설명 80자 이내" 경고 해소 + 유저가 한눈에 "뭐 하는
  // 사이트인지" 알 수 있게 재작성(SOP 문서 사이트가 아니라 주간 의사결정 워크스페이스로 포지셔닝).
  title: {
    default: "Growth Opt Playbook | 마케팅 의사결정 워크스페이스",
    template: "%s | Growth Opt Playbook",
  },
  description: "캠페인 CSV로 성과 원인을 찾고 다음 행동을 정한 뒤 실제 결과까지 검토하는 무료 퍼포먼스 마케팅 워크스페이스",
  keywords: "퍼포먼스 마케팅, 마케팅 데이터 분석, 마케팅 분석툴, 데이터 분석, 콘텐츠 마케팅, 구글 애널리틱스, GA4, SEO, 검색엔진최적화, ROAS, 그로스 해킹, CRM 마케팅, 데이터 드리븐, 마케팅 대시보드, 마케팅 예산 배분, MMM, 마케팅 믹스 모델링, 퍼포먼스 마케팅 SOP, CPA 분석, ROAS 분석, CTR 개선, 광고 소재 분석, 소재 피로도, 타겟팅 전략, 오디언스 분석, 광고 최적화, 캠페인 최적화, 자동입찰, 머신러닝 광고, 마케팅 데이터 분석 툴, 노코드 데이터 분석, CSV 분석 도구, 무료 마케팅 툴, 마케팅 대시보드 무료, 퍼포먼스 마케터 취업, 퍼포먼스 마케터 실무, 그로스 마케팅, A/B 테스트, 증분 측정, 인과추론 마케팅, 통계적 유의성, 홀드아웃 테스트, 메타 광고, 구글 애즈, 앱 마케팅, UA 마케팅, 모바일 앱 마케팅",
  authors: [{ name: "Growth Opt Playbook" }],
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
    title: "Growth Opt Playbook | 마케팅 의사결정 워크스페이스",
    description: "성과 원인부터 다음 행동과 실제 결과 검토까지 잇는 무료 퍼포먼스 마케팅 워크스페이스",
    siteName: "Growth Opt Playbook",
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
    title: "Growth Opt Playbook | 마케팅 의사결정 워크스페이스",
    description: "성과 원인부터 다음 행동과 실제 결과 검토까지 잇는 무료 퍼포먼스 마케팅 워크스페이스",
    images: ["https://growthoptplaybook.com/og-card.png"],
  },
  other: {
    "google-adsense-account": "ca-pub-3073450406371629",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${dmSans.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable} ${notoSansKr.variable} dark`}>
      <head>
        <meta name="theme-color" content="#11141b" />
        <meta name="naver-site-verification" content="c4cc3586f416c84363563356e79f834ca11544a7" />
        <link rel="alternate" type="application/rss+xml" title="Growth Opt Playbook" href="/rss.xml" />
        {/* 구글 검색결과 파비콘은 data-URI를 못 읽음 → 크롤 가능한 파일 URL(/favicon.svg)로 제공.
            SVG 파비콘은 구글·모던 브라우저 지원. apple-touch-icon은 iOS 홈화면·공유용. */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        {/* PapaParse·Chart.js·XLSX는 v2에서 npm 모듈로 직접 import(파일별 import) — index.html 시절
            CDN <Script beforeInteractive> 태그는 미사용·불필요(App Router에서 "script tag while rendering"
            콘솔 에러 유발)라 제거. Supabase는 전체 무료 전환으로 미사용(TODO(B2B) 재도입 시 layout에 재추가). */}
      </head>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('mkt-library-theme')!=='dark')document.body.classList.add('light-mode')}catch(e){document.body.classList.add('light-mode')}" }} />
        <SkipLink />
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
                  name: "Growth Opt Playbook",
                  description: "퍼포먼스 마케팅 주간 의사결정 워크스페이스",
                  inLanguage: "ko-KR",
                },
                {
                  "@type": "Organization",
                  "@id": "https://growthoptplaybook.com/#org",
                  name: "Growth Opt Playbook",
                  url: "https://growthoptplaybook.com/",
                  logo: "https://growthoptplaybook.com/favicon.svg",
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
            gtag('config', 'G-DK12TNR0GW', { send_page_view: false });
          `}
        </Script>

        <GaPageviews />
        {children}
        <Footer />
      </body>
    </html>
  );
}
