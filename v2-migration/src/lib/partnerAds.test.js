import { describe, expect, it } from "vitest";
import { PARTNER_AD_PLACEMENTS, partnerAdFormat, pageAdPlacement, partnerAdMode } from "./partnerAds";
import { partnerAdDocument, partnerAdSource, PARTNER_FRAME_CSP } from "./partnerAdFrame";

describe("partner ad sizing and placement", () => {
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

it("embeds only the issued creatives in unique-origin documents", () => {
  for (const [format, id, width, height] of [["rail", 1039165, "160", "600"], ["wide", 1039166, "728", "90"], ["compact", 1039167, "320", "100"]]) {
    const source = partnerAdSource(format);
    expect(source).toMatch(/^data:text\/html;charset=utf-8,/);
    const html = decodeURIComponent(source.split(",").slice(1).join(","));
    const config = JSON.parse(html.match(/new PartnersCoupang.G\((\{[^<]+\})\);/)[1]);
    expect(config).toEqual({ id, template: "carousel", trackingCode: "AF3219545", width, height, tsource: "" });
    expect(html).toContain('src="https://ads-partners.coupang.com/g.js"');
    expect(html).toContain('name="referrer" content="origin"');
    expect(html).toContain(PARTNER_FRAME_CSP);
    expect(PARTNER_FRAME_CSP).toContain("default-src 'none'");
  }
  for (const format of [null, "constructor", "toString", "<script>", "unknown"]) {
    expect(partnerAdDocument(format)).toBeNull();
    expect(partnerAdSource(format)).toBeNull();
  }
});
