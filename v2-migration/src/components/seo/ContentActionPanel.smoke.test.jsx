// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import ContentActionPanel from "./ContentActionPanel";

const TARGET_POSTS = [
  ["ad-performance-diagnosis", "5-21", "/tools/campaign-variance"],
  ["budget-marginal-efficiency", "5-3", "/tools/budget-allocation"],
  ["ad-creative-testing", "9-6", "/content/freshness"],
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
