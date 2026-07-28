const DAY_MS = 86400000;

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const parsed = Number(String(value ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function mondayTimestamp(value) {
  const match = String(value ?? "").trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) return null;
  return timestamp;
}

function isoDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function canonicalPlatform(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (/android|aos|google.?play|play.?store/.test(text)) return "android";
  if (/ios|iphone|ipad/.test(text)) return "ios";
  return text;
}

function isOrganic(value) {
  return /(^|[\s_-])(organic|오가닉|자연|비광고)([\s_-]|$)/i.test(String(value ?? "").normalize("NFKC"));
}

export function buildAttributedForecastDataset(rows, fields, options = {}) {
  const { timeHeader, platformHeader, channelHeader, spendHeader, targetHeader } = fields || {};
  if (!timeHeader || !channelHeader || !spendHeader || !targetHeader) return null;
  const records = [];
  for (const row of rows || []) {
    const week = mondayTimestamp(row[timeHeader]);
    const channel = String(row[channelHeader] ?? "").trim();
    const outcome = parseNumber(row[targetHeader]);
    const cost = parseNumber(row[spendHeader]);
    if (week == null || !channel || !Number.isFinite(outcome)) continue;
    records.push({
      week,
      platform: canonicalPlatform(platformHeader ? row[platformHeader] : "total"),
      channel,
      organic: isOrganic(channel),
      outcome,
      cost: Number.isFinite(cost) ? Math.max(0, cost) : 0,
    });
  }
  if (!records.some((record) => record.organic) || !records.some((record) => !record.organic)) return null;
  let weeks = [...new Set(records.map((record) => record.week))].sort((left, right) => left - right);
  const asOf = options.asOfDate == null ? Date.now() : new Date(options.asOfDate).getTime();
  if (weeks.length && Number.isFinite(asOf) && asOf < weeks.at(-1) + 7 * DAY_MS) weeks = weeks.slice(0, -1);
  const weekSet = new Set(weeks);
  const filtered = records.filter((record) => weekSet.has(record.week));
  const platforms = [...new Set(filtered.map((record) => record.platform))];
  if (weeks.length < 51 || !platforms.includes("android") || !platforms.includes("ios")) return null;
  return { weeks, weekLabels: weeks.map(isoDate), records: filtered, platforms };
}
