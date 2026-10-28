// 본문 맨 위 "현재 입력" 줄(AnalysisSetupBar)을 언제 그리는지(product-ssot §1.1c).
// 입력(파일·행 수)은 화면에 한 번만 말한다. 분석이 끝나면 대부분의 도구는 업로더가 한 줄로 접히거나
// (CsvUploader collapseWhenAnalyzed) 결과 위 맥락 줄(ds/ReportContext)이 입력을 말하므로 맨 위 줄은 같은 말의 반복이다.
// e2e/report-first-viewport.spec.js가 발행 도구 전체의 실제 화면에서 "입력 줄이 정확히 한 종류"인지 잰다.

// 분석 여부와 무관하게 도구가 늘 자기 입력 줄을 그린다(제목 줄·데이터 줄·분석 게이트 없는 결과).
export const ALWAYS_OWN_INPUT_LINE_TOOL_IDS = Object.freeze([
  "5-2", "5-22", "5-3", "5-31", "5-23", "5-24", "5-20", "9-1",
  "5-18-trend", "5-18-cannibal", "5-18-mmm", "5-18-forecast",
]);

// 분석 뒤에도 자기 입력 줄이 아직 없는 도구 — 맨 위 줄이 계속 말한다. 보고서 틀을 붙이면 여기서 뺀다.
export const SETUP_BAR_INPUT_TOOL_IDS = Object.freeze([
  "5-18-paid-organic", "5-28", "5-29", "5-30",
]);

export function setupBarShowsInput(toolId, analyzed) {
  if (ALWAYS_OWN_INPUT_LINE_TOOL_IDS.includes(toolId)) return false;
  return !analyzed || SETUP_BAR_INPUT_TOOL_IDS.includes(toolId);
}
