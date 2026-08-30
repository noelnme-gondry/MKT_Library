import { describe, expect, it } from "vitest";
import { REPORT_SUPPORTED_TOOL_IDS, reportBlockFromResultCard, serializeReportDraft } from "./reportSchema";
import { ROUTES, isRoutePublished } from "@/lib/routeMap";
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
    expect(block.dataGroup).toBe("");
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

  it("공개 분석 도구 전체를 보고서 대상으로 파생한다", () => {
    const published = ROUTES.filter((route) => isRoutePublished(route) && (route.id.startsWith("5-") || route.id.startsWith("9-")));
    expect(published.length).toBeGreaterThan(4);
    for (const route of published) expect(REPORT_SUPPORTED_TOOL_IDS.has(route.id), route.id).toBe(true);
    // 미공개(preview)·비도구 라우트는 들어오지 않는다.
    expect(REPORT_SUPPORTED_TOOL_IDS.has("9-2")).toBe(false);
    expect(REPORT_SUPPORTED_TOOL_IDS.has("home")).toBe(false);
  });

  it("분석 서명이 없으면 블록을 만들지 않는다", () => {
    expect(reportBlockFromResultCard({ toolId: "5-4", headline: "판정 불가", inputSignature: "", locale: "ko" })).toBeNull();
  });

  it("금지된 원본 키가 있으면 내보내기를 중단한다", () => {
    expect(() => serializeReportDraft({ title: "x", blocks: [block], notes: [], raw: [{ secret: 1 }] })).toThrow("REPORT_FORBIDDEN_DATA");
  });

  it("Markdown 표 셀을 escape하고 같은 입력에서 동일 결과를 낸다", () => {
    const draft = serializeReportDraft({ title: "주간 | 보고", blocks: [{ ...block, stats: [{ label: "A\\|B", displayValue: "1" }] }], notes: [] });
    const first = renderReportMarkdown(draft, "ko");
    expect(first).toContain(String.raw`A\\\|B`);
    expect(renderReportMarkdown(draft, "ko")).toBe(first);
  });
});
