"use client";
import Script from "next/script";
import GaPageviews from "@/components/GaPageviews";
import useAnalyticsEnabled from "@/components/useAnalyticsEnabled";

// GTM·GA4를 운영 호스트에서만 싣는다(사유는 lib/analyticsHost.js).
// 스크립트가 안 실리면 window.gtag가 없고, analytics.js와 GaPageviews가 이미
// gtag 부재를 확인하므로 제품 이벤트도 함께 no-op이 된다 — 통로가 하나뿐이라
// 여기 한 곳만 막으면 page_view·tool_view·퍼널 이벤트가 전부 같이 멎는다.
//
// GaPageviews를 여기 안에 두는 이유: 밖에 두면 gtag를 5초간 재시도하다 포기하는
// 타이머만 로컬에서 계속 돈다. "계측이 켜졌나"의 주인을 한 곳으로 모은다.
export default function AnalyticsScripts() {
  const enabled = useAnalyticsEnabled();
  if (!enabled) return null;
  return (
    <>
      <Script id="gtm" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T6C7QW75');`}
      </Script>
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-DK12TNR0GW" strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-DK12TNR0GW',{send_page_view:false});`}
      </Script>
      <GaPageviews />
    </>
  );
}
