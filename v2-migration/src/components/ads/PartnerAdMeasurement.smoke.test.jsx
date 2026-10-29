// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://growthoptplaybook.com/"}
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PartnerAdSlot, { PartnerAdRail } from "./PartnerAdSlot";
import GaPageviews from "@/components/GaPageviews";
import { trackProductEvent } from "@/lib/analytics";
import { beginPartnerAdPage } from "@/lib/partnerAdMeasurement";
import { PARTNER_AD_PLACEMENTS, PARTNER_AD_RAIL_MIN_WIDTH, pageAdPlacement } from "@/lib/partnerAds";
import { writeStoredConsent } from "@/lib/consent";
import * as adMode from "./usePartnerAdMode";

let pathname = "/";
let width = 800;
let visibility = "visible";
let zeroSize = false;
let intersections;
let resizes;
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const adCalls = () => window.gtag.mock.calls.filter(call => call[1] === "ad_slot_view");
const setPath = path => { window.history.pushState({}, "", path); pathname = window.location.pathname; };
const resize = nextWidth => act(() => { width = nextWidth; resizes.forEach(observer => observer.callback()); });
const intersect = (ratio = 0.5) => act(() => {
  intersections.slice().forEach(observer => {
    if (observer.active) observer.callback([{ target: observer.target, isIntersecting: ratio > 0, intersectionRatio: ratio }]);
  });
});
function Page({ locale = "ko", show = true, duplicate = false }) {
  const placement = pageAdPlacement(pathname);
  return <><GaPageviews /><div>{show && <><PartnerAdRail locale={locale} /><PartnerAdSlot placement={placement} locale={locale} />{duplicate && <PartnerAdSlot placement={placement} locale={locale} />}</>}</div></>;
}

