import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import PartnerAdSlot, { PartnerAdRail } from "./PartnerAdSlot";
import { PARTNER_AD_PLACEMENTS } from "@/lib/partnerAds";
import { CONSENT_STORAGE_KEY, writeStoredConsent } from "@/lib/consent";
import * as adMode from "./usePartnerAdMode";
import { adsterraDocument, ADSTERRA_FRAME_SANDBOX, partnerAdSource } from "@/lib/partnerAdFrame";

afterEach(() => { cleanup(); window.localStorage.removeItem(CONSENT_STORAGE_KEY); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("production builds on local hosts render no advertising DOM or requests", () => {
  vi.stubEnv("NODE_ENV", "production");
  const { container } = render(<><PartnerAdRail />{Object.keys(PARTNER_AD_PLACEMENTS).map(placement => <PartnerAdSlot key={placement} placement={placement} />)}</>);
  expect(container.innerHTML).toBe("");
});

it("a hidden preview returns after resizing and mounts only the fitting creative", () => {
  vi.stubEnv("NODE_ENV", "development");
  let notify;
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class { constructor(callback) { notify = callback; } observe() {} disconnect() { disconnect(); } });
  const { container, unmount } = render(<div style={{ padding: "0 16px" }}><PartnerAdSlot placement="analysis-bottom" locale="en" /></div>);
  const parent = container.firstChild;
  const slot = parent.querySelector("[data-ad-slot]");
  const resize = width => act(() => { Object.defineProperty(parent, "clientWidth", { configurable: true, value: width }); notify(); });
  resize(320);
  expect(slot.hidden).toBe(true);
  resize(360);
  expect(slot.hidden).toBe(false);
  expect(slot.querySelectorAll("[data-ad-format]")).toHaveLength(1);
  expect(slot.querySelector("[data-ad-format]").dataset.adFormat).toBe("compact");
  resize(800);
  expect(slot.querySelectorAll("[data-ad-format]")).toHaveLength(1);
  expect(slot.querySelector("[data-ad-format]").dataset.adFormat).toBe("wide");
  expect(slot.querySelector("iframe, script, a")).toBeNull();
  act(() => writeStoredConsent("denied"));
  expect(parent.querySelector("[data-ad-slot]")).toBeNull();
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});

it("mounts only the fitting live iframe on the partner origin", () => {
  vi.spyOn(adMode, "default").mockReturnValue("live");
  let notify;
  vi.stubGlobal("ResizeObserver", class { constructor(callback) { notify = callback; } observe() {} disconnect() {} });
  const { container } = render(<div><PartnerAdSlot placement="analysis-bottom" /></div>);
  const parent = container.firstChild;
  const resize = width => act(() => { Object.defineProperty(parent, "clientWidth", { configurable: true, value: width }); notify(); });
  resize(800);
  expect(parent.querySelectorAll("iframe")).toHaveLength(1);
  const frame = parent.querySelector("iframe");
  expect(frame.getAttribute("src")).toBe(partnerAdSource("wide"));
  expect(new URL(frame.getAttribute("src")).origin).toBe("https://ads-partners.coupang.com");
  expect(frame.hasAttribute("srcdoc")).toBe(false);
  expect(frame.getAttribute("sandbox").split(" ")).toEqual(["allow-scripts", "allow-same-origin", "allow-popups", "allow-popups-to-escape-sandbox"]);
  expect(frame.getAttribute("referrerpolicy")).toBe("origin");
  expect(parent.querySelector("script")).toBeNull();
  resize(360);
  expect(parent.querySelectorAll("iframe")).toHaveLength(1);
  expect(parent.querySelector("iframe").getAttribute("src")).toBe(partnerAdSource("compact"));
  resize(319);
  expect(parent.querySelector("iframe")).toBeNull();
});

it("replaces general slots with one isolated Adsterra frame and hides undersized slots", () => {
  vi.spyOn(adMode, "default").mockReturnValue("live");
  let notify;
  vi.stubGlobal("ResizeObserver", class { constructor(callback) { notify = callback; } observe() {} disconnect() {} });
  const { container } = render(<div><PartnerAdSlot placement="home-intro" /></div>);
  const parent = container.firstChild;
  for (const [width, format, height] of [[800, "wide", "90"], [360, "compact", "50"]]) {
    act(() => { Object.defineProperty(parent, "clientWidth", { configurable: true, value: width }); notify(); });
    expect(parent.querySelectorAll("iframe")).toHaveLength(1);
    const frame = parent.querySelector("iframe");
    expect(frame.getAttribute("data-ad-provider")).toBe("adsterra");
    expect(frame.hasAttribute("src")).toBe(false);
    expect(frame.getAttribute("srcdoc")).toBe(adsterraDocument(format));
    expect(frame.getAttribute("height")).toBe(height);
    expect(frame.getAttribute("sandbox")).toBe(ADSTERRA_FRAME_SANDBOX);
    expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(parent.querySelector("script")).toBeNull();
  }
  act(() => { Object.defineProperty(parent, "clientWidth", { configurable: true, value: 319 }); notify(); });
  expect(parent.querySelector("iframe")).toBeNull();
});
