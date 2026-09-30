// @vitest-environment jsdom
// 다운로드 설정(C)이 결과 카드의 내보내기 문맥으로 흘러가 Word·Excel·PNG·도구 항목이 같은 값을 읽는지.
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ResultActionCard from "./ResultActionCard";
import { useAnalysisExport } from "@/lib/analysis-export/AnalysisExportContext";
import { useAppStore } from "@/store/useDataStore";

function Probe() {
  const ctx = useAnalysisExport();
  return <output data-testid="probe">{JSON.stringify({ options: ctx?.exportOptions, name: ctx?.fileNameFor?.("보고서"), source: ctx?.figureContext?.source })}</output>;
}
const probe = () => JSON.parse(screen.getByTestId("probe").textContent);
const periods = [
  { id: "before", start: "2024-03-11", end: "2024-03-17" },
  { id: "after", start: "2024-03-18", end: "2024-03-24" },
];

describe("다운로드 설정 배선", () => {
  beforeEach(() => {
    delete window.IntersectionObserver;
    useAppStore.setState({ csvData: { raw: [{ a: 1 }], headers: ["a"], mapping: {}, fileName: "pvm.csv" }, decisionRecords: [], dashboardFilter: {} });
  });

  it("설정이 없으면 기존 동작(옵션 없음·기본 파일 이름)", () => {
    render(<ResultActionCard toolId="5-21" headline="CPI" analysisBasis={false} decisionReview={false} download={<Probe />} scopeEvidence={{ periods }} />);
    expect(probe().options).toBeNull();
    expect(probe().name).toBeNull();
  });

  it("설정을 넘기면 옵션과 결과 기간 기반 파일 이름이 문맥에 실린다", () => {
    render(<ResultActionCard toolId="5-21" headline="CPI" analysisBasis={false} decisionReview={false} download={<Probe />}
      scopeEvidence={{ periods }} exportOptions={{ pngHeader: "title", reportHidden: ["charts"], fileNamePattern: "toolPeriod" }} />);
    expect(probe().options).toEqual({ pngHeader: "title", reportHidden: ["charts"], fileNamePattern: "toolPeriod" });
    expect(probe().name).toMatch(/_20240311-20240324_보고서$/);
    // PNG 출처 줄에 쓸 파일 이름(예시 데이터가 아니면).
    expect(probe().source.fileName).toBe("pvm.csv");
  });
});
