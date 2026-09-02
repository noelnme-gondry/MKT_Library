// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
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
  useAppStore.setState({ demoDisabled: false, workspaceDatasetSummaries: [] });
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

  it("offers a saved-workspace return path before asking for another upload", () => {
    useAppStore.setState({ workspaceDatasetSummaries: [{ group: "efficiency", fileName: "saved.csv", rowCount: 20 }] });
    render(<DochiAssistant />);

    expect(screen.getByText(/저장된 작업 1개를 찾았어요/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /저장된 분석 이어보기/ }));
    expect(push).toHaveBeenCalledWith("/storage");
  });
});

// 말풍선 꼬리는 도치 컴포넌트마다 따로 그려져 있어 한 곳만 고치면 옆에서 그대로
// 재발한다(§7) — 파일에서 파생해 전부 검사한다.
describe("도치 말풍선 꼬리 계약", () => {
  const dir = path.join(process.cwd(), "src/components/assistant");
  const tails = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".jsx"))
    .flatMap((name) => {
      const src = fs.readFileSync(path.join(dir, name), "utf8");
      return [...src.matchAll(/speech-tail[\s\S]{0,240}?<path d="([^"]+)"/g)].map((m) => ({ name, d: m[1] }));
    });
  const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  const rules = [...css.matchAll(/\.([\w-]+__speech-tail) \{([^}]*)\}/g)]
    .map(([, selector, body]) => ({ selector, body }))
    .filter(({ body }) => body.includes("right:-"));

  // 스캐너가 깨지면 0건이 되어 조용히 통과한다 — 규모부터 단언한다.
  it("검사 대상이 실제로 있다", () => {
    expect(tails.length).toBeGreaterThanOrEqual(2);
    expect(rules.length).toBeGreaterThanOrEqual(2);
  });

  it("삼각형의 밑변은 긋지 않는다 — 말풍선 테두리를 가로지르는 선이 곧 이음매다", () => {
    // 닫힌 경로(Z)면 밑변까지 stroke가 그려져 꼬리가 말풍선에 붙은 게 아니라
    // 그 위에 얹힌 빈 삼각형으로 보인다. 열어 두어도 fill은 그대로 채워진다.
    tails.forEach(({ name, d }) => {
      expect(`${name}:${d}`).not.toMatch(/[Zz]/);
    });
  });

  it("꼬리 왼쪽 변이 말풍선 테두리 위에 정확히 얹힌다", () => {
    // right 오프셋과 width가 같아야 꼬리 x=0이 패딩 경계(=테두리 안쪽 선)에 놓인다.
    // 어긋나면 다리 끝과 테두리 사이에 1px 틈이 보이거나 다리가 말풍선 안으로 삐져나온다.
    rules.forEach(({ selector, body }) => {
      const right = Number((body.match(/right:-(\d+)px/) || [])[1]);
      const width = Number((body.match(/width:(\d+)px/) || [])[1]);
      expect(`${selector}:${right}`).toBe(`${selector}:${width}`);
    });
  });
});
