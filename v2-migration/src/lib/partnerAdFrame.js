import { PARTNER_AD_FORMATS, PARTNER_TRACKING_CODE } from "./partnerAds";

// data: 문서는 앱과 다른 고유 opaque origin을 가진다. allow-same-origin은
// 쿠팡 자식 프레임의 출처를 보존해 SDK의 postMessage 출처 검사를 통과시킨다.
// srcdoc/앱 URL에 이 권한을 부여하면 앱에 접근할 수 있으므로 사용하지 않는다.
export const PARTNER_FRAME_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";
export const PARTNER_FRAME_CSP = "default-src 'none'; script-src 'unsafe-inline' https://ads-partners.coupang.com; style-src 'unsafe-inline'; frame-src https://ads-partners.coupang.com; connect-src https://logs-partners.coupang.com; img-src https://logs-partners.coupang.com; base-uri 'none'; form-action 'none'";

// 고정된 세 규격만 선택하며 현재 페이지 URL·분석 데이터는 받지 않는다.
export function partnerAdDocument(format) {
  if (!Object.hasOwn(PARTNER_AD_FORMATS, format)) return null;
  const { id, width, height } = PARTNER_AD_FORMATS[format];
  const config = { id, template: "carousel", trackingCode: PARTNER_TRACKING_CODE, width: String(width), height: String(height), tsource: "" };
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${PARTNER_FRAME_CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="origin"><title>Coupang Partners advertisement</title><style>html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden}iframe{border:0}</style></head><body><script src="https://ads-partners.coupang.com/g.js"></script><script>new PartnersCoupang.G(${JSON.stringify(config)});</script></body></html>`;
}

export function partnerAdSource(format) {
  const html = partnerAdDocument(format);
  return html ? `data:text/html;charset=utf-8,${encodeURIComponent(html)}` : null;
}
