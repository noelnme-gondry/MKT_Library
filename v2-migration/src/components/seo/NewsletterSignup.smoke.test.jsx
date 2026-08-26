// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import NewsletterSignup from "./NewsletterSignup";

describe("NewsletterSignup conversion telemetry", () => {
  afterEach(() => {
    delete window.gtag;
  });

  it("tracks a submit attempt without claiming a confirmed subscription", () => {
    window.gtag = vi.fn();
    const { container } = render(<NewsletterSignup placement="post" />);
    fireEvent.submit(container.querySelector("form"));

    expect(window.gtag).toHaveBeenCalledWith("event", "newsletter_submit_attempt", {
      source: "blog",
      locale: "ko",
      placement: "post",
    });
    expect(window.gtag).not.toHaveBeenCalledWith("event", "newsletter_submit", expect.anything());
    expect(screen.getByRole("status").textContent).toContain("확인 메일");
  });

  it("keeps product placements separately tagged with the same explicit consent", () => {
    window.gtag = vi.fn();
    const { container } = render(<NewsletterSignup locale="en" source="product" placement="weekly_report" />);
    expect(container.querySelector('input[name="tag"][value="growthopt-product"]')).toBeTruthy();
    expect(container.querySelector('input[name="tag"][value="product-en-weekly_report"]')).toBeTruthy();
    expect(container.querySelector('input[name="metadata__marketing_consent"][required]')).toBeTruthy();
    fireEvent.submit(container.querySelector("form"));
    expect(window.gtag).toHaveBeenCalledWith("event", "newsletter_submit_attempt", {
      source: "product",
      locale: "en",
      placement: "weekly_report",
    });
  });
});
