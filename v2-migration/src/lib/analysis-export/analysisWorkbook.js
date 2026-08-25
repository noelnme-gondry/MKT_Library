import * as XLSX from "xlsx";

export const ANALYSIS_WORKBOOK_SHEETS = Object.freeze([
  "00_README",
  "01_SUMMARY",
  "02_RAW_DATA",
  "03_MAPPING",
  "04_SCOPE",
  "05_CALCULATIONS",
  "06_ENGINE_OUTPUT",
  "07_RESULTS",
  "08_METHOD_LIMITS",
]);

const MAX_EXCEL_ROWS = 1_048_576;
const MAX_EXCEL_COLUMNS = 16_384;

function tx(locale, ko, en) {
  return locale === "en" ? en : ko;
}

function asText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function textCell(value) {
  return { t: "s", v: asText(value) };
}

function primitiveCell(value) {
  if (typeof value === "number" && Number.isFinite(value)) return { t: "n", v: value };
  if (typeof value === "boolean") return { t: "b", v: value };
  // 원본의 =/+/-/@ 시작 문자열도 공유문자열로 고정한다. 수식으로 승격하지 않는다.
  return textCell(value);
}

function isSafeInternalFormula(value) {
  const formula = asText(value);
  if (!formula.startsWith("=") || formula.length > 512) return false;
  if (/[\[\]{};\\]/.test(formula) || /(?:https?:|file:|dde)/i.test(formula)) return false;
  const remainder = formula.slice(1)
    .replace(/'(?:[^']|''){1,31}'!/g, "")
    .replace(/""/g, "")
    .replace(/\b(?:IF|AND|OR|IFERROR|ABS|COUNTA|COUNT|MAX|MIN|SUM|SUMIFS|AVERAGE|SUMPRODUCT|INDEX|MATCH|VALUE|SUBSTITUTE)\b/g, "")
    .replace(/\$?[A-Z]{1,3}:\$?[A-Z]{1,3}/g, "")
    .replace(/\$?[A-Z]{1,3}\$?\d+/g, "")
    .replace(/-?\d+(?:\.\d+)?/g, "")
    .replace(/[+\-*/().,: <>=]/g, "");
  return remainder === "";
}

function formulaCell(value, numberFormat) {
  const formula = asText(value).replace(/^=/, "");
  const cell = { t: "n", f: formula };
  if (numberFormat) cell.z = numberFormat;
  return cell;
}

function trustedFormulaAt(table, rowIndex, columnIndex, value) {
  if (value && typeof value === "object" && !Array.isArray(value) && typeof value.formula === "string") {
    return isSafeInternalFormula(value.formula)
      ? formulaCell(value.formula, value.numberFormat)
      : textCell(value.formula);
  }
  const isRuleMatch = (table.formulaRules || []).some((rule) => (
    table.rows[rowIndex]?.[rule.whenColumn] === rule.equals && rule.columns.includes(columnIndex)
  ));
  return isRuleMatch && isSafeInternalFormula(value) ? formulaCell(value) : primitiveCell(value);
}

function sheetFromRows(rows, { table = null, autoFilter = true } = {}) {
  const safeRows = Array.isArray(rows) && rows.length ? rows : [[""]];
  const sheet = {};
  let maxColumn = 0;
  safeRows.forEach((row, rowIndex) => {
    const cells = Array.isArray(row) ? row : [];
    maxColumn = Math.max(maxColumn, cells.length - 1);
    cells.forEach((value, columnIndex) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      sheet[address] = table
        ? trustedFormulaAt(table, rowIndex, columnIndex, value)
        : primitiveCell(value);
    });
  });
  sheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: safeRows.length - 1, c: maxColumn } });
  const sample = safeRows.slice(0, 200);
  sheet["!cols"] = Array.from({ length: maxColumn + 1 }, (_, columnIndex) => {
    const width = sample.reduce((current, row) => Math.max(current, asText(row?.[columnIndex]).length), 8);
    return { wch: Math.min(Math.max(width + 2, 10), 42) };
  });
  if (autoFilter && safeRows.length > 1 && maxColumn > 0) {
    sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: safeRows.length - 1, c: maxColumn } }) };
  }
  return sheet;
}

