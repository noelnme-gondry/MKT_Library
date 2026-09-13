// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ContentActionPanel from "./ContentActionPanel";
import { useAppStore } from "@/store/useDataStore";
import { getAllPosts } from "@/lib/blog";
import { BLOG_INSIGHT_PLACEMENTS } from "@/lib/blogInsightRegistry";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { normalizeProductToolId } from "@/lib/analytics";
import { primaryToolForContent } from "@/lib/contentToolRegistry";
import { TEMPLATE_PAGES } from "@/lib/templateCatalog";

const TARGET_POSTS = [
  ["ad-performance-diagnosis", "5-21", "/tools/campaign-variance"],
  ["budget-marginal-efficiency", "5-3", "/tools/budget-allocation"],
  ["ad-creative-testing", "9-6", "/content/freshness"],
  ["multicollinearity-mmm-guide", "5-25", "/tools/vif-multicollinearity"],
  ["apple-search-ads-guide", "5-26", "/tools/asa-keyword-finder"],
];

describe("all published article journeys", () => {
  afterEach(() => { delete window.gtag; useAppStore.setState(useAppStore.getInitialState()); });
  it.each(["ko", "en"].flatMap(locale => getAllPosts(locale).map(post => [post.slug, locale])))("%s exposes only supported next steps in %s", (slug, locale) => {
    window.gtag = vi.fn();
    const en = locale === "en";
    const toolId = primaryToolForContent(slug, "blog");
    const template = TEMPLATE_PAGES.find(page => page.toolId === toolId);
    const practice = BLOG_INSIGHT_PLACEMENTS[slug];
    render(<ContentActionPanel post={{ slug }} locale={locale} />);
    expect(template).toBeTruthy();
    expect(screen.getByRole("link", { name: en ? "Prepare the CSV columns →" : "CSV 컬럼 준비 →" }).getAttribute("href")).toBe(`${en ? "/en" : ""}/templates/${template.slug}`);
    const sample = screen.queryByRole("link", { name: en ? "Try the article’s demo →" : "본문 데모 실습으로 →" });
    expect(Boolean(sample)).toBe(Boolean(practice));
    if (practice) {
      expect(sample.getAttribute("href")).toBe("#blog-practice");
      clickWithoutNavigation(sample);
      expect(window.gtag).toHaveBeenCalledWith("event", "blog_tool_cta_clicked", expect.objectContaining({ tool_id: normalizeProductToolId(practice.toolId), content_slug: slug, placement: "article_case_practice" }));
      expect(JSON.parse(window.sessionStorage.getItem("gop:editorial-journey")).tool_id).toBe(practice.toolId);
    }
    const review = screen.queryByRole("link", { name: en ? "Continue in Weekly Review →" : "주간 리뷰로 이어가기 →" });
    const canReview = Boolean(practice && TOOL_GROUP[practice.toolId] === "efficiency" && TOOL_GROUP[toolId] === "efficiency");
    expect(Boolean(review)).toBe(canReview);
    if (canReview) {
      expect(review.getAttribute("href")).toBe(`${en ? "/en" : ""}/weekly-review`);
      clickWithoutNavigation(review);
      expect(window.gtag).toHaveBeenCalledWith("event", "blog_tool_cta_clicked", expect.objectContaining({ tool_id: "weekly-review", content_slug: slug, placement: "article_case_review" }));
    }
  });
});

const ACTION_CASES = TARGET_POSTS.flatMap(([slug, toolId, path]) =>
  ["ko", "en"].flatMap((locale) =>
    ["article_post", "article_mid"].map((placement) => [
      slug,
      toolId,
      locale,
      placement,
      locale === "en" ? `/en${path}` : path,
    ]),
  ),
);

function clickWithoutNavigation(element) {
  element.addEventListener("click", (event) => event.preventDefault(), { once: true });
  fireEvent.click(element);
}

