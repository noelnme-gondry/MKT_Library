// Descriptive click-contributor analysis. This is not causal attribution.
import { reportRows, normalizeReportPlatform, multitouchCapabilities, CONTRIBUTOR_SLOTS } from "../lib/attributionReports/fields";
import { dateBounds } from "../lib/analysisPeriod";
const text = value => String(value ?? "").trim();
const ordered = (a, b) => b.installs - a.installs || a.name.localeCompare(b.name, "en");
export function parseTouchTimestamp(value, utcOffsetMinutes = 0) {
  const raw = text(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/i);
  if (!match) return null; // date-only extracts cannot produce CTIT
  const [, y, mo, d, h, mi, s = "0", ms = "0", zone] = match;
  const timestamp = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) + Number(`0.${ms}`) * 1000;
  const check = new Date(timestamp);
  if (check.getUTCFullYear() !== +y || check.getUTCMonth() !== +mo - 1 || check.getUTCDate() !== +d || +h > 23 || +mi > 59 || +s > 59) return null;
  let offset = utcOffsetMinutes;
  if (zone) {
    if (zone.toUpperCase() === "Z") offset = 0;
    else {
      const normalized = zone.replace(":", "");
      const hours = +normalized.slice(1, 3), minutes = +normalized.slice(3, 5);
      if (hours > 23 || minutes > 59) return null;
      offset = (normalized[0] === "-" ? -1 : 1) * (hours * 60 + minutes);
    }
  }
  return Number.isFinite(offset) ? timestamp - offset * 60000 : null;
}
export function attributionChannel(value) {
  const raw = text(value), name = raw.toLowerCase();
  if (["facebook ads", "facebook_int", "metaweb_int", "meta"].includes(name)) return "Meta";
  if (["googleadwords_int", "google ads", "adwords", "google"].includes(name)) return "Google";
  if (["tiktokglobal_int", "tiktok"].includes(name)) return "TikTok";
  if (["apple search ads", "asa", "apple_search_ads"].includes(name)) return "ASA";
  if (["snapchat_int", "snap"].includes(name)) return "Snap";
  return raw || "Unknown";
}
export function normalizeMultitouch(raw, mapping, { utcOffsetMinutes = 0 } = {}) {
  const rows = reportRows(raw, mapping);
  const byId = new Map();
  let invalidRows = 0, duplicates = 0;
  for (const row of rows) {
    const id = text(row.af_id), installTime = parseTouchTimestamp(row.af_install_time, utcOffsetMinutes);
    if (!id || /^(null|none|nan)$/i.test(id) || installTime == null) { invalidRows++; continue; }
    const key = JSON.stringify([text(row.af_app_id), id]);
    if (byId.has(key)) {
      duplicates++;
      if (installTime >= byId.get(key).installTime) continue;
    }
    byId.set(key, { row, installTime });
  }
  let nonClickInstalls = 0;
  const installs = [];
  for (const { row, installTime } of byId.values()) {
    if (text(row.af_touch_type).toLowerCase() !== "click") { nonClickInstalls++; continue; }
    const contributors = [];
    let unknownTouchTypes = 0;
    for (const n of CONTRIBUTOR_SLOTS) {
      const media = text(row[`af_c${n}_media_source`]);
      if (!media) continue;
      const type = text(row[`af_c${n}_touch_type`]).toLowerCase();
      if (!type) unknownTouchTypes++;
      if (type !== "click") continue;
      contributors.push({ channel: attributionChannel(media), campaign: text(row[`af_c${n}_campaign`]) || "Unknown", time: parseTouchTimestamp(row[`af_c${n}_touch_time`], utcOffsetMinutes), match: text(row[`af_c${n}_match_type`]).toLowerCase(), slot: n });
    }
    contributors.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity) || a.slot - b.slot);
    installs.push({ installTime, touchTime: parseTouchTimestamp(row.af_touch_time, utcOffsetMinutes), channel: attributionChannel(row.channel), campaign: text(row.campaign_name) || "Unknown", country: text(row.country) || "Unknown", platform: normalizeReportPlatform(row.platform) || "Unknown", placement: text(row.af_placement) || "Unknown", contributors, unknownTouchTypes });
  }
  return { installs, invalidRows, duplicates, nonClickInstalls, rawRows: raw.length,
    ...dateBounds(installs.map(i => new Date(i.installTime + utcOffsetMinutes * 60000).toISOString().slice(0, 10))),
    ...multitouchCapabilities(mapping),
    countries: [...new Set(installs.map(i => i.country))].sort(), platforms: [...new Set(installs.map(i => i.platform))].sort(),
    media: [...new Set(installs.map(i => i.channel))].sort(),
  };
}
export const TOUCH_GAP_BUCKETS = ["reversed", "0-5m", "5-30m", "30-60m", "1-6h", "6-12h", "12-24h", "1-3d", ">3d"];
function gapBucket(milliseconds) {
  if (milliseconds < 0) return 0;
  return [5, 30, 60, 360, 720, 1440, 4320].findIndex(minutes => milliseconds <= minutes * 60000) + 1 || 8;
}
function timeSummary(values, installs) {
  const sorted = values.filter(v => v >= 0).sort((a, b) => a - b), n = sorted.length;
  return { installs, valid: n, invalid: installs - n, median: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : null,
    within5m: n ? sorted.filter(v => v <= 300000).length / n : null,
    within1h: n ? sorted.filter(v => v <= 3600000).length / n : null,
    within24h: n ? sorted.filter(v => v <= 86400000).length / n : null,
    within3d: n ? sorted.filter(v => v <= 259200000).length / n : null };
}
export function buildMultitouchView(dataset, options = {}) {
  const { country = "", platform = "", start = "", end = "", excludeProbabilistic = false, splitPlacement = false, focus = "", campaignFocus = "" } = options;
  // Dates refer to the selected report timezone; timestamps are UTC internally.
  const offset = (options.utcOffsetMinutes || 0) * 60000;
  const selected = dataset.installs.filter(i => {
    const day = new Date(i.installTime + offset).toISOString().slice(0, 10);
    return (!country || i.country === country) && (!platform || i.platform === platform) && (!start || day >= start) && (!end || day <= end);
  });
  const mediaOf = i => splitPlacement && dataset.hasPlacement && ["Meta", "TikTok"].includes(i.channel) ? `${i.channel} · ${i.placement}` : i.channel;
  const groups = new Map(), allAssists = new Map(), placements = new Map();
  const campaigns = new Map();
  let unknownMatches = 0, unknownTouchTypes = 0;
  const touchesOf = i => i.contributors.filter(c => !excludeProbabilistic || (c.match && c.match !== "probabilistic"));
  const addRate = (map, name, i, extra = {}) => {
    const entry = map.get(name) || { name, installs: 0, withAssist: 0, withAssistExcluded: 0, ...extra };
    entry.installs++; entry.withAssist += Number(i.contributors.length > 0);
    entry.withAssistExcluded += Number(i.contributors.some(c => c.match && c.match !== "probabilistic"));
    map.set(name, entry);
  };
  selected.forEach(i => {
    const media = mediaOf(i);
    addRate(groups, media, i);
    const placeKey = JSON.stringify([i.channel, i.placement]), place = placements.get(placeKey) || { media: i.channel, placement: i.placement, installs: 0 };
    if (["Meta", "TikTok"].includes(i.channel)) { place.installs++; placements.set(placeKey, place); }
    new Set(touchesOf(i).map(c => c.channel)).forEach(channel => {
      const key = JSON.stringify([media, channel]), entry = allAssists.get(key) || { media, channel, installs: 0 };
      entry.installs++; allAssists.set(key, entry);
    });
    const key = JSON.stringify([media, i.campaign]);
    addRate(campaigns, key, i, { media, campaign: i.campaign });
    unknownMatches += i.contributors.filter(c => !c.match).length;
    unknownTouchTypes += i.unknownTouchTypes;
  });
  const rateRows = map => [...map.values()].map(row => ({ ...row, rateIncluded: row.withAssist / row.installs, rateExcluded: dataset.hasMatchType ? row.withAssistExcluded / row.installs : null,
    rate: excludeProbabilistic ? (dataset.hasMatchType ? row.withAssistExcluded / row.installs : null) : row.withAssist / row.installs })).sort(ordered);
  const scoped = selected.filter(i => (!focus || mediaOf(i) === focus) && (!campaignFocus || i.campaign === campaignFocus));
  const heat = new Map(), assistCampaigns = new Map(), paths = new Map(), ctit = new Map(), gaps = new Map();
  let pathInstalls = 0, unorderedInstalls = 0;
  const addGap = (phase, pair, value) => {
    for (const name of ["All", pair]) {
      const key = JSON.stringify([phase, name]);
      const entry = gaps.get(key) || { phase, name, valid: 0, counts: Array(9).fill(0) };
      entry.valid++; entry.counts[gapBucket(value)]++; gaps.set(key, entry);
    }
  };
  scoped.forEach(i => {
    const media = mediaOf(i), cs = touchesOf(i);
    const timeKey = focus ? i.campaign : media;
    const ts = ctit.get(timeKey) || { installs: 0, values: [] };
    ts.installs++;
    if (i.touchTime != null) ts.values.push(i.installTime - i.touchTime);
    ctit.set(timeKey, ts);
    const channels = new Set(cs.map(c => c.channel));
    channels.forEach(channel => {
      const key = JSON.stringify([media, channel]);
      const entry = heat.get(key) || { media, channel, installs: 0 };
      entry.installs++; heat.set(key, entry);
    });
    new Set(cs.map(c => JSON.stringify([c.channel, c.campaign]))).forEach(key => {
      const [channel, campaign] = JSON.parse(key), entry = assistCampaigns.get(key) || { name: key, channel, campaign, installs: 0 };
      entry.installs++; assistCampaigns.set(key, entry);
    });
    if (!cs.length) return;
    // This pair is independent of contributor chronology. Keep it even when
    // contributor timestamps are missing or tied.
    if (i.touchTime != null) addGap("attributed-install", `${media} → install`, i.installTime - i.touchTime);
    // Minute-precision exports can contain simultaneous recorded touches.
    // Slot number is not evidence of chronological order.
    if (cs.some(c => c.time == null) || cs.some((c, n) => n > 0 && c.time === cs[n - 1].time)) { unorderedInstalls++; return; }
    pathInstalls++;
    const names = cs.map(c => c.channel);
    const key = JSON.stringify([...names, media]);
    const entry = paths.get(key) || { name: key, touches: names, media, installs: 0 };
    entry.installs++; paths.set(key, entry);
    for (let n = 0; n < cs.length - 1; n++) addGap(n === 0 ? "first-second" : "second-third", `${cs[n].channel} → ${cs[n + 1].channel}`, cs[n + 1].time - cs[n].time);
    if (i.touchTime != null) {
      addGap("last-attributed", `${cs.at(-1).channel} → ${media}`, i.touchTime - cs.at(-1).time);
    }
  });
  const heatDenominators = new Map();
  scoped.forEach(i => heatDenominators.set(mediaOf(i), (heatDenominators.get(mediaOf(i)) || 0) + 1));
  const selectedDates = selected.map(i => new Date(i.installTime + offset).toISOString().slice(0, 10)).sort();
  const total = selected.length, withAssist = selected.filter(i => touchesOf(i).length).length;
  return { total, withAssist, rate: total && (!excludeProbabilistic || dataset.hasMatchType) ? withAssist / total : null, dateStart: selectedDates[0] || null, dateEnd: selectedDates.at(-1) || null, scopedInstalls: scoped.length, unknownMatches, unknownTouchTypes, pathInstalls, unorderedInstalls,
    mediaRows: rateRows(groups).map(row => ({ ...row, topContributors: [...allAssists.values()].filter(a => a.media === row.name).sort((a, b) => b.installs - a.installs || a.channel.localeCompare(b.channel)).slice(0, 3) })),
    placements: [...placements.values()].sort((a, b) => a.media.localeCompare(b.media) || b.installs - a.installs || a.placement.localeCompare(b.placement)),
    campaignRows: rateRows(campaigns).filter(row => !focus || row.media === focus),
    heat: [...heat.values()].map(row => ({ ...row, share: row.installs / (heatDenominators.get(row.media) || 1) })),
    assistCampaigns: [...assistCampaigns.values()].sort(ordered), paths: [...paths.values()].sort(ordered),
    ctit: [...ctit.entries()].map(([name, entry]) => ({ name, ...timeSummary(entry.values, entry.installs) })).sort((a, b) => b.installs - a.installs || a.name.localeCompare(b.name)),
    gaps: [...gaps.values()].map(row => ({ ...row, shares: row.counts.map(n => n / row.valid) })).sort((a, b) => a.phase.localeCompare(b.phase) || (a.name === "All" ? -1 : b.name === "All" ? 1 : b.valid - a.valid || a.name.localeCompare(b.name))),
  };
}

