// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import RecipeCommandInput from "./RecipeCommandInput";
import { COMMON_WORDS } from "@/lib/vocabulary/commonWords";
import { PVM_WORDS } from "@/lib/vocabulary/tools/pvmWords";
import { buildVocabulary } from "@/lib/vocabulary/vocabulary";
import { buildDataContext } from "@/lib/vocabulary/dataContext";

const vocab = buildVocabulary([...COMMON_WORDS, ...PVM_WORDS]);
const rows = Array.from({ length: 20 }, (_, i) => ({
  날짜: `2026-09-${String(i + 1).padStart(2, "0")}`,
  매체: i % 2 ? "Meta" : "TikTok",
  캠페인명: `cmp_${i % 4}`,
  구분: i % 3 ? "iOS" : "Android",
  비용: String(1000 + i),
  설치: String(10 + i),
}));
const mapping = { 날짜: "date", 매체: "channel", 캠페인명: "campaign_name", 비용: "cost", 설치: "installs" };
const context = buildDataContext({ rows, mapping, toolId: "5-21" });

function Harness({ onMapping = () => {}, initial = [] }) {
  const [steps, setSteps] = useState(initial);
  return (
    <>
      <RecipeCommandInput vocabulary={vocab} context={context} steps={steps} onStepsChange={setSteps} onMapping={onMapping} locale="ko" />
      <output data-testid="steps">{JSON.stringify(steps)}</output>
    </>
  );
}

const input = () => screen.getByRole("combobox");
const optionLabels = () => screen.getAllByRole("option").map((node) => node.querySelector("span")?.textContent);
const steps = () => JSON.parse(screen.getByTestId("steps").textContent);

