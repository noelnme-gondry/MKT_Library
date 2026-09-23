// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import BlogDochiBridge, { shouldOpenBridge, templatePathFor, blogLocalDateKey } from "./BlogDochiBridge";
import { recordSessionSlug } from "./BlogReadTracker";

// 주의: 여기서 innerHTML을 다시 쓰면 컴포넌트가 붙잡고 있던 노드가 떨어져 나가
// 스크롤이 반영되지 않는다(같은 실수로 이 테스트가 한 번 통과 못 했다).
// 요소는 그대로 두고 위치만 바꾼다.
function mountArticle({ height = 4000 } = {}) {
  document.body.innerHTML = '<div class="blog-prose">본문</div>';
  scrollArticleTo(0, height);
}

function scrollArticleTo(scrolled, height = 4000) {
  const article = document.querySelector(".blog-prose");
  article.getBoundingClientRect = () => ({ top: -scrolled, height });
  window.scrollY = scrolled;
  window.innerHeight = 1000;
}

function seedSession(count) {
  for (let i = 0; i < count; i += 1) recordSessionSlug(window.sessionStorage, `read-${i}`);
}

describe("shouldOpenBridge", () => {
  const ready = { downwardScrolls: 2, dismissed: false, disabled: false };

  it("opens after two downward scroll gestures", () => {
    expect(shouldOpenBridge(ready)).toBe(true);
    expect(shouldOpenBridge({ ...ready, downwardScrolls: 1 })).toBe(false);
    expect(shouldOpenBridge({ ...ready, downwardScrolls: 0 })).toBe(false);
  });

  it("stays shut once dismissed or switched off", () => {
    expect(shouldOpenBridge({ ...ready, dismissed: true })).toBe(false);
    expect(shouldOpenBridge({ ...ready, disabled: true })).toBe(false);
  });
});

describe("templatePathFor", () => {
  it("derives the template page from the catalog, not a hardcoded map", () => {
    expect(templatePathFor("5-3")).toBe("/templates/budget-allocation");
  });

  it("returns null for a tool without a template instead of inventing a path", () => {
    expect(templatePathFor("no-such-tool")).toBeNull();
  });
});

