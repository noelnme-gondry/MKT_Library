// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const { push, importControl } = vi.hoisted(() => ({ push: vi.fn(), importControl: { finish: null } }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/CsvUploader", () => ({
  default: ({ onImportStart, onPrepared }) => (
    <>
      <button type="button" onClick={() => { onImportStart?.({ source: "csv" }); onPrepared?.({ source: "csv" }); }}>
        파일 전달
      </button>
      <button type="button" onClick={() => {
        onImportStart?.({ source: "csv" });
        importControl.finish = () => onPrepared?.({ source: "csv" });
      }}>
        지연 파일 전달
      </button>
    </>
  ),
}));

import fs from "node:fs";
import path from "node:path";

import DochiWelcomeOverlay, { DOCHI_WELCOME_COPY, DOCHI_WELCOME_STEPS } from "@/components/assistant/DochiWelcomeOverlay";
import { DOCHI_WELCOME_DISMISSED_KEY, DOCHI_WELCOME_SESSION_KEY, resetDochiWelcomeSnapshot } from "@/lib/dochiWelcome";
import { useAppStore } from "@/store/useDataStore";

// 단계별 줄 구성까지 계약이다 — 카피가 줄바꿈 위치를 소유하므로 줄 수가 바뀌면
// 여기서 걸린다(브라우저 폭에 맡기면 어디서 끊길지 알 수 없다).
// 카피를 테스트에 다시 적으면 문구를 고칠 때마다 여기가 깨지고, 그때 문구를
// 옮겨 적으면 계약이 아니라 사본이 된다 — 컴포넌트에서 파생한다.
const KO_LINES = DOCHI_WELCOME_COPY.ko.lines;
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
  useAppStore.setState({
    workspaceDatasetSummaries: [],
    decisionPersistenceEnabled: false,
    workspaceRestoreStatus: "idle",
  });
  importControl.finish = null;
});

// body를 손으로 비우지 않는다 — Radix 포털을 쓰므로 testing-library의 자동
// cleanup이 언마운트를 소유해야 한다(직접 비우면 포털 노드 제거가 깨진다).
afterEach(() => {
  push.mockReset();
});

