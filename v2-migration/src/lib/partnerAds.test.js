import { describe, expect, it } from "vitest";
import { PARTNER_AD_PLACEMENTS, partnerAdFormat, pageAdPlacement, partnerAdMode, partnerAdInlineLayout, partnerAdRailFormat, partnerAdEventParams } from "./partnerAds";
import { partnerAdSource } from "./partnerAdFrame";

describe("partner ad sizing and placement", () => {
  it("borrows only enough safe space for compact and excludes scrollbars, sidebar and safe-area", () => {
    expect(partnerAdInlineLayout({ contentLeft: 16, contentWidth: 318, safeLeft: 0, safeRight: 350 })).toEqual({ width: 320, marginLeft: -1 });
    expect(partnerAdInlineLayout({ contentLeft: 16, contentWidth: 288, safeLeft: 0, safeRight: 320 })).toEqual({ width: 320, marginLeft: -16 });
    expect(partnerAdInlineLayout({ contentLeft: 16, contentWidth: 278, safeLeft: 0, safeRight: 310 })).toEqual({ width: 310, marginLeft: -16 });
    expect(partnerAdInlineLayout({ contentLeft: 286, contentWidth: 300, safeLeft: 270, safeRight: 620 })).toEqual({ width: 320, marginLeft: -10 });
    expect(partnerAdInlineLayout({ contentLeft: 16, contentWidth: 288, safeLeft: 20, safeRight: 300 })).toEqual({ width: 280, marginLeft: 4 });
  });
  it("uses compact only as the analysis rail replacement and admits its actual measurement format", () => {
    for (const prefix of ["", "/en"]) {
      for (const path of ["/dashboard", "/tools/budget-allocation", "/dochi-result"]) {
        expect(partnerAdRailFormat(`${prefix}${path}`, 319)).toBeNull();
        expect(partnerAdRailFormat(`${prefix}${path}`, 320)).toBe("compact");
        expect(partnerAdRailFormat(`${prefix}${path}`, 1179)).toBe("compact");
        expect(partnerAdRailFormat(`${prefix}${path}`, 1180)).toBe("rail");
      }
      for (const path of ["/", "/guide", "/blog/correlation-vs-causation"]) expect(partnerAdRailFormat(`${prefix}${path}`, 1179)).toBeNull();
    }
    expect(partnerAdEventParams({ ad_slot: "site-rail", ad_format: "compact", locale: "ko", page_path: "/dashboard" })).toMatchObject({ ad_provider: "adsterra", ad_format: "compact", ad_measurement_version: 1 });
    expect(partnerAdEventParams({ ad_slot: "site-rail", ad_format: "wide", locale: "ko", page_path: "/dashboard" })).toBeNull();
  });
  it("selects exactly one unscaled horizontal format that fits the available width", () => {
    for (const placement of Object.keys(PARTNER_AD_PLACEMENTS).filter(key => key !== "site-rail")) {
      expect(partnerAdFormat(placement, 728)).toBe("wide");
      expect(partnerAdFormat(placement, 727.5)).toBe("compact");
      expect(partnerAdFormat(placement, 320)).toBe("compact");
      for (const width of [319.5, 0, -1, NaN, Infinity]) expect(partnerAdFormat(placement, width)).toBeNull();
    }
  });
  it("assigns one horizontal location per page in both languages", () => {
    const locations = {
      "/": "home-intro", "/blog/marketing-analysis-example": "blog-byline",
      "/blog": "page-bottom", "/blog/tag/measurement": "page-bottom", "/compare": "page-bottom",
      "/dashboard": "analysis-bottom", "/tools/operations-planner": "analysis-bottom",
      "/content/freshness": "analysis-bottom", "/dochi-result": "analysis-bottom",
      "/weekly-review": "page-bottom", "/guide/kpi-analysis": "page-bottom",
    };
    for (const [path, placement] of Object.entries(locations)) {
      expect(pageAdPlacement(path), path).toBe(placement);
      expect(pageAdPlacement(`/en${path}`), `/en${path}`).toBe(placement);
    }
  });
});

it("loads only on production hosts and respects opt-out and pending consent", () => {
  const base = { hostname: "growthoptplaybook.com", environment: "production", consent: null, needsConsent: false };
  expect(partnerAdMode(base)).toBe("live");
  expect(partnerAdMode({ ...base, hostname: "www.growthoptplaybook.com" })).toBe("live");
  expect(partnerAdMode({ ...base, consent: "denied" })).toBe("off");
  expect(partnerAdMode({ ...base, needsConsent: true })).toBe("off");
  expect(partnerAdMode({ ...base, needsConsent: true, consent: "granted" })).toBe("live");
  for (const hostname of ["localhost", "preview.up.railway.app", "growthoptplaybook.com.example.org"]) {
    expect(partnerAdMode({ ...base, hostname })).toBe("off");
  }
  expect(partnerAdMode({ ...base, hostname: "localhost", environment: "development" })).toBe("preview");
});

it("loads only the issued creatives directly from the partner origin", () => {
  for (const [format, id, width, height] of [["rail", 1039165, "160", "600"], ["wide", 1039166, "728", "90"], ["compact", 1039167, "320", "100"]]) {
    const source = partnerAdSource(format);
    const url = new URL(source);
    expect(url.origin).toBe("https://ads-partners.coupang.com");
    expect(url.pathname).toBe("/widgets.html");
    expect(Object.fromEntries(url.searchParams)).toEqual({ id: String(id), template: "carousel", trackingCode: "AF3219545", subId: "", width, height, tsource: "" });
    // No SDK wrapper, page URL, query, analysis data or size handshake.
    expect(url.hash).toBe("");
  }
  for (const format of [null, "constructor", "toString", "<script>", "unknown"]) {
    expect(partnerAdSource(format)).toBeNull();
  }
});