describe("RecipeCommandInput", () => {
  it("'채' → 채널별·채널+캠페인별이 위에, Enter로 칩이 된다", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "채" } });
    expect(optionLabels().slice(0, 2)).toEqual(["채널별", "채널+캠페인별"]);
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(steps()).toEqual([{ id: "level.pvm.channelCampaign", params: {} }]);
    expect(screen.getByRole("button", { name: "채널+캠페인별 빼기" })).toBeTruthy();
    expect(input().value).toBe("");
  });

  it("'캠' → 캠페인별이 먼저, 채널+캠페인별은 아래", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "캠" } });
    const labels = optionLabels();
    expect(labels[0]).toBe("캠페인별");
    expect(labels.indexOf("채널+캠페인별")).toBeGreaterThan(0);
  });

  it("매핑된 축은 실제 컬럼명을 옆에 보인다", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "채널별" } });
    expect(screen.getAllByRole("option")[0].textContent).toContain("컬럼: 매체");
  });

  it("값으로 OS를 알아본 컬럼은 매핑과 축을 한 번에 적용한다", () => {
    const onMapping = vi.fn();
    render(<Harness onMapping={onMapping} />);
    fireEvent.change(input(), { target: { value: "OS" } });
    const offer = screen.getAllByRole("option").find((node) => node.textContent.includes("'구분'을 OS로 지정"));
    fireEvent.mouseDown(offer);
    expect(onMapping).toHaveBeenCalledWith({ column: "구분", field: "platform" });
    expect(steps()).toEqual([{ id: "level.field", params: { field: "platform" } }]);
  });

  it("못 쓰는 단어는 흐리게 + 필요한 컬럼, 골라도 아무 일 없다", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "채널+캠페인+소재" } });
    const option = screen.getAllByRole("option")[0];
    expect(option.getAttribute("aria-disabled")).toBe("true");
    expect(option.textContent).toContain("필요:");
    fireEvent.mouseDown(option);
    expect(steps()).toEqual([]);
  });

  it("목록이 포인터 밑에 열려도(mouseenter) 강조가 바뀌지 않는다 — 실제로 움직일 때만", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "채" } });
    const options = screen.getAllByRole("option");
    fireEvent.mouseEnter(options[1]);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.mouseMove(options[1]);
    expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true");
  });

  it("'플랫폼'으로 쳐도 OS 축을 찾는다(필터 막대가 부르는 이름)", () => {
    const ctx = buildDataContext({ rows, mapping: { ...mapping, 구분: "platform" }, toolId: "5-21" });
    render(<RecipeCommandInput vocabulary={vocab} context={ctx} steps={[]} onStepsChange={() => {}} locale="ko" />);
    fireEvent.change(input(), { target: { value: "플랫폼" } });
    expect(optionLabels()).toContain("OS별");
  });

  it("한글 조합 중 Enter는 선택하지 않는다", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "채" } });
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    expect(steps()).toEqual([]);
  });

  it("칩을 누르거나 빈 입력에서 Backspace면 빠진다", () => {
    render(<Harness initial={[{ id: "view.top.5", params: {} }, { id: "view.only.worse", params: {} }]} />);
    fireEvent.click(screen.getByRole("button", { name: "상위 5개만 보기 빼기" }));
    expect(steps()).toEqual([{ id: "view.only.worse", params: {} }]);
    fireEvent.keyDown(input(), { key: "Backspace" });
    expect(steps()).toEqual([]);
  });

  it("사전에 없는 말은 적용하지 않고 쓸 수 있는 말을 안내한다", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "아무말대잔치" } });
    expect(screen.getByRole("listbox").textContent).toContain("해당하는 말이 없습니다");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(steps()).toEqual([]);
  });

  it("반영되지 않은 칩은 이유를 보인다", () => {
    const step = { id: "view.top.5", params: {} };
    render(<RecipeCommandInput vocabulary={vocab} context={context} steps={[step]} onStepsChange={() => {}} rejected={[{ step, code: "MISSING_FIELD" }]} locale="ko" />);
    expect(screen.getByText(/적용 안 됨/).textContent).toContain("필요한 컬럼이 없음");
  });

  describe("저장한 설정(계정)", () => {
    const weekly = { toolId: "5-21", name: "주간 보고용", steps: [{ id: "level.pvm.channelCampaign", params: {} }, { id: "view.top.5", params: {} }] };
    function PresetHarness({ presets, initial = [] }) {
      const [steps, setSteps] = useState(initial);
      return (
        <>
          <RecipeCommandInput vocabulary={vocab} context={context} steps={steps} onStepsChange={setSteps} presets={presets} locale="ko" />
          <output data-testid="steps">{JSON.stringify(steps)}</output>
        </>
      );
    }

    it("이름으로 치면 저장한 설정이 맨 위에 뜨고, 고르면 칩 목록이 그 설정으로 바뀐다", () => {
      render(<PresetHarness presets={{ status: "ready", canApply: true, recipes: [weekly], save: vi.fn() }} initial={[{ id: "view.only.worse", params: {} }]} />);
      fireEvent.change(input(), { target: { value: "주간" } });
      expect(optionLabels()[0]).toBe("저장한 설정 · 주간 보고용");
      fireEvent.keyDown(input(), { key: "Enter" });
      expect(steps()).toEqual(weekly.steps);
    });

    it("로그인 전이면 저장 대신 로그인 안내", () => {
      render(<PresetHarness presets={{ status: "signedOut", canApply: false, recipes: [], save: vi.fn() }} initial={[{ id: "view.top.5", params: {} }]} />);
      fireEvent.click(screen.getByRole("button", { name: "이 설정 저장" }));
      expect(screen.getByText(/로그인하면 이 설정을/)).toBeTruthy();
      expect(screen.getByRole("link", { name: "로그인" }).getAttribute("href")).toBe("/account");
    });

    it("Pro가 아니면 Pro 안내(만료 후에도 열람·삭제는 된다고 말한다)", () => {
      render(<PresetHarness presets={{ status: "ready", canApply: false, recipes: [], save: vi.fn() }} initial={[{ id: "view.top.5", params: {} }]} />);
      fireEvent.click(screen.getByRole("button", { name: "이 설정 저장" }));
      expect(screen.getByText(/설정 저장은 Pro/).textContent).toContain("만료 후에도");
      expect(screen.getByRole("link", { name: "Pro 안내" }).getAttribute("href")).toBe("/subscription");
    });

    it("이름을 붙여 저장하고, 데이터 값이 든 설정을 빼고 보냈다고 말한다", async () => {
      const save = vi.fn(async () => ({ ok: true, skipped: 1 }));
      const initial = [{ id: "view.top.5", params: {} }, { id: "filter.only.view", params: { field: "channel", values: ["Meta"] } }];
      render(<PresetHarness presets={{ status: "ready", canApply: true, recipes: [], save }} initial={initial} />);
      fireEvent.click(screen.getByRole("button", { name: "이 설정 저장" }));
      fireEvent.change(screen.getByLabelText("설정 이름"), { target: { value: "주간 보고용" } });
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
      const note = await screen.findByText(/'주간 보고용'으로 저장했습니다/);
      expect(save).toHaveBeenCalledWith("주간 보고용", initial);
      expect(note.textContent).toContain("1개");
    });

    it("칩이 없으면 저장 버튼이 없다", () => {
      render(<PresetHarness presets={{ status: "ready", canApply: true, recipes: [], save: vi.fn() }} />);
      expect(screen.queryByRole("button", { name: "이 설정 저장" })).toBeNull();
    });
  });
});
