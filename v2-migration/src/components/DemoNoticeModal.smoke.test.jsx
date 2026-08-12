// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DemoNoticeModal from "@/components/DemoNoticeModal";
import { useAppStore } from "@/store/useDataStore";

const DEMO_CSV = {
  raw: [{ date: "2026-01-01" }],
  headers: ["date"],
  mapping: { date: "date" },
  fileName: "demo_efficiency.csv",
};

describe("DemoNoticeModal", () => {
  beforeEach(() => {
    useAppStore.setState({
      currentRouteId: "5-2",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: DEMO_CSV },
      csvData: DEMO_CSV,
      csvClearedByGroup: {},
      demoNoticeSeen: false,
    });
  });

  it.each([
    {
      locale: "ko",
      title: "지금은 데모 데이터를 이용 중입니다",
      action: "내 CSV로 바꾸기",
      privacy: "내 CSV는 이 브라우저 안에서만 처리되고 서버로 업로드되지 않습니다.",
      forbidden: /우측 상단|CSV 변경/,
    },
    {
      locale: "en",
      title: "You're currently viewing demo data",
      action: "Use my CSV",
      privacy: "Your CSV is processed only in this browser and is not uploaded to our servers.",
      forbidden: /top right|Change CSV/i,
    },
  ])("offers a direct $locale CTA, clears the active group, then focuses the uploader", async ({ locale, title, action, privacy, forbidden }) => {
    render(
      <>
        <button type="button" className="csv-dropzone">CSV upload area</button>
        <DemoNoticeModal locale={locale} />
      </>
    );
    const dropzone = screen.getByRole("button", { name: "CSV upload area", hidden: true });
    const scrollIntoView = vi.fn();
    dropzone.scrollIntoView = scrollIntoView;

    expect(screen.getByRole("dialog", { name: title })).toBeTruthy();
    expect(screen.getByText(privacy, { exact: false })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(forbidden);
    fireEvent.click(screen.getByRole("button", { name: action }));

    const state = useAppStore.getState();
    expect(state.csvData).toMatchObject({ raw: [], headers: [], fileName: "" });
    expect(state.csvGroups.efficiency).toMatchObject({ raw: [], headers: [], fileName: "" });
    expect(state.csvClearedByGroup.efficiency).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(dropzone));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("does not clear automatically or when the secondary action is chosen", () => {
    render(<DemoNoticeModal />);
    expect(useAppStore.getState().csvData).toBe(DEMO_CSV);
    fireEvent.click(screen.getByRole("button", { name: "나중에" }));

    expect(useAppStore.getState().csvData).toBe(DEMO_CSV);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes with Escape without clearing demo data", () => {
    render(<DemoNoticeModal />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useAppStore.getState().csvData).toBe(DEMO_CSV);
  });
});
