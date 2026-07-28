const clean = (value) => String(value ?? "").trim();
const BLOCKED_HEADER_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const safeHeader = (value, index) => {
  const header = clean(value) || `column_${index + 1}`;
  return BLOCKED_HEADER_KEYS.has(header.toLowerCase()) ? `_${header}` : header;
};

export function detectHeaderRow(table = [], maxRows = 20) {
  const candidates = table.slice(0, maxRows);
  let best = { index: 0, score: -Infinity };
  candidates.forEach((row, index) => {
    const cells = (row || []).map(clean).filter(Boolean);
    if (cells.length < 2) return;
    const unique = new Set(cells.map((cell) => cell.toLowerCase())).size / cells.length;
    const text = cells.filter((cell) => Number.isNaN(Number(cell.replace(/[,$₩%]/g, "")))).length / cells.length;
    const next = candidates[index + 1] || [];
    const nextFilled = next.map(clean).filter(Boolean).length;
    const score = cells.length * 2 + unique + text + Math.min(nextFilled, cells.length) / cells.length;
    if (score > best.score) best = { index, score };
  });
  return best.index;
}

export function tableToRecords(table = []) {
  const headerIndex = detectHeaderRow(table);
  const seen = new Map();
  const headers = (table[headerIndex] || []).map((value, index) => {
    const base = safeHeader(value, index);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  });
  const raw = table.slice(headerIndex + 1).filter((row) => row?.some((cell) => clean(cell))).map((row) => Object.fromEntries(headers.map((header, index) => [header, clean(row?.[index])])));
  return { headerIndex, headers, raw };
}