describe("DochiWelcomeOverlay first-visit onboarding", () => {
  it("walks every scripted step in order with its own pose", () => {
    render(<DochiWelcomeOverlay />);

    // 각 단계는 정해진 도치 포즈를 쓴다 — 자산에 실제로 있는 파일만.
    const poseAt = () => document.querySelector(".dochi-welcome__stage .dochi-sprite").className;
    KO_LINES.forEach((lines, index) => {
      if (index > 0) fireEvent.click(screen.getByRole("button", { name: "다음" }));
      expectLines(lines);
      expect(poseAt()).toContain(`is-${DOCHI_WELCOME_STEPS[index].pose}`);
    });
    // 마지막 단계에서만 업로드 경로가 열린다.
    expect(screen.getByRole("button", { name: "파일 전달" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "다음" })).toBe(null);
  });

  // 첫 방문자가 제품 설명에 닿기까지의 클릭 수는 계약이다. 인사만 하는 단계를
  // 다시 넣으면 여기서 걸린다(§5.7 — 모든 문장은 상태·행동·오해 방지·오류 해결 중 하나).
  it("reaches the hand-off step within one click", () => {
    expect(DOCHI_WELCOME_STEPS.length).toBeLessThanOrEqual(2);
    expect(DOCHI_WELCOME_STEPS.at(-1).id).toBe("ask");
    for (const locale of ["ko", "en"]) {
      const lines = DOCHI_WELCOME_COPY[locale].lines;
      expect(lines).toHaveLength(DOCHI_WELCOME_STEPS.length);
      // 첫 단계가 제품이 무엇인지와 데이터 처리 위치를 이미 말한다.
      expect(lines[0].join(" ").length).toBeGreaterThan(40);
    }
  });

  // next/image의 기본값은 `loading="lazy"`라 브라우저가 레이아웃 이후에야 요청을
  // 시작하고 preload 링크도 없다 — 말풍선(HTML·CSS)은 즉시 뜨는데 도치만 한참 뒤
  // 나타난다(실측 1440 뷰포트: 이미지 응답 2.8초 → priority 적용 후 1.0초).
  // 값이 아니라 근거를 고정한다: 오버레이의 도치는 절대 lazy면 안 되고,
  // 무대 밖 예열 블록이 나머지 포즈를 미리 받아 단계 전환에서도 같은 공백이
  // 반복되지 않아야 한다.
  it("loads Dochi eagerly and prewarms the other poses so the mascot never lags the bubble", () => {
    render(<DochiWelcomeOverlay />);

    const stageImage = document.querySelector(".dochi-welcome__stage img");
    expect(stageImage).toBeTruthy();
    expect(stageImage.getAttribute("loading")).not.toBe("lazy");

    // 예열은 무대 **밖**에 있어야 단계마다 리마운트되지 않는다.
    const preload = document.querySelector(".dochi-welcome__preload");
    expect(preload).toBeTruthy();
    expect(preload.closest(".dochi-welcome__stage")).toBe(null);
    expect([...preload.querySelectorAll("img")].every((img) => img.getAttribute("loading") !== "lazy")).toBe(true);

    // 현재 포즈를 뺀 나머지 단계 포즈가 전부 예열된다(달리기는 프레임 2장).
    const preloaded = new Set([...preload.querySelectorAll(".dochi-sprite")].map((el) => el.className));
    // 현재 무대에 선 포즈는 예열 대상에서 빠진다(이미 떠 있다).
    const currentPose = DOCHI_WELCOME_STEPS[0].pose;
    for (const pose of [...DOCHI_WELCOME_STEPS.map((step) => step.pose).filter((pose) => pose !== currentPose), "run"]) {
      expect([...preloaded].some((cls) => cls.includes(`is-${pose}`))).toBe(true);
    }
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

  it("starts at the hand-off message for a device that already has saved work", () => {
    useAppStore.setState({ workspaceDatasetSummaries: [{ id: "saved-1" }] });
    render(<DochiWelcomeOverlay />);
    expect(screen.queryByText(KO_LINES[0][0])).toBe(null);
    expectLines(KO_LINES.at(-1));
    expect(screen.getByText(DOCHI_WELCOME_COPY.ko.progress(DOCHI_WELCOME_STEPS.length, DOCHI_WELCOME_STEPS.length))).toBeTruthy();
    expect(screen.getByRole("button", { name: "파일 전달" })).toBeTruthy();
  });

  it("waits for device-storage restore before choosing the returning-user step", () => {
    useAppStore.setState({ decisionPersistenceEnabled: true, workspaceRestoreStatus: "loading" });
    render(<DochiWelcomeOverlay />);
    expect(screen.queryByText(KO_LINES[0][0])).toBe(null);

    act(() => useAppStore.setState({
      workspaceDatasetSummaries: [{ id: "restored-1" }],
      workspaceRestoreStatus: "ready",
    }));
    expectLines(KO_LINES.at(-1));
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
    expect(screen.queryByText(KO_LINES.at(-1)[0])).toBe(null);
  });

  it.each(["안내 닫기", "건너뛰기"])("continues an import and routes after %s", (closeAction) => {
    render(<DochiWelcomeOverlay />);
    advanceToLastStep();
    fireEvent.click(screen.getByRole("button", { name: "지연 파일 전달" }));
    expect(screen.getByText("파일을 읽고 있어요.")).toBeTruthy();
    fireEvent.click(closeAction === "안내 닫기"
      ? screen.getByLabelText(closeAction)
      : screen.getByRole("button", { name: closeAction }));
    expect(screen.queryByText("파일을 읽고 있어요.")).toBe(null);

    act(() => importControl.finish?.());
    expect(push).toHaveBeenCalledWith("/dochi-result");
  });

  it("renders the English script and routes to the English workspace", () => {
    const enLines = DOCHI_WELCOME_COPY.en.lines;
    render(<DochiWelcomeOverlay locale="en" />);
    expectLines(enLines[0]);
    // 데이터 처리 위치 고지는 첫 화면에서 사라지면 안 된다(F-03).
    expect(enLines[0].join(" ")).toContain("browser");
    for (let i = 0; i < enLines.length - 1; i += 1) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expectLines(enLines.at(-1));
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
    // 두 변이 만나는 꼭짓점은 좌하단(-8,+8)이고, 이게 도치 쪽(왼쪽)을 향해야 한다.
    // CSS rotate 양수는 화면 기준 시계방향이므로 +45deg에서 (-11.3, 0) → 정확히 왼쪽.
    // -45deg는 같은 꼭짓점을 (0, +11.3)으로 보내 꼬리가 아래를 찌르는 "v"가 된다.
    expect(tail).toContain("rotate(45deg)");
    expect(tail).not.toContain("rotate(-45deg)");
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
