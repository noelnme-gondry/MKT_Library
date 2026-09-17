// 유입 경로 서베이(주관식) 판정·정규화 SSOT.
//
// 답변 텍스트를 읽는 곳이 둘이다 — 팝업(전송 전 검증)과 API 라우트(저장 전
// 검증). 두 곳이 각자 자르면 화면이 통과시킨 답변을 서버가 거절하거나, 반대로
// 서버가 화면보다 긴 값을 받는다(§7 "같은 지표를 두 곳에서 계산하면 반드시
// 갈린다"). 해석은 여기 하나가 소유하고 소비처는 결과만 쓴다.
//
// 저장소를 둘로 가르는 이유는 도치 인사(lib/dochiWelcome.js)와 같다.
// - localStorage: 답했거나 "다시 묻지 않기"를 고른 상태. 영구.
// - sessionStorage: 아직 안 답한 사람이 같은 방문에서 여러 페이지를 볼 때
//   반복 노출만 막는다. 다음 방문에는 한 번 더 묻는다.
// 저장소를 못 쓰는 환경에서는 판정이 "노출"로 떨어진다 — 한 번 더 뜨는 쪽이
// 영영 못 묻는 쪽보다 낫다.

export const SOURCE_SURVEY_ANSWERED_KEY = "mkt-library-source-survey-answered";
export const SOURCE_SURVEY_SESSION_KEY = "mkt-library-source-survey-seen";

// 서버 CHECK 제약(scripts/source-survey-schema.sql)과 같은 값이다. 한쪽만 바꾸면
// 화면이 받은 답변을 서버가 거절한다.
export const SOURCE_SURVEY_MAX_LENGTH = 300;

// 첫 화면을 가리지 않도록 잠시 기다린 뒤 묻는다. 진입 직후에 띄우면 무엇을 하는
// 곳인지 보기도 전에 질문부터 받게 되고, 그 답은 유입 경로가 아니라 짜증이다.
export const SOURCE_SURVEY_DWELL_MS = 25000;

export const SOURCE_SURVEY_LOCALES = ["ko", "en"];

// 순수 판정 — 저장소·DOM을 보지 않는다(골든으로 고정).
// welcomeOpen: 도치 첫 방문 인사가 떠 있는 동안에는 절대 겹치지 않는다.
export function shouldShowSourceSurvey({
  storageAllows = true,
  welcomeOpen = false,
  dwellElapsed = false,
  closed = false,
} = {}) {
  if (!storageAllows) return false;
  if (welcomeOpen) return false;
  if (!dwellElapsed) return false;
  if (closed) return false;
  return true;
}

// 답변 정규화. 줄바꿈·연속 공백을 한 칸으로 접고 상한에서 자른다.
// 빈 답변은 null — 소비처는 "저장할 값이 있는가"만 물으면 된다.
export function normalizeSourceSurveyAnswer(value) {
  if (typeof value !== "string") return null;
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (!collapsed) return null;
  return collapsed.slice(0, SOURCE_SURVEY_MAX_LENGTH);
}

export function isSourceSurveyLocale(value) {
  return SOURCE_SURVEY_LOCALES.includes(value);
}

function readStorage(storage, key) {
  if (typeof window === "undefined") return null;
  try {
    return window[storage]?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  if (typeof window === "undefined") return;
  try {
    window[storage]?.setItem(key, value);
  } catch {
    // 저장 실패의 유일한 영향은 다음 방문에 한 번 더 묻는 것이다.
  }
}

export function readSourceSurveyAnswered() {
  return readStorage("localStorage", SOURCE_SURVEY_ANSWERED_KEY) === "1";
}

export function writeSourceSurveyAnswered() {
  writeStorage("localStorage", SOURCE_SURVEY_ANSWERED_KEY, "1");
}

export function readSourceSurveySessionSeen() {
  return readStorage("sessionStorage", SOURCE_SURVEY_SESSION_KEY) === "1";
}

export function markSourceSurveySessionSeen() {
  writeStorage("sessionStorage", SOURCE_SURVEY_SESSION_KEY, "1");
}

// useSyncExternalStore 스냅샷. 팝업이 열리면서 세션 표식을 남기는데 저장소를
// 매번 다시 읽으면 그 직후 false로 뒤집혀 떠 있던 팝업이 스스로 닫힌다
// (dochiWelcome.js가 같은 이유로 같은 방식을 쓴다).
let storageSnapshot = null;

export function readSourceSurveyStorageSnapshot() {
  if (typeof window === "undefined") return false;
  if (storageSnapshot === null) {
    storageSnapshot = !readSourceSurveyAnswered() && !readSourceSurveySessionSeen();
  }
  return storageSnapshot;
}

// 서버 렌더에서는 항상 닫힘 — 프리렌더 HTML에 팝업이 들어가면 크롤러가 가려진
// 화면을 보고 하이드레이션도 어긋난다.
export function sourceSurveyServerSnapshot() {
  return false;
}

export function resetSourceSurveySnapshot() {
  storageSnapshot = null;
}
