// 5-18 마케팅 반응 분석의 공유 가능한 진입 단계. URL은 외부 콘텐츠·북마크에서도
// 들어오므로 알려진 값만 허용하고 나머지는 첫 단계(trend)로 안전하게 폴백한다.
// hub은 공유 CSV·매핑만 관리하는 진입점이다. 나머지 네 값은 각각 독립 화면에서
// 필요한 엔진만 실행한다. 과거 ?stage= 링크도 그대로 해석해 외부 북마크를 보존한다.
export const RESPONSE_STAGES = ["hub", "trend", "diagnose", "mmm", "lab"];

export const RESPONSE_STAGE_PATHS = {
  hub: "/tools/marketing-response",
  trend: "/tools/marketing-trend",
  diagnose: "/tools/cannibalization-diagnosis",
  mmm: "/tools/mmm-contribution",
  lab: "/tools/marketing-forecast",
};

export function resolveResponseStage(value) {
  return RESPONSE_STAGES.includes(value) ? value : "hub";
}

export function responseStageHref(stage, locale = "ko") {
  const path = RESPONSE_STAGE_PATHS[resolveResponseStage(stage)];
  return `${locale === "en" ? "/en" : ""}${path}`;
}
