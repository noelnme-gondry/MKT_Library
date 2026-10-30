import { ADSTERRA_FORMATS, PARTNER_AD_FORMATS, PARTNER_TRACKING_CODE } from "./partnerAds";
import { SITE_URL } from "./routeMap";

// 공식 위젯은 쿠팡 출처에서만 실행되어 앱 DOM·저장소를 읽을 수 없다.
// srcdoc/앱 URL에 이 권한을 부여하면 앱에 접근할 수 있으므로 사용하지 않는다.
export const PARTNER_FRAME_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

// SDK가 숨긴 0×0 프레임의 크기 응답을 기다리지 않고 공식 iframe을 바로 표시한다.
// 발급된 세 규격만 선택하며 현재 페이지 URL·분석 데이터는 받지 않는다.
export function partnerAdSource(format) {
  if (!Object.hasOwn(PARTNER_AD_FORMATS, format)) return null;
  const { id, width, height } = PARTNER_AD_FORMATS[format];
  const query = new URLSearchParams({ id: String(id), template: "carousel", trackingCode: PARTNER_TRACKING_CODE, subId: "", width: String(width), height: String(height), tsource: "" });
  return `https://ads-partners.coupang.com/widgets.html?${query}`;
}

// srcdoc는 불투명 출처로 격리한다. allow-same-origin을 추가하면 앱 데이터에 접근할 수 있다.
export const ADSTERRA_FRAME_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox";
export function adsterraDocument(format) {
  if (!Object.hasOwn(ADSTERRA_FORMATS, format)) return null;
  const { key, width, height } = ADSTERRA_FORMATS[format];
  const options = JSON.stringify({ key, format: "iframe", height, width, params: {} });
  // srcdoc의 기본 주소도 고정해 부모 경로·쿼리가 document.baseURI에 노출되지 않게 한다.
  // SDK가 소비 후 삭제하므로 전역 var의 삭제 불가능한 속성 대신 일반 속성으로 설정한다.
  return `<!doctype html><html><head><base href="${SITE_URL}/"><meta name="referrer" content="origin"><style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body><script>window.atOptions=${options};</script><script src="https://bauval.org/22/${key}" referrerpolicy="origin"></script></body></html>`;
}
