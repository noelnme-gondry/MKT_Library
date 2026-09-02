// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import AssistantWorkspace, { analysisInputSignature } from "@/components/assistant/AssistantWorkspace";
import { useAppStore } from "@/store/useDataStore";

const raw = [
  { date: "2026-08-01", channel: "Meta", cost: "100", installs: "10" },
  { date: "2026-08-02", channel: "Meta", cost: "120", installs: "12" },
  { date: "2026-08-03", channel: "Google", cost: "110", installs: "11" },
];

const completeRaw = Array.from({ length: 28 }, (_, index) => ({
  date: `2026-08-${String(index + 1).padStart(2, "0")}`,
  channel: index % 2 ? "Meta" : "Google",
  cost: String(100 + index * 10),
  installs: String(10 + index),
}));

const storeRaw = Array.from({ length: 8 }, (_, index) => ([
  { Date: `2026-02-${String(index + 1).padStart(2, "0")}`, Source: "Search", Views: index < 4 ? "700" : "300", Installs: index < 4 ? "350" : "150" },
  { Date: `2026-02-${String(index + 1).padStart(2, "0")}`, Source: "Browse", Views: index < 4 ? "300" : "700", Installs: index < 4 ? "30" : "70" },
])).flat();

const experimentRaw = [
  { numerator: "12", denominator: "100", is_control: "true" },
  { numerator: "18", denominator: "100", is_control: "false" },
];

const interruptionRaw = ["Meta", "Google"].flatMap((channel) => Array.from({ length: 7 }, (_, index) => ({
  date: `2026-03-0${index + 1}`,
  channel,
  cost: String(channel === "Meta" && index >= 4 ? 10 : 100),
  installs: "10",
})));

function slice(mapping = { date: "date", channel: "channel", cost: "cost", installs: "installs" }, records = raw) {
  return { raw: records, headers: ["date", "channel", "cost", "installs"], mapping, fileName: "campaign.csv" };
}

