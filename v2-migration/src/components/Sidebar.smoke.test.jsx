// @vitest-environment jsdom
//
// Render-smoke for Sidebar. Regression net for a render/mount-effect throw.
// Sidebar derives its active id from usePathname() (mocked to "/") and reads the
// static IA/PHASES tables. The planner remains the first action on every route.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import Sidebar from "@/components/Sidebar";
import { workspaceNavItem } from "@/lib/workspaceNav";

let pathname = "/";
let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}));

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "home",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
    decisionRecords: [],
    dochiAnalysisSession: null,
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
    search = "";
    seedNoData();
  });
  it.each(["ko", "en"])("keeps the planner and project review visible on entry (%s)", (locale) => {
    const prefix = locale === "en" ? "/en" : "";
    pathname = prefix || "/";
    const { container } = render(<Sidebar locale={locale} />);
    const rail = container.querySelector(".planner-rail");
    expect([...rail.querySelectorAll(":scope > a")].map(link => link.getAttribute("href")))
      .toEqual([prefix + "/tools/operations-planner", prefix + "/weekly-review"]);
    expect(rail.querySelectorAll("details")).toHaveLength(3);
    expect(rail.querySelector("details[open]")).toBeNull();
    for (const path of ["/start", "/diagnose", "/blog", "/guide", "/calculator", "/templates", "/glossary", "/compare", "/storage", "/subscription", "/account"]) {
      expect(rail.querySelectorAll(`details a[href="${prefix}${path}"]`), path).toHaveLength(1);
    }
    expect(container.querySelector("a[href*='youtube.com']")).toBeNull();
  });

  it.each(["/start", "/en/blog/article", "/calculator/example", "/account"])("opens the current collection on %s", (path) => {
    pathname = path;
    const { container } = render(<Sidebar locale={path.startsWith("/en/") ? "en" : "ko"} />);
    expect(container.querySelectorAll("details[open]")).toHaveLength(1);
    expect(container.querySelectorAll('details[open] a[aria-current="page"]')).toHaveLength(1);
  });

  it("keeps the planner current when data is loaded and retains the analysis session", () => {
    pathname = "/tools/operations-planner";
    seedWithData();
    const source = useAppStore.getState().csvData;
    useAppStore.setState({ dochiAnalysisSession: { sourceData: source, analyses: [] } });
    const { container } = render(<Sidebar />);
    expect(container.querySelector('.rail-planner[aria-current="page"]')).toBeTruthy();
    expect(container.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
    expect(container.querySelector('nav a[href="/dochi-result"]')).toBeNull();
    expect(useAppStore.getState().dochiAnalysisSession.sourceData).toBe(source);
  });

  it("surfaces decisions due now in the recurring workspace flow", () => {
    useAppStore.setState({
      decisionRecords: [{ id: "decision_1", toolId: "5-2", action: "CPA 검토", reviewDate: "2020-01-01", actual: "", learning: "" }],
    });
    const { container } = render(<Sidebar />);
    const review = container.querySelector('a[href="/weekly-review"]');
    expect(review?.getAttribute("aria-label")).toBe(`${workspaceNavItem("review").name}, 지금 검토할 결정 1건`);
    expect(review?.textContent).toContain("1");
  });
});
