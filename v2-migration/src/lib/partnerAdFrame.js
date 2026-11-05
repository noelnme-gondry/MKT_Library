import { PARTNER_AD_FORMATS, PARTNER_TRACKING_CODE, partnerAdDimensions } from "./partnerAds";

// 공식 위젯은 쿠팡 출처에서만 실행되어 앱 DOM·저장소를 읽을 수 없다.
// srcdoc/앱 URL에 이 권한을 부여하면 앱에 접근할 수 있으므로 사용하지 않는다.
export const PARTNER_FRAME_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

// SDK가 숨긴 0×0 프레임의 크기 응답을 기다리지 않고 공식 iframe을 바로 표시한다.
// 발급된 ID와 지면별 크기만 선택하며 현재 페이지 URL·분석 데이터는 받지 않는다.
export function partnerAdSource(format, layout) {
  if (!Object.hasOwn(PARTNER_AD_FORMATS, format)) return null;
  const { id } = PARTNER_AD_FORMATS[format];
  const { width, height } = partnerAdDimensions(format, layout);
  const query = new URLSearchParams({ id: String(id), template: "carousel", trackingCode: PARTNER_TRACKING_CODE, subId: "", width: String(width), height: String(height), tsource: "" });
  return `https://ads-partners.coupang.com/widgets.html?${query}`;
}
