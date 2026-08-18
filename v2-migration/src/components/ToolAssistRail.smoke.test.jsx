// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";

import ToolAssistRail, { getSections } from "@/components/ToolAssistRail";
import DecisionReview from "@/components/ds/DecisionReview";
import { computeAnalyzeSig, useAppStore } from "@/store/useDataStore";

class Observer {
  observe() {}
  disconnect() {}
}

window.IntersectionObserver = Observer;

describe("ToolAssistRail", () => {
  it("provides a collapsed contextual assistant and opens on request", () => {
    const csvData = { raw: [{ Date: "2026-01-01" }], headers: ["Date"], mapping: { Date: "date" }, fileName: "ops.csv" };
    useAppStore.setState({ csvData, analyzedByGroup: { ...useAppStore.getState().analyzedByGroup, efficiency: computeAnalyzeSig(csvData) } });
    document.body.innerHTML = '<section id="dashboard-tabpanel"></section><section id="dashboard-support-tools"></section>';
    const { getByRole, container } = render(<ToolAssistRail toolId="5-2" />);
    expect(container.querySelector(".tool-assist-rail")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: /분석 도우미 열기/ }));
    expect(container.querySelector(".tool-assist-rail").classList.contains("is-open")).toBe(true);
    expect(container.textContent).toContain("현재 탭 결과 읽기");
    expect(container.textContent).toContain("캠페인 성과 변동 탐지");
  });

  it("keeps EN copy and the EN next-tool destination in parity", async () => {
    document.body.innerHTML = '<section id="s-sat-summary"></section>';
    const { getByRole, container } = render(<>
      <DecisionReview toolId="5-22" locale="en" decisionPrefill={{ action: "Raise budget by 10%", metric: "CPA" }} />
      <ToolAssistRail toolId="5-22" locale="en" />
    </>);
    fireEvent.click(getByRole("button", { name: /Open analysis assistant/ }));
    expect(container.textContent).toContain("Prepare saturation inputs");
    await waitFor(() => expect(getByRole("button", { name: /Schedule a review/ })).toBeTruthy());
    expect(container.querySelector('a[href="/en/tools/budget-allocation"]')).toBeTruthy();
  });

  it("opens and focuses the existing inline review without creating a record", async () => {
    useAppStore.setState({ decisionRecords: [], decisionPersistenceEnabled: false });
    window.gtag = vi.fn();
    document.body.innerHTML = '<section id="s-controls"></section><section id="s-scenario"></section>';
    const { getByRole, getByLabelText, container } = render(<>
      <DecisionReview toolId="5-3" decisionPrefill={{ action: "검색 예산 10% 시험 증액", metric: "CPA" }} />
      <ToolAssistRail toolId="5-3" />
    </>);
    const review = container.querySelector(".decision-review");
    const actionInput = getByLabelText("무엇을 바꿀까요?");
    actionInput.scrollIntoView = vi.fn();

    fireEvent.click(getByRole("button", { name: /분석 도우미 열기/ }));
    await waitFor(() => expect(getByRole("button", { name: /검토 약속 만들기/ })).toBeTruthy());
    fireEvent.click(getByRole("button", { name: /검토 약속 만들기/ }));

    await waitFor(() => expect(review.open).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(actionInput));
    expect(actionInput.scrollIntoView).toHaveBeenCalled();
    expect(container.querySelector(".tool-assist-rail").classList.contains("is-open")).toBe(false);
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
    expect(window.gtag).toHaveBeenCalledWith("event", "decision_review_opened", expect.objectContaining({
      tool_id: "5-3",
      source: "tool_assist_rail",
      placement: "tool_assist_rail",
      locale: "ko",
    }));
    delete window.gtag;
  });

  it("maps contextual sections for the dashboard, creative, and new diagnostic tools", () => {
    expect(getSections("5-2").map((section) => section.id)).toContain("dashboard-support-tools");
    expect(getSections("5-2", { hasDashboardResults: false }).map((section) => section.id)).toEqual(["dashboard-data-setup"]);
    expect(getSections("9-6").map((section) => section.id)).toContain("s-creative-hero");
    expect(getSections("5-24").map((section) => section.id)).toEqual(["brand-its-setup", "brand-its-result"]);
    expect(getSections("5-25").map((section) => section.id)).toEqual(["vif-setup", "vif-result"]);
    expect(getSections("5-26").map((section) => section.id)).toEqual(["asa-setup", "asa-summary"]);
    expect(getSections("5-25")[1].title).toEqual(["VIF 판정 읽기", "Read the VIF verdict"]);
  });

  it.each([
    ["브랜드 증분", "5-24", "brand-its-setup", "brand-its-result", "브랜드 증분 데이터 준비"],
    ["VIF", "5-25", "vif-setup", "vif-result", "채널 지출 데이터 준비"],
    ["ASA", "5-26", "asa-setup", "asa-summary", "ASA 판정 기준과 데이터 준비"],
  ])("jumps to the %s setup and announces its result checkpoint", async (_name, toolId, setupId, resultId, setupTitle) => {
    document.body.innerHTML = `<section id="${setupId}"></section>`;
    const scrollIntoView = vi.fn();
    document.getElementById(setupId).scrollIntoView = scrollIntoView;
    const { getByRole, container } = render(<ToolAssistRail toolId={toolId} />);

    fireEvent.click(getByRole("button", { name: /분석 도우미 열기/ }));
    expect(container.textContent).toContain(setupTitle);
    fireEvent.click(getByRole("button", { name: "이 위치로 이동" }));
    expect(scrollIntoView).toHaveBeenCalled();
    fireEvent.click(getByRole("button", { name: "분석 도우미 접기" }));

    const result = document.createElement("section");
    result.id = resultId;
    document.body.appendChild(result);
    await waitFor(() => expect(container.textContent).toContain("새 결과가 준비됐습니다"));
    expect(container.querySelector(".tool-assist-rail").classList.contains("is-open")).toBe(false);
  });

  it("shows the same ASA checkpoints in English", () => {
    document.body.innerHTML = '<section id="asa-setup"></section>';
    const { getByRole, container } = render(<ToolAssistRail toolId="5-26" locale="en" />);
    fireEvent.click(getByRole("button", { name: /Open analysis assistant/ }));
    expect(container.textContent).toContain("Prepare ASA inputs and thresholds");
    expect(container.textContent).not.toContain("ASA 판정 기준과 데이터 준비");
  });

  it("keeps dashboard assistance on the upload and mapping step until a result panel exists", () => {
    useAppStore.setState({ csvData: { raw: [], headers: [], mapping: {}, fileName: "" }, analyzedByGroup: { ...useAppStore.getState().analyzedByGroup, efficiency: null } });
    document.body.innerHTML = '<section id="dashboard-data-setup"></section>';
    const scrollIntoView = vi.fn();
    document.getElementById("dashboard-data-setup").scrollIntoView = scrollIntoView;
    const { getByRole, container } = render(<ToolAssistRail toolId="5-2" />);
    fireEvent.click(getByRole("button", { name: /분석 도우미 열기/ }));
    expect(container.textContent).toContain("데이터 업로드·매핑");
    expect(container.textContent).not.toContain("현재 탭 결과 읽기");
    fireEvent.click(getByRole("button", { name: "데이터 준비하기" }));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("treats a dashboard demo as a sample, not the user's next analysis", () => {
    const csvData = { raw: [{ Date: "2026-01-01" }], headers: ["Date"], mapping: { Date: "date" }, fileName: "demo_efficiency.csv" };
    useAppStore.setState({ csvData, analyzedByGroup: { ...useAppStore.getState().analyzedByGroup, efficiency: computeAnalyzeSig(csvData) } });
    document.body.innerHTML = '<section id="dashboard-demo-source"></section><section id="dashboard-data-setup"></section>';
    const { getByRole, container } = render(<ToolAssistRail toolId="5-2" />);
    fireEvent.click(getByRole("button", { name: /분석 도우미 열기/ }));
    expect(container.textContent).toContain("샘플 결과 살펴보기");
    expect(container.textContent).toContain("내 CSV로 바꾸기");
    expect(container.textContent).not.toContain("캠페인 성과 변동 탐지");
  });

  it("keeps a contextual assistant for preview content wrappers without publishing them into the main journey", () => {
    document.body.innerHTML = '<section id="s-pvm-result"></section>';
    const { container } = render(<ToolAssistRail toolId="9-3" />);
    expect(container.textContent).toContain("콘텐츠 트래픽 변동 탐지");
    expect(getSections("9-3").map((section) => section.id)).toContain("s-pvm-result");
  });

  it("tracks a contextual jump", () => {
    document.body.innerHTML = '<section id="s-controls"></section>';
    const scrollIntoView = vi.fn();
    document.getElementById("s-controls").scrollIntoView = scrollIntoView;
    window.gtag = vi.fn();
    const { getByRole } = render(<ToolAssistRail toolId="5-3" />);
    fireEvent.click(getByRole("button", { name: /분석 도우미 열기/ }));
    fireEvent.click(getByRole("button", { name: /이 위치로 이동/ }));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(window.gtag).toHaveBeenCalledWith("event", "tool_assist_jump", expect.objectContaining({ tool_id: "5-3", section_id: "s-controls" }));
    delete window.gtag;
  });

  it("compresses a result into one decision, one action, and an evidence link", async () => {
    document.body.innerHTML = `
      <section id="s-forecast"
        data-assist-title-ko="10% 미인증 — 운영 판단 보류"
        data-assist-summary-ko="봉인 최근 12주 OOS wMAPE는 32.77%입니다."
        data-assist-actions-ko="현재 예측값으로 예산을 확정하지 마세요.|||최근 레짐 데이터를 추가해 재검증하세요.">
      </section>`;
    const { getByRole, container } = render(<ToolAssistRail toolId="5-18-forecast" />);
    await waitFor(() => expect(getByRole("button", { name: /분석 도우미/ })).toBeTruthy());
    if (!container.querySelector(".tool-assist-rail").classList.contains("is-open")) {
      fireEvent.click(getByRole("button", { name: /분석 도우미 열기/ }));
    }
    await waitFor(() => expect(container.textContent).toContain("예측 검증 미통과"));
    expect(container.textContent).toContain("32.77%");
    expect(container.textContent).toContain("지금 할 일");
    expect(container.textContent).toContain("현재 예측값으로 예산을 확정하지 마세요.");
    expect(container.textContent).not.toContain("최근 레짐 데이터를 추가해 재검증하세요.");
    expect(container.textContent).toContain("근거 위치 보기");
    expect(container.textContent).not.toContain("예산 분배");
    expect(container.textContent).not.toContain("이 도구에서 판단을 정리한 뒤");
    expect(container.textContent).not.toContain("데이터 매핑 확인");
  });

  it("updates the collapsed label when the reader passes the next checkpoint", async () => {
    let prepTop = 120;
    let resultTop = 860;
    document.body.innerHTML = '<section id="s-prep"></section><section id="s-sat-summary"></section>';
    document.getElementById("s-prep").getBoundingClientRect = () => ({ top: prepTop });
    document.getElementById("s-sat-summary").getBoundingClientRect = () => ({ top: resultTop });
    const { getByRole } = render(<ToolAssistRail toolId="5-22" />);
    await waitFor(() => expect(getByRole("button", { name: /포화도 입력 준비/ })).toBeTruthy());
    prepTop = -540;
    resultTop = 140;
    fireEvent.scroll(window);
    await waitFor(() => expect(getByRole("button", { name: /증액 여지 판단/ })).toBeTruthy());
  });

  it("announces, but does not open over, an actual result checkpoint", async () => {
    document.body.innerHTML = '<section id="s-incr-method"></section>';
    const { container } = render(<ToolAssistRail toolId="5-23" />);
    expect(container.querySelector(".tool-assist-rail").classList.contains("is-open")).toBe(false);
    const result = document.createElement("section");
    result.id = "s-incr-result";
    document.body.appendChild(result);
    await waitFor(() => expect(container.textContent).toContain("새 결과가 준비됐습니다"));
    expect(container.querySelector(".tool-assist-rail").classList.contains("is-open")).toBe(false);
  });

  it("announces a new result without covering the mobile viewport", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    document.body.innerHTML = '<section id="s-incr-method"></section>';
    const { container, getByRole } = render(<ToolAssistRail toolId="5-23" />);
    const result = document.createElement("section");
    result.id = "s-incr-result";
    document.body.appendChild(result);
    await waitFor(() => expect(getByRole("button", { name: /분석 도우미 열기: 증분 결과 판독/ })).toBeTruthy());
    expect(container.textContent).toContain("새 결과가 준비됐습니다");
    expect(container.querySelector(".tool-assist-rail").classList.contains("is-open")).toBe(false);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
  });
});
