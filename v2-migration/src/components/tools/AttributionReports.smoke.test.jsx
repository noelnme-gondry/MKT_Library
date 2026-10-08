// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within, cleanup } from "@testing-library/react";
import MultitouchMap from "./MultitouchMap";
import CannibalDetail from "./CannibalDetail";
import { useAppStore } from "@/store/useDataStore";
import { buildMultitouchDemo, buildCannibalDetailDemo } from "@/lib/attributionReports/demo";

beforeEach(() => {
  cleanup();
  useAppStore.setState(useAppStore.getInitialState(), true);
});
describe("raw report routes and state wiring", () => {
  it.each(["ko", "en"])("loads the multi-touch example directly into results (%s)", async locale => {
    useAppStore.getState().setCurrentRouteId("5-30");
    render(<MultitouchMap locale={locale} />);
    expect(screen.queryByRole("table", { name: locale === "en" ? "CTIT" : "CTIT" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Run the example and see results" : "예시 데이터로 결과 바로 보기" }));
    expect(useAppStore.getState().isGroupAnalyzed("5-30")).toBe(true);
    const table = await screen.findByRole("table", { name: "CTIT" });
    expect(table.textContent).toContain("10.0");
    const before = table.textContent;
    fireEvent.change(screen.getByLabelText("Probabilistic"), { target: { value: "true" } });
    await screen.findByText(locale === "en" ? "960 of 2,400 click-attributed installs have recorded click contributors" : "클릭 귀속 설치 2,400건 중 960건에 클릭 contributor가 기록됐습니다");
    await waitFor(() => expect(screen.getByRole("table", { name: "CTIT" }).textContent).toBe(before));
    fireEvent.change(screen.getByLabelText(locale === "en" ? "Meta/TikTok placement" : "Meta·TikTok 지면"), { target: { value: "true" } });
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^TikTok · Pangle/ }).length).toBeGreaterThan(0));
    expect(useAppStore.getState().isGroupAnalyzed("5-30")).toBe(true);
  });
  it("keeps calculations behind the confirmed mapping gate", async () => {
    const store = useAppStore.getState();
    store.setCurrentRouteId("5-30"); store.setCsvData({ ...buildMultitouchDemo(), importSource: "csv", fileName: "raw.csv" });
    render(<MultitouchMap />);
    expect(screen.queryByRole("table", { name: "CTIT" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "데이터 분석하기" }));
    expect(useAppStore.getState().isGroupAnalyzed("5-30")).toBe(true);
    await screen.findByRole("table", { name: "CTIT" });
  });
  it.each(["ko", "en"])("renders stretch/campaign/mix detail and curated renumbering (%s)", async locale => {
    const store = useAppStore.getState();
    store.setCurrentRouteId("5-18-cannibal-detail"); store.setCsvData(buildCannibalDetailDemo()); store.setGroupAnalyzed("5-18-cannibal-detail");
    render(<CannibalDetail locale={locale} />);
    const stretches = await screen.findByRole("table", { name: locale === "en" ? "Detected stretches" : "탐지 구간" });
    expect(within(stretches).getAllByRole("row")).toHaveLength(5);
    fireEvent.click(within(stretches).getAllByRole("button", { name: locale === "en" ? "Exclude stretch" : "구간 제외" })[0]);
    await waitFor(() => expect(within(stretches).getAllByRole("row")).toHaveLength(4));
    expect(within(stretches).getAllByRole("button").find(button => button.textContent.startsWith("#"))?.textContent).toMatch(/^#1 /);
    const channels = screen.getByRole("table", { name: locale === "en" ? "Channel moves" : "채널 변화량" });
    fireEvent.click(within(channels).getByRole("button", { name: "Meta" }));
    const campaigns = screen.getByRole("table", { name: locale === "en" ? "Campaign moves" : "캠페인 변화량" });
    expect(campaigns.textContent).not.toContain("Google");
    fireEvent.click(within(campaigns).getByRole("button", { name: "Acquisition" }));
    expect(screen.getByRole("table", { name: locale === "en" ? "Gender change mix" : "성별 변화 구성" }).textContent).toContain("Female");
  });
  it("preserves response, detail and multi-touch datasets through actual route transitions", () => {
    const store = useAppStore.getState();
    store.setCurrentRouteId("5-18-cannibal");
    const panel = { raw: [{ week: "2026-01-05", signup: "100", meta_spend: "50" }], headers: ["week", "signup", "meta_spend"], mapping: {}, fileName: "panel.csv" };
    store.setCsvData(panel);
    store.setCurrentRouteId("5-18-cannibal-detail"); store.setCsvData(buildCannibalDetailDemo());
    expect(useAppStore.getState().activeDataGroup).toBe("cannibal_detail");
    store.setCurrentRouteId("5-30"); store.setCsvData(buildMultitouchDemo());
    store.setCurrentRouteId("5-18-cannibal");
    expect(useAppStore.getState().csvData.raw).toBe(panel.raw);
    store.setCurrentRouteId("5-18-cannibal-detail");
    expect(useAppStore.getState().csvData.fileName).toBe("demo_cannibal_detail.csv");
    store.setCurrentRouteId("5-30");
    expect(useAppStore.getState().csvData.fileName).toBe("demo_multitouch.csv");
  });
});
