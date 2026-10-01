// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { buildSampleJourney, getSampleJourney } from "@/lib/sampleJourney";
import { toolIndexEntry } from "@/lib/toolIndex";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
import DochiResultWorkspace from "./DochiResultWorkspace";
import CampaignPvm from "@/components/tools/CampaignPvm";

afterEach(() => {
  push.mockReset();
  useAppStore.setState({ analysisHandoff: null, dochiAnalysisSession: null, savedSetupAppliedTool: null, savedSetupAppliedInputs: null });
});

it.each(["ko", "en"])("keeps actual periods, metric and values through summary → detail, despite stale settings (%s)", async locale => {
  const data = buildSampleJourney(locale);
  const { period } = getSampleJourney(data);
  useAppStore.setState({
    currentRouteId: "dochi-result", activeDataGroup: "efficiency", csvData: data,
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: data },
    dochiAnalysisSession: { sourceData: data, analyses: [] },
    denomBasis: "actions", displayCurrency: "KRW", decisionPersistenceEnabled: false,
    dashboardFilterGroups: { efficiency: { channels: new Set(["Stale channel"]), dateStart: "2020-01-01", dateEnd: "2020-01-07" } },
    savedSetupAppliedTool: "5-21", savedSetupAppliedProject: useAppStore.getState().activeProjectId,
    savedSetupAppliedInputs: { metricOverride: "cpi", weekBasis: "calendar", lookback: 3 },
  });
  const summary = render(<DochiResultWorkspace locale={locale} />);
  // Real sample analyses run across animation frames; CI can exceed waitFor's 1s default.
  await waitFor(() => expect(summary.container.querySelector('[data-queue-settled="true"]')).toBeTruthy(), { timeout: 10000 });
  const chip = [...summary.container.querySelectorAll(".tool-index__chip")].find(node => node.querySelector(".tool-index__q").textContent === toolIndexEntry("5-21", locale).name);
  fireEvent.click(chip);
  const bridge = summary.container.querySelector(".result-mix-rate .result-bridge");
  const summaryNumbers = [...bridge.querySelectorAll("b")].map(node => node.textContent);
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Open analysis" : "분석 열기", exact: true }));
  await waitFor(() => expect(push).toHaveBeenCalledWith(`${locale === "en" ? "/en" : ""}/tools/campaign-variance`));
  expect(useAppStore.getState().analysisHandoff).toMatchObject({
    metric: "cpa", periodA: { start: period.previousStart, end: period.previousEnd },
    periodB: { start: period.currentStart, end: period.currentEnd },
  });
  expect(useAppStore.getState().dashboardFilterGroups.efficiency.channels.size).toBe(0);
  summary.unmount();
  act(() => useAppStore.getState().setCurrentRouteId("5-21"));
  const detail = render(<CampaignPvm locale={locale} />);
  const detailNumbers = [...detail.container.querySelectorAll(".result-mix-rate .result-bridge b")].map(node => node.textContent);
  expect(detailNumbers).toEqual(summaryNumbers);
  expect([...detail.container.querySelectorAll(".result-period-picker time")].map(node => node.dateTime)).toEqual([period.currentStart, period.currentEnd, period.previousStart, period.previousEnd]);
  // 요약에서 넘어온 기간도 날짜 자체에서 수정한다. 비교 기간은 보존된다.
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? /^Analysis period/ : /^분석 기간/ }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(locale === "en" ? "Start date" : "시작일"), { target: { value: period.currentEnd } });
  fireEvent.click(within(dialog).getByRole("button", { name: locale === "en" ? "Apply" : "적용" }));
  expect(useAppStore.getState().dashboardFilter).toMatchObject({ dateStart: period.currentEnd, comparisonStart: period.previousStart, comparisonEnd: period.previousEnd });
  expect(detail.container.querySelector(".result-action-card")).toBeTruthy();
  detail.unmount();
}, 15000);