describe("Dochi analysis workspace", () => {
  beforeEach(() => {
    useAppStore.setState({ denomBasis: "installs", displayCurrency: "KRW" });
  });

  it("uses a structural fingerprint instead of carrying source headers or values in the result signature", () => {
    const source = {
      raw: [{ "Private Account": "secret-123", installs: "10" }],
      headers: ["Private Account", "installs"],
      mapping: {},
      fileName: "private.csv",
    };
    const signature = analysisInputSignature(source);
    expect(signature).toMatch(/^v1:1:2:[a-z0-9]+$/);
    expect(signature).not.toContain("secret-123");
    expect(signature).not.toContain("Private Account");
    expect(signature).not.toContain("private.csv");
    expect(analysisInputSignature({ ...source, raw: [{ ...source.raw[0], installs: "11" }] })).not.toBe(signature);
  });

  it("keeps the empty state honest before a source is available", () => {
    render(<AssistantWorkspace csvData={{ raw: [], headers: [], mapping: {}, fileName: "" }} />);
    expect(screen.getByText(/파일을 읽으면 가능한 분석/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /요약 분석 실행/ })).toBeNull();
  });

  it("keeps the same workspace states available in English", () => {
    render(<AssistantWorkspace csvData={slice()} locale="en" getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    expect(screen.getByText("The analysis map Dochi found")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run summary analyses" })).toBeTruthy();
    expect(screen.getByText(/Additional model confirmation/)).toBeTruthy();
  });

  it("shows mapping-backed eligibility and paints a handoff state before preparing the same source", async () => {
    const onOpenTool = vi.fn();
    render(<AssistantWorkspace csvData={slice()} getTitle={(toolId) => `도구 ${toolId}`} onOpenTool={onOpenTool} />);
    expect(screen.getByText(/표준 역할 매핑/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "이 화면에서 계산 가능한 요약" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /추가 차트·상세 분석 열기/ })[0]);
    expect(screen.getByText("상세 분석 화면을 준비하고 있습니다.")).toBeTruthy();
    await waitFor(() => expect(onOpenTool).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ raw })));
  });

  it("treats a mapped dt column as a daily source and makes weekly analyses available without a week header", async () => {
    const onEligibilityChange = vi.fn();
    const records = completeRaw.map((row) => ({ dt: row.date, signup: row.installs, meta_spend: row.cost }));
    render(<AssistantWorkspace
      csvData={{
        raw: records,
        headers: ["dt", "signup", "meta_spend"],
        mapping: { dt: "date", signup: "mmm_reg", meta_spend: "ch_meta" },
        fileName: "daily-response.csv",
      }}
      getTitle={(toolId) => toolId}
      onEligibilityChange={onEligibilityChange}
    />);
    await waitFor(() => expect(onEligibilityChange).toHaveBeenCalled());
    const latest = onEligibilityChange.mock.calls.at(-1)[0];
    expect(latest.find((item) => item.toolId === "5-18-trend")).toMatchObject({ status: "ready", blockers: [] });
    expect(latest.find((item) => item.toolId === "5-18-mmm")).toMatchObject({
      status: "blocked",
      blockers: expect.arrayContaining([expect.objectContaining({ code: "min_periods" })]),
    });
  });

  it("marks old results stale and rebuilds every available analysis when the user reruns after a mapping change", async () => {
    const view = render(<AssistantWorkspace csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    const start = screen.queryByRole("button", { name: /요약 분석 실행/ });
    if (!start) throw new Error("Expected a baseline analysis candidate for the fixture");
    fireEvent.click(start);
    await waitFor(() => expect(screen.getAllByText("완료").length).toBe(4));

    view.rerender(<AssistantWorkspace csvData={slice({ date: "date", channel: "channel", cost: "installs", installs: "cost" }, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    await waitFor(() => expect(screen.getByText(/오래된 상태로 표시/)).toBeTruthy());
    expect(screen.getAllByText(/오래됨/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /현재 매핑으로 가능한 분석 전체 다시 실행/ }));
    await waitFor(() => expect(screen.getAllByText("완료").length).toBe(4));
    expect(screen.queryByText("오래됨")).toBeNull();
  });

  it("renders every available result visualization while keeping interpretation limits deferred", async () => {
    render(<AssistantWorkspace csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /요약 분석 실행/ }));
    await waitFor(() => expect(screen.getByText("분석 결과")).toBeTruthy());
    expect(screen.getByRole("heading", { name: /도치가 확인한 발견 \d+건/ })).toBeTruthy();
    expect(document.querySelectorAll(".dochi-workspace__findings-summary li").length).toBeGreaterThan(0);
    expect(screen.getByText("현재 근거")).toBeTruthy();
    expect(screen.getByText("해석 한계 보기")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("img", { name: "직전 기간과 최근 기간 사이에 무엇이 변했는가?" })).toBeTruthy());
    fireEvent.click(screen.getByText("정확한 수치 표 보기"));
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("keeps the decision reading order visible and detailed evidence collapsed", async () => {
    const { container } = render(<AssistantWorkspace csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /요약 분석 실행/ }));
    await waitFor(() => expect(container.querySelector(".dochi-workspace__decision-focus")).toBeTruthy());
    const workspace = container.querySelector(".dochi-workspace");
    const directChildren = [...workspace.children];
    const contextIndex = directChildren.findIndex((child) => child.classList.contains("dochi-workspace__head"));
    const judgmentIndex = directChildren.findIndex((child) => child.classList.contains("dochi-workspace__judgment"));
    const decisionIndex = directChildren.findIndex((child) => child.classList.contains("dochi-workspace__decision-focus"));
    expect(contextIndex).toBeLessThan(judgmentIndex);
    expect(judgmentIndex).toBeLessThan(decisionIndex);

    const decision = container.querySelector(".dochi-workspace__decision-focus");
    expect(decision.querySelector(".dochi-workspace__decision-tape")).toBeTruthy();
    expect(decision.querySelector(".dochi-workspace__result-action")).toBeTruthy();
    const details = decision.querySelector("details");
    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
  });

  it("automatically advances every baseline item after the first result commits", async () => {
    render(<AssistantWorkspace csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /요약 분석 실행/ }));
    // 큐는 setTimeout(0) 사슬로 한 건씩 넘어간다. 기준선은 5건인데 이 테스트는 완료
    // 4건을 기다리고 있어서, 5번째가 도는 중인 사슬 중간을 "다 끝났다"로 단언하고
    // 있었다 — DOM이 조금만 무거워지면 깨지는 자리다. 전건 완료(정착 상태)를 기다린
    // 뒤에 실행 표시가 사라졌는지 본다.
    await waitFor(() => expect(screen.getAllByText("완료").length).toBe(5));
    expect(screen.queryByText("요약 분석 실행 중")).toBeNull();
  });

  it("gives every completed result the same workbook escape as the detail tools", async () => {
    // 발행 도구 20개는 ResultActionCard가 공통 XLSX를 제공하는데(product-ssot §5.5)
    // 도치 작업대만 결론 카드가 없어 탈출구가 통째로 빠져 있었다 — 도치로 들어온
    // 사람은 결과를 보고도 가져갈 방법이 없었다.
    render(<AssistantWorkspace csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /요약 분석 실행/ }));
    await waitFor(() => expect(screen.getAllByText("완료").length).toBe(5));

    const hubs = screen.getAllByRole("button", { name: "⬇ 결과 받기" });
    expect(hubs.length).toBe(document.querySelectorAll(".dochi-workspace__result-status").length);
    expect(hubs.length).toBeGreaterThan(0);
  });

  it("keeps the workbook escape in English too", async () => {
    render(<AssistantWorkspace csvData={slice(undefined, completeRaw)} locale="en" getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Run summary analyses/ }));
    await waitFor(() => expect(screen.getAllByText("Complete").length).toBe(5));
    expect(screen.getAllByRole("button", { name: "⬇ Get results" }).length).toBeGreaterThan(0);
  });

  it("automatically starts only when the home Dochi handoff explicitly requests it", async () => {
    render(<AssistantWorkspace autoStart csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    await waitFor(() => expect(screen.getAllByText("완료").length).toBe(4));
    expect(screen.getAllByText("분석 결과").length).toBeGreaterThan(0);
  });

  it("shows only actual completed results in the embedded home view, with dashboard open first", async () => {
    const { container } = render(<AssistantWorkspace autoStart presentation="embedded" csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} />);
    const workspace = container.querySelector(".dochi-workspace--embedded");
    await waitFor(() => expect(workspace.querySelector(".dochi-workspace__embedded-result")?.open).toBe(true));
    expect(screen.queryByRole("button", { name: /추가 차트·상세 분석 열기/ })).toBeNull();
    expect(screen.queryByText("현재 판단 상태")).toBeNull();
  });

  it("uses actions automatically when mapped installs are all zero and reruns when the shared controls change", async () => {
    const records = completeRaw.map((row) => ({ ...row, installs: "0", actions: String(Number(row.installs) * 2) }));
    const data = {
      raw: records,
      headers: ["date", "channel", "cost", "installs", "actions"],
      mapping: { date: "date", channel: "channel", cost: "cost", installs: "installs", actions: "actions" },
      fileName: "signup-campaign.csv",
    };
    useAppStore.setState({ denomBasis: "installs", displayCurrency: "KRW" });
    render(<AssistantWorkspace autoStart csvData={data} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    await waitFor(() => expect(screen.getAllByText(/CPA/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/CPI 변화/)).toBeNull();
    useAppStore.getState().setDisplayCurrency("USD");
    await waitFor(() => expect(screen.getAllByText(/\$/).length).toBeGreaterThan(0));
  });

  it("does not queue or run a design-confirmation analysis until the user approves its detailed-tool handoff", async () => {
    const data = {
      raw: experimentRaw,
      headers: ["numerator", "denominator", "is_control"],
      mapping: { numerator: "numerator", denominator: "denominator", is_control: "is_control" },
      fileName: "experiment.csv",
    };
    render(<AssistantWorkspace csvData={data} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByText(/설계 확인 필요/));
    expect(screen.queryByText(/승인됨 — 이 작업대에서는/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /승인하고 상세 도구에서 계속/ }));
    await waitFor(() => expect(screen.getByText(/승인됨 — 이 작업대에서는/)).toBeTruthy());
    expect(screen.getByText(/5-4: 승인됨 · 상세 도구/)).toBeTruthy();
    expect(screen.queryByText("분석 결과")).toBeNull();
  });

  it("uses the natural-experiment handoff contract and never generates an incrementality number", async () => {
    const onOpenTool = vi.fn();
    render(<AssistantWorkspace csvData={slice(undefined, interruptionRaw)} getTitle={(toolId) => toolId} onOpenTool={onOpenTool} />);
    fireEvent.click(screen.getByText(/자연실험 후보/));
    fireEvent.click(screen.getByLabelText(/실제 운영 중단/));
    fireEvent.change(screen.getByLabelText("결과 지표 선택"), { target: { value: "installs" } });
    fireEvent.change(screen.getByLabelText(/대조 단위/), { target: { value: "Google" } });
    fireEvent.click(screen.getByRole("button", { name: /확인 후 상세 도구로 넘기기/ }));
    await waitFor(() => expect(onOpenTool).toHaveBeenCalledWith(
      "5-23",
      expect.any(Object),
      expect.objectContaining({ naturalExperiment: expect.objectContaining({ targetToolId: "5-23", requiresParallelTrendCheck: true }) }),
    ));
    expect(screen.queryByText(/증분.*[0-9]/)).toBeNull();
  });

  it("renders an ASO time-series result as an accessible chart instead of hiding the line spec", async () => {
    render(<AssistantWorkspace
      csvData={{
        raw: storeRaw,
        headers: ["Date", "Source", "Views", "Installs"],
        mapping: { Date: "date", Source: "store_source", Views: "product_page_views", Installs: "installs" },
        fileName: "store.csv",
      }}
      getTitle={(toolId) => toolId}
      onOpenTool={() => {}}
    />);
    fireEvent.click(screen.getByRole("button", { name: /요약 분석 실행/ }));
    await waitFor(() => expect(screen.getByText("전체 조회→설치")).toBeTruthy());
    const chart = screen.getByRole("img", { name: /전환율은 날짜와 유입 소스별로/ });
    expect(chart.getAttribute("viewBox")).toBe("0 0 640 240");
    expect(chart.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });
});
