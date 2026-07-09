/** @type {import('next').NextConfig} */
const nextConfig = {
  // 보안 헤더 — iframe 도용(클릭재킹)·MIME 스니핑·레퍼러 유출 방지. 코드 복사 자체는
  // 공개 클라이언트 앱 특성상 못 막지만, "내 사이트를 남의 iframe에 띄워 자기 것인 양"
  // 하는 벡터는 frame-ancestors 'self'로 원천 차단. full CSP는 GTM/AdSense 인라인
  // 스크립트를 깨뜨릴 수 있어 프레임 통제만 적용.
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
