const clean = (value) => String(value ?? "").trim();

// 날짜가 실제로 적힌 열만 안전하게 변환한다. `Week 1`처럼 연도를 알 수 없는 열은
// 자동 변환하지 않아 잘못된 날짜를 만들어 내지 않는다.
export function normalizeWidePeriod(value) {
  const source = clean(value);
  const match = source.match(/^(20\d{2})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function getWidePeriodColumns(headers = []) {
  return headers.filter((header) => normalizeWidePeriod(header) !== null);
}

export function wideToLong({ headers = [], raw = [], valueHeader = "기간별 값" } = {}) {
  const periodHeaders = getWidePeriodColumns(headers);
  if (periodHeaders.length < 2) {
    throw new Error("At least two ISO date columns are required for wide-to-long conversion.");
  }

  const dimensionHeaders = headers.filter((header) => !periodHeaders.includes(header));
  const used = new Set([...headers, "date"]);
  let safeValueHeader = valueHeader;
  let suffix = 2;
  while (used.has(safeValueHeader)) {
    safeValueHeader = `${valueHeader}_${suffix}`;
    suffix += 1;
  }

  const longRows = [];
  raw.forEach((row) => {
    periodHeaders.forEach((periodHeader) => {
      const value = clean(row?.[periodHeader]);
      if (!value) return;
      const next = {};
      dimensionHeaders.forEach((header) => { next[header] = clean(row?.[header]); });
      next.date = normalizeWidePeriod(periodHeader);
      next[safeValueHeader] = value;
      longRows.push(next);
    });
  });

  return {
    headers: [...dimensionHeaders, "date", safeValueHeader],
    raw: longRows,
    periodHeaders,
    dimensionHeaders,
    valueHeader: safeValueHeader,
  };
}
