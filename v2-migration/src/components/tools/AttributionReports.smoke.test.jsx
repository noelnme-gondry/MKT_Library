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
    await screen.findByRole("table", { name: locale === "en" ? "Multi-touch by media" : "매체별 멀티터치" });
    const dateInput = screen.getByRole("textbox", { name: locale === "en" ? "Install start date" : "설치 시작일", exact: true });
    expect(dateInput.closest("label")).toBeNull();
    const dateLabel = Array.from(document.querySelectorAll("label")).find(label => label.htmlFor === dateInput.id);
    expect(dateLabel.control).toBe(dateInput);
    const zoneHelp = screen.getByRole("button", { name: locale === "en" ? "Source timestamp time zone" : "원본 시각의 시간대", exact: true });
    expect(zoneHelp.closest("label")).toBeNull();
    expect(screen.queryByRole("table", { name: "CTIT" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: locale === "en" ? "Conversion timing" : "전환 시간", exact: true }));
    const table = await screen.findByRole("table", { name: "CTIT" });
    expect(table.textContent).toContain("10.0");
    const before = table.textContent;
    fireEvent.change(screen.getByLabelText("Probabilistic"), { target: { value: "true" } });
    await screen.findByText(locale === "en" ? "960 installs with recorded contributing clicks" : "추가 클릭 접촉이 기록된 설치 960건");
    await waitFor(() => expect(screen.getByRole("table", { name: "CTIT" }).textContent).toBe(before));
    fireEvent.change(screen.getByLabelText(locale === "en" ? "Meta/TikTok placement" : "Meta·TikTok 지면"), { target: { value: "true" } });
    fireEvent.click(await screen.findByRole("radio", { name: locale === "en" ? "Media & campaigns" : "매체·캠페인", exact: true }));
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
    await screen.findByRole("table", { name: "매체별 멀티터치" });
  });
  it.each(["ko", "en"])("connects media selection, paths and phase/pair timing without losing evidence (%s)", async locale => {
    const en = locale === "en", store = useAppStore.getState();
    store.setCurrentRouteId("5-30"); store.setCsvData(buildMultitouchDemo()); store.setGroupAnalyzed("5-30");
    render(<MultitouchMap locale={locale} />);
    const media = await screen.findByRole("table", { name: en ? "Multi-touch by media" : "매체별 멀티터치" });
    fireEvent.click(within(media).getByRole("button", { name: "Meta", exact: true }));
    await screen.findByRole("table", { name: en ? "Install media × contributor channel" : "설치 매체 × 기여 채널" });
    expect(screen.getByRole("combobox", { name: en ? "Attributed media" : "귀속 매체", exact: true }).value).toBe("Meta");
    fireEvent.click(screen.getByRole("radio", { name: en ? "Touch paths" : "접촉 경로", exact: true }));
    await screen.findByRole("img", { name: en ? "Recorded click-contributor paths with valid timestamps" : "유효 시각의 클릭 contributor 경로" });
    const ctitView = screen.getByRole("radio", { name: en ? "Conversion timing" : "전환 시간", exact: true });
    fireEvent.click(ctitView);
    fireEvent.change(screen.getByRole("combobox", { name: en ? "Campaign" : "캠페인", exact: true }), { target: { value: "Acquisition" } });
    await waitFor(() => {
      const table = screen.getByRole("table", { name: "CTIT", exact: true });
      expect(table.textContent).toContain("300 / 300");
      expect(table.textContent).not.toContain("Return");
    });
    fireEvent.click(screen.getByRole("radio", { name: en ? "Attributed → install" : "귀속 → 설치", exact: true }));
    expect(within(screen.getByRole("table", { name: en ? "Touch time gaps" : "접촉 시간 간격" })).getAllByRole("row")).toHaveLength(10);
    fireEvent.change(screen.getByRole("combobox", { name: en ? "Channel pair" : "채널 쌍", exact: true }), { target: { value: "Meta → install" } });
    expect(screen.getByRole("combobox", { name: en ? "Channel pair" : "채널 쌍", exact: true }).value).toBe("Meta → install");
    fireEvent.click(screen.getByRole("radio", { name: en ? "Media & campaigns" : "매체·캠페인", exact: true }));
    await waitFor(() => expect(within(screen.getByRole("table", { name: en ? "Multi-touch by campaign" : "캠페인별 멀티터치" })).getAllByRole("row")).toHaveLength(9));
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
