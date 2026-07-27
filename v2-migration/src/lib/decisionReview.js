// 결정 기록은 서버나 브라우저 영속 저장소가 아닌, 사용자가 직접 보관하는 CSV가 SSOT다.
// 텍스트 값은 CSV 수식 주입을 막고, Excel 호환을 위해 호출부에서 BOM + CRLF로 저장한다.
export const DECISION_REVIEW_COLUMNS = [
  "tool_id",
  "action",
  "hypothesis",
  "metric",
  "baseline",
  "review_date",
  "actual",
  "learning",
  "status",
];

function safeCell(value) {
  const text = String(value ?? "");
  // Excel/Sheets가 사용자 입력을 수식으로 해석하지 않도록 보호한다.
  const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replace(/"/g, '""')}"`;
}

function asText(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

export function getDecisionReviewStatus({ actual, learning } = {}) {
  return asText(actual) || asText(learning) ? "reviewed" : "pending";
}

export function normalizeDecisionReviewRows(rows, fallbackToolId = "") {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const action = asText(row?.action);
      const actual = asText(row?.actual);
      const learning = asText(row?.learning);
      return {
        toolId: asText(row?.tool_id ?? row?.["\uFEFFtool_id"] ?? row?.toolId) || fallbackToolId,
        action,
        hypothesis: asText(row?.hypothesis),
        metric: asText(row?.metric),
        baseline: asText(row?.baseline),
        reviewDate: asText(row?.review_date ?? row?.reviewDate),
        actual,
        learning,
        status: getDecisionReviewStatus({ actual, learning }),
      };
    })
    .filter((row) => row.action);
}

export function serializeDecisionReviewCsv(records = []) {
  const rows = normalizeDecisionReviewRows(records).map((record) => [
    record.toolId,
    record.action,
    record.hypothesis,
    record.metric,
    record.baseline,
    record.reviewDate,
    record.actual,
    record.learning,
    record.status,
  ]);
  return `\uFEFF${[DECISION_REVIEW_COLUMNS, ...rows].map((row) => row.map(safeCell).join(",")).join("\r\n")}\r\n`;
}
