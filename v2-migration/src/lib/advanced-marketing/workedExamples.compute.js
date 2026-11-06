// Test-time generation only: reading the page must not execute analysis engines.
import { ADVANCED_TOOLS } from "./registry";
import { buildAdvancedDemo, advancedDemoOptions } from "./demo";
import { projectAdvancedRows } from "./input";
import { executeAdvanced } from "./execute";
import { ADVANCED_READING } from "./reading";

export function computeAdvancedGuideSummaries() {
  const firstSentence = (text) => text.includes(". ") ? text.slice(0, text.indexOf(". ") + 1) : text;
  return Object.fromEntries(Object.entries(ADVANCED_READING).map(([id, reading]) => [id,
    Object.fromEntries(Object.entries(reading).filter(([key]) => key !== "prep").map(([key, value]) => [key,
      Object.fromEntries(Object.entries(value).map(([locale, text]) => [locale, firstSentence(text)]))]))]));
}

export function computeAdvancedExamples() {
  return Object.fromEntries(ADVANCED_TOOLS.map((tool) => {
    const csv = buildAdvancedDemo(tool.id), rows = projectAdvancedRows(csv, tool.id);
    const options = advancedDemoOptions(tool.id), report = executeAdvanced(tool.id, rows, options);
    if (report.status !== "ready") throw new Error(`Example not ready: ${tool.id}`);
    return [tool.id, { rowCount: rows.length, currency: report.diagnostics.currency || csv.currency,
      settings: Object.fromEntries(tool.options.map((option) => [option.key, options[option.key]])),
      input: rows.slice(0, 3), metrics: report.metrics.slice(0, 3),
      method: report.method, action: report.action, warnings: report.warnings,
    }];
  }));
}
