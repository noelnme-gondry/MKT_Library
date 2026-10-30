import { afterEach, describe, expect, it, vi } from "vitest";
import { beginPartnerAdPage, isCurrentPartnerAdPage } from "./partnerAdMeasurement";
import { PARTNER_AD_PLACEMENTS, partnerAdEventParams } from "./partnerAds";
import { trackProductEvent } from "./analytics";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("partner ad measurement contract", () => {
  it("derives valid slot/format pairs from the placement registry", () => {
    for (const [slot, placement] of Object.entries(PARTNER_AD_PLACEMENTS)) {
      for (const format of placement.formats) {
        expect(partnerAdEventParams({ ad_slot: slot, ad_format: format, locale: "en", page_path: "/en/blog/ab-testing?file=secret.csv#private", file_name: "secret.csv", measurement_version: 999 })).toEqual({
          ad_provider: placement.provider, ad_slot: slot, ad_format: format,
          locale: "en", page_path: "/en/blog/ab-testing", ad_measurement_version: 1,
        });
      }
    }
    for (const slot of ["constructor", "__proto__", "unknown"]) {
      expect(partnerAdEventParams({ ad_slot: slot, ad_format: "wide", locale: "ko", page_path: "/" })).toBeNull();
    }
    expect(partnerAdEventParams({ ad_slot: "site-rail", ad_format: "wide", locale: "ko", page_path: "/" })).toBeNull();
    expect(partnerAdEventParams({ ad_slot: "home-intro", ad_format: "wide", locale: "ko", page_path: "https://evil.example/" })).toBeNull();
  });

  it("shares dedupe across mounts but starts a new entry after leaving and returning", () => {
    const first = beginPartnerAdPage("/blog/ab-testing");
    first.slots.add("site-rail");
    expect(beginPartnerAdPage("/blog/ab-testing")).toBe(first);
    expect(beginPartnerAdPage("/blog/ab-testing").slots.has("site-rail")).toBe(true);
    beginPartnerAdPage("/account");
    expect(isCurrentPartnerAdPage(first)).toBe(false);
    const returned = beginPartnerAdPage("/blog/ab-testing");
    expect(returned).not.toBe(first);
    expect(returned.slots.size).toBe(0);
    expect(isCurrentPartnerAdPage(returned)).toBe(true);
  });
});

describe("ad event transport boundaries", () => {
  function browser(hostname, consent = "granted") {
    vi.stubGlobal("navigator", { language: "ko-KR" });
    vi.stubGlobal("window", { location: new URL(`https://${hostname}/en/blog/ab-testing?csv=private.csv#secret`),
      localStorage: { getItem: () => consent }, gtag: vi.fn() });
    return { ad_slot: "blog-byline", ad_format: "wide", locale: "en" };
  }
  it.each(["localhost", "preview.up.railway.app", "growthoptplaybook.com.evil.example"])("rejects %s even if gtag was injected", hostname => {
    expect(trackProductEvent("ad_slot_view", browser(hostname))).toBe(false);
    expect(window.gtag).not.toHaveBeenCalled();
  });
  it("uses the existing production transport without implicit private URLs or extra fields", () => {
    const params = browser("growthoptplaybook.com");
    expect(trackProductEvent("ad_slot_view", { ...params, page_path: "/private-input", fileName: "private.csv", cost: 50, ad_measurement_version: 999, measurement_version: 999 })).toBe(true);
    expect(window.gtag).toHaveBeenCalledExactlyOnceWith("event", "ad_slot_view", {
      ...params, ad_provider: "adsterra", ad_measurement_version: 1, page_path: "/en/blog/ab-testing",
      page_location: "https://growthoptplaybook.com/en/blog/ab-testing", page_referrer: "", page_title: "", send_to: "G-DK12TNR0GW",
    });
  });
  it("rejects denied and pending EEA consent at send time", () => {
    expect(trackProductEvent("ad_slot_view", browser("growthoptplaybook.com", "denied"))).toBe(false);
    expect(window.gtag).not.toHaveBeenCalled();
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({ timeZone: "Europe/Berlin" });
    expect(trackProductEvent("ad_slot_view", browser("growthoptplaybook.com", null))).toBe(false);
    expect(window.gtag).not.toHaveBeenCalled();
  });
  it("reports a failed send without throwing or recording success", () => {
    const params = browser("growthoptplaybook.com");
    window.gtag.mockImplementation(() => { throw new Error("blocked"); });
    expect(trackProductEvent("ad_slot_view", params)).toBe(false);
  });
});