// Each absent-touch node retains its upstream history. Distinct paths are never
// collapsed into one shared "none" band, and all installed volume is conserved.
export function multitouchFlow(paths) {
  const nodes = new Map(), links = new Map();
  paths.forEach(path => {
    const history = [], chain = [];
    for (let lane = 0; lane < 4; lane++) {
      const isMissing = lane < 3 && !path.touches[lane];
      const label = lane === 3 ? path.media : path.touches[lane] || "None";
      const id = JSON.stringify([lane, isMissing ? "missing" : "channel", label, ...(isMissing ? history : [])]);
      const node = nodes.get(id) || { id, lane, label, isMissing, parentId: chain.at(-1), history: history.map(item => item[1] || "None"), volume: 0 };
      node.volume += path.installs; nodes.set(id, node); chain.push(id); history.push(label);
      history[history.length - 1] = isMissing ? ["missing"] : ["channel", label];
    }
    for (let n = 0; n < 3; n++) {
      const key = JSON.stringify([chain[n], chain[n + 1]]), link = links.get(key) || { source: chain[n], target: chain[n + 1], value: 0 };
      link.value += path.installs; links.set(key, link);
    }
  });
  const orderedNodes = [], position = new Map();
  for (let lane = 0; lane < 4; lane++) {
    const layer = [...nodes.values()].filter(node => node.lane === lane).sort((a, b) => Number(a.isMissing) - Number(b.isMissing)
      || (a.isMissing ? (position.get(a.parentId) || 0) - (position.get(b.parentId) || 0) : b.volume - a.volume) || a.id.localeCompare(b.id));
    layer.forEach((node, index) => position.set(node.id, index)); orderedNodes.push(...layer);
  }
  return { nodes: orderedNodes, links: [...links.values()] };
}
