// @vitest-environment jsdom
//
// Render-smoke for Header. Regression net for a render/mount-effect throw. Header
// runs two mount effects (theme apply → localStorage + body class; theme restore
// → matchMedia). It reads isDarkMode/theme from the store, NOT csvData. We seed
// the store (no-data + with-data) for parity; the topbar must mount either way.
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import Header from "@/components/Header";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "home",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
    decisionRecords: [],
    isCmdkOpen: false,
    analystMode: false,
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

describe("Header render smoke", () => {
  beforeEach(() => seedNoData());
  it("no-data mounts", () => {
    expect(() => render(<Header />)).not.toThrow();
    expect(document.querySelector("header.topbar")).toBeTruthy();
  });
  it("with-data mounts", () => {
    seedWithData();
    expect(() => render(<Header />)).not.toThrow();
    expect(document.querySelector("#theme-toggle")).toBeTruthy();
    expect(screen.getByLabelText("현재 데이터: x.csv").textContent).toContain("x.csv");
    expect(document.querySelector(".topbar-context")).toBeTruthy();
    expect(document.querySelector(".topbar-actions__primary")).toBeTruthy();
  });
  it("exposes the complete tool menu as a dialog trigger in both locales", () => {
    const { unmount } = render(<Header />);
    const koTrigger = screen.getByRole("button", { name: "전체 도구" });
    expect(koTrigger.getAttribute("aria-controls")).toBe("cmdk");
    expect(koTrigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(koTrigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(koTrigger);
    expect(koTrigger.getAttribute("aria-expanded")).toBe("true");
    unmount();
    useAppStore.setState({ isCmdkOpen: false });
    render(<Header locale="en" />);
    expect(screen.getByRole("button", { name: "All tools" })).toBeTruthy();
  });
  it("links to the localized decision inbox and shows decisions due now", () => {
    useAppStore.setState({
      decisionRecords: [{ id: "decision_1", toolId: "5-2", action: "Review CPA", reviewDate: "2020-01-01", actual: "", learning: "" }],
    });
    const { unmount } = render(<Header />);
    const koLink = screen.getByRole("link", { name: "결정 검토함, 지금 검토할 결정 1건" });
    expect(koLink.getAttribute("href")).toBe("/weekly-review");
    expect(koLink.textContent).toContain("1");
    unmount();
    render(<Header locale="en" />);
    expect(screen.getByRole("link", { name: "Decision inbox, 1 decision due now" }).getAttribute("href")).toBe("/en/weekly-review");
  });
  it("keeps lower-frequency controls in one localized utility menu", () => {
    const { unmount } = render(<Header />);
    const koMenu = document.querySelector(".header-utility-menu");
    expect(koMenu).toBeTruthy();
    expect(koMenu?.querySelector("summary")?.getAttribute("aria-label")).toBe("기타 설정");
    expect(koMenu?.querySelector("#theme-toggle")?.getAttribute("aria-label")).toBe("테마 전환");
    unmount();
    render(<Header locale="en" />);
    expect(document.querySelector(".header-utility-menu > summary")?.getAttribute("aria-label")).toBe("More settings");
    expect(screen.getByRole("link", { name: "Decision inbox" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All tools" })).toBeTruthy();
  });
  it("keeps analyst mode in the utility menu and exposes its active state", () => {
    render(<Header />);
    expect(document.querySelector(".topbar-actions__primary .header-analyst-mode")).toBeNull();
    const toggle = document.querySelector(".header-analyst-mode-menu");
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(useAppStore.getState().analystMode).toBe(true);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.textContent).toContain("✓");
  });
  it("closes the utility menu on Escape and outside pointer input", () => {
    render(<Header />);
    const menu = document.querySelector(".header-utility-menu");
    const trigger = menu?.querySelector(":scope > summary");
    menu?.setAttribute("open", "");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu?.hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(trigger);
    menu?.setAttribute("open", "");
    fireEvent.pointerDown(document.body);
    expect(menu?.hasAttribute("open")).toBe(false);
  });
});
