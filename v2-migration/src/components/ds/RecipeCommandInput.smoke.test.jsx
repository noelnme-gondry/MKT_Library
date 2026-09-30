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
});
