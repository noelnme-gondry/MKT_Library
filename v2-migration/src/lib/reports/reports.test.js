import { describe, expect, it } from "vitest";
import { reportBlockFromResultCard, serializeReportDraft } from "./reportSchema";
import { renderReportMarkdown } from "./renderMarkdown";

describe("weekly report contract", () => {
  const block = reportBlockFromResultCard({
    toolId: "5-21",
    toolTitle: "성과 변동 탐지",
    headline: "CPA 상승은 Google이 주도했습니다",
    points: [{ text: "Google 소재를 점검하세요" }],
    stats: [{ label: "CPA 변화", value: "+₩2,000" }],
    inputSignature: "sig",
    locale: "ko",
  });

  it("표시 결과를 구조화 블록으로 만든다", () => {
    expect(block.blockKind).toBe("summary");
    expect(block.stats[0].displayValue).toBe("+₩2,000");
  });

  it("구조화된 화면 근거의 라벨·대상·수치를 함께 보존한다", () => {
    const structured = reportBlockFromResultCard({
      toolId: "5-21",
      toolTitle: "성과 변동 탐지",
      headline: "Meta가 변화를 주도했습니다",
      points: [{ label: "효율 최대 영향", text: "Meta", detail: "CPI +₩22.6" }],
      stats: [],
      inputSignature: "structured",
      locale: "ko",
    });
    expect(structured.points[0]).toBe("효율 최대 영향 · Meta · CPI +₩22.6");
  });

  it("금지된 원본 키가 있으면 내보내기를 중단한다", () => {
    expect(() => serializeReportDraft({ title: "x", blocks: [block], notes: [], raw: [{ secret: 1 }] })).toThrow("REPORT_FORBIDDEN_DATA");
  });

  it("Markdown 표 셀을 escape하고 같은 입력에서 동일 결과를 낸다", () => {
    const draft = serializeReportDraft({ title: "주간 | 보고", blocks: [{ ...block, stats: [{ label: "A|B", displayValue: "1" }] }], notes: [] });
    const first = renderReportMarkdown(draft, "ko");
    expect(first).toContain("A\\|B");
    expect(renderReportMarkdown(draft, "ko")).toBe(first);
  });
});
