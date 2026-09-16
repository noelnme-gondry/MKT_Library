import { fieldLabels } from "@/lib/toolIndex";

/**
 * "왜 이 분석이 지금 안 되는가"를 한 문장으로.
 *
 * 도치 작업대와 업로드 화면의 도구 목록이 같은 판정을 쓰므로 문구도 한 곳에서
 * 나와야 한다 — 두 곳에 적으면 같은 파일에 대해 화면마다 다른 이유를 말하게 된다.
 *
 * 주의: 자격 판정기가 두 벌이다. 이 함수는 `lib/assistant/evaluateAnalysisEligibility`의
 * 결과 모양(`blockers[].alternatives`)을 읽는다. `lib/analysis-router/evaluateEligibility`는
 * `blockers[].fields`를 쓰는 다른 엔진이고 자기 포매터(`formatEligibilityBlocker`)를
 * 갖고 있다. 둘을 바꿔 끼우면 `undefined.join`으로 화면이 죽는다.
 */
export function blockersText(result, locale = "ko") {
  const en = locale === "en";
  const first = result?.blockers?.[0];
  if (!first) return en ? "Review the detailed tool requirements." : "상세 도구의 데이터 조건을 확인해 주세요.";
  if (first.code === "missing_fields") {
    const labels = blockerFieldLabels(result, locale);
    const shown = labels.length ? labels.join(" / ") : (first.alternatives || []).flat().join(" / ");
    return en ? `Missing: ${shown}` : `필요: ${shown}`;
  }
  if (first.code === "grain_mismatch") return en ? "This file has a different data grain." : "이 파일은 다른 데이터 단위입니다.";
  if (first.code === "no_rows") return en ? "No readable rows were found." : "읽을 수 있는 행이 없습니다.";
  if (first.code === "min_rows") return en ? `Needs at least ${first.required} rows (currently ${first.current}).` : `최소 ${first.required}행 필요 (현재 ${first.current}행).`;
  if (first.code === "min_periods") return en ? `Needs at least ${first.required} periods.` : `최소 ${first.required}개 기간이 필요합니다.`;
  return en ? "This analysis needs additional data or review." : "이 분석에는 추가 데이터 또는 확인이 필요합니다.";
}

/**
 * 빠진 컬럼을 사람이 읽는 라벨로. 내부 키(`cost`·`creative_id`)를 그대로 내면
 * 사용자가 자기 CSV에서 무엇을 고쳐야 하는지 알 수 없다.
 */
export function blockerFieldLabels(result, locale = "ko") {
  return fieldLabels(result?.missing || [], locale);
}
