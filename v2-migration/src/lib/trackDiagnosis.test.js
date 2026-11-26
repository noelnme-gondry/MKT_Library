import { afterEach, expect, it, vi } from "vitest";
import { trackDiagnosis } from "./trackDiagnosis";
import { trackProductEvent } from "./analytics";

afterEach(() => vi.unstubAllGlobals());

it("preserves article attribution through demo and upload and clears it on a new direct entry", () => {
  const values = new Map();
  const gtag = vi.fn();
  vi.stubGlobal("window", {
    gtag, location: { hostname: "localhost", origin: "http://localhost", pathname: "/en" },
    sessionStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
  });
  vi.stubGlobal("document", { referrer: "http://localhost/en/blog/ad-performance-diagnosis" });
  trackDiagnosis("entry_view", "blog", "en");
  for (const source of ["demo", "upload"]) {
    trackDiagnosis("result_view", source, "en");
    expect(gtag).toHaveBeenLastCalledWith("event", "diagnosis_result_view", expect.objectContaining({
      content_slug: "ad-performance-diagnosis", interaction_source: source, locale: "en",
    }));
  }
  trackDiagnosis("entry_view", "direct", "en");
  trackDiagnosis("result_blocked", "upload", "en");
  expect(gtag.mock.lastCall[2]).not.toHaveProperty("content_slug");
  trackProductEvent("blog_tool_cta_clicked", { tool_id: "campaign-diagnosis", locale: "en", content_type: "blog", content_slug: "ad-creative-testing", placement: "article_diagnosis" });
  trackDiagnosis("entry_view", "blog", "en");
  expect(gtag.mock.lastCall[2].content_slug).toBe("ad-creative-testing");
  const count = gtag.mock.calls.length;
  trackDiagnosis("result_view", "client-filename.csv", "en");
  expect(gtag).toHaveBeenCalledTimes(count);
});
