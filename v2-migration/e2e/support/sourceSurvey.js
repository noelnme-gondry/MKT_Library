// 유입 경로 서베이는 첫 결과를 읽은 뒤 본문 아래에 추가된다. 다른 분석 검사가
// 지연 노출에 영향받지 않도록 기본은 "이미 답함"이며, 전용 source-survey 스펙이
// 시드를 풀고 실제 노출·배치·닫기를 검증한다. 시드는 playwright.config.js가 건다.
//
// **주의: 그 시드는 `localStorage.clear()` 한 줄에 지워진다.** 저장소를 비우는
// 스펙은 비운 직후 이 키를 다시 세워야 한다 — `src/app/e2eSurveySuppression.test.js`가
// e2e 스펙 전수에서 파생해 강제한다.
export const SOURCE_SURVEY_ANSWERED_KEY = "mkt-library-source-survey-answered";
export const SOURCE_SURVEY_SEEN_KEY = "mkt-library-source-survey-seen";
