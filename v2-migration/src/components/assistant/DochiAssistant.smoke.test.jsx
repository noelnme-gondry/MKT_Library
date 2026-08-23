// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/CsvUploader", () => ({
  default: ({ onImportStart, onPrepared, onImportFailed, onMappingReviewConfirmed }) => (
    <>
      <button type="button" onClick={() => { onImportStart?.({ source: "csv" }); onPrepared?.({ source: "csv" }); }}>파일 전달</button>
      <button type="button" onClick={() => { onImportStart?.({ source: "csv" }); onImportFailed?.({ source: "csv", state: "parse_error" }); }}>실패한 파일 전달</button>
      {onMappingReviewConfirmed && <button type="button" onClick={onMappingReviewConfirmed}>매핑 확인</button>}
    </>
  ),
}));

vi.mock("@/components/assistant/AssistantWorkspace", () => ({
  default: ({ autoStart, presentation }) => <div data-dochi-workspace={presentation}>{autoStart ? "실제 결과 실행" : "대기"}</div>,
}));

import DochiAssistant from "@/components/assistant/DochiAssistant";
import { useAppStore } from "@/store/useDataStore";

afterEach(() => {
  vi.useRealTimers();
  useAppStore.setState({ demoDisabled: false });
  document.body.innerHTML = "";
});

describe("DochiAssistant home intake", () => {
  it("keeps the first intake copy short and reserves a separate mascot column", () => {
    render(<DochiAssistant />);

    expect(screen.getByRole("region", { name: "도치 박사 데이터 접수처" })).toBeTruthy();
    expect(screen.getByText("CSV 하나를 올려 주세요. 읽고 바로 결과를 가져올게요.")).toBeTruthy();
    expect(screen.getByText(/브라우저 안에서만 읽습니다/)).toBeTruthy();
    expect(useAppStore.getState().demoDisabled).toBe(true);
    expect(document.querySelector(".dochi-home-assistant__speech")).toBeTruthy();
    expect(document.querySelector(".dochi-home-assistant__stage")).toBeTruthy();
  });

  it("moves from mapping confirmation through the gray crossing scene to same-page results", () => {
    vi.useFakeTimers();
    render(<DochiAssistant />);

    fireEvent.click(screen.getByRole("button", { name: "파일 전달" }));
    expect(screen.getByRole("heading", { name: "컬럼만 확인해 주세요" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "매핑 확인" }));
    expect(document.querySelector(".dochi-journey.is-running")).toBeTruthy();
    expect(document.querySelector(".dochi-journey__runner--crossing")).toBeTruthy();

    act(() => vi.advanceTimersByTime(1850));
    expect(screen.getByRole("heading", { name: "도치가 가져온 실제 분석 결과" })).toBeTruthy();
    expect(screen.getByText("실제 결과 실행")).toBeTruthy();
    expect(document.querySelector('[data-dochi-workspace="embedded"]')).toBeTruthy();
  });

  it("keeps the same in-page result flow in English", () => {
    vi.useFakeTimers();
    render(<DochiAssistant locale="en" />);
    expect(screen.getByText("Upload one CSV. I’ll read it and bring back the results.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "파일 전달" }));
    fireEvent.click(screen.getByRole("button", { name: "매핑 확인" }));
    act(() => vi.advanceTimersByTime(1850));
    expect(screen.getByRole("heading", { name: "Actual analysis results Dochi brought back" })).toBeTruthy();
  });

  it("restores the uploader after an import failure instead of trapping the intake journey", () => {
    render(<DochiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: "실패한 파일 전달" }));

    expect(document.querySelector(".dochi-home-assistant").getAttribute("data-phase")).toBe("welcome");
    expect(screen.getByRole("button", { name: "파일 전달" })).toBeTruthy();
  });
});
