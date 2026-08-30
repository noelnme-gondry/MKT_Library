// 공용 파일 다운로드 헬퍼 — 도구마다 재정의하던 blob 다운로드 로직을 단일화한다
// (DownloadHub와 짝). CSV는 항상 BOM+CRLF+charset=utf-8(§7 Excel 한 행 뭉침·한글
// 깨짐 방지). 표시/입출력 헬퍼라 utils에 둠(수학 아님).

function triggerDownload(blob, fileName) {
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

// 헤더+행 → RFC4180 CSV 본문. 세 함정을 한 곳에서 막는다(§7):
//  ① `\n` 조인은 Excel에서 한 행으로 뭉친다 → CRLF
//  ② BOM이 없으면 한글이 깨진다
//  ③ 값에 콤마·따옴표·줄바꿈이 있으면 열이 밀린다 → 따옴표 감싸고 " 이스케이프
// 도구마다 이 조립을 다시 쓰면 셋 중 하나를 빠뜨린다.
export function csvBody(header, rows) {
  const cell = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [header.map(cell).join(","), ...rows.map((row) => row.map(cell).join(","))];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

// CSV 문자열(이미 BOM/CRLF 포함 가능)을 그대로 저장. 호출자가 BOM을 안 넣었어도
// 안전하게 저장되도록 charset 지정.
export function downloadCsv(csvString, baseName = "export") {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
  return triggerDownload(blob, withDate(baseName, "csv"));
}

export function downloadXlsx(arrayBuffer, baseName = "export") {
  const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return triggerDownload(blob, withDate(baseName, "xlsx"));
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
  return triggerDownload(blob, withDate(baseName, ext));
}

export function downloadCalendar(calendarString, baseName = "decision_review") {
  const blob = new Blob([calendarString], { type: "text/calendar;charset=utf-8" });
  return triggerDownload(blob, withDate(baseName, "ics"));
}

export function downloadJson(value, baseName = "result-manifest", ext = "json") {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  return triggerDownload(blob, withDate(baseName, ext));
}
