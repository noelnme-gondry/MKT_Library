// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import BlogReadTracker, { readDepthPercent, reachedDepths, readSessionSlugs, recordSessionSlug } from "./BlogReadTracker";

function eventsNamed(name) {
  return window.gtag.mock.calls.filter((call) => call[1] === name);
}

describe("read depth math", () => {
  it("reports 0 before the article starts and 100 past its end", () => {
    expect(readDepthPercent(2000, 4000, 0, 800)).toBe(0);
    expect(readDepthPercent(0, 4000, 6000, 800)).toBe(100);
  });

  it("counts what has scrolled past the viewport bottom", () => {
    expect(readDepthPercent(0, 4000, 1200, 800)).toBe(50);
  });

  it("never returns a partial depth as reached", () => {
    expect(reachedDepths(49)).toEqual([25]);
    expect(reachedDepths(75)).toEqual([25, 50, 75]);
    expect(reachedDepths(100)).toEqual([25, 50, 75, 100]);
  });
});

describe("session slug store", () => {
  it("keeps insertion order and de-duplicates", () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    expect(recordSessionSlug(storage, "a")).toEqual(["a"]);
    expect(recordSessionSlug(storage, "b")).toEqual(["a", "b"]);
    expect(recordSessionSlug(storage, "a")).toEqual(["a", "b"]);
  });

  // 저장소가 막힌 브라우저에서 계측이 페이지를 죽이면 안 된다.
  it("falls back to empty when storage throws", () => {
    const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readSessionSlugs(storage)).toEqual([]);
    expect(() => recordSessionSlug(storage, "a")).not.toThrow();
  });

  it("survives corrupted stored values", () => {
    const storage = { getItem: () => "not json", setItem: () => {} };
    expect(readSessionSlugs(storage)).toEqual([]);
  });
});

// 주의: `trackProductEventOnce`의 중복 방지 키는 모듈 수명이라 테스트끼리 공유된다.
// 케이스마다 다른 슬러그를 써야 두 번째 케이스가 "조용히 통과"하지 않는다.
describe("BlogReadTracker", () => {
  beforeEach(() => {
    window.gtag = vi.fn();
    window.sessionStorage.clear();
    document.body.innerHTML = '<div class="blog-prose">본문</div>';
    const article = document.querySelector(".blog-prose");
    article.getBoundingClientRect = () => ({ top: 0, height: 4000 });
    window.scrollY = 0;
    window.innerHeight = 1000; // 4000px 본문의 25%가 첫 화면에 들어온다
  });

  afterEach(() => {
    delete window.gtag;
    document.body.innerHTML = "";
  });

  it("reports the depths already on screen at mount", () => {
    render(<BlogReadTracker slug="depth-mount" />);
    const depths = eventsNamed("blog_read_depth").map((call) => call[2].state);
    expect(depths).toEqual(["depth_25"]);
    expect(eventsNamed("blog_read_depth")[0][2]).toMatchObject({
      content_slug: "depth-mount",
      content_type: "blog",
      locale: "ko",
    });
  });

  it("does not report the same depth twice on repeated scrolls", () => {
    render(<BlogReadTracker slug="depth-repeat" />);
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
    expect(eventsNamed("blog_read_depth").filter((c) => c[2].state === "depth_25")).toHaveLength(1);
  });

  it("stays silent on the first article and reports the second", () => {
    render(<BlogReadTracker slug="first-post" />);
    expect(eventsNamed("blog_session_articles")).toHaveLength(0);

    render(<BlogReadTracker slug="second-post" locale="en" />);
    const session = eventsNamed("blog_session_articles");
    expect(session).toHaveLength(1);
    expect(session[0][2]).toMatchObject({ content_slug: "second-post", rank: 2, locale: "en" });
  });

  // 계측은 화면을 그리지 않는다 — 마크업이 하나라도 늘면 본문 레이아웃에 끼어든다.
  it("renders nothing", () => {
    const { container } = render(<BlogReadTracker slug="renders-nothing" />);
    expect(container.innerHTML).toBe("");
  });

  it("does nothing when the article element is missing", () => {
    document.body.innerHTML = "";
    expect(() => render(<BlogReadTracker slug="no-article" />)).not.toThrow();
    expect(eventsNamed("blog_read_depth")).toHaveLength(0);
  });
});
