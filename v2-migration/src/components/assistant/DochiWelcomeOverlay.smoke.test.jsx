// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/CsvUploader", () => ({
  default: ({ onImportStart, onPrepared }) => (
    <button type="button" onClick={() => { onImportStart?.({ source: "csv" }); onPrepared?.({ source: "csv" }); }}>
      파일 전달
    </button>
  ),
}));

import DochiWelcomeOverlay from "@/components/assistant/DochiWelcomeOverlay";
import { DOCHI_WELCOME_DISMISSED_KEY, DOCHI_WELCOME_SESSION_KEY, resetDochiWelcomeSnapshot } from "@/lib/dochiWelcome";
import { useAppStore } from "@/store/useDataStore";

const KO_LINES = [
  "안녕하세요!",
  "저는 처음 오신 분들을 안내하는 역할을 맡고 있는 도치라고 합니다!",
  "이 홈페이지는 마케터 분들을 위한 분석 사이트입니다!",
  "가지고 계신 데이터 파일이나 구글 스프레드시트(전체공개) 주소를 전달해주시면 지금의 문제와 할 수 있는 데이터 분석을 정리해드릴게요!",
];

const advanceToLastStep = () => {
  for (let i = 0; i < KO_LINES.length - 1; i += 1) {
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
  }
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  // 저장소 스냅샷은 모듈에 한 번 굳으므로 테스트마다 비운다.
  resetDochiWelcomeSnapshot();
  useAppStore.setState({ workspaceDatasetSummaries: [] });
});

// body를 손으로 비우지 않는다 — Radix 포털을 쓰므로 testing-library의 자동
// cleanup이 언마운트를 소유해야 한다(직접 비우면 포털 노드 제거가 깨진다).
afterEach(() => {
  push.mockReset();
});

describe("DochiWelcomeOverlay first-visit onboarding", () => {
  it("opens for a first-time visitor and walks the four scripted lines", () => {
    render(<DochiWelcomeOverlay />);

    expect(screen.getByText(KO_LINES[0])).toBeTruthy();
    // 각 단계는 정해진 도치 포즈를 쓴다 — 자산에 실제로 있는 파일만.
    const poseAt = () => document.querySelector(".dochi-welcome__stage .dochi-sprite").className;
    expect(poseAt()).toContain("is-idle");

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText(KO_LINES[1])).toBeTruthy();
    expect(poseAt()).toContain("is-point-up");

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText(KO_LINES[2])).toBeTruthy();
    expect(poseAt()).toContain("is-results");

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText(KO_LINES[3])).toBeTruthy();
    expect(poseAt()).toContain("is-delivery");
    // 마지막 단계에서만 업로드 경로가 열린다.
    expect(screen.getByRole("button", { name: "파일 전달" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "다음" })).toBe(null);
  });

  it("marks the session as seen on open so one visit does not repeat the greeting", () => {
    render(<DochiWelcomeOverlay />);
    expect(window.sessionStorage.getItem(DOCHI_WELCOME_SESSION_KEY)).toBe("1");
    // 세션 표식만으로는 영구 옵트아웃이 되지 않는다.
    expect(window.localStorage.getItem(DOCHI_WELCOME_DISMISSED_KEY)).toBe(null);
  });

  it("stays closed when the visitor already opted out", () => {
    window.localStorage.setItem(DOCHI_WELCOME_DISMISSED_KEY, "1");
    render(<DochiWelcomeOverlay />);
    expect(screen.queryByText(KO_LINES[0])).toBe(null);
  });

  it("stays closed for the rest of the session once seen", () => {
    window.sessionStorage.setItem(DOCHI_WELCOME_SESSION_KEY, "1");
    render(<DochiWelcomeOverlay />);
    expect(screen.queryByText(KO_LINES[0])).toBe(null);
  });

  it("stays closed for a device that already has saved work", () => {
    useAppStore.setState({ workspaceDatasetSummaries: [{ id: "saved-1" }] });
    render(<DochiWelcomeOverlay />);
    expect(screen.queryByText(KO_LINES[0])).toBe(null);
  });

  it("writes the permanent opt-out only when the checkbox is ticked before closing", () => {
    const { unmount } = render(<DochiWelcomeOverlay />);
    fireEvent.click(screen.getByLabelText("안내 닫기"));
    expect(window.localStorage.getItem(DOCHI_WELCOME_DISMISSED_KEY)).toBe(null);
    unmount();

    window.sessionStorage.clear();
    resetDochiWelcomeSnapshot();
    render(<DochiWelcomeOverlay />);
    fireEvent.click(screen.getByRole("checkbox", { name: "다음 방문부터 보이지 않기" }));
    fireEvent.click(screen.getByLabelText("안내 닫기"));
    expect(window.localStorage.getItem(DOCHI_WELCOME_DISMISSED_KEY)).toBe("1");
  });

  it("hands an uploaded file to the existing result workspace", () => {
    render(<DochiWelcomeOverlay />);
    advanceToLastStep();
    fireEvent.click(screen.getByRole("button", { name: "파일 전달" }));
    expect(push).toHaveBeenCalledWith("/dochi-result");
    expect(screen.queryByText(KO_LINES[3])).toBe(null);
  });

  it("renders the English script and routes to the English workspace", () => {
    render(<DochiWelcomeOverlay locale="en" />);
    expect(screen.getByText("Hello!")).toBeTruthy();
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("checkbox", { name: "Don’t show this again" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "파일 전달" }));
    expect(push).toHaveBeenCalledWith("/en/dochi-result");
  });
});
