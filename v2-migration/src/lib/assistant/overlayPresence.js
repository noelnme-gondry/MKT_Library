// 첫 방문 화면에 뜨는 오버레이가 둘이 됐다(도치 인사 · 유입 경로 서베이).
// 둘이 동시에 뜨면 첫 방문자가 모달 두 겹을 보게 되므로, 서베이는 인사가
// 닫힌 뒤에만 뜬다.
//
// 컴포넌트끼리 직접 import하면 인사가 서베이를 알아야 하고(역방향 의존) 다음에
// 오버레이가 하나 더 생기면 배선이 n²이 된다. 대신 "지금 인사가 떠 있는가"만
// 모듈 하나가 들고 있고 양쪽이 각자 여기에만 말을 건다.
//
// useSyncExternalStore 계약대로 스냅샷은 값이 실제로 바뀔 때만 바뀐다.

let welcomeOpen = false;
const listeners = new Set();

export function subscribeWelcomePresence(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readWelcomeOpen() {
  return welcomeOpen;
}

// 서버 렌더에는 오버레이가 없다(프리렌더 HTML에 모달을 넣지 않는다).
export function welcomePresenceServerSnapshot() {
  return false;
}

export function setWelcomeOpen(next) {
  const value = Boolean(next);
  if (value === welcomeOpen) return;
  welcomeOpen = value;
  for (const listener of listeners) listener();
}

// 테스트 격리용. 프로덕션 경로에서는 호출하지 않는다.
export function resetWelcomePresence() {
  welcomeOpen = false;
  listeners.clear();
}
