"use client";
import { useState } from "react";
import { _mmmParseDate } from "@/utils/regForecastMath";
import { mmmExcelSerialDateTimestamp, mmmParseNumericValue } from "@/utils/mmmInputUtils";

/* index.html의 5-18 DnD colMap(§12.20류 이관) — mmmGuessRole/mmmAutoMapPartial/
 * mmmColMapRoles/mmmGetPanelFromColMap을 React 네이티브 HTML5 DnD로 포팅.
 * colMap: { [header]: { role, kind?, plat? } }
 * role: week|date|reg|react|revenue|channel|dummy|step|external|platform|ignore */

const MMM_DAY_MS = 86400000;

function isoWeekMonday(year, week) {
  if (!(year >= 1900) || !(week >= 1 && week <= 53)) return null;
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Day = new Date(jan4).getUTCDay() || 7;
  const timestamp = jan4 - (jan4Day - 1) * MMM_DAY_MS + (week - 1) * 7 * MMM_DAY_MS;
  return new Date(timestamp + 3 * MMM_DAY_MS).getUTCFullYear() === year ? timestamp : null;
}

// 시간축을 원본 문자열 정렬이 아니라 canonical key로 비교한다. `2025-W01`과
// `2025W1`은 같은 ISO-week Monday이며, 달력 날짜는 rollover(2025-02-31)를
// 허용하지 않는다. 숫자형 주차는 별도 index kind로 유지한다.
function mappedTimeKey(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return { kind: "date", value: value.getTime(), source: "calendar-date" };
  const text = String(value ?? "").trim();
  if (!text) return null;
  const isoWeek = text.match(/^(\d{4})\s*-?\s*W\s*(\d{1,2})$/i);
  if (isoWeek) {
    const timestamp = isoWeekMonday(Number(isoWeek[1]), Number(isoWeek[2]));
    return timestamp == null ? null : { kind: "date", value: timestamp, source: "iso-week" };
  }
  const ymd = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (ymd) {
    const year = Number(ymd[1]), month = Number(ymd[2]), day = Number(ymd[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const parsed = new Date(timestamp);
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
    return { kind: "date", value: timestamp, source: "calendar-date" };
  }
  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const excelTimestamp = mmmExcelSerialDateTimestamp(value);
    if (excelTimestamp != null) return { kind: "date", value: excelTimestamp, source: "excel-serial-date" };
  }
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return { kind: "index", value: Number(text), source: "numeric-week" };
  const parsed = _mmmParseDate(value);
  return parsed ? { kind: "date", value: parsed.getTime(), source: "calendar-date" } : null;
}

function weekStartTimestamp(timestamp, weekStart) {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  const daysSinceStart = weekStart === "sunday"
    ? date.getUTCDay()
    : (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceStart);
  return date.getTime();
}

function formatWeekStart(timestamp) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function expectedDailyCadence(counts) {
  const frequencies = new Map();
  counts.filter((count) => count > 0).forEach((count) => frequencies.set(count, (frequencies.get(count) || 0) + 1));
  const modalDays = [...frequencies.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] || 0;
  return modalDays >= 5 ? (modalDays >= 6 ? 7 : 5) : null;
}

function looksDate(value) {
  return mappedTimeKey(value)?.kind === "date";
}

function guessPlat(name) {
  const s = String(name).toLowerCase();
  const hasA = /(android|aos|google_?play|playstore)/.test(s);
  const hasI = /(^|_)ios(_|$)/.test(s) || /(iphone|ipad)/.test(s);
  if (hasA && hasI) return s.lastIndexOf("android") > s.lastIndexOf("ios") ? "android" : "ios";
  if (hasA) return "android";
  if (hasI) return "ios";
  return "common";
}

// 더미/step은 숫자 parser의 관대한 기호 제거를 쓰지 않는다. `foo`, 공란,
// `2`를 0으로 바꾸면 mmmValidate가 잘못된 설계를 볼 수 없으므로, 문서화된
// binary label만 정확히 0/1로 바꾸고 나머지는 NaN으로 보존한다.
const MMM_BINARY_TRUE = new Set(["true", "yes", "y", "on", "enabled", "active", "occurred", "발생", "있음", "예", "온", "켜기", "활성"]);
const MMM_BINARY_FALSE = new Set(["false", "no", "n", "off", "disabled", "inactive", "notoccurred", "미발생", "없음", "아니오", "오프", "끄기", "비활성"]);
const MMM_REGIME_TRUE = new Set(["post", "after", "afterchange", "newregime", "사후", "변경후", "이후"]);
const MMM_REGIME_FALSE = new Set(["pre", "before", "beforechange", "oldregime", "사전", "변경전", "이전"]);

function mmmParseBinaryIndicator(value, role = "dummy") {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return Number.isFinite(value) && (value === 0 || value === 1) ? value : NaN;
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return NaN;
  if (/^(?:0(?:\.0+)?|1(?:\.0+)?)$/.test(raw)) return Number(raw);
  const label = raw.replace(/[\s_-]+/g, "");
  if (MMM_BINARY_TRUE.has(label) || (role === "step" && MMM_REGIME_TRUE.has(label))) return 1;
  if (MMM_BINARY_FALSE.has(label) || (role === "step" && MMM_REGIME_FALSE.has(label))) return 0;
  return NaN;
}

function guessRole(col, rows) {
  const name = String(col).toLowerCase();
  const vals = rows.map((r) => r[col]).filter((v) => v != null && String(v).trim() !== "");
  const nums = vals.map(mmmParseNumericValue).filter(Number.isFinite);
  const isNum = nums.length >= vals.length * 0.7 && vals.length > 0;
  const binaryRole = /step|구조변화|regime|레짐|shutdown|중단|종료|launch|런칭/.test(name) ? "step" : "dummy";
  const binaryValues = vals.map((value) => mmmParseBinaryIndicator(value, binaryRole));
  const isBin = vals.length > 0 && binaryValues.every(Number.isFinite);
  const kind = /brand|브랜드/.test(name) ? "brand" : "perf";
  const hasDateHeader = /(^|[_\s])(date|day|ds)([_\s]|$)|날짜|일자/i.test(name);
  const hasDateText = vals.filter((value) => /\d{4}[-/.]|\d{4}\s*-?\s*W/i.test(String(value))).length >= vals.length * 0.7;
  // 5자리 spend(예: 50,000)를 Excel serial date로 오인하지 않는다. 숫자형
  // serial은 date/day/ds 헤더일 때만, 명시적 날짜 문자열은 헤더와 무관하게 허용한다.
  const isDateCol = vals.length > 0 && (hasDateHeader || hasDateText) && vals.filter(looksDate).length >= vals.length * 0.7;
  const isExplicitSpend = /(^|[_\s])(spend|cost|budget)([_\s]|$)|(?:spend|cost|budget)$|비용|지출|예산/i.test(name);
  let role = "ignore";
  if (/^(week|t|wk)$/.test(name) || /week|주차|주인덱스/.test(name)) role = "week";
  else if (isDateCol) role = "date";
  else if (/날짜|date/.test(name)) role = "date";
  else if (isBin && binaryRole === "step") role = "step";
  else if (isBin) role = "dummy";
  else if (isNum && isExplicitSpend) role = "channel";
  else if (isNum && /revenue|매출|sales|gmv|payment|결제금액/.test(name)) role = "revenue";
  else if (isNum && /purchaser|buyer|구매자|결제자/.test(name)) role = "purchasers";
  else if (isNum && /traffic|total.?visit|총.?유입|방문자|sessions?/.test(name)) role = "traffic";
  else if (isNum && /industry|market|category|업계|시장.?수요|카테고리.?수요/.test(name)) role = "external";
  else if (isNum && /reg|가입|등록|signup|sign_up|install/.test(name)) role = "reg";
  else if (isNum && /react|재활성|reactiv|resurrect|win.?back|winback/.test(name)) role = "react";
  else if (isNum && /cost|spend|비용|지출|budget|imp|click|ch_|채널|brand/.test(name)) role = "channel";
  else if (!isNum && /platform|os|플랫폼|기기|device|segment|세그/.test(name)) role = "platform";
  else if (isNum) role = "channel";
  return { role, kind };
}

// 부분 자동 매핑(index.html mmmAutoMapPartial 이식) — reg/react/채널 spend만 강한 키워드로 배치,
// 나머지(week·더미·플랫폼·impression/click·파생컬럼 등)는 전부 트레이(ignore)에 남겨 사용자가 직접 드래그.
// partial=false(🪄 전부 자동 추정)면 guessRole 전체 휴리스틱(catch-all 포함) 사용.
export function autoGuessColMap(headers, rows, partial = true) {
  const derivedRe = /^\s*(ln|log|sin|cos)\s*[\(_]|^\s*(ln|log|sin|cos)\b|description/i;
  const out = {};
  const once = { week: false, date: false, platform: false };
  for (const h of headers || []) {
    const name = String(h).toLowerCase();
    if (!partial) {
      const g = guessRole(h, rows || []);
      let role = g.role;
      if (role in once) {
        if (once[role]) role = "ignore";
        else once[role] = true;
      }
      out[h] = { role, kind: g.kind };
      if (["reg", "react", "traffic", "purchasers", "revenue", "channel", "dummy", "step", "external"].includes(role)) out[h].plat = guessPlat(h);
      continue;
    }
    // partial: 강한 키워드만. isNum·isBin·isDateCol 판정 후 reg/react/channel/date만.
    const vals = (rows || []).map((r) => r[h]).filter((v) => v != null && String(v).trim() !== "");
    const nums = vals.map(mmmParseNumericValue).filter(Number.isFinite);
    const isNum = nums.length >= vals.length * 0.7 && vals.length > 0;
    const uniq = [...new Set(nums)];
    const isBin = isNum && uniq.every((v) => v === 0 || v === 1) && uniq.length <= 2;
    const hasDateHeader = /(^|[_\s])(date|day|ds)([_\s]|$)|날짜|일자/i.test(name);
    const hasDateText = vals.filter((value) => /\d{4}[-/.]|\d{4}\s*-?\s*W/i.test(String(value))).length >= vals.length * 0.7;
    const isDateCol = vals.length > 0 && (hasDateHeader || hasDateText) && vals.filter(looksDate).length >= vals.length * 0.7;
    const kind = /brand|브랜드/.test(name) ? "brand" : "perf";
    const isExplicitSpend = /(^|[_\s])(spend|cost|budget)([_\s]|$)|(?:spend|cost|budget)$|비용|지출|예산/i.test(name);
    let role = "ignore";
    if (/^(week|t|wk)$/.test(name) || /week|주차|주인덱스/.test(name)) {
      role = once.week ? "ignore" : "week";
      once.week = true;
    }
    else if (isDateCol) role = "date"; // 날짜는 분석 무영향(표시/예측용)이라 자동 배치
    else if (!derivedRe.test(name) && isNum && !isBin) {
      if (isExplicitSpend) role = "channel";
      else if (/revenue|매출|sales|gmv|payment|결제금액/.test(name)) role = "revenue";
      else if (/purchaser|buyer|구매자|결제자/.test(name)) role = "purchasers";
      else if (/traffic|total.?visit|총.?유입|방문자|sessions?/.test(name)) role = "traffic";
      else if (/industry|market|category|업계|시장.?수요|카테고리.?수요/.test(name)) role = "external";
      else if (/reg|가입|등록|signup|sign_up|install/.test(name)) role = "reg";
      else if (/react|재활성|reactiv|resurrect|win.?back|winback/.test(name)) role = "react";
      else if (/spend|cost|비용|지출|budget|brand/.test(name)) role = "channel";
    }
    if (role === "ignore" && !isNum && /platform|os|플랫폼|기기|device/.test(name)) {
      role = once.platform ? "ignore" : "platform";
      once.platform = true;
    }
    if (role === "date") { if (once.date) role = "ignore"; else once.date = true; }
    out[h] = { role, kind };
    if (["reg", "react", "traffic", "purchasers", "revenue", "channel", "dummy", "step", "external"].includes(role)) out[h].plat = guessPlat(h);
  }
  return out;
}

function sanKey(name, used) {
  // 한글·일본어 등 비ASCII 헤더를 지우면 서로 다른 채널이 c/c2가 되어 헤더
  // 순서에 따라 prior가 다른 매체로 붙는다. Unicode 문자·숫자를 보존해 동일
  // 헤더는 메인/참고국 파일의 열 순서와 무관하게 같은 key가 되게 한다.
  let b = "c_" + String(name).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
  if (b === "c_") b = "c";
  let k = b, i = 2;
  while (used.has(k)) { k = b + i; i++; }
  used.add(k);
  return k;
}

function colMapRoles(headers, colMap) {
  const out = { week: [], date: null, reg: [], react: [], traffic: [], purchasers: [], revenue: [], platform: null, channels: [], dummies: [], steps: [], externals: [] };
  const used = new Set();
  for (const h of headers || []) {
    const def = colMap[h] || {};
    // 이전 저장 매핑에는 dummy/step의 plat이 없었다. 이 경우 common으로
    // 처리하면 `ios_Delist` 같은 iOS 구조변화가 Android 패널에도 들어간다.
    // 명시 태그가 최우선이고, 없을 때만 헤더명에서 OS를 복구한다. 따라서
    // 기존 사용자의 저장 매핑도 다시 드래그하지 않아도 OS별 패널이 분리된다.
    const r = def.role, plat = def.plat || guessPlat(h);
    if (r === "week") out.week.push({ header: h, plat });
    else if (r === "date" && !out.date) out.date = h;
    else if (r === "reg") out.reg.push({ header: h, plat });
    else if (r === "react") out.react.push({ header: h, plat });
    else if (r === "traffic") out.traffic.push({ header: h, plat });
    else if (r === "purchasers") out.purchasers.push({ header: h, plat });
    else if (r === "revenue") out.revenue.push({ header: h, plat });
    else if (r === "platform" && !out.platform) out.platform = h;
    else if (r === "channel") out.channels.push({ header: h, key: sanKey(h, used), label: h, kind: def.kind === "brand" ? "brand" : "perf", plat });
    else if (r === "dummy") out.dummies.push({ header: h, key: sanKey(h, used), label: h, plat });
    else if (r === "step") out.steps.push({ header: h, key: sanKey(h, used), label: h, plat });
    else if (r === "external") out.externals.push({ header: h, key: sanKey(h, used), label: h, plat });
  }
  return out;
}

export function colMapMissing(headers, colMap, locale = "ko") {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  if (!colMap) return [tr("채널·타깃 매핑", "channel & target mapping")];
  const r = colMapRoles(headers, colMap);
  const miss = [];
  if (!r.date && !r.week.length && (r.platform || colMap.__mmmRowOrderConfirmed !== true)) {
    miss.push(r.platform
      ? tr("플랫폼 행을 주별로 합칠 날짜/주차", "date/week for combining platform rows by period")
      : tr("날짜/주차 또는 '이미 주별·정렬됨' 확인", "date/week or 'already weekly and ordered' confirmation"));
  }
  if (!r.reg.length && !r.react.length && !r.traffic.length && !r.purchasers.length && !r.revenue.length) miss.push(tr("유입·가입·재유입·구매자·매출 중 타깃 1개", "1 target among traffic/regs/reactivation/purchasers/revenue"));
  if (!r.channels.length) miss.push(tr("채널 spend 1개 이상", "1+ channel spend"));
  return miss;
}

// 컬럼 태그 모드(플랫폼 단일 컬럼 없이 헤더명 android/ios 태그로 구분)인지 + 존재하는 태그 목록.
// index mmmIsTagMode/mmmColMapPlatforms 이식.
export function mmmPlatformTags(headers, colMap) {
  const r = colMapRoles(headers, colMap);
  if (r.platform) return []; // 행 필터(단일 컬럼) 모드는 태그 토글 대상 아님 — 값 자체가 플랫폼
  const set = new Set();
  [...r.reg, ...r.react, ...r.traffic, ...r.purchasers, ...r.revenue, ...r.channels, ...r.externals].forEach((x) => {
    if (x.plat && x.plat !== "common") set.add(x.plat);
  });
  return [...set];
}

// 단일 컬럼 세그먼트(platform role) 모드일 때 그 컬럼의 고유 값 목록(빈도순, 상위 20).
// 성별·플랫폼·국가 등 임의 차원을 값별 pill 토글로 노출하기 위한 열거. 태그 모드
// (r.platform 없음)에선 [] 반환 — 그건 mmmPlatformTags가 담당.
export function mmmSegmentValues(headers, rows, colMap) {
  const r = colMapRoles(headers, colMap);
  if (!r.platform) return null;
  const freq = new Map();
  for (const row of rows || []) {
    const v = row[r.platform];
    if (v == null || String(v).trim() === "") continue;
    const key = String(v);
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  const all = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return {
    col: r.platform,
    values: all.slice(0, 20).map(([value, count]) => ({ value, count })),
    truncated: all.length > 20,
  };
}

function longFormatHeader(headers, expression) {
  return (headers || []).find((header) => expression.test(String(header).trim()));
}

// long-format MMM 입력: `week | channel | spend | target`.
// 타깃은 해당 주의 전체값이 채널별 행에서 반복된다는 계약으로 첫 유효값만 보존하고,
// 채널 spend만 주차×채널 wide 형태로 pivot한다. 타깃을 행 수만큼 더하면 가짜 성과가 된다.
function pivotLongFormat(headers, rows, colMap) {
  const roles = colMapRoles(headers, colMap);
  const channelHeader = longFormatHeader(headers, /(^|[_\s])(channel|media|source|network)([_\s]|$)|채널|매체/i);
  const spendHeader = longFormatHeader(headers, /(^|[_\s])(spend|cost|budget|expense)([_\s]|$)|지출|비용|예산/i);
  const timeHeader = roles.date || roles.week[0]?.header;
  const onlySpendMapped = roles.channels.length === 0 || roles.channels.every((channel) => channel.header === spendHeader);
  if (!channelHeader || !spendHeader || !timeHeader || !onlySpendMapped) return null;

  const channelToHeader = new Map();
  const usedHeaders = new Set(headers || []);
  const makeChannelHeader = (channel) => {
    const canonical = String(channel).normalize("NFKC").toLocaleLowerCase("en-US");
    if (channelToHeader.has(canonical)) return channelToHeader.get(canonical);
    const base = `MMM spend · ${channel}`;
    let header = base;
    let n = 2;
    while (usedHeaders.has(header)) { header = `${base} ${n}`; n += 1; }
    usedHeaders.add(header);
    channelToHeader.set(canonical, header);
    return header;
  };

  const diagnostics = {
    sourceRows: (rows || []).length,
    droppedInvalidRows: 0,
    blankTimeRows: 0,
    unparseableTimeRows: 0,
    blankChannelRows: 0,
    repeatedValueConflicts: 0,
    conflictingHeaders: new Set(),
  };
  const targetHeaders = new Set([
    ...roles.reg, ...roles.react, ...roles.traffic, ...roles.purchasers, ...roles.revenue,
  ].map((item) => item.header));
  const externalHeaders = new Set(roles.externals.map((item) => item.header));
  const binaryHeaders = new Map([
    ...roles.dummies.map((item) => [item.header, "dummy"]),
    ...roles.steps.map((item) => [item.header, "step"]),
  ]);
  const repeatedHeaders = new Set([...targetHeaders, ...externalHeaders, ...binaryHeaders.keys()]);
  const isBlank = (value) => value == null || String(value).trim() === "";
  const canonicalRepeated = (header, value) => {
    if (binaryHeaders.has(header)) return mmmParseBinaryIndicator(value, binaryHeaders.get(header));
    return mmmParseNumericValue(value);
  };
  const grouped = new Map();
  for (const row of rows || []) {
    const rawTime = row[timeHeader];
    const time = String(rawTime ?? "").trim();
    const channel = String(row[channelHeader] ?? "").trim();
    const parsedTime = mappedTimeKey(rawTime);
    if (!parsedTime || !channel) {
      if (!parsedTime) {
        diagnostics.droppedInvalidRows += 1;
        if (!time) diagnostics.blankTimeRows += 1;
        else diagnostics.unparseableTimeRows += 1;
      }
      if (!channel) diagnostics.blankChannelRows += 1;
      continue;
    }
    // 세그먼트 컬럼이 있으면 Android/iOS 같은 시계열을 서로 섞지 않는다.
    const segment = roles.platform ? String(row[roles.platform] ?? "") : "";
    const key = `${parsedTime.kind}:${parsedTime.value}\u0001${segment}`;
    const existing = grouped.get(key);
    const item = existing || { ...row };
    // 첫 행의 타깃이 비어 있으면 이후 같은 주의 유효값을 채운다. 이미 값이 있으면
    // 반복 타깃을 더하지 않는다.
    for (const header of repeatedHeaders) {
      if (!existing || isBlank(row[header])) continue;
      if (isBlank(item[header])) {
        item[header] = row[header];
        continue;
      }
      if (Number.isNaN(item[header])) continue;
      const current = canonicalRepeated(header, item[header]);
      const incoming = canonicalRepeated(header, row[header]);
      if (!Number.isFinite(current) || !Number.isFinite(incoming) || Math.abs(current - incoming) > 1e-9 * Math.max(1, Math.abs(current), Math.abs(incoming))) {
        item[header] = NaN;
        diagnostics.repeatedValueConflicts += 1;
        diagnostics.conflictingHeaders.add(header);
      }
    }
    for (const header of headers || []) {
      if (header === channelHeader || header === spendHeader) continue;
      if (repeatedHeaders.has(header)) continue;
      if ((item[header] == null || String(item[header]).trim() === "") && row[header] != null && String(row[header]).trim() !== "") item[header] = row[header];
    }
    const dynamicHeader = makeChannelHeader(channel);
    const spendValue = mmmParseNumericValue(row[spendHeader]);
    const previous = item[dynamicHeader];
    const previousValue = mmmParseNumericValue(previous);
    item[dynamicHeader] = !Number.isFinite(spendValue)
      ? NaN
      : previous == null || String(previous).trim() === ""
        ? spendValue
        : Number.isFinite(previousValue)
          ? previousValue + spendValue
          : NaN;
    grouped.set(key, item);
  }
  if (!grouped.size || !channelToHeader.size) return null;

  const nextHeaders = (headers || []).filter((header) => header !== channelHeader && header !== spendHeader);
  const nextMap = { ...colMap, [channelHeader]: { ...(colMap[channelHeader] || {}), role: "ignore" }, [spendHeader]: { ...(colMap[spendHeader] || {}), role: "ignore" } };
  for (const [channel, header] of channelToHeader) {
    nextHeaders.push(header);
    nextMap[header] = { role: "channel", kind: /brand|브랜드/i.test(channel) ? "brand" : "perf", plat: "common" };
  }
  return {
    headers: nextHeaders,
    rows: [...grouped.values()],
    colMap: nextMap,
    diagnostics: { ...diagnostics, conflictingHeaders: [...diagnostics.conflictingHeaders].sort((a, b) => a.localeCompare(b)) },
  };
}

// colMap → MMM panel (index mmmGetPanelFromColMap 이식). platform: "all"|"android"|"ios" —
// 컬럼 태그 모드면 plat 일치(+공통) 컬럼만 선택, 플랫폼 단일 컬럼(행필터) 모드면 그 값으로 행 필터.
export function buildPanelFromColMap(headers, rows, colMap, platform = "all", locale = "ko", inheritedDiagnostics = null, options = {}) {
  const pivoted = pivotLongFormat(headers, rows, colMap);
  if (pivoted) return buildPanelFromColMap(pivoted.headers, pivoted.rows, pivoted.colMap, platform, locale, pivoted.diagnostics, options);
  const weekStart = options.weekStart === "sunday" ? "sunday" : "monday";
  const r = colMapRoles(headers, colMap);
  const tagMode = !r.platform && mmmPlatformTags(headers, colMap).length > 0;
  const P = platform === "all" ? null : platform;
  const inPlat = (x) => !tagMode || !P || x.plat === P || x.plat === "common";
  // OS가 분리된 회귀에서는 귀속을 알 수 없는 `other_cost`를 매체 효과로
  // 추정하면 Android/iOS 계수가 왜곡된다. 사용자가 명시적으로 채널로
  // 매핑했더라도 이 패널에서는 제외한다.
  const isAmbiguousOtherCost = (x) => /(^|[_\s])(other|etc|misc|기타)([_\s]|$)/i.test(String(x.header || x.label || ""));
  let baseRows = rows || [];
  if (r.platform && P) baseRows = baseRows.filter((row) => String(row[r.platform]) === P);
  const expectedSegments = r.platform
    ? [...new Set(baseRows.map((row) => String(row[r.platform] ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    : [];
  const timeDiagnostics = {
    sourceRows: inheritedDiagnostics?.sourceRows ?? baseRows.length,
    droppedInvalidRows: inheritedDiagnostics?.droppedInvalidRows || 0,
    blankTimeRows: inheritedDiagnostics?.blankTimeRows || 0,
    unparseableTimeRows: inheritedDiagnostics?.unparseableTimeRows || 0,
    blankChannelRows: inheritedDiagnostics?.blankChannelRows || 0,
    repeatedValueConflicts: inheritedDiagnostics?.repeatedValueConflicts || 0,
    conflictingHeaders: inheritedDiagnostics?.conflictingHeaders || [],
    duplicatePeriods: 0,
    internalPartialWeeks: 0,
    boundaryPartialWeeks: 0,
    expectedDaysPerWeek: null,
    internalIncompletePlatformWeeks: 0,
    boundaryIncompletePlatformWeeks: 0,
    mixedPlatformCadence: false,
    platformCoverage: null,
    weekStart,
    issues: [],
    warnings: [],
  };
  const num = (h, allowNaN) => baseRows.map((row) => {
    const v = row[h];
    if (v == null || String(v).trim() === "") return allowNaN ? NaN : 0;
    const n = mmmParseNumericValue(v);
    return isNaN(n) ? (allowNaN ? NaN : 0) : n;
  });
  const weekC = r.week[0] || null;
  // 날짜를 parseFloat하면 2025-01-06 → 2025가 되어 같은 해 모든 주가 동률이 된다.
  // 시간순 정렬은 원본 date/week 값을 파싱해 하고, MMM 내부 t는 항상 1…N으로 정규화한다.
  const timeHeader = r.date || weekC?.header || null;
  // 일자별 패널은 사용자가 고른 일요일/월요일 시작 주간으로 합산한다. 단일 platform 컬럼의 Total도
  // 같은 주 Android/iOS 행을 한 주로 합친다. KPI·지출은 합계, 이벤트는
  // 해당 주 발생 여부(max)다. step은 발생 이벤트가 아니라 regime 상태이므로
  // 주 안에서 0/1이 섞이면 NaN으로 남겨 경계 주를 차단한다.
  if ((r.date || (weekC && r.platform)) && baseRows.length) {
    const additiveHeaders = new Set([
      ...r.reg, ...r.react, ...r.traffic, ...r.purchasers, ...r.revenue, ...r.channels,
    ].map((item) => item.header));
    // 업계 지수는 일자/플랫폼 행에 반복될 수 있는 level control이다. KPI·spend처럼
    // 합산하면 주간 시장 규모가 행 수만큼 부풀므로 유효값 평균으로 묶는다.
    const externalHeaders = new Set(r.externals.map((item) => item.header));
    const binaryRoles = new Map([
      ...r.dummies.map((item) => [item.header, "dummy"]),
      ...r.steps.map((item) => [item.header, "step"]),
    ]);
    const binaryHeaders = new Set(binaryRoles.keys());
    const modelHeaders = new Set([...additiveHeaders, ...externalHeaders, ...binaryHeaders]);
    const numericValue = (value) => {
      if (value == null || String(value).trim() === "") return NaN;
      const parsed = mmmParseNumericValue(value);
      return Number.isFinite(parsed) ? parsed : NaN;
    };
    const groups = new Map();
    baseRows.forEach((row) => {
      const rawTime = row[timeHeader];
      const parsedTime = mappedTimeKey(rawTime);
      if (!parsedTime) {
        timeDiagnostics.droppedInvalidRows += 1;
        if (rawTime == null || String(rawTime).trim() === "") timeDiagnostics.blankTimeRows += 1;
        else timeDiagnostics.unparseableTimeRows += 1;
        return;
      }
      // ISO week는 이미 주 단위 입력이며 항상 ISO 월요일 라벨을 유지한다. 일자형
      // 원자료만 일요일 시작 또는 월요일 시작으로 다시 묶는다.
      const shouldRegroupDate = parsedTime.kind === "date" && parsedTime.source !== "iso-week";
      const periodValue = shouldRegroupDate ? weekStartTimestamp(parsedTime.value, weekStart) : parsedTime.value;
      const normalizedTime = parsedTime.kind === "date" ? formatWeekStart(periodValue) : String(periodValue);
      const key = `${parsedTime.kind}:${periodValue}`;
      let item = groups.get(key);
      if (!item) {
        item = { ...row };
        Object.defineProperty(item, "__mmmMissingAdditive", { value: new Set(), enumerable: false, configurable: true });
        Object.defineProperty(item, "__mmmPeriodValue", { value: periodValue, enumerable: false, configurable: true });
        Object.defineProperty(item, "__mmmTimeKind", { value: parsedTime.kind, enumerable: false, configurable: true });
        Object.defineProperty(item, "__mmmDistinctDates", { value: new Set(), enumerable: false, configurable: true });
        Object.defineProperty(item, "__mmmDatesBySegment", { value: new Map(), enumerable: false, configurable: true });
        Object.defineProperty(item, "__mmmSegments", { value: new Set(), enumerable: false, configurable: true });
        Object.defineProperty(item, "__mmmDailyKeys", { value: new Set(), enumerable: false, configurable: true });
        Object.defineProperty(item, "__mmmInvalidBinary", { value: new Set(), enumerable: false, configurable: true });
        Object.defineProperty(item, "__mmmStepStates", { value: new Map(), enumerable: false, configurable: true });
        Object.defineProperty(item, "__mmmExternalCounts", { value: new Map(), enumerable: false, configurable: true });
        item[timeHeader] = normalizedTime;
        for (const header of modelHeaders) {
          if (binaryHeaders.has(header)) {
            const role = binaryRoles.get(header);
            const value = mmmParseBinaryIndicator(row[header], role);
            item[header] = value;
            if (!Number.isFinite(value)) item.__mmmInvalidBinary.add(header);
            if (role === "step" && Number.isFinite(value)) item.__mmmStepStates.set(header, new Set([value]));
            continue;
          }
          const value = numericValue(row[header]);
          if (externalHeaders.has(header)) {
            item[header] = Number.isFinite(value) ? value : "";
            if (Number.isFinite(value)) item.__mmmExternalCounts.set(header, 1);
            continue;
          }
          item[header] = Number.isFinite(value) ? value : "";
          if (!Number.isFinite(value)) item.__mmmMissingAdditive.add(header);
        }
      } else {
        for (const header of modelHeaders) {
          if (binaryHeaders.has(header)) {
            const role = binaryRoles.get(header);
            const value = mmmParseBinaryIndicator(row[header], role);
            if (!Number.isFinite(value)) {
              item.__mmmInvalidBinary.add(header);
              item[header] = NaN;
              continue;
            }
            if (item.__mmmInvalidBinary.has(header)) continue;
            if (role === "dummy") {
              const current = mmmParseBinaryIndicator(item[header], role);
              item[header] = Math.max(Number.isFinite(current) ? current : 0, value);
            } else {
              const states = item.__mmmStepStates.get(header) || new Set();
              states.add(value);
              item.__mmmStepStates.set(header, states);
              item[header] = states.size === 1 ? value : NaN;
            }
            continue;
          }
          const value = numericValue(row[header]);
          if (externalHeaders.has(header)) {
            if (!Number.isFinite(value)) continue;
            const current = numericValue(item[header]);
            const count = item.__mmmExternalCounts.get(header) || 0;
            item[header] = Number.isFinite(current) && count > 0 ? (current * count + value) / (count + 1) : value;
            item.__mmmExternalCounts.set(header, count + 1);
            continue;
          }
          if (!Number.isFinite(value)) {
            item.__mmmMissingAdditive.add(header);
            continue;
          }
          const current = numericValue(item[header]);
          item[header] = (Number.isFinite(current) ? current : 0) + value;
        }
      }
      if (parsedTime.source === "calendar-date") {
        item.__mmmDistinctDates.add(parsedTime.value);
        const segment = r.platform ? String(row[r.platform] ?? "").trim() : "";
        const dailyKey = `${parsedTime.value}\u0001${segment}`;
        if (item.__mmmDailyKeys.has(dailyKey)) timeDiagnostics.duplicatePeriods += 1;
        item.__mmmDailyKeys.add(dailyKey);
        if (segment) {
          const dates = item.__mmmDatesBySegment.get(segment) || new Set();
          dates.add(parsedTime.value);
          item.__mmmDatesBySegment.set(segment, dates);
        }
      }
      if (r.platform) {
        const segment = String(row[r.platform] ?? "").trim();
        if (segment) {
          if (parsedTime.source !== "calendar-date" && item.__mmmSegments.has(segment)) timeDiagnostics.duplicatePeriods += 1;
          item.__mmmSegments.add(segment);
        }
      }
      groups.set(key, item);
    });
    let groupedRows = [...groups.values()].sort((a, b) => a.__mmmPeriodValue - b.__mmmPeriodValue);
    const boundaryDrops = new Set();
    if (r.date) {
      const counts = groupedRows.map((item) => item.__mmmDistinctDates.size);
      const expectedDays = expectedDailyCadence(counts);
      timeDiagnostics.expectedDaysPerWeek = expectedDays;
      if (expectedDays) {
        groupedRows.forEach((item, index, all) => {
          if (item.__mmmDistinctDates.size === expectedDays) return;
          if (index === 0 || index === all.length - 1) {
            timeDiagnostics.boundaryPartialWeeks += 1;
            boundaryDrops.add(item);
            return;
          }
          timeDiagnostics.internalPartialWeeks += 1;
        });
      }
    }
    if (r.platform && expectedSegments.length) {
      const inferredDaysBySegment = {};
      if (r.date) {
        expectedSegments.forEach((segment) => {
          inferredDaysBySegment[segment] = expectedDailyCadence(groupedRows.map((item) => item.__mmmDatesBySegment.get(segment)?.size || 0));
        });
      }
      const inferredCadences = [...new Set(Object.values(inferredDaysBySegment).filter(Number.isFinite))];
      const sharedExpectedDays = inferredCadences.length ? Math.max(...inferredCadences) : null;
      timeDiagnostics.mixedPlatformCadence = inferredCadences.length > 1;
      const details = [];
      groupedRows.forEach((item, index, all) => {
        const missingSegments = expectedSegments.filter((segment) => !item.__mmmSegments.has(segment));
        const incompleteSegments = r.date && sharedExpectedDays
          ? expectedSegments.flatMap((segment) => {
            const observed = item.__mmmDatesBySegment.get(segment)?.size || 0;
            return observed === sharedExpectedDays ? [] : [{ segment, observed, expected: sharedExpectedDays }];
          })
          : [];
        if (!missingSegments.length && !incompleteSegments.length) return;
        const boundary = index === 0 || index === all.length - 1;
        if (details.length < 20) details.push({ period: item[timeHeader], boundary, missingSegments, incompleteSegments });
        if (boundary) {
          timeDiagnostics.boundaryIncompletePlatformWeeks += 1;
          boundaryDrops.add(item);
        } else {
          timeDiagnostics.internalIncompletePlatformWeeks += 1;
        }
      });
      timeDiagnostics.platformCoverage = {
        expectedSegments,
        expectedDaysPerWeek: sharedExpectedDays,
        inferredDaysBySegment,
        internalIncompleteWeeks: timeDiagnostics.internalIncompletePlatformWeeks,
        boundaryIncompleteWeeks: timeDiagnostics.boundaryIncompletePlatformWeeks,
        details,
      };
    }
    if (boundaryDrops.size) groupedRows = groupedRows.filter((item) => !boundaryDrops.has(item));
    baseRows = groupedRows.map((item) => {
      item.__mmmMissingAdditive?.forEach((header) => { item[header] = ""; });
      item.__mmmInvalidBinary?.forEach((header) => { item[header] = NaN; });
      item.__mmmStepStates?.forEach((states, header) => {
        if (!item.__mmmInvalidBinary?.has(header)) item[header] = states.size === 1 ? [...states][0] : NaN;
      });
      delete item.__mmmMissingAdditive;
      delete item.__mmmPeriodValue;
      delete item.__mmmTimeKind;
      delete item.__mmmDistinctDates;
      delete item.__mmmDatesBySegment;
      delete item.__mmmSegments;
      delete item.__mmmDailyKeys;
      delete item.__mmmInvalidBinary;
      delete item.__mmmStepStates;
      delete item.__mmmExternalCounts;
      return item;
    });
  } else if (timeHeader && baseRows.length) {
    // 주별 wide 입력도 canonical key를 만들 수 없는 행은 t로 살리지 않는다.
    baseRows = baseRows.filter((row) => {
      const rawTime = row[timeHeader];
      if (mappedTimeKey(rawTime)) return true;
      timeDiagnostics.droppedInvalidRows += 1;
      if (rawTime == null || String(rawTime).trim() === "") timeDiagnostics.blankTimeRows += 1;
      else timeDiagnostics.unparseableTimeRows += 1;
      return false;
    });
  }
  const timeValue = (row, index) => {
    const parsed = timeHeader ? mappedTimeKey(row[timeHeader]) : null;
    return parsed?.value ?? index;
  };
  // 표시 라벨: 매핑된 날짜 컬럼(2025-01-06 등) 우선, 없으면 주차 컬럼 원본값. 둘 다 없으면 null(→인덱스 폴백).
  const labelC = r.date || (weekC ? weekC.header : null);
  const weekLabelRaw = labelC ? baseRows.map((row) => row[labelC]) : null;
  const panel = { week: baseRows.map((_, i) => i + 1), ch: {}, dummy: {}, steps: {}, external: {}, targets: {} };
  const chans = r.channels.filter((channel) => inPlat(channel) && !isAmbiguousOtherCost(channel));
  const dummies = r.dummies.filter(inPlat);
  const steps = r.steps.filter(inPlat);
  const externals = r.externals.filter(inPlat);
  for (const ch of chans) panel.ch[ch.key] = num(ch.header, true);
  for (const d of dummies) panel.dummy[d.key] = baseRows.map((row) => mmmParseBinaryIndicator(row[d.header], "dummy"));
  for (const s of steps) panel.steps[s.key] = baseRows.map((row) => mmmParseBinaryIndicator(row[s.header], "step"));
  for (const external of externals) panel.external[external.key] = num(external.header, true);
  // 종속(타깃): 플랫폼 일치 컬럼을 index별 벡터 합산 — Total이면 Android+iOS 합(이전엔 pick=1개만
  // 골라 Total인데 한 OS 값만 나오던 버그). X(채널)는 이미 filter라 대칭.
  const sumCols = (list) => {
    const cs = list.filter(inPlat);
    if (!cs.length) return null;
    const arrs = cs.map((c) => num(c.header, true));
    return baseRows.map((_, i) => {
      const values = arrs.map((array) => array[i]);
      return values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) : NaN;
    });
  };
  const regA = sumCols(r.reg), reactA = sumCols(r.react), trafficA = sumCols(r.traffic), purchasersA = sumCols(r.purchasers), revenueA = sumCols(r.revenue);
  if (regA) panel.targets.Regs = regA;
  if (reactA) panel.targets.React = reactA;
  if (trafficA) panel.targets.Traffic = trafficA;
  if (purchasersA) panel.targets.Purchasers = purchasersA;
  if (revenueA) panel.targets.Revenue = revenueA;
  const order = baseRows.map((_, i) => i).sort((a, b) => timeValue(baseRows[a], a) - timeValue(baseRows[b], b) || a - b);
  const re = (arr) => order.map((i) => arr[i]);
  panel.week = order.map((_, i) => i + 1);
  if (weekLabelRaw) panel.weekLabel = re(weekLabelRaw);
  for (const k in panel.ch) panel.ch[k] = re(panel.ch[k]);
  for (const k in panel.dummy) panel.dummy[k] = re(panel.dummy[k]);
  for (const k in panel.steps) panel.steps[k] = re(panel.steps[k]);
  for (const k in panel.external) panel.external[k] = re(panel.external[k]);
  for (const k in panel.targets) panel.targets[k] = re(panel.targets[k]);
  if (panel.targets.Regs && panel.targets.React) {
    panel.targets.RR = panel.week.map((_, i) => panel.targets.Regs[i] + panel.targets.React[i]);
    if (!panel.targets.Traffic) panel.targets.Traffic = panel.targets.RR.slice();
  }
  // deriveWide와 동일한 패널 형태로 — 엔진(mmmChannelEffects/decomp)·렌더가 참조.
  panel.channels = chans.map((c) => ({ key: c.key, label: c.label, kind: c.kind }));
  panel.dummyDefs = dummies.map((d) => ({ key: d.key, label: d.label }));
  panel.stepDefs = steps.map((s) => ({ key: s.key, label: s.label }));
  panel.externalDefs = externals.map((external) => ({ key: external.key, label: external.label }));
  panel.useDummies = dummies.length > 0;
  // 차트·예측 라벨: mmmForecast/차트는 panel.dateLabel·dates·granularity를 읽음(weekLabel 아님) →
  // 매핑된 주차/날짜 라벨을 그 이름들로도 노출해야 x축·미래라벨이 실제 날짜(t 인덱스 아님)로 나옴.
  panel.dateLabel = panel.weekLabel || null;
  panel.weekStart = weekStart;
  const canonicalTimes = (panel.weekLabel || []).map(mappedTimeKey);
  if (canonicalTimes.length && canonicalTimes.every(Boolean)) {
    const kinds = new Set(canonicalTimes.map((item) => item.kind));
    if (kinds.size > 1) timeDiagnostics.issues.push({ code: "mixed-time-axis", messageKo: "날짜형과 숫자형 주차가 섞여 있습니다.", messageEn: "Date-based and numeric week values are mixed." });
    const seen = new Set();
    canonicalTimes.forEach((item) => {
      const key = `${item.kind}:${item.value}`;
      if (seen.has(key)) timeDiagnostics.duplicatePeriods += 1;
      seen.add(key);
    });
    const gaps = [];
    for (let i = 1; i < canonicalTimes.length; i++) {
      const previous = canonicalTimes[i - 1], current = canonicalTimes[i];
      if (previous.kind !== current.kind) continue;
      const distance = current.kind === "date"
        ? Math.round((current.value - previous.value) / (7 * MMM_DAY_MS))
        : Math.round(current.value - previous.value);
      const missingWeeks = Math.max(0, distance - 1);
      if (missingWeeks) gaps.push({ after: panel.weekLabel[i - 1], before: panel.weekLabel[i], missingWeeks });
    }
    panel.calendarGaps = { count: gaps.reduce((sum, gap) => sum + gap.missingWeeks, 0), gaps };
    if (kinds.size === 1 && canonicalTimes[0].kind === "date") {
      panel.dates = canonicalTimes.map((item) => new Date(item.value));
      panel.granularity = { days: 7, unit: "weekly" };
    }
  }
  if (timeDiagnostics.droppedInvalidRows) timeDiagnostics.issues.push({ code: "invalid-time-row", count: timeDiagnostics.droppedInvalidRows, messageKo: `날짜/주차를 해석할 수 없는 ${timeDiagnostics.droppedInvalidRows}개 행을 제외했습니다. 원자료를 고친 뒤 다시 분석하세요.`, messageEn: `${timeDiagnostics.droppedInvalidRows} row(s) with blank or unparseable dates/weeks were dropped. Fix the source data before analysis.` });
  if (timeDiagnostics.blankChannelRows) timeDiagnostics.issues.push({ code: "blank-long-channel", count: timeDiagnostics.blankChannelRows, messageKo: `long-format 원자료에 채널명이 빈 ${timeDiagnostics.blankChannelRows}개 행이 있습니다. 행을 조용히 제외하지 않고 분석을 중단했습니다.`, messageEn: `${timeDiagnostics.blankChannelRows} long-format row(s) have a blank channel. Analysis was blocked instead of silently dropping them.` });
  if (timeDiagnostics.repeatedValueConflicts) timeDiagnostics.issues.push({ code: "conflicting-long-repeated-value", count: timeDiagnostics.repeatedValueConflicts, headers: timeDiagnostics.conflictingHeaders, messageKo: `같은 기간·세그먼트의 채널 행에서 반복 Y/이벤트 값이 서로 다릅니다(${timeDiagnostics.conflictingHeaders.join(", ")}). 채널별 행에는 같은 전체값을 반복하세요.`, messageEn: `Repeated Y/event values disagree across channel rows for the same period and segment (${timeDiagnostics.conflictingHeaders.join(", ")}). Repeat the same total value on every channel row.` });
  if (timeDiagnostics.duplicatePeriods) timeDiagnostics.issues.push({ code: "duplicate-time-period", count: timeDiagnostics.duplicatePeriods, messageKo: `같은 주차가 ${timeDiagnostics.duplicatePeriods}번 중복되었습니다. 플랫폼 행이 아니라면 주차별 한 행으로 정리하세요.`, messageEn: `${timeDiagnostics.duplicatePeriods} duplicate weekly period(s) were found. Use one row per week unless rows represent mapped platform segments.` });
  if (timeDiagnostics.internalPartialWeeks) timeDiagnostics.issues.push({ code: "partial-internal-week", count: timeDiagnostics.internalPartialWeeks, messageKo: `내부 ${timeDiagnostics.internalPartialWeeks}개 주차의 일자 수가 ${timeDiagnostics.expectedDaysPerWeek}일 cadence보다 적습니다. 빠진 일자를 채우세요.`, messageEn: `${timeDiagnostics.internalPartialWeeks} internal week(s) have fewer dates than the ${timeDiagnostics.expectedDaysPerWeek}-day cadence. Add the missing daily rows.` });
  if (timeDiagnostics.boundaryPartialWeeks) timeDiagnostics.warnings.push({ code: "partial-boundary-week", count: timeDiagnostics.boundaryPartialWeeks, messageKo: `첫/마지막 경계 partial ${timeDiagnostics.boundaryPartialWeeks}개 주차를 제외했습니다.`, messageEn: `${timeDiagnostics.boundaryPartialWeeks} partial boundary week(s) were excluded.` });
  if (timeDiagnostics.mixedPlatformCadence) {
    const cadence = Object.entries(timeDiagnostics.platformCoverage?.inferredDaysBySegment || {}).map(([segment, days]) => `${segment} ${days ?? "?"}일`).join(", ");
    timeDiagnostics.issues.push({ code: "mixed-platform-cadence", messageKo: `플랫폼별 일자 cadence가 서로 다릅니다(${cadence}). Total 집계에는 같은 주간 cadence가 필요합니다.`, messageEn: `Daily cadence differs by platform (${cadence.replaceAll("일", " days")}). Total aggregation requires the same weekly cadence.` });
  }
  if (timeDiagnostics.internalIncompletePlatformWeeks) {
    const expectedDays = timeDiagnostics.platformCoverage?.expectedDaysPerWeek;
    const cadence = expectedDays ? ` · 주 ${expectedDays}일` : "";
    timeDiagnostics.issues.push({ code: "incomplete-internal-platform-week", count: timeDiagnostics.internalIncompletePlatformWeeks, messageKo: `내부 ${timeDiagnostics.internalIncompletePlatformWeeks}개 주차에서 필수 플랫폼 행 또는 일자가 빠졌습니다(기대: ${expectedSegments.join(", ")}${cadence}). 원자료를 채우세요.`, messageEn: `${timeDiagnostics.internalIncompletePlatformWeeks} internal week(s) are missing required platform rows or dates (expected: ${expectedSegments.join(", ")}${expectedDays ? ` · ${expectedDays} days/week` : ""}). Complete the source data.` });
  }
  if (timeDiagnostics.boundaryIncompletePlatformWeeks) timeDiagnostics.warnings.push({ code: "incomplete-boundary-platform-week", count: timeDiagnostics.boundaryIncompletePlatformWeeks, messageKo: `플랫폼 행 또는 일자가 불완전한 첫/마지막 ${timeDiagnostics.boundaryIncompletePlatformWeeks}개 주차를 제외했습니다.`, messageEn: `${timeDiagnostics.boundaryIncompletePlatformWeeks} first/last week(s) with incomplete platform rows or dates were excluded.` });
  panel.timeDiagnostics = timeDiagnostics;
  return { panel, roles: r, missing: colMapMissing(headers, colMap, locale) };
}

// [role, koLabel, enLabel, withKind, withPlat] — 라벨은 렌더에서 tr(ko,en)로 선택.
const ZONES = [
  ["week", "🗓 주차(t) · 1개", "🗓 Week (t) · 1", false, false],
  ["date", "📅 날짜 · 1개 (표시용)", "📅 Date · 1 (for display)", false, false],
  ["reg", "🎯 가입 Regs", "🎯 Regs", false, true],
  ["react", "🎯 재활성 React", "🎯 Reactivation", false, true],
  ["traffic", "🎯 총유입 Traffic", "🎯 Total traffic", false, true],
  ["purchasers", "🛍 구매자 Purchasers", "🛍 Purchasers", false, true],
  ["revenue", "💰 매출 Revenue", "💰 Revenue", false, true],
  ["channel", "📈 채널 spend (여러 개 · perf/brand · 플랫폼)", "📈 Channel spend (many · perf/brand · platform)", true, true],
  ["external", "📊 업계 수요 지수 (MMM 전용 · 여러 개 · 플랫폼)", "📊 Industry-demand index (MMM only · many · platform)", false, true],
  ["dummy", "🔢 더미/이벤트 (0·1 · true/false · yes/no · on/off)", "🔢 Dummy/event (0/1 · true/false · yes/no · on/off)", false, true],
  ["step", "📐 구조변화 step (0·1 · pre/post · before/after)", "📐 Structural step (0/1 · pre/post · before/after)", false, true],
  ["platform", "🔀 세그먼트/플랫폼 단일 컬럼 (선택 · 성별·플랫폼·국가 등 값별로 나눠보기)", "🔀 Segment/platform single column (optional · split by gender/platform/country, etc.)", false, false],
];

export default function MmmColumnMapper({ headers, rows, colMap, onChange, locale = "ko" }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const [dragCol, setDragCol] = useState(null);
  const [selectedCol, setSelectedCol] = useState(null);
  const [dragOverRole, setDragOverRole] = useState(null);
  const cm = colMap || {};

  const setRole = (col, role) => {
    const next = { ...cm };
    if (["week", "date", "platform"].includes(role)) {
      for (const h of headers || []) {
        if (next[h] && next[h].role === role) next[h] = { ...next[h], role: "ignore" };
      }
    }
    const prev = next[col] || {};
    next[col] = { ...prev, role, plat: ["reg", "react", "traffic", "purchasers", "revenue", "channel", "dummy", "step", "external"].includes(role) ? prev.plat || guessPlat(col) : prev.plat };
    onChange(next);
  };
  const setField = (col, field, value) => {
    onChange({ ...cm, [col]: { ...(cm[col] || {}), [field]: value } });
  };

  // React state만으로 drag 대상을 기억하면 브라우저가 onDrop 전에 렌더를 끊는
  // 경우 대상이 사라질 수 있다. native DataTransfer에도 함께 넣어 한 번의 drag로
  // 안정적으로 배치하고, click→zone 선택은 드래그가 불안정한 환경의 즉시 대안이다.
  const beginDrag = (event, col) => {
    setDragCol(col);
    setSelectedCol(col);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-mmm-column", col);
      event.dataTransfer.setData("text/plain", col);
    }
  };
  const draggedColumn = (event) => event.dataTransfer?.getData("application/x-mmm-column")
    || event.dataTransfer?.getData("text/plain")
    || dragCol
    || selectedCol;
  const placeColumn = (col, role) => {
    if (!col) return;
    setRole(col, role);
    setDragCol(null);
    setSelectedCol(null);
    setDragOverRole(null);
  };

  const inRole = (role) => (headers || []).filter((h) => (cm[h]?.role || "ignore") === role);

  const Chip = ({ col, withKind, withPlat }) => {
    const def = cm[col] || {};
    return (
      <span
        className="reg-chip"
        draggable
        onDragStart={(event) => beginDrag(event, col)}
        onDragEnd={() => { setDragCol(null); setDragOverRole(null); }}
        onClick={(event) => { event.stopPropagation(); setSelectedCol(col); }}
        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 9px", margin: "2px", borderRadius: "6px", background: selectedCol === col ? "color-mix(in srgb, var(--primary) 14%, var(--bg-2))" : "var(--bg-2)", border: selectedCol === col ? "1px solid var(--primary)" : "1px solid var(--border)", boxShadow: selectedCol === col ? "0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent)" : "none", fontSize: "12px", cursor: "grab", userSelect: "none", WebkitUserSelect: "none" }}
      >
        <strong>{col}</strong>
        {withKind && (
          <select value={def.kind || "perf"} onClick={(event) => event.stopPropagation()} onChange={(e) => setField(col, "kind", e.target.value)} style={{ fontSize: "11px" }}>
            <option value="perf">perf spend</option>
            <option value="brand">brand spend</option>
          </select>
        )}
        {withPlat && (
          <select value={def.plat || "common"} onClick={(event) => event.stopPropagation()} onChange={(e) => setField(col, "plat", e.target.value)} style={{ fontSize: "11px" }}>
            <option value="common">{tr("공통", "Common")}</option>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
          </select>
        )}
        <span onClick={(event) => { event.stopPropagation(); placeColumn(col, "ignore"); }} style={{ cursor: "pointer", color: "var(--text-muted)" }}>✕</span>
      </span>
    );
  };

  const Zone = ({ role, label, withKind, withPlat }) => (
    <div
      data-mmm-role-zone={role}
      onDragEnter={(event) => { event.preventDefault(); setDragOverRole(role); }}
      onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = "move"; setDragOverRole(role); }}
      onDragLeave={() => setDragOverRole((current) => current === role ? null : current)}
      onDrop={(event) => { event.preventDefault(); placeColumn(draggedColumn(event), role); }}
      onClick={() => placeColumn(selectedCol, role)}
      style={{ border: dragOverRole === role ? "2px solid var(--primary)" : "1px dashed var(--border)", borderRadius: "8px", padding: "10px", minHeight: "58px", background: dragOverRole === role ? "color-mix(in srgb, var(--primary) 8%, var(--bg-1))" : selectedCol ? "color-mix(in srgb, var(--primary) 3%, var(--bg-1))" : "transparent", cursor: selectedCol ? "pointer" : "default", transition: "border-color 120ms ease, background 120ms ease" }}
    >
      <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "4px" }}>{label}</div>
      <div>
        {inRole(role).length
          ? inRole(role).map((c) => <Chip key={c} col={c} withKind={withKind} withPlat={withPlat} />)
          : <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{tr("여기로 드래그", "Drag here")}</span>}
      </div>
    </div>
  );

  const tray = (headers || []).filter((h) => (cm[h]?.role || "ignore") === "ignore");
  const missing = colMapMissing(headers, cm, locale);
  const hasMappedTime = (headers || []).some((header) => ["date", "week"].includes(cm[header]?.role));
  const hasMappedPlatform = (headers || []).some((header) => cm[header]?.role === "platform");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <p className="muted" style={{ fontSize: "12px", margin: 0 }}>
          {selectedCol
            ? tr(`“${selectedCol}” 선택됨 — 넣을 역할 영역을 한 번 클릭하세요.`, `“${selectedCol}” selected — click the role zone to place it.`)
            : tr("컬럼을 역할 영역으로 드래그하거나, 칩을 한 번 클릭한 뒤 역할 영역을 클릭하세요.", "Drag columns onto a role zone, or click a chip once and then click a role zone.")}
        </p>
        <button
          type="button"
          className="ab-pill"
          onClick={() => onChange(autoGuessColMap(headers, rows, false))}
        >
          {tr("🪄 전부 자동 추정", "🪄 Auto-map all")}
        </button>
      </div>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); placeColumn(draggedColumn(event), "ignore"); }}
        style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", marginBottom: "10px" }}
      >
        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "4px" }}>{tr("📦 컬럼 (미지정 — 드래그해서 배치)", "📦 Columns (unassigned — drag to place)")}</div>
        <div>
          {tray.length ? tray.map((h) => <Chip key={h} col={h} withKind={false} withPlat={false} />) : <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{tr("모두 배치됨", "All placed")}</span>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {ZONES.map(([role, koLabel, enLabel, withKind, withPlat]) => (
          <Zone key={role} role={role} label={tr(koLabel, enLabel)} withKind={withKind} withPlat={withPlat} />
        ))}
      </div>
      {!hasMappedTime && !hasMappedPlatform && (
        <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginTop: "10px", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", color: "var(--text-1)" }}>
          <input
            type="checkbox"
            checked={cm.__mmmRowOrderConfirmed === true}
            onChange={(event) => onChange({ ...cm, __mmmRowOrderConfirmed: event.target.checked })}
          />
          <span>{tr(
            "날짜/주차 컬럼이 없습니다. 이 CSV는 이미 주별 1행이고 오래된 주→최신 주 순서로 정렬되어 있음을 확인합니다.",
            "No date/week column is mapped. I confirm this CSV already has one row per week and is ordered oldest to newest.",
          )}</span>
        </label>
      )}
      {!hasMappedTime && hasMappedPlatform && (
        <div className="callout warning" style={{ marginTop: "10px" }}>
          <div className="ico">!</div>
          <div className="body"><strong>{tr("플랫폼 행에는 날짜/주차가 필요합니다", "Platform rows require date/week")}</strong><p>{tr("Android·iOS 등 같은 기간의 여러 행을 Total 한 주로 합치려면 날짜 또는 주차 컬럼을 매핑하세요.", "Map a date or week column so Android, iOS, and other rows for the same period can be combined into one Total week.")}</p></div>
        </div>
      )}
      {missing.length > 0 && (
        <div className="callout warning" style={{ marginTop: "10px" }}>
          <div className="ico">!</div>
          <div className="body"><strong>{tr("필수 역할이 비어 있습니다", "Required roles are empty")}</strong><p>{missing.join(", ")}</p></div>
        </div>
      )}
    </div>
  );
}
