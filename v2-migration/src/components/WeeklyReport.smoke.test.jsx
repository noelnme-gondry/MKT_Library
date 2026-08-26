import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import WeeklyReport from "./WeeklyReport";
import { useAppStore } from "@/store/useDataStore";

describe("WeeklyReport", () => {
  beforeEach(() => useAppStore.setState({
    reportDraft: { schemaVersion: 1, title: "", period: null, blocks: [], notes: [] },
  }));

  it("KR 빈 상태와 원본 비저장 안내를 렌더한다", () => {
    render(<WeeklyReport />);
    expect(screen.getByRole("heading", { name: "분석 결론을 한 장의 주간 보고서로" })).toBeTruthy();
    expect(screen.getByText(/원본 데이터는 저장하거나 내보내지 않습니다/)).toBeTruthy();
    expect(screen.getByLabelText("시작일")).toBeTruthy();
    expect(screen.getByLabelText("종료일")).toBeTruthy();
    expect(screen.getByRole("button", { name: "XLSX 받기" })).toBeTruthy();
  });

  it("EN 수집 블록을 렌더한다", () => {
    const varianceCsv = {
      raw: [{ Date: "2026-08-01", Cost: "100", Installs: "10" }],
      headers: ["Date", "Cost", "Installs"],
      mapping: { Date: "date", Cost: "cost", Installs: "installs" },
      fileName: "variance.csv",
    };
    const activeCsv = { raw: [{ Date: "2026-08-01" }], headers: ["Date"], mapping: { Date: "date" }, fileName: "other.csv" };
    const signature = "variance.csv|1|cost:Cost|date:Date|installs:Installs";
    useAppStore.setState({
      csvData: activeCsv,
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: varianceCsv },
      reportDraft: {
        schemaVersion: 1,
        title: "Weekly",
        period: null,
        notes: [],
        blocks: [{
          schemaVersion: 1,
          id: "b1",
          toolId: "5-21",
          toolTitle: "Campaign Variance",
          dataGroup: "efficiency",
          blockKind: "summary",
          headline: "CPA increased",
          points: [],
          stats: [],
          scope: {},
          inputSignature: signature,
          locale: "en",
        }],
      },
    });
    render(<WeeklyReport locale="en" />);
    expect(screen.getByText("CPA increased")).toBeTruthy();
    expect(screen.queryByText("This result was created from an earlier data input.")).toBeNull();
    expect(document.querySelectorAll("main h1")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Download XLSX" })).toBeTruthy();
  });

  it("서로 다른 분석 기간을 수집하면 공유 전 경고한다", () => {
    useAppStore.setState({
      reportDraft: {
        schemaVersion: 1,
        title: "",
        period: null,
        notes: [],
        blocks: [
          { schemaVersion: 1, id: "a", toolId: "5-2", toolTitle: "Dashboard", headline: "A", points: [], stats: [], scope: { dateStart: "2026-08-01", dateEnd: "2026-08-07" }, inputSignature: "a" },
          { schemaVersion: 1, id: "b", toolId: "5-21", toolTitle: "PVM", headline: "B", points: [], stats: [], scope: { dateStart: "2026-08-08", dateEnd: "2026-08-14" }, inputSignature: "b" },
        ],
      },
    });
    render(<WeeklyReport />);
    expect(screen.getByRole("status").textContent).toContain("수집한 결과의 분석 기간이 서로 다릅니다");
  });
});
