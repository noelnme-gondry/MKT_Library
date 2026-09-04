// 데스크톱 도구 화면의 사이드바 접기 — 노출 판정 SSOT.
//
// 도구 화면에서 좌측 내비 248px + 우측 목차 예약 208px이 상시로 붙어, 1280px
// 노트북에서 분석에 남는 폭이 747px(뷰포트의 58%)뿐이었다. 분석 중에는 도구 목록을
// 거의 쓰지 않고, 쓸 때는 ⌘K와 헤더 ☰가 이미 같은 경로를 준다.
//
// 저장소는 하나다: 사용자가 한 번이라도 토글하면 그 선택이 전 라우트에 적용되고,
// 선택이 없을 때만 라우트 종류로 기본값을 정한다(도구=접힘, 그 외=펼침).
// "기본값"과 "사용자 선택"을 한 값에 섞으면 둘을 구분할 수 없다.
import { ROUTES, isRoutePublished } from "@/lib/routeMap";

export const SIDEBAR_STORAGE_KEY = "mkt-library-sidebar";
export const SIDEBAR_COLLAPSED_CLASS = "is-sidebar-collapsed";

// 손으로 쓴 경로 목록은 도구가 하나 늘 때마다 어긋난다 — 라우트에서 파생한다.
export function collapsedByDefaultPaths() {
  return ROUTES
    .filter((route) => !route.legacy && /^(5-|9-)/.test(route.id) && isRoutePublished(route))
    .map((route) => route.slug)
    .filter(Boolean)
    .sort();
}

export function normalizePath(pathname) {
  const withoutLocale = String(pathname || "/").replace(/^\/en(?=\/|$)/, "");
  const trimmed = withoutLocale.replace(/\/+$/, "");
  return trimmed || "/";
}

export function isCollapsedByDefault(pathname) {
  return collapsedByDefaultPaths().includes(normalizePath(pathname));
}

/** 저장된 선택. 없으면 null — "선택 없음"과 "펼침 선택"은 다른 상태다. */
export function readStoredPreference() {
  try {
    const value = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return value === "collapsed" || value === "expanded" ? value : null;
  } catch {
    return null;
  }
}

export function resolveCollapsed(pathname) {
  const stored = readStoredPreference();
  return stored ? stored === "collapsed" : isCollapsedByDefault(pathname);
}

// ── 렌더가 읽는 스냅샷 ────────────────────────────────────────────────────
// useSyncExternalStore의 스냅샷은 모듈에 굳혀야 한다. 매번 DOM·저장소를 다시 읽으면
// 같은 렌더 안에서 값이 달라져 무한 루프가 된다(§12.29b와 같은 함정).
let snapshot = false;
let hydrated = false;
const listeners = new Set();

export function subscribeSidebar(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readSidebarSnapshot() {
  if (!hydrated) {
    // 부팅 인라인 스크립트가 첫 페인트 전에 이미 붙여 둔 클래스를 그대로 읽는다.
    snapshot = typeof document !== "undefined"
      && document.body.classList.contains(SIDEBAR_COLLAPSED_CLASS);
    hydrated = true;
  }
  return snapshot;
}

// 서버 스냅샷은 항상 "펼침" — 프리렌더 HTML은 모든 라우트가 공유하므로 여기서
// 라우트별 기본값을 굳히면 안 된다(정적 페이지가 서로 다른 초기 상태를 갖게 된다).
export function sidebarServerSnapshot() {
  return false;
}

function applyToDocument(collapsed) {
  if (typeof document === "undefined") return;
  document.body.classList.toggle(SIDEBAR_COLLAPSED_CLASS, collapsed);
}

function publish(collapsed) {
  snapshot = collapsed;
  hydrated = true;
  applyToDocument(collapsed);
  listeners.forEach((listener) => listener());
}

/** 사용자가 명시적으로 바꾼다 — 이 선택은 저장되어 라우트 기본값을 이긴다. */
export function setSidebarCollapsed(collapsed) {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // 저장소를 못 써도 이번 세션 동안의 토글은 동작해야 한다.
  }
  publish(collapsed);
}

/** 라우트가 바뀌었을 때 — 저장된 선택이 없을 때만 기본값을 다시 적용한다. */
export function syncSidebarForPath(pathname) {
  if (readStoredPreference()) return;
  publish(isCollapsedByDefault(pathname));
}

// 테스트가 모듈 상태를 비운다(스냅샷이 한 번 굳으므로).
export function resetSidebarSnapshot() {
  snapshot = false;
  hydrated = false;
}