describe("ContentActionPanel blog conversion paths", () => {
  afterEach(() => {
    delete window.gtag;
  });

  it.each(ACTION_CASES)(
    "%s routes %s in %s at %s to its exact tool and tracks the click",
    (slug, toolId, locale, placement, expectedHref) => {
      window.gtag = vi.fn();
      const placementProps = placement === "article_mid" ? { placement } : {};
      const { container } = render(
        <ContentActionPanel locale={locale} toolId={toolId} post={{ slug }} {...placementProps} />,
      );

      const panel = container.querySelector(".content-action-panel");
      const primaryLink = container.querySelector(".content-action-panel__cta");
      const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));

      expect(primaryLink?.getAttribute("href")).toBe(expectedHref);
      expect(hrefs).not.toContain("/");
      expect(hrefs).not.toContain("/en");
      expect(panel?.classList.contains("content-action-panel--inline")).toBe(placement === "article_mid");

      clickWithoutNavigation(primaryLink);
      expect(window.gtag).toHaveBeenCalledTimes(1);
      expect(window.gtag).toHaveBeenCalledWith("event", "blog_tool_cta_clicked", {
        tool_id: toolId,
        source: "blog",
        locale,
        placement,
        content_slug: slug,
        content_type: "blog",
      });
    },
  );
});

// 회귀 방지 — 이 세 도구는 TOOL_COPY에 없어 `5-2`(운영 대시보드)로 폴백하고 있었다.
// 글에 적힌 주제와 다른 도구로 보내면 그 세션은 거기서 끝난다.
describe("previously mis-routed content", () => {
  afterEach(() => {
    delete window.gtag;
  });

  it.each([
    ["aso-basics-guide", "5-27", "/tools/aso-store-conversion"],
    ["brand-campaign-lift", "5-24", "/tools/brand-campaign-incrementality"],
    ["content-element-analysis", "9-1", "/content/element-analysis"],
  ])("%s reaches %s instead of the dashboard fallback", (slug, toolId, path) => {
    window.gtag = vi.fn();
    const { container } = render(<ContentActionPanel toolId={toolId} post={{ slug }} />);
    const cta = container.querySelector(".content-action-panel__cta");
    expect(cta?.getAttribute("href")).toBe(path);
    expect(cta?.getAttribute("href")).not.toBe("/dashboard");
  });
});

describe("answer link placement", () => {
  afterEach(() => {
    delete window.gtag;
  });

  it.each(["ko", "en"])("%s renders one plain link, not a second panel box", (locale) => {
    window.gtag = vi.fn();
    const { container } = render(
      <ContentActionPanel locale={locale} toolId="5-3" post={{ slug: "roas-improvement" }} placement="article_answer" />,
    );
    expect(container.querySelector(".content-action-panel")).toBeNull();
    const link = container.querySelector(".content-answer__action a");
    expect(link?.getAttribute("href")).toBe(locale === "en" ? "/en/tools/budget-allocation" : "/tools/budget-allocation");

    clickWithoutNavigation(link);
    expect(window.gtag).toHaveBeenCalledWith("event", "blog_tool_cta_clicked", expect.objectContaining({
      tool_id: "5-3",
      placement: "article_answer",
      locale,
    }));
  });
});

// 노출 계측 — 클릭 0이 "안 눌렀다"인지 "안 보였다"인지 가르는 분모다.
describe("panel impression tracking", () => {
  const observers = [];

  beforeEach(() => {
    window.gtag = vi.fn();
    observers.length = 0;
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(target) { this.target = target; }
      disconnect() { this.disconnected = true; }
      trigger() { this.callback([{ target: this.target, isIntersecting: true, intersectionRatio: 1 }]); }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.gtag;
  });

  it("reports the panel only once it actually enters the viewport", () => {
    render(<ContentActionPanel toolId="5-22" post={{ slug: "impression-probe" }} placement="article_mid" />);
    expect(window.gtag).not.toHaveBeenCalled();

    observers[0].trigger();
    expect(window.gtag).toHaveBeenCalledWith("event", "blog_cta_viewed", expect.objectContaining({
      tool_id: "5-22",
      content_slug: "impression-probe",
      placement: "article_mid",
      content_type: "blog",
    }));
    expect(observers[0].disconnected).toBe(true);
  });

  it("reports the answer link only after it becomes visible", () => {
    render(<ContentActionPanel toolId="5-22" post={{ slug: "answer-probe" }} placement="article_answer" />);
    expect(window.gtag).not.toHaveBeenCalled();
    observers[0].trigger();
    expect(window.gtag).toHaveBeenCalledWith("event", "blog_cta_viewed", expect.objectContaining({
      content_slug: "answer-probe", placement: "article_answer", tool_id: "5-22",
    }));
    expect(observers[0].disconnected).toBe(true);
  });
});
