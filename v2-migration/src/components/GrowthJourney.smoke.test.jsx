// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { buildSampleJourney, getSampleJourney } from "@/lib/sampleJourney";
import * as snapshotStore from "@/lib/weekly-review/snapshotStore";
import LandingPage from "./LandingPage";
import DochiResultWorkspace from "./assistant/DochiResultWorkspace";
import WeeklyReviewScreen from "./weekly-review/WeeklyReviewScreen";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/CsvUploader", () => ({ default: () => <div data-testid="upload-area" /> }));

beforeEach(() => {
  useAppStore.setState({ ...useAppStore.getInitialState(), decisionPersistenceEnabled: false });
  window.history.replaceState(null, "", "/");
  window.gtag = vi.fn();
});
afterEach(() => { push.mockReset(); vi.restoreAllMocks(); delete window.gtag; });

describe("home → result → weekly review", () => {
  it("does not read real project targets, snapshots or decisions into a guided sample", async () => {
    const settings = vi.spyOn(snapshotStore, "readReviewProject");
    const snapshots = vi.spyOn(snapshotStore, "listStoredSnapshots");
    const save = vi.spyOn(snapshotStore, "saveReviewProject");
    useAppStore.setState({ decisionPersistenceEnabled: true, workspaceRestoreStatus: "ready", denomBasis: "actions", decisionRecords: [{ id: "private-record", toolId: "weekly-review", action: "Private decision", createdAt: "2024-03-20", actionTarget: "Private campaign" }] });
    useAppStore.getState().handoffCsvToRoute("5-2", buildSampleJourney());
    useAppStore.getState().setCurrentRouteId("weekly-review");
    const view = render(<WeeklyReviewScreen />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "이번 주 결론" })).toBeTruthy());
    expect(settings).not.toHaveBeenCalled();
    expect(snapshots).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(view.container.querySelector(".wr-verdict").textContent).not.toContain("Private");
    expect(view.container.querySelector(".wr-history-entry")).toBeNull();
    fireEvent.click(view.container.querySelector("#wr-history summary"));
    expect(view.container.querySelector("#wr-history").textContent).not.toContain("Private decision");
  });
  it.each(["ko", "en"])("opens a real computed sample in one click and preserves its scope to the copied review (%s)", async locale => {
    const en = locale === "en";
    const home = render(<LandingPage locale={locale} />);
    const preview = home.container.querySelector(".home-result-preview__kpis div:last-child dd").textContent;
    fireEvent.click(home.container.querySelector(".dc-action-route--sample"));
    expect(push).toHaveBeenCalledWith(en ? "/en/dochi-result" : "/dochi-result");
    home.unmount();
    act(() => useAppStore.getState().setCurrentRouteId("dochi-result"));
    const data = useAppStore.getState().csvData;
    expect(getSampleJourney(data)).not.toBeNull();
    expect(useAppStore.getState().isGroupAnalyzed("dochi-result")).toBe(true);
    const result = render(<DochiResultWorkspace locale={locale} />);
    expect(result.container.querySelector(".dochi-result-workspace").dataset.phase).toBe("results");
    await waitFor(() => expect(result.container.querySelector('[data-queue-settled="true"]')).toBeTruthy(), { timeout: 10000 });
    const focus = result.container.querySelector(".dochi-workspace__decision-focus");
    expect(focus.textContent).toContain(preview);
    expect(focus.textContent).toContain("CPA");
    expect(result.container.querySelector(".dochi-workspace__judgment")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en ? "Build weekly review" : "주간 리뷰 만들기" }));
    result.unmount();
    act(() => useAppStore.getState().setCurrentRouteId("weekly-review"));
    expect(useAppStore.getState().csvData).toBe(data);
    const weekly = render(<WeeklyReviewScreen locale={locale} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: en ? "This week" : "이번 주 결론" })).toBeTruthy());
    expect(weekly.container.querySelector(".wr-verdict__big").textContent).toContain(preview);
    expect(weekly.container.querySelector(".wr-screen__period").textContent).toContain(getSampleJourney(data).period.currentStart);
    const clipboard = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipboard } });
    fireEvent.click(screen.getByRole("button", { name: en ? "Copy summary" : "요약 복사" }));
    await waitFor(() => expect(clipboard).toHaveBeenCalledOnce());
    const copied = clipboard.mock.calls[0][0];
    expect(copied).toContain(preview);
    expect(copied).toContain(getSampleJourney(data).channel);
    expect(copied).toContain(en ? "Sample data" : "샘플 데이터");
    expect(copied).toContain(en ? "not a significance" : "통계적 유의성");
    expect(window.gtag).toHaveBeenCalledWith("event", "weekly_review_export", expect.objectContaining({ source: "demo", placement: "verdict_summary", state: "completed" }));
    expect(screen.getAllByText(en ? "Copied. Paste it into your team workspace." : "복사했습니다. 팀 작업 공간에 붙여넣으세요.")).toHaveLength(1);
    const entry = weekly.container.querySelector("#wr-upload");
    expect(entry.open).toBe(false);
    act(() => { window.history.replaceState(null, "", "#wr-upload"); window.dispatchEvent(new Event("hashchange")); });
    expect(entry.open).toBe(true);
    const conditions = weekly.container.querySelector(".wr-decision-conditions");
    expect(conditions.open).toBe(false);
    fireEvent.click(conditions.querySelector("summary"));
    expect(within(conditions).getByRole("textbox", { name: en ? "Guardrail value" : "가드레일 값" })).toBeTruthy();
  });

  it("requires mapping again when a real upload replaces the sample on the same screen", () => {
    const home = render(<LandingPage />);
    fireEvent.click(home.container.querySelector(".dc-action-route--sample"));
    home.unmount();
    act(() => useAppStore.getState().setCurrentRouteId("dochi-result"));
    const view = render(<DochiResultWorkspace />);
    const sample = useAppStore.getState().csvData;
    act(() => useAppStore.getState().setCsvData({ ...sample, raw: sample.raw.map(row => ({ ...row })), mapping: { ...sample.mapping }, importSource: "csv" }));
    expect(view.container.querySelector(".dochi-result-workspace").dataset.phase).toBe("mapping");
    expect(screen.getByRole("heading", { name: "컬럼을 확인해 주세요" })).toBeTruthy();
    expect(useAppStore.getState().isGroupAnalyzed("dochi-result")).toBe(false);
  });
});
