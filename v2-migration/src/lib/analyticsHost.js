// 계측 스크립트를 실을 호스트 SSOT.
//
// 왜 필요한가: GTM·GA4·AdSense는 여태 조건 없이 로드됐다. 그래서 `npm run dev`나
// 로컬 프로덕션 빌드로 화면을 볼 때마다 localhost 히트가 **운영 속성에 그대로 쌓였다**.
// page_view만이 아니라 analytics.js를 거치는 제품 이벤트 전부가 같은 gtag를 쓰므로
// 퍼널 지표(analysis_started·result_downloaded…)까지 함께 부풀려진다.
//
// 왜 빌드타임 env가 아니라 호스트인가: 페이지가 정적 프리렌더라 같은 HTML이
// localhost와 운영에 함께 나간다. `NODE_ENV`로 가르면 `npm run build && npm start`가
// 프로덕션으로 잡혀 그대로 샌다. 실제로 구분되는 값은 호스트뿐이다.
//
// Railway 미리보기 도메인(*.up.railway.app)은 일부러 제외한다 — 배포 확인 트래픽은
// 사용자 행동이 아니다. canonical도 커스텀 도메인이라 실사용자는 여기로만 들어온다.
export const ANALYTICS_HOSTS = Object.freeze([
  "growthoptplaybook.com",
  "www.growthoptplaybook.com",
]);

export function isAnalyticsHost(hostname) {
  if (typeof hostname !== "string") return false;
  return ANALYTICS_HOSTS.includes(hostname.trim().toLowerCase());
}
