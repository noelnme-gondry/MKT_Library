import { reportRows, WIDE_AGE_BUCKETS, normalizeReportPlatform } from "../lib/attributionReports/fields";
import { parseNumericStrict } from "./parseNumeric";
const DAY = 86400000;
const str = value => String(value ?? "").trim();
const sum = values => values.reduce((a, b) => a + b, 0);
const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null; };
export function isoWeekForDate(value) {
  const raw = str(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== raw) return null;
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  return { year, week: Math.ceil(((+date - Date.UTC(year, 0, 1)) / DAY + 1) / 7) };
}
export function isoWeekStart(year, week) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200 || !Number.isInteger(week) || week < 1 || week > 53) return null;
  const fourth = new Date(Date.UTC(year, 0, 4));
  fourth.setUTCDate(4 - ((fourth.getUTCDay() || 7) - 1) + (week - 1) * 7);
  const date = fourth.toISOString().slice(0, 10), actual = isoWeekForDate(date);
  return actual?.year === year && actual.week === week ? date : null;
}
function rowWeek(row) {
  const year = parseNumericStrict(row.iso_year), week = parseNumericStrict(row.iso_week);
  if (year != null && week != null) return isoWeekStart(year, week) ? { year, week } : null;
  const token = str(row.date).match(/^(\d{4})-?W(\d{1,2})$/i);
  if (token) return isoWeekStart(+token[1], +token[2]) ? { year: +token[1], week: +token[2] } : null;
  return isoWeekForDate(str(row.date).slice(0, 10));
}
export function normalizeCannibalDetail(raw, mapping) {
  let invalidRows = 0, invalidFemaleRows = 0, invalidAgeRows = 0;
  const invalidWeeks = new Set();
  const mapped = new Set(Object.values(mapping));
  const ageBuckets = WIDE_AGE_BUCKETS.filter(bucket => mapped.has(bucket.key));
  const overlappingAges = ageBuckets.some((a, i) => ageBuckets.some((b, j) => i < j && Math.max(a.low, b.low) <= Math.min(a.high, b.high)));
  const rows = [];
  for (const row of reportRows(raw, mapping)) {
    const time = rowWeek(row), count = parseNumericStrict(row.count), channel = str(row.channel);
    if (!time || count == null || count < 0 || !channel) {
      invalidRows++;
      if (time) invalidWeeks.add(JSON.stringify([str(row.country) || "All", normalizeReportPlatform(row.platform) || "All", time.year, time.week, str(row.outcome_type) || "All"]));
      continue;
    }
    const female = parseNumericStrict(row.female_count);
    if (female != null && (female < 0 || female > count)) invalidFemaleRows++;
    let ageGroups = null;
    if (ageBuckets.length && !str(row.age)) {
      const values = ageBuckets.map(bucket => ({ name: bucket.label, count: parseNumericStrict(row[bucket.key]) }));
      const total = values.every(g => g.count != null && g.count >= 0) ? sum(values.map(g => g.count)) : null;
      if (!overlappingAges && total != null && total <= count) {
        ageGroups = total < count ? [...values, { name: "Other / unknown", count: count - total }] : values;
      } else invalidAgeRows++;
    }
    rows.push({ ...time, count, ageGroups, channel, organic: /^(organic|오가닉|자연유입)$/i.test(channel),
      country: str(row.country) || "All", platform: normalizeReportPlatform(row.platform) || "All", campaign: str(row.campaign_name) || "Unknown",
      outcomeType: str(row.outcome_type) || "All", gender: ({ f: "Female", female: "Female", 여성: "Female", m: "Male", male: "Male", 남성: "Male" })[str(row.gender).toLowerCase()] || str(row.gender), age: str(row.age),
      female: female != null && female >= 0 && female <= count ? female : null });
  }
  return { rows, invalidRows, invalidWeeks: [...invalidWeeks], invalidFemaleRows, invalidAgeRows, countries: [...new Set(rows.map(r => r.country))].sort(), platforms: [...new Set(rows.map(r => r.platform))].sort(), years: [...new Set(rows.map(r => r.year))].sort((a, b) => a - b), outcomeTypes: [...new Set(rows.map(r => r.outcomeType))].sort() };
}
function aggregate(rows, keyOf, valueOf = row => row.count) {
  const map = new Map();
  rows.forEach(row => { const key = keyOf(row); map.set(key, (map.get(key) || 0) + valueOf(row)); });
  return map;
}
function completeWeeks(rows, year) {
  const byWeek = new Map();
  rows.filter(r => r.year === year).forEach(row => {
    const entry = byWeek.get(row.week) || { paid: 0, organic: 0, hasPaid: false, hasOrganic: false };
    entry[row.organic ? "organic" : "paid"] += row.count;
    entry[row.organic ? "hasOrganic" : "hasPaid"] = true;
    byWeek.set(row.week, entry);
  });
  return byWeek;
}
const opposite = (a, b) => a * b < 0;
function detectStretches(points, minWeeks, kind, baselineWeeks) {
  const stretches = [];
  for (let start = 0; start < points.length;) {
    const history = points.slice(start - baselineWeeks, start);
    const hasBaseline = start >= baselineWeeks && history.length === baselineWeeks && history.every((p, n) => p.week === points[start].week - baselineWeeks + n);
    if (kind === "trend" && !hasBaseline) { start++; continue; }
    const paidBase = kind === "trend" ? median(history.map(p => p.paidDelta)) : 0;
    const organicBase = kind === "trend" ? median(history.map(p => p.organicDelta)) : 0;
    const direction = Math.sign(points[start].paidDelta - paidBase);
    let end = start;
    while (end < points.length && (end === start || points[end].week === points[end - 1].week + 1)
      && opposite(points[end].paidDelta - paidBase, points[end].organicDelta - organicBase)
      && Math.sign(points[end].paidDelta - paidBase) === direction) end++;
    if (end - start >= minWeeks) {
      stretches.push({ kind, start: points[start].week, end: points[end - 1].week, points: points.slice(start, end), baseline: kind === "trend" ? history : [], paidBase, organicBase });
      start = end;
    } else start++;
  }
  return stretches;
}
function entityChanges(rows, year, weeks, keyOf, missingAsZero) {
  const previous = aggregate(rows.filter(r => r.year === year - 1), r => JSON.stringify([r.week, keyOf(r)]));
  const current = aggregate(rows.filter(r => r.year === year), r => JSON.stringify([r.week, keyOf(r)]));
  const names = [...new Set(rows.map(keyOf))].sort();
  return names.map(name => ({ name, weeks: weeks.map(week => {
    const key = JSON.stringify([week, name]), a = previous.get(key), b = current.get(key);
    return { week, delta: (a != null && b != null) || missingAsZero ? (b || 0) - (a || 0) : null };
  }) }));
}
function movementRows(rows, year, stretch, keyOf, missingAsZero) {
  const weeks = stretch.points.map(p => p.week), historyWeeks = stretch.baseline.map(p => p.week);
  const changes = entityChanges(rows, year, [...historyWeeks, ...weeks], keyOf, missingAsZero);
  return changes.map(entry => {
    const history = entry.weeks.filter(p => historyWeeks.includes(p.week));
    const baseline = stretch.kind === "trend" ? (history.length === historyWeeks.length && history.every(p => p.delta != null) ? median(history.map(p => p.delta)) : null) : 0;
    const points = entry.weeks.filter(p => weeks.includes(p.week)).map(p => ({ week: p.week, delta: p.delta != null && baseline != null ? p.delta - baseline : null }));
    return { name: entry.name, points, move: points.every(p => p.delta != null) ? sum(points.map(p => p.delta)) : null,
      coMovingWeeks: points.filter(p => { const total = stretch.points.find(t => t.week === p.week); return p.delta != null && opposite(p.delta, total.organicDelta - stretch.organicBase) && Math.sign(p.delta) === Math.sign(total.paidDelta - stretch.paidBase); }).length };
  });
}
function mixComparison(rows, year, stretch, axis, selectPaid, missingAsZero) {
  const expanded = [];
  rows.forEach(row => {
    if (axis === "gender" && row.gender) expanded.push({ ...row, group: row.gender });
    else if (axis === "gender" && row.female != null) expanded.push({ ...row, count: row.female, group: "Female" }, { ...row, count: row.count - row.female, group: "Non-female / unknown" });
    else if (axis === "age" && row.age) expanded.push({ ...row, group: row.age });
    else if (axis === "age" && row.ageGroups) row.ageGroups.forEach(group => expanded.push({ ...row, count: group.count, group: group.name }));
  });
  // Partial segment coverage cannot stand for the whole cohort.
  const relevant = rows.filter(r => (r.organic || selectPaid(r)) && (r.year === year || r.year === year - 1) && [...stretch.points, ...stretch.baseline].some(p => p.week === r.week));
  if (!relevant.length || relevant.some(r => axis === "gender" ? !r.gender && r.female == null : !r.age && !r.ageGroups)) return { axis, overlap: null, groups: [], reason: "incomplete_mix" };
  const paid = movementRows(expanded.filter(r => !r.organic && selectPaid(r)), year, stretch, r => r.group, missingAsZero);
  const organic = movementRows(expanded.filter(r => r.organic), year, stretch, r => r.group, missingAsZero);
  const selectedMove = movementRows(rows.filter(r => !r.organic && selectPaid(r)), year, stretch, () => "selected", missingAsZero)[0]?.move;
  const pd = Math.sign(selectedMove || 0), od = Math.sign(sum(stretch.points.map(p => p.organicDelta - stretch.organicBase)));
  if ([...paid, ...organic].some(row => row.move == null)) return { axis, overlap: null, groups: [], reason: "unobserved_groups" };
  const pTotal = sum(paid.filter(r => r.move * pd > 0).map(r => Math.abs(r.move))), oTotal = sum(organic.filter(r => r.move * od > 0).map(r => Math.abs(r.move)));
  if (!pTotal || !oTotal) return { axis, overlap: null, groups: [], reason: "no_same_direction_move" };
  const names = [...new Set([...paid, ...organic].map(r => r.name))].sort();
  const groups = names.map(name => {
    const p = paid.find(r => r.name === name)?.move || 0, o = organic.find(r => r.name === name)?.move || 0;
    return { name, paidShare: p * pd > 0 ? Math.abs(p) / pTotal : 0, organicShare: o * od > 0 ? Math.abs(o) / oTotal : 0 };
  });
  return { axis, overlap: sum(groups.map(g => Math.min(g.paidShare, g.organicShare))), groups };
}
export function buildCannibalDetailView(dataset, options = {}) {
  const { country = "", platform = "", outcomeType = "", year = dataset.years.at(-1), minWeeks = 4, baselineWeeks = 8, missingAsZero = false, channelMinShare = 0.1, cutoffDate = "" } = options;
  if (!Number.isInteger(year)) return { segments: [], year: null, stretches: [], comparedWeeks: 0, excludedWeeks: 0, minWeeks, baselineWeeks };
  const invalidWeeks = new Set((dataset.invalidWeeks || []).map(key => JSON.parse(key)).filter(entry => !outcomeType || entry[4] === outcomeType).map(entry => JSON.stringify(entry.slice(0, 4))));
  const rows = dataset.rows.filter(r => (!country || r.country === country) && (!platform || r.platform === platform) && (!outcomeType || r.outcomeType === outcomeType));
  const segmentKeys = [...new Set(rows.map(r => JSON.stringify([r.country, r.platform])))].sort();
  const segments = segmentKeys.map(key => {
    const [countryName, platformName] = JSON.parse(key), segmentRows = rows.filter(r => r.country === countryName && r.platform === platformName);
    const previous = completeWeeks(segmentRows, year - 1), current = completeWeeks(segmentRows, year);
    const points = [...current.entries()].sort(([a], [b]) => a - b).flatMap(([week, c]) => {
      const p = previous.get(week), start = isoWeekStart(year, week);
      const isComplete = !cutoffDate || new Date(`${start}T00:00:00Z`).getTime() + 7 * DAY <= new Date(`${cutoffDate}T00:00:00Z`).getTime();
      const invalidTotal = [year - 1, year].some(y => invalidWeeks.has(JSON.stringify([countryName, platformName, y, week])));
      if (!p || !p.hasOrganic || !c.hasOrganic || !p.hasPaid || !c.hasPaid || !isComplete || invalidTotal) return [];
      return [{ week, paid: c.paid, organic: c.organic, paidPrevious: p.paid, organicPrevious: p.organic, paidDelta: c.paid - p.paid, organicDelta: c.organic - p.organic }];
    });
    const stretches = ["sign", "trend"].flatMap(kind => detectStretches(points, Math.max(1, minWeeks), kind, Math.max(1, baselineWeeks))).sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind)).map((stretch, index) => {
      const paidMove = sum(stretch.points.map(p => p.paidDelta - stretch.paidBase)), organicMove = sum(stretch.points.map(p => p.organicDelta - stretch.organicBase));
      const paidRows = segmentRows.filter(r => !r.organic);
      const channels = movementRows(paidRows, year, stretch, r => r.channel, missingAsZero).map(row => ({ ...row, share: row.move != null && paidMove ? row.move / paidMove : null })).filter(row => row.move == null || row.move * paidMove > 0 && row.share >= channelMinShare).sort((a, b) => Math.abs(b.move || 0) - Math.abs(a.move || 0) || a.name.localeCompare(b.name));
      const campaigns = movementRows(paidRows, year, stretch, r => JSON.stringify([r.channel, r.campaign]), missingAsZero).map(row => {
        const [channel, campaign] = JSON.parse(row.name); return { ...row, channel, campaign, share: row.move != null && paidMove ? row.move / paidMove : null };
      }).sort((a, b) => Math.abs(b.move || 0) - Math.abs(a.move || 0) || a.name.localeCompare(b.name));
      const mixFor = selectPaid => ["gender", "age"].map(axis => mixComparison(segmentRows, year, stretch, axis, selectPaid, missingAsZero));
      return { ...stretch, id: `${key}:${year}:${stretch.kind}:${stretch.start}:${stretch.end}`, number: index + 1, paidMove, organicMove, channels, campaigns, mix: mixFor(() => true),
        channelMix: Object.fromEntries(channels.map(c => [c.name, mixFor(r => r.channel === c.name)])),
        campaignMix: Object.fromEntries(campaigns.map(c => [c.name, mixFor(r => JSON.stringify([r.channel, r.campaign]) === c.name)])) };
    });
    return { country: countryName, platform: platformName, year, points, stretches, excludedWeeks: current.size - points.length };
  });
  return { segments, year, stretches: segments.flatMap(s => s.stretches.map(r => ({ ...r, country: s.country, platform: s.platform }))), comparedWeeks: sum(segments.map(s => s.points.length)), excludedWeeks: sum(segments.map(s => s.excludedWeeks)), minWeeks, baselineWeeks };
}
