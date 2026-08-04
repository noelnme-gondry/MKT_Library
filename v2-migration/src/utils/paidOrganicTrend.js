const DAY_MS = 86400000;
export const PAID_ORGANIC_MIN_MOVE_PCT = 1;

export function parseTrendNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").replace(/[,%\s]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedHeader(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function findHeader(headers, score) {
  return (headers || [])
    .map((header, index) => ({ header, index, score: score(normalizedHeader(header), String(header)) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.header || "";
}

export function guessPaidOrganicColumns(headers) {
  const date = findHeader(headers, (name) => {
    if (/^(week|date|day|주차|날짜|일자)$/.test(name)) return 10;
    if (/weekstart|weekdate|주차시작|기준일/.test(name)) return 8;
    return /week|date|날짜|일자|주차/.test(name) ? 4 : 0;
  });
  const paid = findHeader(headers, (name) => {
    const isPaid = /paid|유료|광고귀속/.test(name);
    const isOutcome = /reg|signup|registration|install|conversion|가입|등록|설치|전환/.test(name);
    return isPaid && isOutcome ? 12 : isPaid ? 5 : 0;
  });
  const organic = findHeader(headers, (name) => {
    const isOrganic = /organic|오가닉|자연/.test(name);
    const isOutcome = /reg|signup|registration|install|conversion|가입|등록|설치|전환/.test(name);
    return isOrganic && isOutcome ? 12 : isOrganic ? 5 : 0;
  });
  const total = findHeader(headers, (name) => {
    if (/paid|유료|organic|오가닉|자연|spend|cost|비용|지출/.test(name)) return 0;
    if (/total/.test(name) && /reg|signup|registration|install|conversion|가입|등록|설치|전환/.test(name)) return 12;
    if (/전체|합계/.test(name) && /가입|등록|설치|전환/.test(name)) return 12;
    if (/^(regs?|signups?|registrations?|installs?|conversions?|가입|등록|설치|전환)$/.test(name)) return 9;
    return /reg|signup|registration|install|conversion|가입|등록|설치|전환/.test(name) ? 3 : 0;
  });
  return { date, total, paid, organic };
}

function weekStartIso(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00Z`)
    : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const utc = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  const mondayOffset = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - mondayOffset);
  return utc.toISOString().slice(0, 10);
}

function pctChange(previous, current) {
  if (!Number.isFinite(previous) || !Number.isFinite(current) || Math.abs(previous) < 1e-12) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function buildPaidOrganicTrend(rows, mapping, { recentWeeks = 12 } = {}) {
  const missing = [];
  if (!mapping?.date) missing.push("date");
  if (!mapping?.paid) missing.push("paid");
  if (!mapping?.organic && !mapping?.total) missing.push("organic-or-total");
  if (missing.length) return { missing, levels: [], points: [], invalidRows: 0, invalidWeeks: 0 };

  const grouped = new Map();
  let invalidRows = 0;
  for (const row of rows || []) {
    const week = weekStartIso(row?.[mapping.date]);
    const paid = parseTrendNumber(row?.[mapping.paid]);
    const organic = mapping.organic ? parseTrendNumber(row?.[mapping.organic]) : null;
    const total = mapping.total ? parseTrendNumber(row?.[mapping.total]) : null;
    if (!week || paid == null || (mapping.organic ? organic == null : total == null)) {
      invalidRows += 1;
      continue;
    }
    const current = grouped.get(week) || { week, paid: 0, organic: 0, total: 0 };
    current.paid += paid;
    if (mapping.organic) current.organic += organic;
    else current.total += total;
    grouped.set(week, current);
  }

  let invalidWeeks = 0;
  const levels = [...grouped.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((item) => ({
      week: item.week,
      paid: item.paid,
      organic: mapping.organic ? item.organic : item.total - item.paid,
    }))
    .filter((item) => {
      const valid = item.paid >= 0 && item.organic >= 0;
      if (!valid) invalidWeeks += 1;
      return valid;
    });

  const points = [];
  for (let index = 1; index < levels.length; index += 1) {
    const previous = levels[index - 1];
    const current = levels[index];
    const x = pctChange(previous.organic, current.organic);
    const y = pctChange(previous.paid, current.paid);
    if (x == null || y == null) continue;
    points.push({
      x,
      y,
      week: current.week,
      organic: current.organic,
      paid: current.paid,
      organicPrevious: previous.organic,
      paidPrevious: previous.paid,
    });
  }

  const recent = points.slice(-Math.max(1, recentWeeks));
  const meaningful = recent.filter((point) => Math.abs(point.x) >= PAID_ORGANIC_MIN_MOVE_PCT || Math.abs(point.y) >= PAID_ORGANIC_MIN_MOVE_PCT);
  const watchCount = meaningful.filter((point) => point.x <= -PAID_ORGANIC_MIN_MOVE_PCT && point.y >= PAID_ORGANIC_MIN_MOVE_PCT).length;
  const coGrowthCount = meaningful.filter((point) => point.x >= PAID_ORGANIC_MIN_MOVE_PCT && point.y >= PAID_ORGANIC_MIN_MOVE_PCT).length;
  const oppositeCount = meaningful.filter((point) => point.x * point.y < 0).length;
  const threshold = Math.max(3, Math.ceil(meaningful.length * 0.4));
  const verdict = watchCount >= threshold
    ? "watch"
    : coGrowthCount >= threshold
      ? "co-growth"
      : "mixed";
  const comparisonStart = levels[Math.max(0, levels.length - 5)];
  const latest = levels.at(-1);

  return {
    missing,
    levels,
    points,
    recent,
    invalidRows,
    invalidWeeks,
    meaningfulCount: meaningful.length,
    watchCount,
    coGrowthCount,
    oppositeCount,
    verdict,
    recentOrganicChange: comparisonStart && latest ? pctChange(comparisonStart.organic, latest.organic) : null,
    recentPaidChange: comparisonStart && latest ? pctChange(comparisonStart.paid, latest.paid) : null,
  };
}

export function buildPaidOrganicTrendDemo(locale = "ko") {
  const headers = ["week", "total_signups", "paid_signups"];
  const start = Date.UTC(2025, 0, 6);
  const raw = Array.from({ length: 24 }, (_, index) => {
    const paid = Math.round(1850 + index * 68 + Math.sin(index * 0.9) * 230);
    const organicBase = 5100 + index * 22 + Math.sin(index * 0.55) * 310;
    const recentDisplacement = index >= 15 ? (index - 14) * 95 : 0;
    const organic = Math.round(Math.max(0, organicBase - recentDisplacement));
    return {
      week: new Date(start + index * 7 * DAY_MS).toISOString().slice(0, 10),
      total_signups: organic + paid,
      paid_signups: paid,
    };
  });
  return {
    raw,
    headers,
    mapping: {},
    fileName: locale === "en" ? "demo_paid_organic_trend.csv" : "demo_paid_organic_trend.csv",
  };
}
