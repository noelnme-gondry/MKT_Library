// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  SIDEBAR_COLLAPSED_CLASS,
  SIDEBAR_STORAGE_KEY,
  readStoredPreference,
  resolveCollapsed,
} from "./sidebarCollapse";

describe("sidebar collapse preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.classList.remove(SIDEBAR_COLLAPSED_CLASS);
  });

  it("starts expanded — closing is the user's call, not the app's", () => {
    // 처음에는 도구 라우트를 자동으로 접었는데, 사용자가 화면을 열자마자 "내비가
    // 그냥 사라졌다"로 읽혔다. 자동으로 접는 것은 복잡함을 치우는 대신 감춘 것이다.
    expect(readStoredPreference()).toBe(null);
    expect(resolveCollapsed()).toBe(false);
  });

  it("honours an explicit choice in both directions", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    expect(resolveCollapsed()).toBe(true);
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "expanded");
    expect(resolveCollapsed()).toBe(false);
  });

  it("treats an unrecognised value as no choice at all", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "garbage");
    expect(readStoredPreference()).toBe(null);
    expect(resolveCollapsed()).toBe(false);
  });
});
