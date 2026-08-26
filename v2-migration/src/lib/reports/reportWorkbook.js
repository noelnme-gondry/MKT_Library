function tx(locale, ko, en) {
  return locale === "en" ? en : ko;
}

function text(value, limit = 2000) {
  return String(value ?? "").slice(0, limit);
}

function safeCell(value) {
  // Excel must never promote user-entered report text to a formula.
  return { t: "s", v: text(value) };
}

function sheetFromRows(XLSX, rows) {
  const sheet = {};
  let maxColumn = 0;
  rows.forEach((row, rowIndex) => {
    maxColumn = Math.max(maxColumn, row.length - 1);
    row.forEach((value, columnIndex) => {
      sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] = safeCell(value);
    });
  });
  sheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, rows.length - 1), c: maxColumn } });
  sheet["!cols"] = Array.from({ length: maxColumn + 1 }, (_, columnIndex) => ({
    wch: Math.min(Math.max(12, Math.max(...rows.slice(0, 100).map((row) => text(row[columnIndex]).length)) + 2), 48),
  }));
  if (rows.length > 1 && maxColumn > 0) sheet["!autofilter"] = { ref: sheet["!ref"] };
  return sheet;
}

function periodFor(block = {}) {
  const { dateStart, dateEnd } = block.scope || {};
  return dateStart && dateEnd ? `${dateStart} ~ ${dateEnd}` : "";
}

export async function createWeeklyReportWorkbook(draft = {}, locale = "ko") {
  const XLSX = await import("xlsx");
  const title = text(draft.title || tx(locale, "주간 성과 보고서", "Weekly performance report"), 160);
  const blocks = Array.isArray(draft.blocks) ? draft.blocks : [];
  const notes = Array.isArray(draft.notes) ? draft.notes.map((note) => text(note?.text)).filter(Boolean) : [];
  const workbook = XLSX.utils.book_new();
  const overviewRows = [
    [tx(locale, "주간 성과 보고서", "Weekly performance report"), title],
    [tx(locale, "보고 기간", "Reporting period"), draft.period?.start && draft.period?.end ? `${draft.period.start} ~ ${draft.period.end}` : tx(locale, "미입력", "Not set")],
    [tx(locale, "포함한 분석", "Included analyses"), blocks.length],
    [tx(locale, "개인정보", "Privacy"), tx(locale, "원본 CSV 행은 이 파일에 포함되지 않습니다. 이 파일은 브라우저에서 생성됐습니다.", "Source CSV rows are not included. This file was generated in the browser.")],
    [tx(locale, "출처", "Source"), "Growth Opt Playbook — https://growthoptplaybook.com"],
  ];
  const resultRows = [
    [tx(locale, "순서", "Order"), tx(locale, "도구", "Tool"), tx(locale, "분석 기간", "Analysis period"), tx(locale, "결론", "Conclusion"), tx(locale, "근거·다음 확인", "Evidence / next check"), tx(locale, "핵심 수치", "Key figures")],
    ...blocks.map((block, index) => [
      index + 1,
      text(block.toolTitle || block.toolId, 160),
      periodFor(block),
      text(block.headline, 240),
      (block.points || []).map((point) => text(point, 500)).join("\n"),
      (block.stats || []).map((stat) => `${text(stat.label, 120)}: ${text(stat.displayValue, 160)}`).join("\n"),
    ]),
  ];
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(XLSX, overviewRows), "00_OVERVIEW");
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(XLSX, resultRows), "01_RESULTS");
  if (notes.length) XLSX.utils.book_append_sheet(workbook, sheetFromRows(XLSX, [[tx(locale, "공유 메모", "Sharing note")], ...notes.map((note) => [note])]), "02_NOTES");
  workbook.Props = { Title: title, Subject: "Client-side weekly performance report", Author: "Growth Opt Playbook" };
  return XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true, cellStyles: true });
}
