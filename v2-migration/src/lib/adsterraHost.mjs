// This existing Railway service serves only ad-frame documents on this origin;
// ordinary pages keep their canonical redirect to the public application.
export const ADSTERRA_FRAME_ORIGIN = "https://mktlibrary-production.up.railway.app";
export const ADSTERRA_FRAME_PREFIX = "/ad-frame/";
export const ADSTERRA_FRAME_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

export function isAdsterraFrameHost(host) {
  return host?.toLowerCase() === new URL(ADSTERRA_FRAME_ORIGIN).host;
}
