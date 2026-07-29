const DAY_MS = 86400000;

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  const parsed = Number(text.replace(/[,\s]/g, ""));
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

function explicitEventPlatform(header) {
  const text = String(header ?? "").toLowerCase();
  if (/android|aos|google.?play|play.?store/.test(text)) return "android";
  if (/ios|iphone|ipad/.test(text)) return "ios";
  return null;
}

function eventPlatform(header, rowPlatform, mappedPlatform) {
  if (mappedPlatform && mappedPlatform !== "common") return mappedPlatform;
  return explicitEventPlatform(header) || rowPlatform || "total";
}

function eventKey(header) {
  return String(header ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mappedStepFields(fields) {
  return (fields?.stepFields || [])
    .map((field) => typeof field === "string" ? { header: field, platform: null } : {
      header: field?.header,
      platform: field?.plat || field?.platform || null,
      stepMode: field?.stepMode || "state",
    })
    .filter((field) => field.header);
}

export function buildAttributedForecastDataset(rows, fields, options = {}) {
  const { timeHeader, platformHeader, channelHeader, spendHeader, targetHeader } = fields || {};
  if (!timeHeader || !channelHeader || !spendHeader || !targetHeader) return null;
  const records = [];
  const steps = mappedStepFields(fields);
  const eventHeaders = steps.map((step) => step.header);
  const stepByHeader = new Map(steps.map((step) => [step.header, step]));
  const eventMap = new Map();
  const eventConflicts = [];
  let invalidPaidCostRows = 0;
  for (const row of rows || []) {
    const week = mondayTimestamp(row[timeHeader]);
    const channel = String(row[channelHeader] ?? "").trim();
    const outcome = parseNumber(row[targetHeader]);
    const cost = parseNumber(row[spendHeader]);
    const platform = canonicalPlatform(platformHeader ? row[platformHeader] : "total");
    if (week != null) {
      eventHeaders.forEach((header) => {
        const value = parseNumber(row[header]);
        if (!Number.isFinite(value)) return;
        const mappedStep = stepByHeader.get(header);
        const explicitPlatform = explicitEventPlatform(header);
        if (explicitPlatform && platform !== explicitPlatform && Math.abs(value) <= 1e-12) return;
        const scope = eventPlatform(header, platform, mappedStep?.platform);
        const key = eventKey(header);
        const mapKey = `${week}::${scope}::${key}`;
        const existing = eventMap.get(mapKey);
        if (existing && Math.abs(existing.value - value) > 1e-12) {
          eventConflicts.push({ week, platform: scope, key, left: existing.value, right: value });
        }
        if (!existing || Math.abs(value) > Math.abs(existing.value)) {
          eventMap.set(mapKey, { week, platform: scope, key, label: header, value });
        }
      });
    }
    if (week == null || !channel || !Number.isFinite(outcome)) continue;
    const organic = isOrganic(channel);
    if (!organic && !Number.isFinite(cost)) invalidPaidCostRows += 1;
    records.push({
      week,
      platform,
      channel,
      organic,
      outcome,
      cost: Number.isFinite(cost) ? Math.max(0, cost) : 0,
    });
  }
  if (!records.some((record) => record.organic) || !records.some((record) => !record.organic)) return null;
  let weeks = [...new Set(records.map((record) => record.week))].sort((left, right) => left - right);
  const hasExplicitAsOf = options.asOfDate != null
    && Number.isFinite(new Date(options.asOfDate).getTime());
  // snapshot 기준일이 없을 때 실행 날짜(Date.now)를 쓰면 같은 CSV 결과가
  // 며칠 뒤 달라진다. 이 경우 최신 주를 보수적으로 제외하는 결정론적 규칙을
  // 쓰고, 파일 수정일/명시 기준일이 있으면 그 시점으로 성숙도를 판정한다.
  const asOf = hasExplicitAsOf
    ? new Date(options.asOfDate).getTime()
    : weeks.at(-1);
  const excludedPartialWeek = Boolean(
    weeks.length && Number.isFinite(asOf) && asOf < weeks.at(-1) + 7 * DAY_MS,
  );
  if (excludedPartialWeek) weeks = weeks.slice(0, -1);
  const weekSet = new Set(weeks);
  const filtered = records.filter((record) => weekSet.has(record.week));
  const rawEvents = [...eventMap.values()].filter((event) => weekSet.has(event.week));
  const stepGroups = new Map();
  rawEvents.forEach((event) => {
    const key = `${event.platform}::${event.key}`;
    const mappedStep = stepByHeader.get(event.label);
    const group = stepGroups.get(key) || { ...event, activeWeeks: new Set(), valuesByWeek: new Map(), stepMode: mappedStep?.stepMode || "state" };
    if (event.value !== 0) group.activeWeeks.add(event.week);
    group.valuesByWeek.set(event.week, event.value);
    stepGroups.set(key, group);
  });
  // Step은 사건 주의 pulse가 아니라 구조 상태다. 매핑된 열에 1이 한 번만 있어도
  // 최초 발생 주부터 이후를 1로 확장한다. 켜졌다 꺼지는 단기 충격은 mapper에서
  // Dummy/Event 역할을 사용해야 한다.
  const events = [...stepGroups.values()].flatMap((group) => {
    const firstActiveWeek = [...group.activeWeeks].sort((left, right) => left - right)[0];
    if (firstActiveWeek == null) return [];
    const outputWeeks = group.stepMode === "boundary" ? weeks.filter((week) => week >= firstActiveWeek) : weeks;
    return outputWeeks.map((week) => ({
      week,
      platform: group.platform,
      key: group.key,
      label: group.label,
      value: group.stepMode === "boundary" ? 1 : group.valuesByWeek.get(week) || 0,
      firstActiveWeek,
      sourceActiveWeeks: group.activeWeeks.size,
      mode: group.stepMode === "boundary" ? "step-boundary" : "step-state",
    }));
  });
  const platforms = [...new Set(filtered.map((record) => record.platform))];
  if (weeks.length < 51 || !platforms.includes("android") || !platforms.includes("ios")) return null;
  return {
    weeks,
    weekLabels: weeks.map(isoDate),
    records: filtered,
    platforms,
    events,
    eventHeaders,
    eventConflicts,
    invalidPaidCostRows,
    snapshotDateSource: hasExplicitAsOf
      ? (options.asOfDateSource || "provided")
      : "conservative-latest-week-excluded",
    snapshotAsOfDate: Number.isFinite(asOf) ? isoDate(asOf) : null,
    excludedPartialWeek,
  };
}