describe("BlogDochiBridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.gtag = vi.fn();
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.stubGlobal("requestAnimationFrame", (cb) => { cb(); return 1; });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    mountArticle();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete window.gtag;
    document.body.innerHTML = "";
  });

  const scrollPastThreshold = () => {
    scrollArticleTo(window.scrollY + 100);
    act(() => { fireEvent.scroll(window); vi.advanceTimersByTime(200); });
    scrollArticleTo(window.scrollY + 100);
    act(() => { fireEvent.scroll(window); });
  };

  // 서버 스냅샷은 항상 닫힘이어야 프리렌더 HTML에 브리지가 없다(크롤러가 가려진 화면을 보지 않는다).
  it("opens on the first article after two separate downward scrolls", () => {
    seedSession(1);
    const { container } = render(<BlogDochiBridge slug="read-0" toolId="5-3" />);
    act(() => { vi.advanceTimersByTime(60_000); });
    scrollPastThreshold();
    expect(container.querySelector(".blog-dochi-bridge")).toBeTruthy();
  });

  it("also opens on subsequent articles after two gestures", () => {
    seedSession(2);
    render(<BlogDochiBridge slug="read-1" toolId="5-3" />);
    expect(document.querySelector(".blog-dochi-bridge")).toBeNull();

    act(() => { vi.advanceTimersByTime(30_000); });
    scrollPastThreshold();

    expect(document.querySelector(".blog-dochi-bridge")).toBeTruthy();
    expect(screen.getByText(/예산 배분 계산하기/)).toBeTruthy();
    expect(document.querySelector(".blog-dochi-bridge__cta").getAttribute("href")).toBe("/tools/budget-allocation");
  });

  it("does not open after one scroll", () => {
    seedSession(2);
    render(<BlogDochiBridge slug="read-1" toolId="5-3" />);
    act(() => { vi.advanceTimersByTime(10_000); });
    scrollArticleTo(100);
    act(() => { fireEvent.scroll(window); });
    expect(document.querySelector(".blog-dochi-bridge")).toBeNull();
  });

  it("counts a continuous scroll burst once and links a published article to its own practice", () => {
    render(<BlogDochiBridge slug="budget-marginal-efficiency" toolId="5-3" />);
    for (const y of [100, 160, 220]) {
      scrollArticleTo(y);
      act(() => { fireEvent.scroll(window); vi.advanceTimersByTime(40); });
    }
    expect(document.querySelector(".blog-dochi-bridge")).toBeNull();
    act(() => { vi.advanceTimersByTime(200); });
    scrollArticleTo(320);
    act(() => { fireEvent.scroll(window); });
    expect(screen.getByRole("link", { name: /이 글의 예제로 분석 체험/ }).getAttribute("href")).toBe("#blog-practice");
  });

  it("uses the article-specific tool even if a caller supplies a generic fallback", () => {
    render(<BlogDochiBridge slug="ab-testing" toolId="5-3" />);
    scrollPastThreshold();
    expect(document.querySelector(".blog-dochi-bridge__cta").getAttribute("href")).toBe("/tools/experiment-analysis");
  });

  it("reports the impression with the existing event, not a new name", () => {
    seedSession(2);
    render(<BlogDochiBridge slug="impression-bridge" toolId="5-22" />);
    act(() => { vi.advanceTimersByTime(30_000); });
    scrollPastThreshold();

    const viewed = window.gtag.mock.calls.filter((call) => call[1] === "blog_cta_viewed");
    expect(viewed).toHaveLength(1);
    expect(viewed[0][2]).toMatchObject({ placement: "blog_bridge", tool_id: "5-22", rank: 2 });
  });

  it("closing hides only that article, not the next article", () => {
    seedSession(2);
    const { unmount } = render(<BlogDochiBridge slug="dismiss-bridge" toolId="5-3" />);
    act(() => { vi.advanceTimersByTime(30_000); });
    scrollPastThreshold();

    act(() => { fireEvent.click(document.querySelector(".blog-dochi-bridge__close")); });
    expect(document.querySelector(".blog-dochi-bridge")).toBeNull();
    expect(window.sessionStorage.getItem("gop:blog:bridge-dismissed:dismiss-bridge")).toBe("1");
    expect(window.localStorage.getItem("gop:blog:bridge-off")).toBeNull();

    unmount();
    render(<BlogDochiBridge slug="dismiss-bridge-2" toolId="5-3" />);
    act(() => { vi.advanceTimersByTime(30_000); });
    scrollPastThreshold();
    expect(document.querySelector(".blog-dochi-bridge")).toBeTruthy();
  });

  it("today hides other articles and expires after local midnight", () => {
    seedSession(2);
    const view = render(<BlogDochiBridge slug="stop-bridge" toolId="5-3" />);
    act(() => { vi.advanceTimersByTime(30_000); });
    scrollPastThreshold();

    act(() => { fireEvent.click(document.querySelector(".blog-dochi-bridge__stop")); });
    expect(window.localStorage.getItem("gop:blog:bridge-off-date")).toBe(blogLocalDateKey());
    const dismissed = window.gtag.mock.calls.filter((call) => call[1] === "blog_bridge_dismissed");
    expect(dismissed[0][2]).toMatchObject({ state: "today", placement: "blog_bridge" });
    view.unmount();
    const second = render(<BlogDochiBridge slug="next-article" toolId="5-3" />);
    scrollPastThreshold();
    expect(document.querySelector(".blog-dochi-bridge")).toBeNull();
    second.unmount();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    vi.setSystemTime(tomorrow);
    render(<BlogDochiBridge slug="next-article" toolId="5-3" />);
    scrollPastThreshold();
    expect(document.querySelector(".blog-dochi-bridge")).toBeTruthy();
  });

  // 홈 도치(`DochiAssistant`)를 그대로 옮기면 마운트 즉시 startMyData()가 돌아 데모가
  // 꺼지고(§12.8) CsvUploader 번들이 콘텐츠 페이지로 흘러든다(§12.29). 소스에서 직접
  // 막는다 — 주석에 속지 않도록 주석을 먼저 지우고 실제 import·호출만 본다.
  it("never touches the data store or mounts an uploader", () => {
    const source = readFileSync("src/components/blog/BlogDochiBridge.jsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(source).not.toMatch(/from "@\/components\/CsvUploader"/);
    expect(source).not.toMatch(/useAppStore|startMyData/);
  });
});

// 외부 노출은 KR/EN 함께(§2.11) — 한쪽만 배선되는 역전이 이 저장소에서 반복됐다.
describe("BlogDochiBridge in English", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.gtag = vi.fn();
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.stubGlobal("requestAnimationFrame", (cb) => { cb(); return 1; });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    mountArticle();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete window.gtag;
    document.body.innerHTML = "";
  });

  it("renders English copy and /en links", () => {
    seedSession(2);
    render(<BlogDochiBridge slug="en-bridge" toolId="5-3" locale="en" />);
    act(() => { vi.advanceTimersByTime(30_000); });
    scrollArticleTo(2000);
    act(() => { fireEvent.scroll(window); });
    act(() => { vi.advanceTimersByTime(200); });
    scrollArticleTo(2100);
    act(() => { fireEvent.scroll(window); });

    const panel = document.querySelector(".blog-dochi-bridge");
    expect(panel).toBeTruthy();
    expect(panel.getAttribute("aria-label")).toBe("Related analysis");
    expect(panel.textContent).toContain("Apply what you read to your data.");
    expect(document.querySelector(".blog-dochi-bridge__cta").getAttribute("href")).toBe("/en/tools/budget-allocation");
    expect(document.querySelector(".blog-dochi-bridge__secondary").getAttribute("href")).toBe("/en/templates/budget-allocation");
  });
});