function safeSheetName(name, used) {
  const base = asText(name).replace(/[\\/?*\[\]:'!]/g, "_").slice(0, 31) || "CALCULATION";
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    const suffix = `_${index}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function appendSheet(workbook, name, rows, options = {}) {
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(rows, options), name);
}

function singleMetricValue(displayValue) {
  const raw = asText(displayValue).trim();
  if (!raw || raw === "—" || /(?:~|\bto\b)/i.test(raw)) return null;
  const matches = raw.match(/[+−-]?\d[\d,]*(?:\.\d+)?/g) || [];
  if (matches.length !== 1) return null;
  const parsed = Number(matches[0].replace(/−/g, "-").replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  if (raw.includes("%")) return { value: parsed / 100, numberFormat: "0.0%" };
  const decimals = (matches[0].split(".")[1] || "").length;
  return { value: parsed, numberFormat: decimals ? `#,##0.${"0".repeat(Math.min(decimals, 4))}` : "#,##0" };
}

function readmeRows(payload, customNames) {
  const { locale, calculationMode } = payload;
  const isExact = calculationMode === "exact_after_preprocessing";
  return [
    [tx(locale, "분석 결과 상세 워크북", "Detailed analysis workbook"), payload.toolTitle],
    [tx(locale, "도구 ID", "Tool ID"), payload.toolId],
    [tx(locale, "생성 시각", "Generated at"), payload.generatedAt || tx(locale, "다운로드 시점", "Download time")],
    [tx(locale, "원본 파일", "Source file"), payload.source.fileName || tx(locale, "수동 입력 또는 파일명 없음", "Manual input or unnamed source")],
    [tx(locale, "계산 구분", "Calculation mode"), isExact
      ? tx(locale, "전처리 이후 수식 재계산", "Formula-recalculable after preprocessing")
      : tx(locale, "엔진 출력 + 살아 있는 후속 수식", "Engine output + live downstream formulas")],
    ["", ""],
    [tx(locale, "읽는 순서", "Reading order"), ANALYSIS_WORKBOOK_SHEETS.join(" → ")],
    [tx(locale, "원본 데이터", "Raw data"), tx(locale, "02_RAW_DATA에 업로드 원본 전체가 들어 있습니다.", "02_RAW_DATA contains the complete uploaded source.")],
    [tx(locale, "매핑", "Mapping"), tx(locale, "03_MAPPING에서 원본 열과 분석 표준 필드 연결을 확인합니다.", "03_MAPPING shows how source columns map to analysis fields.")],
    [tx(locale, "수식", "Formulas"), tx(locale, "05_CALCULATIONS와 추가 계산 시트의 수식은 입력 또는 엔진 출력 셀을 참조합니다.", "Formulas in 05_CALCULATIONS and extra calculation sheets reference inputs or engine-output cells.")],
    [tx(locale, "주의", "Important"), isExact
      ? tx(locale, "전처리·그룹 목록은 브라우저 분석 시점의 스냅샷입니다. 원본만 바꾸면 자동 재매핑되지 않으며 계산 입력 셀을 바꿔야 합니다.", "Preprocessing and group lists are browser snapshots. Editing only the raw sheet does not remap automatically; edit the calculation-input cells instead.")
      : tx(locale, "원본만 바꿔도 통계 모델이 재학습되지는 않습니다. 데이터를 바꾼 경우 사이트에서 다시 분석한 뒤 새 워크북을 받으세요.", "Editing the raw sheet does not refit the statistical model. Re-run the analysis on the site and export a new workbook after changing data.")],
    [tx(locale, "개인정보", "Privacy"), tx(locale, "이 파일은 브라우저에서 생성됩니다. 원본 행은 내보내기 과정에서 서버로 전송되지 않습니다.", "This file is generated in the browser. Raw rows are not sent to a server during export.")],
    [tx(locale, "추가 계산 시트", "Additional calculation sheets"), customNames.join(", ") || tx(locale, "없음", "None")],
    [tx(locale, "출처", "Source"), "Growth Opt Playbook — https://growthoptplaybook.com"],
  ];
}

function summaryRows(payload) {
  const { locale, summary } = payload;
  return [
    [tx(locale, "구분", "Section"), tx(locale, "항목", "Item"), tx(locale, "내용", "Content"), tx(locale, "보충", "Detail")],
    [tx(locale, "결론", "Conclusion"), payload.toolTitle, summary.headline, ""],
    ...summary.stats.map((stat) => [tx(locale, "핵심 수치", "Key figure"), stat.label, stat.value, stat.detail]),
    ...summary.points.map((point) => [tx(locale, "근거·다음 확인", "Evidence / next check"), point.label, point.text, point.detail]),
  ];
}

function rawRows(payload) {
  const headers = payload.source.headers;
  return [
    ["_source_row", ...headers],
    ...payload.source.rows.map((row, index) => [index + 1, ...headers.map((header) => row?.[header] ?? "")]),
  ];
}

function mappingRows(payload) {
  const { locale } = payload;
  return [
    [tx(locale, "원본 열", "Source column"), tx(locale, "표준 필드", "Canonical field"), tx(locale, "분석 사용", "Used in analysis")],
    ...payload.source.headers.map((header) => {
      const mapped = asText(payload.source.mapping?.[header]);
      return [header, mapped || tx(locale, "미매핑", "Unmapped"), mapped && mapped !== "__ignore__" ? tx(locale, "예", "Yes") : tx(locale, "아니오", "No")];
    }),
  ];
}

function scopeRows(payload) {
  const entries = Object.entries(payload.scope);
  return [
    [tx(payload.locale, "범위", "Scope"), tx(payload.locale, "값", "Value")],
    ...(entries.length ? entries : [[tx(payload.locale, "별도 필터 없음", "No explicit filters"), "—"]])
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(" | ") : value]),
  ];
}

