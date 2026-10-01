// Export only known context. A download date is never an analysis period.
export function figureExportContext({ title = "", toolTitle = "", scope = {}, resultState, source = {}, locale = "ko" } = {}) {
  const en = locale === "en";
  const period = (start, end) => [start, end].filter(Boolean).join(" – ");
  const current = period(scope.dateStart, scope.dateEnd);
  const prior = period(scope.comparisonStart, scope.comparisonEnd);
  // 머리글을 줄이거나 빼도(다운로드 설정) 지우지 않는 줄 — 예시 데이터·판단 보류.
  const mandatory = [
    source.importSource === "demo" ? (en ? "Sample data" : "예시 데이터") : "",
    resultState && resultState !== "ready" ? (en ? "Decision withheld. Check the result's limitations." : "판단 보류. 결과의 해석 조건을 함께 확인하세요.") : "",
  ].filter(Boolean);
  const details = [
    toolTitle && toolTitle !== title ? toolTitle : "",
    current ? `${en ? "Period" : "분석 기간"}: ${current}` : "",
    prior ? `${en ? "Comparison" : "비교 기간"}: ${prior}` : "",
    scope.caption ? String(scope.caption) : "",
    ...mandatory,
  ].filter(Boolean);
  return { title: String(title || toolTitle || (en ? "Analysis figure" : "분석 그림")), details, mandatory };
}

// Shared by canvas and HTML exports; wrap measured text without clipping a long word.
export function wrapFigureText(text, maxWidth, measure) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) { line = candidate; continue; }
    if (line) lines.push(line);
    line = "";
    for (const char of word) {
      if (line && measure(line + char) > maxWidth) { lines.push(line); line = ""; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function figureHeaderLayout(ctx, metadata, width, fontFamily) {
  if (!metadata?.title) return { height: 0, lines: [] };
  const lines = [];
  let y = 20;
  for (const [index, text] of [metadata.title, ...(metadata.details || [])].entries()) {
    const font = `${index === 0 ? "600 16" : "400 13"}px ${fontFamily}`;
    ctx.font = font;
    for (const line of wrapFigureText(text, Math.max(1, width - 32), value => ctx.measureText(value).width)) {
      lines.push({ text: line, y, font });
      y += index === 0 ? 24 : 20;
    }
  }
  return { height: y + 8, lines };
}

export function drawFigureHeader(ctx, header, color) {
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (const line of header.lines) {
    ctx.font = line.font;
    ctx.fillText(line.text, 16, line.y);
  }
}
