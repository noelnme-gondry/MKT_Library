"use client";
import Script from "next/script";
import useAnalyticsEnabled from "@/components/useAnalyticsEnabled";

// 블로그 라우트의 AdSense도 같은 호스트 게이트를 쓴다. 계측 부풀림보다 이쪽이
// 더 급한데, 광고 코드가 로컬·미리보기에서 로드되면 노출로 집계돼 무효 트래픽이
// 된다 — 정확도 문제가 아니라 정책 문제다.
export default function AdSenseScript() {
  const enabled = useAnalyticsEnabled();
  if (!enabled) return null;
  return (
    <Script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3073450406371629"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
