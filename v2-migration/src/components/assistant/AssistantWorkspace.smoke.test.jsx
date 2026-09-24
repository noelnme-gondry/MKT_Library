// @vitest-environment jsdom
import { confirmReviewSave } from "@/test/reviewSaveBoundary";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import AssistantWorkspace, { analysisInputSignature } from "@/components/assistant/AssistantWorkspace";
import { useAppStore } from "@/store/useDataStore";
import { buildDemoCsv } from "@/utils/demoData";
import { toolIndexEntry } from "@/lib/toolIndex";

function openAnalysis(id, locale = "ko") {
  const name = toolIndexEntry(id, locale).name;
  const chip = [...document.querySelectorAll(".tool-index__chip")].find(node => node.querySelector(".tool-index__q").textContent === name);
  expect(chip).toBeTruthy();
  if (chip.getAttribute("aria-expanded") !== "true") fireEvent.click(chip);
}
async function waitForAnalyses() {
  await waitFor(() => expect(document.querySelector('[data-queue-settled="true"]')).toBeTruthy());
}

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

  it.each(["ko", "en"])("records real calculation and saves a manual decision without leaving Dochi (%s)", async locale => {
    const en = locale === "en";
    const data = slice(undefined, completeRaw);
    useAppStore.setState({ csvData: data, decisionRecords: [], decisionPersistenceEnabled: false });
    window.gtag = vi.fn();
    const view = render(<AssistantWorkspace csvData={data} locale={locale} getTitle={id => id} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: en ? "Analyze data" : "분석하기" }));
    await waitForAnalyses();
    openAnalysis("5-2", locale);
    await waitFor(() => expect(view.container.querySelectorAll(".dochi-workspace__result.is-success .decision-review").length).toBeGreaterThan(0));
    const editor = view.container.querySelector(".dochi-workspace__result.is-success .decision-review");
    fireEvent.click(editor.querySelector("[data-information-heading], .decision-review-launch"));
    fireEvent.click(screen.getByRole("button", { name: en ? "Save for next review" : "다음 검토로 저장", exact: true }));
    confirmReviewSave();
    const record = useAppStore.getState().decisionRecords[0];
    expect(record.action.length).toBeGreaterThan(0);
    expect(record.comparisonScope).toBeFalsy();
    expect(screen.getByRole("link", { name: en ? "Open weekly review →" : "주간 리뷰 열기 →" }).getAttribute("href")).toBe(`${en ? "/en" : ""}/weekly-review#wr-history`);
    for (const name of ["analysis_started", "analysis_completed", "decision_record_added"]) expect(window.gtag).toHaveBeenCalledWith("event", name, expect.objectContaining({ placement: "dochi_workspace", locale }));
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("campaign.csv");
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("Meta");
    delete window.gtag;
  });

  it.each(["ko", "en"])("opens an analyzable tool without a quality or approval step and reports cautions in the result (%s)", async (locale) => {
    const en = locale === "en";
    const records = completeRaw.map((row) => ({ ...row, cost: "100" }));
    const data = slice(undefined, records);
    const view = render(<AssistantWorkspace csvData={data} locale={locale} getTitle={(id) => id} onOpenTool={() => {}} />);
    openAnalysis("5-22", locale);
    const card = () => within(screen.getByRole("heading", { name: "5-22" }).closest("article"));
    // 분석할 수 있으면 품질 검사·승인 단계 없이 바로 연다(2026-09-24). 주의사항은 결과에서 말한다.
    expect(card().queryByText(en ? "Detailed quality not checked yet" : "상세 품질 아직 미검사")).toBeNull();
    expect(card().queryByRole("button", { name: en ? "Check detailed input quality" : "상세 입력 품질 확인" })).toBeNull();
    expect(card().getByRole("button", { name: en ? /Open analysis/ : /분석 열기/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en ? "Analyze data" : "분석하기" }));
    await waitForAnalyses();
    const resultDetails = [...view.container.querySelectorAll(".dochi-workspace__result-details")];
    expect(resultDetails.length).toBeGreaterThan(0);
    resultDetails.forEach((details) => { details.open = true; fireEvent(details, new Event("toggle")); });
    expect(screen.getAllByText(en ? /too little spend variation/ : /지출 변동이 너무 작은/).length).toBeGreaterThan(0);
    view.rerender(<AssistantWorkspace csvData={{ ...data, raw: records.map((row, index) => ({ ...row, cost: String(100 + index * 10) })) }} locale={locale} getTitle={(id) => id} onOpenTool={() => {}} />);
    expect(card().queryByText(en ? /too little spend variation/ : /지출 변동이 너무 작은/)).toBeNull();
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
    expect(screen.queryByRole("button", { name: /분석하기/ })).toBeNull();
  });

  it("keeps the same workspace states available in English", () => {
    render(<AssistantWorkspace csvData={slice()} locale="en" getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    expect(screen.getByText("Analyses for your data")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Analyze data" })).toBeTruthy();
    expect(document.querySelectorAll(".tool-index")).toHaveLength(1);
    expect(document.querySelector(".dochi-workspace__card")).toBeNull();
  });

  it("shows mapping-backed eligibility and paints a handoff state before preparing the same source", async () => {
    const onOpenTool = vi.fn();
    render(<AssistantWorkspace csvData={slice()} getTitle={(toolId) => `도구 ${toolId}`} onOpenTool={onOpenTool} />);
    expect(document.querySelector(".dochi-workspace__card")).toBeNull();
    openAnalysis("5-2");
    fireEvent.click(screen.getAllByRole("button", { name: /분석 열기|그래도 열어 보기/ })[0]);
    expect(screen.getByText("상세 분석 화면을 준비하고 있습니다.")).toBeTruthy();
    await waitFor(() => expect(onOpenTool).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ raw })));
  });

  it("cancels a pending data handoff when its workspace is left", () => {
    const frames = new Map();
    let id = 0;
    const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.set(++id, callback); return id; });
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(frame => frames.delete(frame));
    const onOpenTool = vi.fn();
    try {
      const view = render(<AssistantWorkspace csvData={slice()} onOpenTool={onOpenTool} />);
      openAnalysis("5-2");
      fireEvent.click(screen.getByRole("button", { name: /분석 열기|그래도 열어 보기/ }));
      expect(frames.size).toBeGreaterThan(0);
      view.unmount();
      for (const callback of frames.values()) callback();
      expect(onOpenTool).not.toHaveBeenCalled();
    } finally { request.mockRestore(); cancel.mockRestore(); }
  });

  it("keeps campaign summaries eligible when the source also has a creative dimension", async () => {
    const onEligibilityChange = vi.fn();
    render(<AssistantWorkspace csvData={buildDemoCsv("efficiency")} onEligibilityChange={onEligibilityChange} />);
    await waitFor(() => expect(onEligibilityChange).toHaveBeenCalled());
    const latest = onEligibilityChange.mock.calls.at(-1)[0];
    for (const id of ["5-2", "5-21"]) {
      expect(latest.find((item) => item.toolId === id).blockers).toEqual([]);
    }
    expect(latest.find((item) => item.toolId === "5-2").status).toBe("ready");
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
    const start = screen.queryByRole("button", { name: /분석하기/ });
    if (!start) throw new Error("Expected a baseline analysis candidate for the fixture");
    fireEvent.click(start);
    await waitForAnalyses();
    openAnalysis("5-2");
    expect(document.querySelector(".dochi-workspace__result")).toBeTruthy();

    view.rerender(<AssistantWorkspace csvData={slice({ date: "date", channel: "channel", cost: "installs", installs: "cost" }, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    await waitFor(() => expect(screen.getByText(/오래된 상태로 표시/)).toBeTruthy());
    expect(screen.getAllByText(/오래됨/).length).toBeGreaterThan(0);
    expect(document.querySelector(".dochi-workspace__result")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    await waitForAnalyses();
    expect(screen.queryByText("오래됨")).toBeNull();
  });

  it("renders every available result visualization while keeping interpretation limits deferred", async () => {
    render(<AssistantWorkspace csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /분석하기/ }));
    await waitForAnalyses();
    expect(document.querySelectorAll(".workspace-card-evidence").length).toBeGreaterThan(1);
    expect(document.querySelector(".dochi-workspace__result")).toBeNull();
    openAnalysis("5-2");
    const focus = within(document.querySelector(".dochi-workspace__result"));
    expect(focus.getByText("현재 근거")).toBeTruthy();
    expect(focus.getByText("해석 한계 보기")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("img", { name: "직전 기간과 최근 기간 사이에 무엇이 변했는가?" })).toBeTruthy());
    const metrics = document.querySelector(".analysis-metric-picker");
    expect(metrics.textContent).not.toMatch(/노출|클릭/);
    const metricButtons = within(metrics).getAllByRole("button");
    expect(metricButtons.some(button => button.getAttribute("aria-pressed") === "true")).toBe(true);
    expect(document.querySelectorAll(".dochi-workspace__period-comparison li")).toHaveLength(1);
    fireEvent.click(metricButtons[0]);
    expect(metricButtons[0].getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(focus.getByText("전체 지표·정확한 수치 보기"));
    expect(focus.getAllByRole("table").length).toBeGreaterThan(0);
  });

  it("keeps the decision reading order visible and detailed evidence collapsed", async () => {
    const { container } = render(<AssistantWorkspace csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /분석하기/ }));
    await waitForAnalyses();
    const workspace = container.querySelector(".dochi-workspace");
    const directChildren = [...workspace.children];
    const contextIndex = directChildren.findIndex((child) => child.classList.contains("workspace-results-heading"));
    const judgmentIndex = directChildren.findIndex((child) => child.classList.contains("dochi-workspace__judgment"));
    const decisionIndex = directChildren.findIndex((child) => child.classList.contains("workspace-next-action"));
    expect(judgmentIndex).toBe(-1); // A completed result replaces the preparation pitch.
    expect(contextIndex).toBeLessThan(decisionIndex);
    openAnalysis("5-2");
    const decision = container.querySelector(".dochi-workspace__result");
    expect(decision.querySelector(".dochi-workspace__decision-tape")).toBeTruthy();
    expect(decision.querySelector(".dochi-workspace__result-action")).toBeTruthy();
    const details = decision.querySelector("[data-information-section]");
    expect(details).toBeTruthy();
    expect(details.tagName).toBe("SECTION");
  });

  it("automatically advances every baseline item after the first result commits", async () => {
    render(<AssistantWorkspace csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /분석하기/ }));
    // 큐는 setTimeout(0) 사슬로 한 건씩 넘어간다. 기준선은 5건인데 이 테스트는 완료
    // 4건을 기다리고 있어서, 5번째가 도는 중인 사슬 중간을 "다 끝났다"로 단언하고
    // 있었다 — DOM이 조금만 무거워지면 깨지는 자리다. 전건 완료(정착 상태)를 기다린
    // 뒤에 실행 표시가 사라졌는지 본다.
    await waitForAnalyses();
    expect(document.querySelectorAll(".workspace-card-evidence").length).toBeGreaterThan(1);
    expect(screen.queryByText("분석하기 중")).toBeNull();
  });

  it("gives every completed result the same workbook escape as the detail tools", async () => {
    // 발행 도구 20개는 ResultActionCard가 공통 XLSX를 제공하는데(product-ssot §5.5)
    // 도치 작업대만 결론 카드가 없어 탈출구가 통째로 빠져 있었다 — 도치로 들어온
    // 사람은 결과를 보고도 가져갈 방법이 없었다.
    render(<AssistantWorkspace csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /분석하기/ }));
    await waitForAnalyses();
    openAnalysis("5-2");

    const hubs = screen.getAllByRole("button", { name: "결과 받기" });
    expect(hubs.length).toBe(document.querySelectorAll(".dochi-workspace__result-status").length);
    expect(hubs.length).toBeGreaterThan(0);
  });

  it("keeps the workbook escape in English too", async () => {
    render(<AssistantWorkspace csvData={slice(undefined, completeRaw)} locale="en" getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Analyze data/ }));
    await waitForAnalyses();
    openAnalysis("5-2", "en");
    expect(screen.getAllByRole("button", { name: "Get results" }).length).toBeGreaterThan(0);
  });

  it("automatically starts only when the home Dochi handoff explicitly requests it", async () => {
    render(<AssistantWorkspace autoStart csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} onOpenTool={() => {}} />);
    await waitForAnalyses();
    openAnalysis("5-2");
    expect(screen.getAllByText("분석 결과").length).toBeGreaterThan(0);
  });

  it("shows only actual completed results in the embedded home view, with dashboard open first", async () => {
    const { container } = render(<AssistantWorkspace autoStart presentation="embedded" csvData={slice(undefined, completeRaw)} getTitle={(toolId) => toolId} />);
    const workspace = container.querySelector(".dochi-workspace--embedded");
    await waitFor(() => expect(workspace.querySelector(".dochi-workspace__embedded-result").tagName).toBe("SECTION"));
    expect(screen.queryByRole("button", { name: /분석 열기|그래도 열어 보기/ })).toBeNull();
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

  it("sends a design-confirmation analysis straight to its detailed tool without running it here", async () => {
    const onOpenTool = vi.fn();
    const data = {
      raw: experimentRaw,
      headers: ["numerator", "denominator", "is_control"],
      mapping: { numerator: "numerator", denominator: "denominator", is_control: "is_control" },
      fileName: "experiment.csv",
    };
    render(<AssistantWorkspace csvData={data} getTitle={(toolId) => toolId} onOpenTool={onOpenTool} />);
    openAnalysis("5-4");
    // 승인 단계 없이 상세 도구로 바로 보낸다 — 설계 확인은 도구 안에서 결과와 함께 한다.
    expect(screen.queryByRole("button", { name: /승인하고 상세 도구에서 계속/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /분석 열기/ }));
    await waitFor(() => expect(onOpenTool).toHaveBeenCalledWith("5-4", expect.anything()));
    expect(screen.queryByText("분석 결과")).toBeNull();
  });

  it("uses the natural-experiment handoff contract and never generates an incrementality number", async () => {
    const onOpenTool = vi.fn();
    render(<AssistantWorkspace csvData={slice(undefined, interruptionRaw)} getTitle={(toolId) => toolId} onOpenTool={onOpenTool} />);
    openAnalysis("5-23");
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
    fireEvent.click(screen.getByRole("button", { name: /분석하기/ }));
    await waitForAnalyses();
    openAnalysis("5-27");
    await waitFor(() => expect(screen.getAllByText("전체 조회→설치").length).toBeGreaterThan(0));
    const chart = screen.getByRole("img", { name: /전환율은 날짜와 유입 소스별로/ });
    expect(chart.getAttribute("viewBox")).toBe("0 0 640 240");
    expect(chart.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });
});
