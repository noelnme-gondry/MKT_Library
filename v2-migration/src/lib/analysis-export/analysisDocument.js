import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun, Footer, PageNumber } from "docx";

export async function createAnalysisDocument(payload) {
  const en = payload.locale === "en";
  const text = value => value == null ? "—" : typeof value === "object" ? (value.formula ? (en ? "See Excel formula" : "Excel 수식 참조") : JSON.stringify(value)) : String(value);
  const p = value => new Paragraph({ children: [new TextRun(text(value))], spacing: { after: 140 } });
  const h = value => new Paragraph({ text: value, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 }, keepNext: true });
  const table = rows => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map((row, index) => new TableRow({ tableHeader: index === 0, cantSplit: true, children: row.map(value => new TableCell({ shading: index === 0 ? { fill: "EAF0F8" } : undefined, children: [p(value)] })) })) });
  const contents = [
    new Paragraph({ text: `${payload.toolTitle} ${en ? "analysis report" : "분석 보고서"}`, heading: HeadingLevel.TITLE }),
    p(`Growth Opt Playbook | ${payload.generatedAt}`),
    h(en ? "Decision summary" : "핵심 결론"), p(payload.summary.headline),
    h(en ? "Analysis scope" : "분석 범위"),
    table([[en ? "Item" : "항목", en ? "Value" : "값"], [en ? "Source" : "원본", payload.source.fileName || (en ? "Manual inputs" : "수동 입력")], [en ? "Uploaded rows" : "업로드 원본 행", payload.source.rows.length], ...Object.entries(payload.scope)]),
    p(en ? "Source row count is not the number of observations used by every calculation. Filters and method-specific exclusions are listed in the evidence sheets." : "원본 행 수가 모든 계산의 분석 표본 수를 뜻하지는 않습니다. 필터와 방법별 제외 조건은 근거 시트에서 확인하세요."),
  ];
  if (payload.summary.stats.length) contents.push(h(en ? "Key results" : "핵심 수치"), table([[en ? "Metric" : "지표", en ? "Result" : "결과", en ? "Context" : "설명"], ...payload.summary.stats.map(stat => [stat.label, stat.value, stat.detail])]));
  if (payload.summary.points.length) contents.push(h(en ? "Evidence and next steps" : "근거와 다음 행동"), ...payload.summary.points.flatMap(point => [p([point.label, point.text].filter(Boolean).join(" — ")), ...(point.detail ? [p(point.detail)] : [])]));
  for (const chart of payload.charts || []) {
    if (!chart.image || !chart.width || !chart.height) continue;
    const scale = Math.min(580 / chart.width, 420 / chart.height);
    contents.push(h(chart.title), new Paragraph({ children: [new ImageRun({ type: "png", data: Uint8Array.from(atob(chart.image.split(",")[1]), char => char.charCodeAt(0)), transformation: { width: Math.round(chart.width * scale), height: Math.round(chart.height * scale) } })] }));
  }
  for (const calculation of payload.calculationTables || []) {
    contents.push(h(calculation.title || calculation.name));
    if (calculation.note) contents.push(p(calculation.note));
    const rows = calculation.rows.slice(0, 21).map(row => row.slice(0, 6));
    if (rows.length) contents.push(table(rows));
    if (calculation.rows.length > 21 || calculation.rows.some(row => row.length > 6)) contents.push(p(en ? "This report shows the first 20 records and 6 columns. The companion Excel workbook contains the full table and formulas." : "이 문서는 앞 20개 기록과 6개 열을 보여줍니다. 전체 표와 계산식은 함께 제공되는 Excel 워크북에서 확인하세요."));
  }
  contents.push(h(en ? "Method and limitations" : "분석 방법과 해석 한계"), p(`${payload.method.name} | ${payload.method.engine} | ${payload.method.version || "—"}`), ...payload.method.assumptions.map(p), ...payload.method.limitations.map(p), p(payload.calculationMode === "exact_after_preprocessing" ? (en ? "Excel formulas recalculate from prepared inputs. Raw edits do not automatically rerun preprocessing." : "Excel 수식은 전처리된 입력부터 다시 계산합니다. 원본 수정만으로 전처리가 다시 실행되지는 않습니다.") : (en ? "Statistical model estimates are browser-engine outputs. Excel preserves those outputs and downstream formulas; edit inputs and rerun the website analysis to refit the model." : "통계 모델 추정치는 브라우저 엔진 산출물입니다. Excel에는 이 산출물과 후속 계산식을 보존합니다. 모델을 다시 추정하려면 데이터를 바꾸고 사이트에서 분석을 재실행하세요.")), p(en ? "This report supports decisions; observed differences alone do not establish causal effects." : "이 보고서는 의사결정을 돕는 자료입니다. 관측 차이만으로 인과효과가 입증되는 것은 아닙니다."));
  const document = new Document({ creator: "Growth Opt Playbook", title: payload.toolTitle, styles: { default: { document: { run: { font: "Arial", size: 22, color: "182230" }, paragraph: { spacing: { line: 300 } } } } }, sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } }, footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun("Growth Opt Playbook  |  "), new TextRun({ children: [PageNumber.CURRENT] })] })] }) }, children: contents }] });
  return Packer.toBlob(document);
}