function calculationRows(payload, customTables) {
  const { locale } = payload;
  const rawEnd = Math.max(2, payload.source.rows.length + 1);
  const rows = [
    [tx(locale, "검사 항목", "Audit item"), tx(locale, "대상", "Target"), tx(locale, "수식 결과", "Formula result"), tx(locale, "설명", "Description")],
    [tx(locale, "원본 행 수", "Raw row count"), "02_RAW_DATA", { formula: payload.source.rows.length ? `=MAX('02_RAW_DATA'!A2:A${rawEnd})` : "=0" }, tx(locale, "원본 시트의 행 번호 최댓값", "Maximum source-row index")],
  ];
  payload.source.headers.forEach((header, index) => {
    const column = XLSX.utils.encode_col(index + 1);
    rows.push([
      tx(locale, "비어 있지 않은 셀", "Non-empty cells"),
      header,
      { formula: `=COUNTA('02_RAW_DATA'!${column}2:${column}${rawEnd})` },
      asText(payload.source.mapping?.[header]) || tx(locale, "미매핑", "Unmapped"),
    ]);
  });
  customTables.forEach((table) => rows.push([
    tx(locale, "추가 계산 시트", "Additional calculation sheet"),
    table.resolvedName,
    { formula: `=COUNTA('${table.resolvedName}'!A1:A${Math.max(1, table.rows.length)})` },
    tx(locale, "제목·빈 셀을 포함한 A열 비어 있지 않은 셀 수", "Non-empty cells in column A, including headers"),
  ]));
  return rows;
}

function engineOutputRows(payload) {
  const { locale } = payload;
  return [
    [tx(locale, "지표", "Metric"), tx(locale, "화면 표시값", "Displayed value"), tx(locale, "숫자값", "Numeric value"), tx(locale, "보충", "Detail"), tx(locale, "출처", "Source")],
    ...payload.summary.stats.map((stat) => {
      const numeric = singleMetricValue(stat.value);
      return [stat.label, stat.value, numeric?.value ?? "", stat.detail, tx(locale, "브라우저 분석 엔진", "Browser analysis engine")];
    }),
  ];
}

function resultRows(payload) {
  const { locale } = payload;
  return [
    [tx(locale, "지표", "Metric"), tx(locale, "수식 연결값", "Formula-linked value"), tx(locale, "보충", "Detail"), tx(locale, "계산 구분", "Calculation mode")],
    ...payload.summary.stats.map((stat, index) => {
      const engineRow = index + 2;
      const numeric = singleMetricValue(stat.value);
      return [
        stat.label,
        { formula: numeric ? `='06_ENGINE_OUTPUT'!C${engineRow}` : `='06_ENGINE_OUTPUT'!B${engineRow}`, numberFormat: numeric?.numberFormat },
        { formula: `='06_ENGINE_OUTPUT'!D${engineRow}` },
        payload.calculationMode,
      ];
    }),
  ];
}

