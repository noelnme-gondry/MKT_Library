function escapeCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderReportMarkdown(draft, locale = "ko") {
  const lines = [`# ${draft.title || (locale === "en" ? "Weekly performance report" : "주간 성과 보고서")}`, ""];
  if (draft.period?.start || draft.period?.end) {
    lines.push(`${locale === "en" ? "Period" : "기간"}: ${draft.period.start || "—"} ~ ${draft.period.end || "—"}`, "");
  }
  draft.blocks.forEach((block) => {
    lines.push(`## ${block.toolTitle}`, "", block.headline, "");
    if (block.stats?.length) {
      lines.push(`| ${locale === "en" ? "Metric" : "지표"} | ${locale === "en" ? "Value" : "값"} |`, "|---|---:|");
      block.stats.forEach((stat) => lines.push(`| ${escapeCell(stat.label)} | ${escapeCell(stat.displayValue)} |`));
      lines.push("");
    }
    block.points?.forEach((point) => lines.push(`- ${point}`));
    if (block.points?.length) lines.push("");
  });
  draft.notes?.forEach((note) => {
    if (note.text) lines.push(`> ${String(note.text).replace(/\r?\n/g, "\n> ")}`, "");
  });
  return lines.join("\n").trimEnd() + "\n";
}

