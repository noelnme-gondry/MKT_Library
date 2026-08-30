"use client";
import { useEffect } from "react";
import useAnalyticsEnabled from "@/components/useAnalyticsEnabled";

const ADSENSE_SCRIPT_ID = "adsense-script";
const ADSENSE_SCRIPT_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3073450406371629";

// 블로그 라우트의 AdSense도 같은 호스트 게이트를 쓴다. 계측 부풀림보다 이쪽이
// 더 급한데, 광고 코드가 로컬·미리보기에서 로드되면 노출로 집계돼 무효 트래픽이
// 된다 — 정확도 문제가 아니라 정책 문제다.
export default function AdSenseScript() {
  const enabled = useAnalyticsEnabled();

  useEffect(() => {
    if (!enabled || document.getElementById(ADSENSE_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.src = ADSENSE_SCRIPT_SRC;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }, [enabled]);

  if (!enabled) return null;
  return null;
}