function methodRows(payload, customTables) {
  const { locale, method } = payload;
  const modeNote = payload.calculationMode === "exact_after_preprocessing"
    ? tx(locale, "전처리된 계산 입력 이후의 결과를 워크북 수식으로 재현합니다. 원본 시트만 수정하면 매핑·전처리는 갱신되지 않습니다.", "Workbook formulas reproduce results after the preprocessed calculation inputs. Editing only the raw sheet does not refresh mapping or preprocessing.")
    : tx(locale, "복잡한 적합·추정은 브라우저 엔진 출력입니다. 이후 비율·차이·표·차트용 값은 수식으로 연결됩니다.", "Complex fitting and estimation come from the browser engine. Downstream ratios, differences, tables, and chart values are formula-linked.");
  return [
    [tx(locale, "구분", "Type"), tx(locale, "내용", "Content")],
    [tx(locale, "방법", "Method"), method.name || payload.analysisType],
    [tx(locale, "엔진", "Engine"), method.engine || "browser"],
    [tx(locale, "버전", "Version"), method.version || "—"],
    [tx(locale, "수식 경계", "Formula boundary"), modeNote],
    ...method.assumptions.map((item) => [tx(locale, "가정", "Assumption"), item]),
    ...method.limitations.map((item) => [tx(locale, "한계", "Limitation"), item]),
    ...customTables.map((table) => [tx(locale, "계산 시트", "Calculation sheet"), `${table.resolvedName}${table.note ? ` · ${table.note}` : ""}`]),
    [tx(locale, "결과 상태", "Result state"), payload.resultState],
    [tx(locale, "실행 정보", "Run details"), payload.manifest ? JSON.stringify(payload.manifest) : tx(locale, "제공되지 않음", "Not provided")],
  ];
}

export function buildAnalysisWorkbook(payload = {}) {
  const rows = payload.source?.rows || [];
  const headers = payload.source?.headers || [];
  if (rows.length + 1 > MAX_EXCEL_ROWS) throw new Error("WORKBOOK_TOO_MANY_ROWS");
  if (headers.length + 1 > MAX_EXCEL_COLUMNS) throw new Error("WORKBOOK_TOO_MANY_COLUMNS");

  const workbook = XLSX.utils.book_new();
  const usedNames = new Set(ANALYSIS_WORKBOOK_SHEETS);
  const customTables = (payload.calculationTables || []).map((table) => ({
    ...table,
    resolvedName: safeSheetName(table.name, usedNames),
  }));
  const customNames = customTables.map((table) => table.resolvedName);

  appendSheet(workbook, "00_README", readmeRows(payload, customNames), { autoFilter: false });
  appendSheet(workbook, "01_SUMMARY", summaryRows(payload));
  appendSheet(workbook, "02_RAW_DATA", rawRows(payload));
  appendSheet(workbook, "03_MAPPING", mappingRows(payload));
  appendSheet(workbook, "04_SCOPE", scopeRows(payload));
  const auditRows = calculationRows(payload, customTables);
  appendSheet(workbook, "05_CALCULATIONS", auditRows, { table: { rows: auditRows, formulaRules: [] } });
  appendSheet(workbook, "06_ENGINE_OUTPUT", engineOutputRows(payload));
  appendSheet(workbook, "07_RESULTS", resultRows(payload), { table: { rows: resultRows(payload), formulaRules: [] } });
  appendSheet(workbook, "08_METHOD_LIMITS", methodRows(payload, customTables), { autoFilter: false });
  customTables.forEach((table) => appendSheet(workbook, table.resolvedName, table.rows, { table }));

  workbook.Props = {
    Title: `${payload.toolTitle || payload.toolId || "Analysis"} — detailed analysis workbook`,
    Subject: "Client-side analysis result audit workbook",
    Author: "Growth Opt Playbook",
    Company: "Growth Opt Playbook",
  };
  workbook.Workbook = {
    ...(workbook.Workbook || {}),
    CalcPr: { calcMode: "auto", fullCalcOnLoad: true, forceFullCalc: true },
  };
  return workbook;
}

export function writeAnalysisWorkbook(payload = {}) {
  return XLSX.write(buildAnalysisWorkbook(payload), {
    bookType: "xlsx",
    type: "array",
    compression: true,
    cellStyles: true,
  });
}
