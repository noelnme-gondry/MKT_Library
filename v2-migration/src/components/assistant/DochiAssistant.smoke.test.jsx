// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/CsvUploader", () => ({
  default: ({ onImportStart, onPrepared, onImportFailed }) => (
    <>
      <button type="button" onClick={() => { onImportStart?.({ source: "csv" }); onPrepared?.({ source: "csv" }); }}>파일 또는 공개 시트 전달</button>
      <button type="button" onClick={() => { onImportStart?.({ source: "csv" }); onImportFailed?.({ source: "csv", state: "parse_error" }); }}>실패한 파일 또는 공개 시트 전달</button>
    </>
  ),
}));

import DochiAssistant from "@/components/assistant/DochiAssistant";
import { useAppStore } from "@/store/useDataStore";

afterEach(() => {
  vi.useRealTimers();
  push.mockReset();
  useAppStore.setState({ demoDisabled: false });
  document.body.innerHTML = "";
  window.sessionStorage.clear();
});

describe("DochiAssistant home intake", () => {
  it("appears as a home-only assistant with file and public-sheet intake language", () => {
    render(<DochiAssistant />);

    expect(screen.getByRole("region", { name: "도치 박사 데이터 접수처" })).toBeTruthy();
    expect(screen.getByText(/CSV 파일 또는 전체 공개 스프레드시트 주소/)).toBeTruthy();
    expect(screen.getByText(/브라우저 안에서만 읽습니다/)).toBeTruthy();
    expect(useAppStore.getState().demoDisabled).toBe(true);
    expect(document.querySelector(".dochi-home-assistant").getAttribute("data-phase")).toBe("welcome");
    expect(document.querySelector('.dochi-home-assistant__stage img[src*="dochi-idle.png"]')).toBeTruthy();
    expect(document.querySelector(".dochi-home-assistant__stage svg")).toBeNull();
  });

  it("shows a truthful running state, then hands the prepared input to the start workspace", () => {
    vi.useFakeTimers();
    render(<DochiAssistant />);

    fireEvent.click(screen.getByRole("button", { name: "파일 또는 공개 시트 전달" }));
    expect(screen.getByText(/분석 가능한 도구를 찾으러/)).toBeTruthy();
    expect(document.querySelector(".dochi-home-assistant").getAttribute("data-phase")).toBe("reading");
    expect(document.querySelector(".dochi-journey__runner--left .dochi-sprite.is-left")).toBeTruthy();
    expect(document.querySelector(".dochi-journey__runner--back .dochi-sprite.is-back")).toBeTruthy();
    expect(document.querySelectorAll('.dochi-journey__runner--left img[src*="dochi-run-side-"]')).toHaveLength(2);
    expect(document.querySelectorAll('.dochi-journey__runner--back img[src*="dochi-run-back-"]')).toHaveLength(2);

    act(() => vi.advanceTimersByTime(3200));
    expect(document.querySelector(".dochi-home-assistant").getAttribute("data-phase")).toBe("sorting");
    expect(document.querySelector(".dochi-journey__runner--delivery .dochi-chart-bundle")).toBeTruthy();
    expect(document.querySelector('.dochi-journey__runner--delivery img[src*="dochi-delivery.png"]')).toBeTruthy();
    expect(document.querySelector('.dochi-journey__runner--results img[src*="dochi-present-results.png"]')).toBeTruthy();
    expect(document.querySelector(".dochi-journey__curtain")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1450));
    expect(push).toHaveBeenCalledWith("/start");
    expect(window.sessionStorage.getItem("dochi_analysis_handoff")).toContain('"locale":"ko"');
  });

  it("keeps the start handoff equivalent in English", () => {
    vi.useFakeTimers();
    render(<DochiAssistant locale="en" />);
    expect(screen.getByText(/CSV file or one publicly shared spreadsheet link/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "파일 또는 공개 시트 전달" }));
    act(() => vi.advanceTimersByTime(4650));
    expect(push).toHaveBeenCalledWith("/en/start");
  });

  it("restores the uploader after an import failure instead of trapping the intake journey", () => {
    render(<DochiAssistant />);

    fireEvent.click(screen.getByRole("button", { name: "실패한 파일 또는 공개 시트 전달" }));

    expect(document.querySelector(".dochi-home-assistant").getAttribute("data-phase")).toBe("welcome");
    expect(screen.getByRole("button", { name: "실패한 파일 또는 공개 시트 전달" })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
