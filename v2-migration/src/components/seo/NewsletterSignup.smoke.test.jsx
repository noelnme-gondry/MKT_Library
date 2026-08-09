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
});
