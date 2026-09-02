// 첫 방문자 온보딩(도치 인사) 노출 판정 SSOT.
//
// 두 저장소를 쓰는 이유가 다르다.
// - localStorage("보지 않기"): 사용자가 명시적으로 끈 상태. 영구.
// - sessionStorage(이번 세션에 봤음): 끄지 않은 사용자가 블로그↔홈을 오갈 때
//   같은 방문 안에서 반복 노출되는 것만 막는다. 다음 날 다시 오면 또 인사한다.
// 저장소를 못 쓰는 환경(프라이빗 모드·차단)에서는 판정이 "노출"로 떨어진다 —
// 안내가 한 번 더 뜨는 쪽이 영영 못 보는 쪽보다 낫다.

export const DOCHI_WELCOME_DISMISSED_KEY = "mkt-library-dochi-welcome-dismissed";
export const DOCHI_WELCOME_SESSION_KEY = "mkt-library-dochi-welcome-seen";

// 순수 판정 — 저장소·DOM을 보지 않는다(골든으로 고정).
// 저장된 작업이 있는 기존 사용자에게도 안내는 노출하되, UI에서 마지막 단계부터
// 시작한다. 여기서는 명시적 옵트아웃과 같은 세션의 중복 노출만 막는다.
export function shouldShowDochiWelcome({ dismissed = false, seenThisSession = false } = {}) {
  if (dismissed) return false;
  if (seenThisSession) return false;
  return true;
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
    // 저장 실패는 조용히 넘긴다(다음 방문에 한 번 더 보이는 것이 유일한 영향).
  }
}

export function readDochiWelcomeDismissed() {
  return readStorage("localStorage", DOCHI_WELCOME_DISMISSED_KEY) === "1";
}

export function writeDochiWelcomeDismissed() {
  writeStorage("localStorage", DOCHI_WELCOME_DISMISSED_KEY, "1");
}

export function readDochiWelcomeSessionSeen() {
  return readStorage("sessionStorage", DOCHI_WELCOME_SESSION_KEY) === "1";
}

export function markDochiWelcomeSessionSeen() {
  writeStorage("sessionStorage", DOCHI_WELCOME_SESSION_KEY, "1");
}

// useSyncExternalStore용 스냅샷. 두 가지 이유로 모듈에 한 번만 굳힌다.
// ① 스냅샷 함수는 같은 입력에 같은 값을 돌려줘야 한다 — 오버레이가 열리면서
//    세션 표식을 남기는데, 저장소를 매번 다시 읽으면 그 직후 스냅샷이 false로
//    뒤집혀 열려 있던 안내가 스스로 닫힌다.
// ② 첫 방문 판정은 이 페이지 생애 동안 바뀌지 않는 사실이다.
let storageSnapshot = null;

export function readDochiWelcomeStorageSnapshot() {
  if (typeof window === "undefined") return false;
  if (storageSnapshot === null) {
    storageSnapshot = !readDochiWelcomeDismissed() && !readDochiWelcomeSessionSeen();
  }
  return storageSnapshot;
}

// 서버 렌더에서는 항상 닫힌 상태다 — 프리렌더된 HTML에 오버레이가 들어가면
// 크롤러가 가려진 화면을 보게 되고 하이드레이션도 어긋난다.
export function dochiWelcomeServerSnapshot() {
  return false;
}

// 테스트에서 저장소를 갈아끼운 뒤 캐시를 비운다(프로덕션 경로에서는 호출하지 않는다).
export function resetDochiWelcomeSnapshot() {
  storageSnapshot = null;
}
