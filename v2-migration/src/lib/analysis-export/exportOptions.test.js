import { describe, expect, it } from "vitest";
import { figureExportContext } from "@/utils/figureExportContext";
import { COMMON_WORDS } from "@/lib/vocabulary/commonWords";
import {
  REPORT_SECTIONS,
  applyReportSections,
  buildExportFileName,
  figureHeaderFor,
  figureSourceLine,
  normalizeExportOptions,
} from "./exportOptions";

const payload = () => ({
  toolId: "5-21",
  summary: { headline: "CPI 1,450 → 1,502", stats: [{ label: "전체 변화", value: "+52" }], points: [{ label: "다음 행동", text: "점검" }] },
  charts: [{ title: "c" }],
  calculationTables: [{ name: "PVM", rows: [] }],
  method: { limitations: ["인과 아님"] },
});

describe("보고서 구획", () => {
  it("설정이 없으면 payload를 그대로 돌려준다(기존 파일 byte-동일)", () => {
    const input = payload();
    expect(applyReportSections(input, null, "docx")).toBe(input);
  });

  it("고른 구획만 빠지고 결론·방법은 남는다", () => {
    const out = applyReportSections(payload(), { reportHidden: ["stats", "charts"] }, "docx");
    expect(out.summary.stats).toEqual([]);
    expect(out.charts).toEqual([]);
    expect(out.summary.points).toHaveLength(1);
    expect(out.summary.headline).toBe("CPI 1,450 → 1,502");
    expect(out.method.limitations).toEqual(["인과 아님"]);
  });

  it("계산 표는 Word에서만 뺀다 — Excel 워크북의 근거", () => {
    expect(applyReportSections(payload(), { reportHidden: ["tables"] }, "docx").calculationTables).toEqual([]);
    expect(applyReportSections(payload(), { reportHidden: ["tables"] }, "xlsx").calculationTables).toHaveLength(1);
  });

  it("모르는 값은 기본값으로", () => {
    expect(normalizeExportOptions({ pngHeader: "x", reportHidden: ["stats", "nope"], fileNamePattern: "?" })).toEqual({ pngHeader: "full", reportHidden: ["stats"], fileNamePattern: "default" });
  });

  it("보고서 구획 단어는 선언된 구획을 빠짐없이 가리킨다", () => {
    const word = COMMON_WORDS.find((entry) => entry.id === "export.report.hide");
    expect(word.expand({}).map((params) => params.section).sort()).toEqual([...REPORT_SECTIONS].sort());
  });
});

describe("PNG 머리글", () => {
  const base = (resultState = "ready", importSource = "csv") => figureExportContext({
    title: "CPI 변화의 구성", toolTitle: "캠페인 성과 변동", scope: { dateStart: "2024-03-18", dateEnd: "2024-03-24" }, resultState, source: { importSource },
  });

  it("기본(제목·기간·출처)은 데이터 출처와 사이트 줄을 더한다", () => {
    expect(figureHeaderFor(base(), null, { sourceLine: figureSourceLine("pvm.csv") }).details).toEqual([
      "캠페인 성과 변동", "분석 기간: 2024-03-18 – 2024-03-24", "데이터: pvm.csv", "growthoptplaybook.com",
    ]);
  });

  it("제목만 / 없음", () => {
    expect(figureHeaderFor(base(), { pngHeader: "title" })).toEqual({ title: "CPI 변화의 구성", details: [] });
    expect(figureHeaderFor(base(), { pngHeader: "none" })).toEqual({ title: "", details: [] });
  });

  it("판단 보류·예시 데이터는 머리글을 빼도 남는다", () => {
    expect(figureHeaderFor(base("inconclusive", "demo"), { pngHeader: "none" })).toEqual({
      title: "CPI 변화의 구성", details: ["예시 데이터", "판단 보류. 결과의 해석 조건을 함께 확인하세요."],
    });
  });
});

describe("파일 이름", () => {
  const input = { toolTitle: "캠페인 성과 변동", toolId: "5-21", period: { start: "2024-03-11", end: "2024-03-24" }, projectName: "우리 앱/iOS", now: new Date("2026-09-30T03:00:00Z") };

  it("기본은 null — 호출부가 기존 이름을 쓴다", () => {
    expect(buildExportFileName(null, input)).toBeNull();
    expect(buildExportFileName({ fileNamePattern: "default" }, input)).toBeNull();
  });

  it.each([
    ["toolPeriod", "캠페인_성과_변동_20240311-20240324_보고서"],
    ["projectToolPeriod", "우리_앱iOS_캠페인_성과_변동_20240311-20240324_보고서"],
    ["dateTool", "20260930_캠페인_성과_변동_보고서"],
  ])("%s", (pattern, expected) => {
    expect(buildExportFileName({ fileNamePattern: pattern }, { ...input, kind: "보고서" })).toBe(expected);
  });

  it("기간을 모르면 다운로드 날짜로 대신하지 않고 그 칸을 뺀다", () => {
    expect(buildExportFileName({ fileNamePattern: "toolPeriod" }, { ...input, period: null, kind: "x" })).toBe("캠페인_성과_변동_x");
  });

  it("파일 시스템 금지 문자는 지운다", () => {
    expect(buildExportFileName({ fileNamePattern: "toolPeriod" }, { ...input, toolTitle: 'a<b>:c"d?', period: null })).toBe("abcd");
  });
});
