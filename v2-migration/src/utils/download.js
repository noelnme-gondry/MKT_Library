// 공용 파일 다운로드 헬퍼 — 도구마다 재정의하던 blob 다운로드 로직을 단일화한다
// (DownloadHub와 짝). CSV는 항상 BOM+CRLF+charset=utf-8(§7 Excel 한 행 뭉침·한글
// 깨짐 방지). 표시/입출력 헬퍼라 utils에 둠(수학 아님).
import { parseNumericStrict } from "./parseNumeric";

export function downloadFile(blob, fileName) {
  if (typeof document === "undefined") return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

// 날짜 접미 파일명(YYYY-MM-DD). Date.now 금지 규칙과 무관(다운로드는 사용자 액션
// 시점 표기 목적 — 결정론 골든 대상 아님).
function withDate(base, ext) {
  const ts = new Date().toISOString().slice(0, 10);
  return `${base}_${ts}.${ext}`;
}

const TRUSTED_CSV_FORMULA = Symbol("trustedCsvFormula");

// PVM처럼 앱이 직접 만든 산술 수식만 명시적으로 허용한다. 외부 텍스트에는 쓰지 않는다.
export function trustedCsvFormula(formula) {
  if (!/^=[A-Z0-9+$^*/().,:\s-]+$/.test(formula)
    || [...formula.matchAll(/([A-Z]+)\(/g)].some(([, name]) => !["LN", "MIN", "MAX", "SUM"].includes(name))) {
    throw new TypeError("Only internal arithmetic CSV formulas are supported.");
  }
  return { [TRUSTED_CSV_FORMULA]: formula };
}

export function csvText(value, { allowNumericText = true } = {}) {
  let text = value == null ? "" : String(value);
  if (value?.[TRUSTED_CSV_FORMULA]) {
    text = value[TRUSTED_CSV_FORMULA];
  } else if (typeof value !== "number") {
    // 따옴표는 열 경계만 보호한다. 공백/제어문자 뒤 또는 전각 수식 시작도 텍스트로 둔다.
    const normalized = text.normalize("NFKC");
    const isNumericText = allowNumericText && parseNumericStrict(text) != null;
    if ((!isNumericText && /^[\s\u0000-\u001f]*[=+@-]/.test(normalized)) || /^[\t\r\n]/.test(text)) {
      text = `'${text}`;
    }
  }
  return text;
}

export function csvCell(value, { quoteAll = false } = {}) {
  const text = csvText(value);
  return quoteAll || /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// 헤더+행 → 스프레드시트용 RFC4180 CSV 본문. 공용 셀 직렬화가 수식 주입도 막는다.
// 재가져오기용 CSV는 보호된 필드를 명시해 원문을 복원한다(storeEvents).
// 세 형식 함정을 한 곳에서 막는다(§7):
//  ① `\n` 조인은 Excel에서 한 행으로 뭉친다 → CRLF
//  ② BOM이 없으면 한글이 깨진다
//  ③ 값에 콤마·따옴표·줄바꿈이 있으면 열이 밀린다 → 따옴표 감싸고 " 이스케이프
// 도구마다 이 조립을 다시 쓰면 셋 중 하나를 빠뜨린다.
export function csvBody(header, rows, options) {
  const cell = value => csvCell(value, options);
  const lines = [header.map(cell).join(","), ...rows.map((row) => row.map(cell).join(","))];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

const CSV_ESCAPED_FIELDS = "gop_escaped_fields_v1";

// 재업로드 CSV는 실제 보호한 열만 기록한다. 원래 작은따옴표로 시작한 문구와 구별한다.
export function reimportableCsvBody(header, rows, options) {
  const escaped = rows.map(row => header.filter((field, index) => {
    const value = row[index];
    return typeof value === "string" && csvText(value) !== value;
  }).join("|"));
  if (!escaped.some(Boolean)) return csvBody(header, rows, options);
  return csvBody([...header, CSV_ESCAPED_FIELDS], rows.map((row, index) => [...row, escaped[index]]), options);
}

export function restoreCsvRecord(row, allowedFields) {
  if (!row || typeof row !== "object") return row;
  const fields = String(row[CSV_ESCAPED_FIELDS] || "").split("|");
  const restored = { ...row };
  for (const field of allowedFields) {
    const value = row[field];
    if (fields.includes(field) && typeof value === "string" && value.startsWith("'")
      && csvText(value.slice(1)) === value) restored[field] = value.slice(1);
  }
  delete restored[CSV_ESCAPED_FIELDS];
  return restored;
}

// CSV 문자열(이미 BOM/CRLF 포함 가능)을 그대로 저장. 호출자가 BOM을 안 넣었어도
// 안전하게 저장되도록 charset 지정.
export function downloadCsv(csvString, baseName = "export") {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
  return downloadFile(blob, withDate(baseName, "csv"));
}

export function downloadXlsx(arrayBuffer, baseName = "export", { dated = true } = {}) {
  const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  // 사용자가 파일 이름 규칙을 고른 경우(dated:false)에는 그 이름을 그대로 쓴다.
  return downloadFile(blob, dated ? withDate(baseName, "xlsx") : `${baseName}.xlsx`);
}

// 사내에 도는 파일이 곧 유통 경로다. 텍스트·마크다운 산출물 끝에 출처 한 줄을 남긴다.
// CSV·XLSX에는 붙이지 않는다 — 데이터 행으로 섞여 파싱을 깨뜨린다.
const ATTRIBUTION = {
  ko: "생성: Growth Opt Playbook — https://growthoptplaybook.com",
  en: "Generated with Growth Opt Playbook — https://growthoptplaybook.com",
};

export function withAttribution(textString, locale = "ko") {
  const text = String(textString ?? "");
  const line = ATTRIBUTION[locale === "en" ? "en" : "ko"];
  const hasAttribution = text.split(/\r?\n/).some((candidate) => candidate.trim() === line);
  if (hasAttribution) return text;
  return `${text.replace(/\s+$/, "")}\n\n---\n${line}\n`;
}

// 마크다운/텍스트 문서 저장(claude-ux §6 "상세 문서 받기" 탈출구용).
export function downloadText(textString, baseName = "summary", ext = "md", locale = "ko") {
  const blob = new Blob([withAttribution(textString, locale)], { type: "text/plain;charset=utf-8" });
  return downloadFile(blob, withDate(baseName, ext));
}

export function downloadCalendar(calendarString, baseName = "decision_review") {
  const blob = new Blob([calendarString], { type: "text/calendar;charset=utf-8" });
  return downloadFile(blob, withDate(baseName, "ics"));
}

export function downloadJson(value, baseName = "result-manifest", ext = "json") {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  return downloadFile(blob, withDate(baseName, ext));
}
