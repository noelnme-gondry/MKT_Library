// 유입 경로 서베이는 첫 방문에 화면 가운데 뜨고, 브라우저 테스트는 전부 첫 방문이다.
// 카드가 클릭을 가로채므로(실제로 4건이 그렇게 깨졌다) 기본 상태를 "이미 답함"으로
// 둔다. 시드 자체는 `playwright.config.js`의 storageState가 건다.
//
// **주의: 그 시드는 `localStorage.clear()` 한 줄에 지워진다.** 저장소를 비우는
// 스펙은 비운 직후 이 키를 다시 세워야 한다 — `src/app/e2eSurveySuppression.test.js`가
// e2e 스펙 전수에서 파생해 강제한다.
export const SOURCE_SURVEY_ANSWERED_KEY = "mkt-library-source-survey-answered";
export const SOURCE_SURVEY_SEEN_KEY = "mkt-library-source-survey-seen";
