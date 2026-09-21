import { trackProductEvent } from "@/lib/analytics";

/* ============================================================
 * 로그인 계측 — 방식(method)과 표면(source)을 함께 센다.
 *
 * 고치기 전 상태: `login_started`·`login_completed`가 두 화면(AccountArchive·
 * ProjectCreateGate)에서만 찍혔고 방식 파라미터가 없었다. 그래서
 *   ① 구글 로그인과 이메일 링크 로그인을 구분할 수 없었고,
 *   ② 이메일 링크 요청은 이벤트가 아예 없었고,
 *   ③ 결제 화면·업로더에서 팝업 로그인이 끝나도 `gop-account-ready`를 받는
 *      핸들러가 계측을 안 해서 그 완료는 영영 안 세어졌다(4곳 중 2곳만 셌다).
 * 완료 신호는 전부 이 한 곳을 지난다 — 표면마다 다시 적으면 같은 로그인이
 * 표면 수만큼 다른 이름으로 갈린다(§16).
 *
 * 개인정보: 이메일·계정 id·토큰은 절대 싣지 않는다. 범주형만 보낸다.
 * ============================================================ */
export const ACCOUNT_READY_MESSAGE = "gop-account-ready";

// GA 탐색에서 쓸 수 있게 열거형으로 고정한다. 새 방식을 추가하면 여기에 먼저 넣는다.
export const LOGIN_METHODS = Object.freeze(["google", "email_link", "password"]);

function safeMethod(method) {
  return LOGIN_METHODS.includes(method) ? method : "unknown";
}

export function trackLoginStarted(method, { locale = "ko", source } = {}) {
  return trackProductEvent("login_started", { method: safeMethod(method), locale, ...(source ? { source } : {}) });
}

// 같은 postMessage 이벤트로 두 번 세지 않는다. 세션 단위로 잠그면 로그아웃 후
// 다시 로그인한 것을 놓치므로 이벤트 객체 단위로만 막는다.
const counted = new WeakSet();

export function trackLoginCompleted(event, { locale = "ko", source, method = "google" } = {}) {
  if (event && typeof event === "object") {
    if (counted.has(event)) return false;
    counted.add(event);
  }
  return trackProductEvent("login_completed", { method: safeMethod(method), locale, ...(source ? { source } : {}) });
}

/** `gop-account-ready`만 받아 계측한 뒤 화면별 후속 동작을 부른다. */
export function accountReadyListener(onReady, options = {}) {
  return (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== ACCOUNT_READY_MESSAGE) return;
    trackLoginCompleted(event, options);
    onReady?.(event);
  };
}
