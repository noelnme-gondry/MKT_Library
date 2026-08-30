// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdSenseScript from "@/components/AdSenseScript";
import useAnalyticsEnabled from "@/components/useAnalyticsEnabled";

vi.mock("@/components/useAnalyticsEnabled", () => ({ default: vi.fn() }));

const SCRIPT_SELECTOR = "#adsense-script";

describe("AdSenseScript", () => {
  beforeEach(() => {
    document.querySelector(SCRIPT_SELECTOR)?.remove();
    vi.mocked(useAnalyticsEnabled).mockReset();
  });

  afterEach(() => {
    cleanup();
    document.querySelector(SCRIPT_SELECTOR)?.remove();
  });

  it("운영 호스트가 아니면 광고 스크립트를 싣지 않는다", () => {
    vi.mocked(useAnalyticsEnabled).mockReturnValue(false);
    render(<AdSenseScript />);
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
  });

  it("운영 호스트에서는 브라우저 표준 script를 head에 한 번만 싣는다", async () => {
    vi.mocked(useAnalyticsEnabled).mockReturnValue(true);
    const first = render(<AdSenseScript />);
    first.rerender(<AdSenseScript />);

    await waitFor(() => expect(document.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(1));

    const script = document.querySelector(SCRIPT_SELECTOR);
    expect(script?.parentElement).toBe(document.head);
    expect(script?.src).toBe(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3073450406371629"
    );
    expect(script?.async).toBe(true);
    expect(script?.crossOrigin).toBe("anonymous");
    expect(script?.hasAttribute("data-nscript")).toBe(false);
  });
});
