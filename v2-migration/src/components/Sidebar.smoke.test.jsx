// @vitest-environment jsdom
//
// Render-smoke for Sidebar. Regression net for a render/mount-effect throw.
// Sidebar derives its active id from usePathname() (mocked to "/") and reads the
// static IA/PHASES tables — it does NOT read csvData. "/" intentionally renders
// the compact Decision Workspace nav; inner pages retain the full IA nav.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import Sidebar from "@/components/Sidebar";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "home",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
    isCmdkOpen: false,
  });
}

function seedWithData() {
  const headers = ["Date", "Country", "Platform", "Channel", "Spend", "Installs"];
  const mapping = { Date: "date", Country: "country", Platform: "platform", Channel: "channel", Spend: "cost", Installs: "installs" };
  const raw = [];
  for (let d = 1; d <= 10; d++) for (const ch of ["Google", "Meta"]) {
    const cost = ch === "Google" ? 100000 + d * 3000 : 80000 + d * 2500;
    raw.push({ Date: `2026-01-${String(d).padStart(2, "0")}`, Country: "KR", Platform: "iOS", Channel: ch, Spend: cost, Installs: Math.round(cost / (ch === "Google" ? 5000 : 4200)) });
  }
  const slice = { raw, headers, mapping, fileName: "x.csv" };
  useAppStore.setState({ currentRouteId: "5-2", csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice }, csvData: slice });
}

describe("Sidebar render smoke", () => {
  beforeEach(() => {
    pathname = "/";
    seedNoData();
  });
  it("no-data mounts", () => {
    expect(() => render(<Sidebar />)).not.toThrow();
    expect(document.querySelector(".home-sidebar-nav")).toBeTruthy();
    expect(document.querySelectorAll(".home-sidebar-nav__item")).toHaveLength(4);
    expect(document.querySelectorAll(".sidebar-library-link")).toHaveLength(6);
    expect(document.querySelector('a[href="/calculator"]')).toBeTruthy();
    expect(document.querySelector('a[href="/diagnose"]')).toBeTruthy();
    expect(document.querySelectorAll(".sidebar-social .ss-btn")).toHaveLength(4);
    expect(document.querySelector('a[href="https://blog.naver.com/growthoptplaybook"]')).toBeTruthy();
    expect(document.querySelector('.home-sidebar-nav__item[aria-current="page"]')).toBeTruthy();
  });
  it("with-data mounts", () => {
    pathname = "/dashboard";
    seedWithData();
    expect(() => render(<Sidebar />)).not.toThrow();
    expect(document.querySelector("aside.sidebar")).toBeTruthy();
    expect(document.querySelector('.nav-item[data-route="5-2"][aria-current="page"]')).toBeTruthy();
    const search = document.querySelector(".sidebar-search");
    expect(search?.getAttribute("aria-controls")).toBe("cmdk");
    expect(search?.getAttribute("aria-expanded")).toBe("false");
  });
  it("keeps resource and external-link parity in English", () => {
    pathname = "/en";
    const { container } = render(<Sidebar locale="en" />);
    expect(container.textContent).toContain("Operating Guide");
    expect(container.textContent).toContain("Naver Blog");
    expect(container.querySelector('a[href="/en/guide"]')).toBeTruthy();
  });
});
