import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 상위 작업공간에도 lockfile이 있어 Turbopack이 /Users/gondry를 루트로 추론하던 경고를
  // 방지. 이 앱의 의존성·파일 추적 범위를 v2-migration으로 고정한다.
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
  // 보안 헤더 — iframe 도용(클릭재킹)·MIME 스니핑·레퍼러 유출 방지. 코드 복사 자체는
  // 공개 클라이언트 앱 특성상 못 막지만, "내 사이트를 남의 iframe에 띄워 자기 것인 양"
  // 하는 벡터는 frame-ancestors 'self'로 원천 차단. full CSP는 GTM/AdSense 인라인
  // 스크립트를 깨뜨릴 수 있어 프레임 통제만 적용.
  // 5-6(소재 분석) → 9-6 통합에 따른 구 URL 보존. /tools/creative-analysis(구 5-6)는
  // 이제 9-6이 서빙(같은 slug 재사용이 아니라, 9-6은 /content/freshness에 있으므로 301).
  async redirects() {
    // 예산 4편(예산배분·ROAS개선·포화신호·스케일업)을 한계 지표 필라 1편으로 통합 →
    // 구 URL 링크주스 승계(ko·en 각 4건). 필라: /blog/budget-marginal-efficiency.
    const budgetPillar = ["marketing-budget-allocation", "roas-improvement", "campaign-saturation-signals", "scaling-pitfalls"];
    const budgetRedirects = budgetPillar.flatMap((slug) => [
      { source: `/blog/${slug}`, destination: "/blog/budget-marginal-efficiency", permanent: true },
      { source: `/en/blog/${slug}`, destination: "/en/blog/budget-marginal-efficiency", permanent: true },
    ]);
    return [
      {
        source: "/tools/creative-analysis",
        destination: "/content/freshness",
        permanent: true,
      },
      {
        source: "/en/tools/creative-analysis",
        destination: "/en/content/freshness",
        permanent: true,
      },
      ...budgetRedirects,
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
