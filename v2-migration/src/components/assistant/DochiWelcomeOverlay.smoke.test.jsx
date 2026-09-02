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

import fs from "node:fs";
import path from "node:path";

import DochiWelcomeOverlay from "@/components/assistant/DochiWelcomeOverlay";
import { DOCHI_WELCOME_DISMISSED_KEY, DOCHI_WELCOME_SESSION_KEY, resetDochiWelcomeSnapshot } from "@/lib/dochiWelcome";
import { useAppStore } from "@/store/useDataStore";

// 단계별 줄 구성까지 계약이다 — 카피가 줄바꿈 위치를 소유하므로 줄 수가 바뀌면
// 여기서 걸린다(브라우저 폭에 맡기면 어디서 끊길지 알 수 없다).
const KO_LINES = [
  ["안녕하세요!"],
  ["저는 처음 오신 분들을 안내하는 역할을 맡고 있는 도치라고 합니다!"],
  [
    "이 홈페이지는 마케터 분들을 위한 분석 사이트 입니다!",
    "사용된 파일과 링크 속 데이터는 저장되지 않습니다!",
    "저희는 서버가 없어요!",
  ],
  [
    "데이터 파일이나 전체 공개된 스프레드 시트 주소를 전달해주시면",
    "발견된 문제, 할 수 있는 데이터 분석을 정리해드릴게요!",
  ],
];
const expectLines = (lines) => lines.forEach((line) => expect(screen.getByText(line)).toBeTruthy());

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

    expectLines(KO_LINES[0]);
    // 각 단계는 정해진 도치 포즈를 쓴다 — 자산에 실제로 있는 파일만.
    const poseAt = () => document.querySelector(".dochi-welcome__stage .dochi-sprite").className;
    expect(poseAt()).toContain("is-idle");

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expectLines(KO_LINES[1]);
    expect(poseAt()).toContain("is-point-up");

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expectLines(KO_LINES[2]);
    expect(poseAt()).toContain("is-results");

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expectLines(KO_LINES[3]);
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
    expect(screen.queryByText(KO_LINES[0][0])).toBe(null);
  });

  it("stays closed for the rest of the session once seen", () => {
    window.sessionStorage.setItem(DOCHI_WELCOME_SESSION_KEY, "1");
    render(<DochiWelcomeOverlay />);
    expect(screen.queryByText(KO_LINES[0][0])).toBe(null);
  });

  it("stays closed for a device that already has saved work", () => {
    useAppStore.setState({ workspaceDatasetSummaries: [{ id: "saved-1" }] });
    render(<DochiWelcomeOverlay />);
    expect(screen.queryByText(KO_LINES[0][0])).toBe(null);
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
    expect(screen.queryByText(KO_LINES[3][0])).toBe(null);
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

describe("DochiWelcomeOverlay speech bubble shape", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

  it("draws the tail as one rotated square, never two stacked triangles", () => {
    render(<DochiWelcomeOverlay />);
    // 삼각형을 테두리색+배경색 두 겹으로 쌓으면 둘이 반픽셀만 어긋나도 말풍선
    // 테두리가 그 틈으로 비쳐 이음매가 보인다. 겹칠 도형이 하나뿐이면 그 실패가
    // 구조적으로 불가능하다.
    expect(document.querySelector(".dochi-welcome__tail")).toBe(null);
    expect(document.querySelector(".dochi-welcome__speech")).toBeTruthy();
    expect(css).not.toContain(".dochi-welcome__speech::before");
    expect(css).toContain(".dochi-welcome__speech::after");
  });

  it("gives the tail the bubble's own fill and line so the two read as one shape", () => {
    const rules = css.split("\n").filter((line) => line.startsWith(".dochi-welcome__speech"));
    const bubble = rules.find((line) => line.startsWith(".dochi-welcome__speech {"));
    const tail = rules.find((line) => line.startsWith(".dochi-welcome__speech::after {"));
    expect(bubble).toContain("var(--dochi-welcome-line)");
    expect(bubble).toContain("var(--dochi-welcome-fill)");
    // 불투명한 배경이 말풍선 테두리를 덮고, 만나는 두 변만 같은 선으로 이어진다.
    expect(tail).toContain("background:var(--dochi-welcome-fill)");
    expect(tail).toContain("border-left:2px solid var(--dochi-welcome-line)");
    expect(tail).toContain("border-bottom:2px solid var(--dochi-welcome-line)");
    expect(tail).toContain("rotate(-45deg)");
  });

  it("keeps the mascot and the tail on the same axis so the tail points at Dochi", () => {
    // 도치가 아래 정렬(align-self:end)이고 꼬리가 위쪽 고정이면 서로 어긋난다.
    // 둘 다 세로 중앙이어야 대사 길이가 변해도 마주본다.
    const stage = css.split("\n").find((line) => line.startsWith(".dochi-welcome__stage {"));
    const tail = css.split("\n").find((line) => line.startsWith(".dochi-welcome__speech::after {"));
    expect(stage).toContain("align-self:center");
    expect(stage).not.toContain("align-self:end");
    expect(tail).toContain("top:50%");
  });

  it("shrinks the upload dropzone so the bubble does not run off the panel", () => {
    // 기본 드롭존은 min-height 182px · padding 38px · 18px 텍스트다. 말풍선
    // 안에서는 축소 계약이 있어야 4단계가 화면을 넘기지 않는다.
    expect(css).toContain(".dochi-welcome .csv-uploader--dochi .csv-dropzone {");
    expect(css).toContain(".dochi-welcome .csv-uploader--dochi .csv-drop-icon {");
  });
});

describe("DochiWelcomeOverlay bubble sizing", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

  it("stands the starter-template action up as a full-width button", () => {
    // 링크처럼 붙어 있으면 눌러야 할 것으로 안 읽힌다.
    const rule = css.split("\n").find((line) => line.startsWith(".dochi-welcome .csv-uploader--dochi .csv-upload-quick-actions .ab-pill {"));
    expect(rule).toContain("width:100%");
  });

  it("drops the upload privacy line that step 3 already says out loud", () => {
    // 3단계가 저장·서버를 직접 말하므로 업로드부의 같은 문구는 높이만 늘린다.
    render(<DochiWelcomeOverlay />);
    advanceToLastStep();
    expect(document.querySelector(".dochi-welcome__privacy")).toBe(null);
    expect(screen.queryByText(/서버로 보내지 않습니다/)).toBe(null);
  });
});
