// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import ContentActionPanel from "./ContentActionPanel";

const TARGET_POSTS = [
  ["ad-performance-diagnosis", "5-21", "/tools/campaign-variance"],
  ["budget-marginal-efficiency", "5-3", "/tools/budget-allocation"],
  ["ad-creative-testing", "9-6", "/content/freshness"],
  ["multicollinearity-mmm-guide", "5-25", "/tools/vif-multicollinearity"],
  ["apple-search-ads-guide", "5-26", "/tools/asa-keyword-finder"],
];

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
