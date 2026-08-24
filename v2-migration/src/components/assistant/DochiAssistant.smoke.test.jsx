// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/CsvUploader", () => ({
  default: ({ onImportStart, onPrepared, onImportFailed }) => (
    <>
      <button type="button" onClick={() => { onImportStart?.({ source: "csv" }); onPrepared?.({ source: "csv" }); }}>파일 전달</button>
      <button type="button" onClick={() => { onImportStart?.({ source: "csv" }); onImportFailed?.({ source: "csv", state: "parse_error" }); }}>실패한 파일 전달</button>
    </>
  ),
}));

import DochiAssistant from "@/components/assistant/DochiAssistant";
import { useAppStore } from "@/store/useDataStore";

afterEach(() => {
  push.mockReset();
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
    expect(document.querySelector(".dochi-home-assistant__speech-tail svg")).toBeTruthy();
  });

  it("opens the dedicated mapping and results workspace after import", () => {
    render(<DochiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: "파일 전달" }));
    expect(push).toHaveBeenCalledWith("/dochi-result");
  });

  it("opens the English dedicated workspace after import", () => {
    render(<DochiAssistant locale="en" />);
    expect(screen.getByText("Upload one CSV. I’ll read it and bring back the results.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "파일 전달" }));
    expect(push).toHaveBeenCalledWith("/en/dochi-result");
  });

  it("restores the uploader after an import failure instead of trapping the intake journey", () => {
    render(<DochiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: "실패한 파일 전달" }));

    expect(document.querySelector(".dochi-home-assistant").getAttribute("data-phase")).toBe("welcome");
    expect(screen.getByRole("button", { name: "파일 전달" })).toBeTruthy();
  });
});
