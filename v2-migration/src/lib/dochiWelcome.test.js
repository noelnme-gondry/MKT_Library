// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  DOCHI_WELCOME_DISMISSED_KEY,
  DOCHI_WELCOME_SESSION_KEY,
  markDochiWelcomeSessionSeen,
  readDochiWelcomeDismissed,
  readDochiWelcomeSessionSeen,
  readDochiWelcomeStorageSnapshot,
  resetDochiWelcomeSnapshot,
  shouldShowDochiWelcome,
  writeDochiWelcomeDismissed,
} from "@/lib/dochiWelcome";

describe("shouldShowDochiWelcome", () => {
  it("shows the welcome to a visitor with no signals at all", () => {
    expect(shouldShowDochiWelcome({})).toBe(true);
    expect(shouldShowDochiWelcome()).toBe(true);
  });

  it("stays hidden forever once the visitor opted out", () => {
    expect(shouldShowDochiWelcome({ dismissed: true })).toBe(false);
    // 옵트아웃은 다른 모든 신호를 이긴다.
    expect(shouldShowDochiWelcome({ dismissed: true, seenThisSession: false })).toBe(false);
  });

  it("does not repeat inside one session when the visitor never opted out", () => {
    expect(shouldShowDochiWelcome({ dismissed: false, seenThisSession: true })).toBe(false);
    // 세션이 끝나면(플래그가 사라지면) 다시 인사한다 — 옵트아웃과 구분되는 지점.
    expect(shouldShowDochiWelcome({ dismissed: false, seenThisSession: false })).toBe(true);
  });

});

describe("dochi welcome storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetDochiWelcomeSnapshot();
  });

  it("round-trips the opt-out through localStorage", () => {
    expect(readDochiWelcomeDismissed()).toBe(false);
    writeDochiWelcomeDismissed();
    expect(window.localStorage.getItem(DOCHI_WELCOME_DISMISSED_KEY)).toBe("1");
    expect(readDochiWelcomeDismissed()).toBe(true);
  });

  it("round-trips the session flag through sessionStorage, not localStorage", () => {
    expect(readDochiWelcomeSessionSeen()).toBe(false);
    markDochiWelcomeSessionSeen();
    expect(window.sessionStorage.getItem(DOCHI_WELCOME_SESSION_KEY)).toBe("1");
    expect(readDochiWelcomeSessionSeen()).toBe(true);
    // 세션 표식이 영구 저장소로 새면 "다음 방문에도 안 보임"이 되어 계약이 뒤집힌다.
    expect(window.localStorage.getItem(DOCHI_WELCOME_SESSION_KEY)).toBe(null);
    expect(readDochiWelcomeDismissed()).toBe(false);
  });

  it("falls back to showing the welcome when storage throws", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new Error("blocked"); },
    });
    expect(readDochiWelcomeDismissed()).toBe(false);
    expect(() => writeDochiWelcomeDismissed()).not.toThrow();
    if (original) Object.defineProperty(window, "localStorage", original);
  });
});

describe("readDochiWelcomeStorageSnapshot", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetDochiWelcomeSnapshot();
  });

  it("allows the welcome for a visitor with a clean browser", () => {
    expect(readDochiWelcomeStorageSnapshot()).toBe(true);
  });

  it("blocks it for an opted-out visitor and for one already greeted this session", () => {
    window.localStorage.setItem(DOCHI_WELCOME_DISMISSED_KEY, "1");
    expect(readDochiWelcomeStorageSnapshot()).toBe(false);

    resetDochiWelcomeSnapshot();
    window.localStorage.clear();
    window.sessionStorage.setItem(DOCHI_WELCOME_SESSION_KEY, "1");
    expect(readDochiWelcomeStorageSnapshot()).toBe(false);
  });

  it("holds the first answer so marking the session seen cannot close an open welcome", () => {
    expect(readDochiWelcomeStorageSnapshot()).toBe(true);
    markDochiWelcomeSessionSeen();
    // 스냅샷이 여기서 false로 뒤집히면 열려 있던 안내가 스스로 닫힌다.
    expect(readDochiWelcomeStorageSnapshot()).toBe(true);
    // 캐시를 비운 다음 방문에서야 막힌다.
    resetDochiWelcomeSnapshot();
    expect(readDochiWelcomeStorageSnapshot()).toBe(false);
  });
});
