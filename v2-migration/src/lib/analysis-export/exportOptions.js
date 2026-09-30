// 다운로드 설정(docs/result-autonomy-spec.md — 2026-09-30 결정 C). 결과 카드의 내보내기 문맥
// (AnalysisExportContext)이 이 옵션을 들고 다니고, Word·Excel(DownloadHub)·PNG(FigurePngButton)가
// 같은 함수로 적용한다 — 도구는 옵션만 넘기면 된다.
//
//  - pngHeader: "full"(제목·기간·데이터 출처·사이트) | "title"(제목만) | "none"(없음)
//    판단 보류 경고는 어느 경우에도 지우지 않는다 — 그림만 떼어 공유될 때 가장 오해받기 쉬운 줄이다.
//  - reportHidden: 보고서에서 뺄 구획 ["stats","points","charts","tables"]
//    결론·분석 범위·방법은 보고서의 뼈대라 뺄 수 없다. 한계 문구는 별도 선택(includeCaveats).
//    Excel의 계산 표는 "원본·계산식" 워크북의 근거라 빼지 않는다(Word에서만 뺀다).
//  - fileNamePattern: "default" | "toolPeriod" | "projectToolPeriod" | "dateTool"

export const REPORT_SECTIONS = Object.freeze(["stats", "points", "charts", "tables"]);
export const PNG_HEADER_MODES = Object.freeze(["full", "title", "none"]);
export const FILE_NAME_PATTERNS = Object.freeze(["default", "toolPeriod", "projectToolPeriod", "dateTool"]);

export const DEFAULT_EXPORT_OPTIONS = Object.freeze({ pngHeader: "full", reportHidden: Object.freeze([]), fileNamePattern: "default" });

export function normalizeExportOptions(options = {}) {
  return {
    pngHeader: PNG_HEADER_MODES.includes(options?.pngHeader) ? options.pngHeader : "full",
    reportHidden: Array.isArray(options?.reportHidden) ? REPORT_SECTIONS.filter((section) => options.reportHidden.includes(section)) : [],
    fileNamePattern: FILE_NAME_PATTERNS.includes(options?.fileNamePattern) ? options.fileNamePattern : "default",
  };
}

/** kind: "docx" | "xlsx". 입력 payload는 바꾸지 않는다. */
export function applyReportSections(payload, options, kind) {
  const { reportHidden } = normalizeExportOptions(options);
  if (!reportHidden.length) return payload;
  const hide = new Set(reportHidden);
  return {
    ...payload,
    summary: {
      ...payload.summary,
      stats: hide.has("stats") ? [] : payload.summary.stats,
      points: hide.has("points") ? [] : payload.summary.points,
    },
    charts: hide.has("charts") ? [] : payload.charts,
    calculationTables: kind === "docx" && hide.has("tables") ? [] : payload.calculationTables,
  };
}

/** PNG 머리글의 데이터 출처 줄. 예시 데이터는 figureExportContext가 따로 말하므로 비운다. */
export function figureSourceLine(fileName, locale = "ko") {
  if (!fileName) return "";
  return locale === "en" ? `Data: ${fileName}` : `데이터: ${fileName}`;
}

/**
 * PNG 머리글. metadata = figureExportContext() 결과 + mandatory(지울 수 없는 줄 — 판단 보류 경고)
 * + sourceLine(데이터 출처). figureHeaderLayout은 title이 비면 머리글을 그리지 않는다.
 */
export function figureHeaderFor(metadata, options, { sourceLine = "", siteLine = "growthoptplaybook.com" } = {}) {
  const { pngHeader } = normalizeExportOptions(options);
  const mandatory = metadata?.mandatory || [];
  if (pngHeader === "full") {
    return { title: metadata.title, details: [...(metadata.details || []), sourceLine, siteLine].filter(Boolean) };
  }
  if (pngHeader === "title" || mandatory.length) return { title: metadata.title, details: [...mandatory] };
  return { title: "", details: [] };
}

function safePart(value) {
  return String(value ?? "").normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
}

function compactDate(iso) {
  return /^\d{4}-\d{2}-\d{2}/.test(String(iso ?? "")) ? String(iso).slice(0, 10).replaceAll("-", "") : "";
}

/**
 * 파일 이름(확장자 없이). default면 null — 호출부가 기존 이름을 쓴다(기존 파일 이름 byte-동일).
 * 기간은 분석이 실제로 쓴 기간만(다운로드 날짜로 대신하지 않는다, §7 디자인 기준). 없으면 그 칸을 뺀다.
 */
export function buildExportFileName(options, { toolTitle = "", toolId = "", period = null, projectName = "", now = new Date(), kind = "" } = {}) {
  const { fileNamePattern } = normalizeExportOptions(options);
  if (fileNamePattern === "default") return null;
  const tool = safePart(toolTitle) || safePart(toolId) || "analysis";
  const range = period?.start || period?.end
    ? [compactDate(period.start), compactDate(period.end)].filter(Boolean).join("-")
    : "";
  const today = compactDate(now.toISOString());
  const parts = {
    toolPeriod: [tool, range],
    projectToolPeriod: [safePart(projectName), tool, range],
    dateTool: [today, tool],
  }[fileNamePattern];
  return [...parts, safePart(kind)].filter(Boolean).join("_") || null;
}
