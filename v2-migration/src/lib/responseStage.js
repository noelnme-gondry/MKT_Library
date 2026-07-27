// 5-18 마케팅 반응 분석의 공유 가능한 진입 단계. URL은 외부 콘텐츠·북마크에서도
// 들어오므로 알려진 값만 허용하고 나머지는 첫 단계(trend)로 안전하게 폴백한다.
export const RESPONSE_STAGES = ["trend", "diagnose", "mmm", "lab"];

export function resolveResponseStage(value) {
  return RESPONSE_STAGES.includes(value) ? value : "trend";
}
