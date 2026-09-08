/**
 * `/weekly-review`가 결정 검토함에서 새 Weekly Review로 바뀐 것을 알리는 1회 안내의 노출 판정.
 *
 * 판정 로직을 컴포넌트가 아니라 여기 두는 이유는 스냅샷을 **모듈에 굳혀야** 하기 때문이다.
 * 오버레이가 열리면서 세션 표식을 남기는데, 스냅샷이 저장소를 매번 다시 읽으면 그 직후
 * false로 뒤집혀 열려 있던 안내가 스스로 닫힌다(기존 도치 온보딩에서 이미 겪은 함정).
 *
 * 저장소를 둘로 가른다 — 명시적 "알겠어요"는 localStorage(영구), 같은 방문 중 반복 차단은
 * sessionStorage. 하나로 합치면 "세션당 1회"와 "영구 끄기"가 구분되지 않는다.
 * 저장소를 못 쓰면 **노출 쪽으로** 폴백한다(한 번 더 뜨는 게 영영 못 보는 것보다 낫다).
 */

export const HANDOVER_DISMISS_KEY = "mkt-library-wr-handover-dismissed";
export const HANDOVER_SESSION_KEY = "mkt-library-wr-handover-seen";

function readStorage(name, key) {
  try {
    return globalThis[name]?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(name, key, value) {
  try {
    globalThis[name]?.setItem(key, value);
  } catch {
    // 저장 실패는 조용히 넘긴다 — 다음에 한 번 더 뜨는 것이 손해가 아니다.
  }
}

export function readHandoverDismissed() {
  return readStorage("localStorage", HANDOVER_DISMISS_KEY) === "1";
}

export function writeHandoverDismissed() {
  writeStorage("localStorage", HANDOVER_DISMISS_KEY, "1");
}

export function readHandoverSessionSeen() {
  return readStorage("sessionStorage", HANDOVER_SESSION_KEY) === "1";
}

export function markHandoverSessionSeen() {
  writeStorage("sessionStorage", HANDOVER_SESSION_KEY, "1");
}

let storageSnapshot = null;

/** 저장소가 노출을 허용하는가. 이 페이지 생애 동안 바뀌지 않는 사실이라 한 번만 읽는다. */
export function readHandoverStorageSnapshot() {
  if (typeof window === "undefined") return false;
  if (storageSnapshot === null) {
    storageSnapshot = !readHandoverDismissed() && !readHandoverSessionSeen();
  }
  return storageSnapshot;
}

/** 서버 렌더에서는 항상 닫힘 — 프리렌더 HTML에 오버레이가 들어가면 크롤러가 가려진 화면을 본다. */
export function handoverServerSnapshot() {
  return false;
}

/** 저장소 변화를 구독하지 않는다(페이지 생애 동안 고정). 테스트용 리셋은 아래. */
export const subscribeHandover = () => () => {};

/** 테스트에서 저장소를 갈아끼운 뒤 캐시를 비운다(프로덕션 경로에서는 호출하지 않는다). */
export function resetHandoverSnapshot() {
  storageSnapshot = null;
}