beforeEach(() => {
  width = 800; visibility = "visible"; zeroSize = false;
  intersections = []; resizes = [];
  setPath("/");
  beginPartnerAdPage("/previous-test");
  window.localStorage.clear(); window.sessionStorage.clear();
  writeStoredConsent("granted");
  window.gtag = vi.fn();
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width: zeroSize ? 0 : 320, height: zeroSize ? 0 : 100, top: 0, left: 0, right: 320, bottom: 100 }));
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(() => zeroSize ? [] : [{}]);
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback) { this.callback = callback; resizes.push(this); }
    observe() { this.callback(); }
    disconnect() {}
  });
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback, options) { this.callback = callback; this.options = options; this.active = false; intersections.push(this); }
    observe(target) { this.target = target; this.active = true; }
    disconnect() { this.active = false; }
  });
});
afterEach(() => { cleanup(); writeStoredConsent(null); delete window.gtag; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(["ko", "en"])("connects the real slot render and product transport for every placement (%s)", locale => {
  const paths = ["/", "/blog/ab-testing", "/dashboard", "/guide"];
  const observed = new Set();
  width = PARTNER_AD_RAIL_MIN_WIDTH;
  for (const path of paths) {
    setPath(`${locale === "en" ? "/en" : ""}${path}?file=private.csv#secret`);
    const view = render(<Page locale={locale} />);
    const before = adCalls().length;
    intersect(0.49);
    expect(adCalls()).toHaveLength(before);
    intersect();
    const calls = adCalls().slice(before);
    expect(calls).toHaveLength(2);
    for (const [, , params] of calls) {
      observed.add(params.ad_slot);
      expect(PARTNER_AD_PLACEMENTS[params.ad_slot].formats).toContain(params.ad_format);
      expect(params).toEqual({ ad_provider: "coupang", ad_slot: params.ad_slot, ad_format: params.ad_format,
        locale, page_path: pathname, ad_measurement_version: 1, send_to: "G-DK12TNR0GW",
        page_location: `https://growthoptplaybook.com${pathname}`, page_referrer: "", page_title: "" });
      expect(JSON.stringify(params)).not.toMatch(/private|secret|\?|#/);
      expect(params).not.toHaveProperty("measurement_version");
    }
    view.unmount();
  }
  expect([...observed].sort()).toEqual(Object.keys(PARTNER_AD_PLACEMENTS).sort());
});

it("dedupes scroll, strict effects, duplicate mounts and format changes by page/slot", () => {
  width = 360;
  const view = render(<StrictMode><Page duplicate /></StrictMode>);
  intersect(); intersect(0); intersect(1);
  expect(adCalls()).toHaveLength(1);
  expect(adCalls()[0][2].ad_format).toBe("compact");
  resize(800); intersect(1);
  view.rerender(<StrictMode><Page duplicate /></StrictMode>);
  intersect(1);
  expect(adCalls()).toHaveLength(1);
  view.unmount();
  render(<Page />); intersect();
  expect(adCalls()).toHaveLength(1);
});

it("records the first reached format, not the first mounted format", () => {
  render(<Page />);
  intersect(0.2); resize(360); intersect();
  expect(adCalls()).toHaveLength(1);
  expect(adCalls()[0][2].ad_format).toBe("compact");
});

it("starts a new entry on SPA navigation and revisit, including a page without ads", () => {
  width = PARTNER_AD_RAIL_MIN_WIDTH;
  const view = render(<Page />); intersect();
  const oldObserver = intersections.find(observer => observer.target.dataset.adFormat === "rail");
  setPath("/guide"); view.rerender(<Page />); intersect();
  expect(adCalls()).toHaveLength(4);
  act(() => oldObserver.callback([{ target: oldObserver.target, isIntersecting: true, intersectionRatio: 1 }]));
  expect(adCalls()).toHaveLength(4);
  setPath("/account"); view.rerender(<Page show={false} />);
  setPath("/"); view.rerender(<Page />); intersect();
  expect(adCalls()).toHaveLength(6);
  view.unmount();
  expect(intersections.every(observer => !observer.active)).toBe(true);
});

it("does not count a query/hash change as another page entry", () => {
  const view = render(<Page />); intersect();
  setPath("/?file=private.csv#result"); view.rerender(<Page />); intersect();
  expect(adCalls()).toHaveLength(1);
});

it("waits for width, rail threshold, nonzero geometry and CSS visibility", () => {
  width = 319;
  const view = render(<Page />); intersect();
  expect(view.container.querySelector("iframe")).toBeNull();
  expect(adCalls()).toHaveLength(0);
  resize(360); zeroSize = true; intersect();
  expect(adCalls()).toHaveLength(0);
  zeroSize = false;
  const slot = view.container.querySelector('[data-ad-slot="home-intro"]');
  slot.style.display = "none"; intersect();
  slot.style.display = ""; slot.style.visibility = "hidden"; intersect();
  expect(adCalls()).toHaveLength(0);
  slot.style.visibility = ""; intersect();
  expect(adCalls()).toHaveLength(1);
  resize(PARTNER_AD_RAIL_MIN_WIDTH - 1); intersect();
  expect(adCalls()).toHaveLength(1);
  resize(PARTNER_AD_RAIL_MIN_WIDTH); intersect();
  expect(adCalls()).toHaveLength(2);
  expect(adCalls()[1][2].ad_slot).toBe("site-rail");
});

it("reobserves on tab visibility instead of sending its stale hidden intersection", () => {
  visibility = "hidden";
  render(<Page />); intersect(1);
  expect(adCalls()).toHaveLength(0);
  const hiddenObserver = intersections[0];
  visibility = "visible";
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  // 탭 복귀 뒤 늦게 전달된 이전 관측은 새 위치를 대신할 수 없다.
  act(() => hiddenObserver.callback([{ target: hiddenObserver.target, isIntersecting: true, intersectionRatio: 1 }]));
  expect(adCalls()).toHaveLength(0);
  intersect(0.1);
  expect(adCalls()).toHaveLength(0);
  intersect();
  expect(adCalls()).toHaveLength(1);
});

it("cleans observers/listeners on consent withdrawal and never sends a stale callback", () => {
  const add = vi.spyOn(document, "addEventListener");
  const remove = vi.spyOn(document, "removeEventListener");
  const view = render(<Page />);
  const observer = intersections[0];
  act(() => writeStoredConsent("denied"));
  expect(view.container.querySelector("iframe")).toBeNull();
  expect(observer.active).toBe(false);
  act(() => observer.callback([{ target: observer.target, isIntersecting: true, intersectionRatio: 1 }]));
  expect(adCalls()).toHaveLength(0);
  act(() => writeStoredConsent("granted")); intersect();
  expect(adCalls()).toHaveLength(1);
  view.unmount();
  const listeners = add.mock.calls.filter(([name]) => name === "visibilitychange").map(([, listener]) => listener);
  expect(listeners.length).toBeGreaterThan(0);
  for (const listener of listeners) expect(remove).toHaveBeenCalledWith("visibilitychange", listener);
});

it.each(["preview", "off"])("does not observe or transmit in %s mode", mode => {
  vi.spyOn(adMode, "default").mockReturnValue(mode);
  render(<Page />); intersect();
  expect(intersections).toHaveLength(0);
  expect(adCalls()).toHaveLength(0);
});

it("keeps the page usable without observation support or when the API fails", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  const view = render(<Page />);
  expect(view.container.querySelector("iframe")).not.toBeNull();
  expect(adCalls()).toHaveLength(0);
  view.unmount();
  vi.stubGlobal("IntersectionObserver", class { constructor() { throw new Error("blocked"); } });
  expect(() => render(<Page />)).not.toThrow();
});

it("frame load/error is not an impression and transport errors cannot throw into the page", () => {
  const view = render(<Page />);
  const frame = view.container.querySelector("iframe");
  fireEvent.load(frame); fireEvent.error(frame);
  expect(adCalls()).toHaveLength(0);
  window.gtag.mockImplementation((_, name) => { if (name === "ad_slot_view") throw new Error("blocked"); });
  expect(() => intersect()).not.toThrow();
  expect(view.container.querySelector("iframe")).toBe(frame);
  expect(beginPartnerAdPage(pathname).slots.size).toBe(0);
  expect(intersections.every(observer => !observer.active)).toBe(true);
  expect(trackProductEvent("analysis_started", { tool_id: "5-2", locale: "ko" })).toBe(true);
});
