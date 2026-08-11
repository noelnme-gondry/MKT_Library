"use client";
import { useState } from "react";
import { _mmmParseDate } from "@/utils/regForecastMath";
import { mmmExcelSerialDateTimestamp, mmmParseNumericValue } from "@/utils/mmmInputUtils";

/* index.html의 5-18 DnD colMap(§12.20류 이관) — mmmGuessRole/mmmAutoMapPartial/
 * mmmColMapRoles/mmmGetPanelFromColMap을 React 네이티브 HTML5 DnD로 포팅.
 * colMap: { [header]: { role, kind?, plat? } }
 * role: week|date|reg|paid|react|revenue|channel|dummy|step|external|platform|geo|reach|frequency|ignore */

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
  const hasA = /(android|aos|google[_\s-]?play|play[_\s-]?store)/.test(s);
  const hasI = /(^|[^a-z0-9])ios([^a-z0-9]|$)/.test(s) || /(iphone|ipad)/.test(s);
  if (hasA && hasI) return s.lastIndexOf("android") > s.lastIndexOf("ios") ? "android" : "ios";
  if (hasA) return "android";
  if (hasI) return "ios";
  return "common";
}

// 행 기반 플랫폼 값은 헤더 태그와 달리 대소문자·스토어 별칭이 제각각이다.
// Android/iOS 계열만 canonical key로 묶고, Web·국가 같은 임의 세그먼트는
// 소문자 원문을 보존해 같은 정규화 규칙으로 필터와 route guard를 판단한다.
export function normalizePlatformValue(value) {
  const normalized = String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
  if (!normalized) return "";
  if (["all", "total", "common", "전체", "합계", "공통"].includes(normalized)) return "all";
  const guessed = guessPlat(normalized);
  return guessed === "common" ? normalized : guessed;
}

// Prism 운영 CSV에서는 `brand_*_impressions`/`performance_*_impressions`가
// 노출량이 아니라 비용을 담는다. MMM의 channel 입력은 항상 비용 축으로
// 해석하되, 이 헤더 패턴을 별도로 기록해 CPA/기여 계산에서 의미가 보존되게 한다.
export function isOperationalDeliveryCostHeader(header) {
  return /^(brand|performance)[_\s].*impressions?$/i.test(String(header ?? "").trim());
}

// Total KPI에는 Android/iOS 업계 지표를 각각 회귀식에 넣지 않는다. 같은 시장
// 지표의 플랫폼별 level을 먼저 합쳐 하나의 Total level로 만든 뒤, MMM 엔진이
// 그 합계의 상대 변화를 계산한다. 각각의 로그 변화량을 더하는 것은
// log(Android + iOS)의 변화량과 같지 않다.
function externalMetricStem(header) {
  return String(header ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(?:^|[_\s-])(?:android|aos|google[_\s-]?play|play[_\s-]?store|ios|iphone|ipad)(?=$|[_\s-])/g, "_")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function externalTotalLabel(externals) {
  const source = String(externals[0]?.label ?? "").normalize("NFKC");
  const withoutPlatform = source
    .replace(/(?:^|[_\s-])(?:android|aos|google[_\s-]?play|play[_\s-]?store|ios|iphone|ipad)(?=$|[_\s-])/gi, "_")
    .replace(/[_\s-]+/g, " ")
    .trim();
  return `${withoutPlatform || "Industry demand"} (Android + iOS)`;
}

function buildTotalExternalControls(externals, baseRows, num) {
  const usedKeys = new Set(externals.map((external) => external.key));
  const groups = new Map();
  externals.forEach((external) => {
    if (external.plat !== "android" && external.plat !== "ios") return;
    const stem = externalMetricStem(external.header);
    if (!stem) return;
    const group = groups.get(stem) || {};
    // 같은 platform/stem 지표가 여럿이면 무엇을 합칠지 알 수 없으므로 자동 합산하지 않는다.
    if (!group[external.plat]) group[external.plat] = external;
    else group[external.plat] = null;
    groups.set(stem, group);
  });
  const paired = new Map();
  groups.forEach((group, stem) => {
    if (group.android && group.ios) paired.set(stem, [group.android, group.ios]);
  });
  const consumed = new Set([...paired.values()].flat().map((external) => external.key));
  const defs = [];
  const values = {};
  externals.forEach((external) => {
    if (consumed.has(external.key)) return;
    defs.push(external);
    values[external.key] = num(external.header, true);
  });
  paired.forEach((pair, stem) => {
    const [android, ios] = pair;
    const androidValues = num(android.header, true);
    const iosValues = num(ios.header, true);
    const key = sanKey(`${stem}_total`, usedKeys);
    defs.push({ key, label: externalTotalLabel(pair), plat: "common", isPlatformAggregate: true, sourceHeaders: [android.header, ios.header] });
    values[key] = baseRows.map((_, index) => Number.isFinite(androidValues[index]) && Number.isFinite(iosValues[index])
      ? androidValues[index] + iosValues[index]
      : NaN);
  });
  return { defs, values };
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
  const binaryRole = /step|구조변화|regime|레짐|shutdown|중단|종료|launch|런칭|delist|reopen|relaunch|liveness|서비스.?중단|재개|재오픈/.test(name) ? "step" : "dummy";
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
  else if (!isNum && /geo|region|location|country|지역|권역|국가/.test(name)) role = "geo";
  else if (isNum && /reach|도달/.test(name)) role = "reach";
  else if (isNum && /frequency|freq|빈도|평균.?노출/.test(name)) role = "frequency";
  else if (/날짜|date/.test(name)) role = "date";
  else if (isBin && binaryRole === "step") role = "step";
  else if (isBin) role = "dummy";
  else if (isNum && isExplicitSpend) role = "channel";
  else if (isNum && /revenue|매출|sales|gmv|payment|결제금액/.test(name)) role = "revenue";
  else if (isNum && /purchaser|buyer|구매자|결제자/.test(name)) role = "purchasers";
  else if (isNum && /traffic|total.?visit|총.?유입|방문자|sessions?/.test(name)) role = "traffic";
  else if (isNum && /industry|market|category|업계|시장.?수요|카테고리.?수요/.test(name)) role = "external";
  else if (isNum && /paid|유료/.test(name) && (/reg|가입|등록|signup|sign_up|install|(^|[_\s-])rr($|[_\s-])/.test(name))) role = "paid";
  else if (isNum && (/reg|가입|등록|signup|sign_up|install/.test(name) || /(^|[_\s-])rr($|[_\s-])/.test(name))) role = "reg";
  else if (isNum && /react|재활성|reactiv|resurrect|win.?back|winback/.test(name)) role = "react";
  else if (isNum && /cost|spend|비용|지출|budget|imp|click|ch_|채널|brand/.test(name)) role = "channel";
  else if (!isNum && /platform|os|플랫폼|기기|device|segment|세그/.test(name)) role = "platform";
  else if (isNum) role = "channel";
  return { role, kind };
}

function guessedStepMode(header) {
  const name = String(header || "");
  // Delist는 실제 셧다운 기간을 1로 채우고 재오픈 시 0으로 되돌리는 상태열이다.
  // Liveness/Reopen처럼 사건 주에만 1을 찍는 열만 이후 1로 확장한다.
  if (/delist|shutdown|서비스.?중단/i.test(name)) return "state";
  return /reopen|relaunch|liveness|launch|재개|재오픈|런칭/i.test(name)
    ? "boundary"
    : "state";
}

function guessedOperationalBoundaryKind(header) {
  const name = String(header || "");
  if (/delist|shutdown|서비스.?(?:중단|종료)|운영.?중단|중단|종료/i.test(name)) return "shutdown-start";
  if (/reopen|relaunch|재개|재오픈/i.test(name)) return "reopen";
  return null;
}

function operationalBoundaryEntity(header) {
  const normalized = String(header || "")
    .normalize("NFKC")
    .toLowerCase()
    // 서로 다른 언어로 적힌 같은 엔티티도 같은 안전 키가 되게 최소한의
    // 도메인 명사만 정규화한다. 중단/재개 동작어와 표시용 suffix는 제거한다.
    .replace(/캠페인/g, " campaign ")
    .replace(/서비스/g, " service ")
    .replace(/애플리케이션|어플리케이션|어플|앱/g, " app ")
    .replace(/제품|상품/g, " product ")
    .replace(/기능/g, " feature ")
    .replace(/마켓/g, " market ")
    .replace(/shut[\s_-]*down|delist|reopen|relaunch|중단|종료|재개|재오픈/giu, " ")
    .replace(/step|boundary|pulse|flag|indicator|dummy|regime|event|status|state|단계|경계|펄스|더미|레짐|이벤트|시점|상태/giu, " ");
  const tokens = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
  return [...new Set(tokens)].sort().join("|");
}

function operationalStepPairPlan(steps) {
  const byPlatform = new Map();
  (steps || []).forEach((step) => {
    if (!step.autoBoundaryKind) return;
    const platform = step.plat || "common";
    const group = byPlatform.get(platform) || { platform, shutdown: [], reopen: [] };
    if (step.autoBoundaryKind === "shutdown-start") group.shutdown.push(step);
    if (step.autoBoundaryKind === "reopen") group.reopen.push(step);
    byPlatform.set(platform, group);
  });
  const pairs = [];
  const unresolved = [];
  byPlatform.forEach((group) => {
    const shutdownByEntity = new Map();
    const reopenByEntity = new Map();
    group.shutdown.forEach((step) => {
      const entity = operationalBoundaryEntity(step.header);
      const items = shutdownByEntity.get(entity) || [];
      items.push(step);
      shutdownByEntity.set(entity, items);
    });
    group.reopen.forEach((step) => {
      const entity = operationalBoundaryEntity(step.header);
      const items = reopenByEntity.get(entity) || [];
      items.push(step);
      reopenByEntity.set(entity, items);
    });
    const unmatched = { platform: group.platform, shutdown: [], reopen: [] };
    const entities = new Set([...shutdownByEntity.keys(), ...reopenByEntity.keys()]);
    entities.forEach((entity) => {
      const shutdown = shutdownByEntity.get(entity) || [];
      const reopen = reopenByEntity.get(entity) || [];
      if (entity && shutdown.length === 1 && reopen.length === 1) {
        pairs.push({ platform: group.platform, entity, shutdown: shutdown[0], reopen: reopen[0] });
      } else if (entity && shutdown.length && reopen.length) {
        unresolved.push({ platform: group.platform, entity, shutdown, reopen, reason: "ambiguous" });
      } else {
        unmatched.shutdown.push(...shutdown);
        unmatched.reopen.push(...reopen);
      }
    });
    if (unmatched.shutdown.length || unmatched.reopen.length) {
      const hasBothKinds = unmatched.shutdown.length > 0 && unmatched.reopen.length > 0;
      unresolved.push({
        ...unmatched,
        reason: unmatched.shutdown.length > 1 || unmatched.reopen.length > 1
          ? "ambiguous"
          : hasBothKinds
            ? "semantic-mismatch"
            : "unmatched",
      });
    }
  });
  return { pairs, unresolved };
}

function deriveOperationalStepIntervals(steps, orderedSeries) {
  const next = Object.fromEntries(Object.entries(orderedSeries || {}).map(([key, values]) => [key, values.slice()]));
  const { pairs, unresolved } = operationalStepPairPlan(steps);
  const derived = [];
  const invalidPairs = [];
  pairs.forEach((pair) => {
    const shutdownValues = next[pair.shutdown.key] || [];
    const reopenValues = next[pair.reopen.key] || [];
    const shutdownPulse = shutdownValues.flatMap((value, index) => Number.isFinite(value) && value !== 0 ? [index] : []);
    const reopenPulse = reopenValues.flatMap((value, index) => Number.isFinite(value) && value !== 0 ? [index] : []);
    // 여러 주가 1이면 사용자가 이미 완성한 상태열로 간주해 절대 덮어쓰지 않는다.
    if (shutdownPulse.length > 1) return;
    if (shutdownPulse.length !== 1 || reopenPulse.length !== 1 || reopenPulse[0] <= shutdownPulse[0]) {
      invalidPairs.push({ ...pair, shutdownPulseCount: shutdownPulse.length, reopenPulseCount: reopenPulse.length });
      return;
    }
    const startIndex = shutdownPulse[0];
    const reopenIndex = reopenPulse[0];
    next[pair.shutdown.key] = shutdownValues.map((value, index) => {
      if (!Number.isFinite(value)) return NaN;
      return index >= startIndex && index < reopenIndex ? 1 : 0;
    });
    derived.push({ ...pair, startIndex, reopenIndex });
  });
  return { series: next, derived, unresolved, invalidPairs };
}

// 부분 자동 매핑(index.html mmmAutoMapPartial 이식) — 타깃과 명시 매체 열을 강한 키워드로 배치.
// `performance_*_impressions`처럼 헤더는 노출수여도 실제 값이 지출인 운영 CSV가 있으므로,
// brand/performance 접두사가 있는 media delivery 열은 누락시키지 않는다.
// partial=false(🪄 전부 자동 추정)면 guessRole 전체 휴리스틱(catch-all 포함) 사용.
export function autoGuessColMap(headers, rows, partial = true) {
  const derivedRe = /^\s*(ln|log|sin|cos)\s*[\(_]|^\s*(ln|log|sin|cos)\b|description/i;
  const out = {};
  const once = { week: false, date: false, platform: false, geo: false };
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
      if (role === "step") {
        out[h].stepMode = guessedStepMode(h);
        out[h].autoBoundaryKind = guessedOperationalBoundaryKind(h);
      }
      if (["reg", "paid", "react", "traffic", "purchasers", "revenue", "channel", "dummy", "step", "external", "reach", "frequency"].includes(role)) out[h].plat = guessPlat(h);
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
    const isExplicitMediaDelivery = isOperationalDeliveryCostHeader(name)
      || /^(brand|performance)[_\s].*(spend|cost|budget|clicks?)$/i.test(name);
    const isExplicitStep = /step|regime|shutdown|delist|reopen|relaunch|liveness|launch|구조변화|레짐|서비스.?중단|운영.?중단|중단|종료|재개|재오픈|런칭/i.test(name);
    const isExplicitEvent = /holiday|event|christmas|easter|new.?year|anzac|funeral|festival|ramadan|black.?friday|cyber.?monday|chuseok|seollal|lunar|record|(?:^|[_\s])day(?:$|[_\s])|공휴일|명절|이벤트|크리스마스|설날|추석/i.test(name);
    let role = "ignore";
    if (/^(week|t|wk)$/.test(name) || /week|주차|주인덱스/.test(name)) {
      role = once.week ? "ignore" : "week";
      once.week = true;
    }
    else if (isDateCol) role = "date"; // 날짜는 분석 무영향(표시/예측용)이라 자동 배치
    else if (isBin && isExplicitStep) role = "step";
    else if (isBin && isExplicitEvent) role = "dummy";
    else if (!derivedRe.test(name) && isNum && !isBin) {
      if (isExplicitSpend) role = "channel";
      else if (isExplicitMediaDelivery) role = "channel";
      else if (/paid|유료/.test(name) && /reg|가입|등록|signup|sign_up|install|(^|[_\s-])rr($|[_\s-])/.test(name)) role = "paid";
      else if (/(^|[_\s-])rr($|[_\s-])|^total[_\s-]*(reg|registration|signup).*(react|reactivation)$/i.test(name)) role = "reg";
      else if (/revenue|매출|sales|gmv|payment|결제금액/.test(name)) role = "revenue";
      else if (/purchaser|buyer|구매자|결제자/.test(name)) role = "purchasers";
      else if (/traffic|total.?visit|총.?유입|방문자|sessions?/.test(name)) role = "traffic";
      else if (/industry|market|category|업계|시장.?수요|카테고리.?수요/.test(name)) role = "external";
      else if (/reg|가입|등록|signup|sign_up|install/.test(name)) role = "reg";
      else if (/react|재활성|reactiv|resurrect|win.?back|winback/.test(name)) role = "react";
      else if (/reach|도달/.test(name)) role = "reach";
      else if (/frequency|freq|빈도|평균.?노출/.test(name)) role = "frequency";
      else if (/spend|cost|비용|지출|budget|brand/.test(name)) role = "channel";
    }
    if (role === "ignore" && !isNum && /geo|region|location|country|지역|권역|국가/.test(name)) {
      role = once.geo ? "ignore" : "geo";
      once.geo = true;
    }
    if (role === "ignore" && !isNum && /platform|os|플랫폼|기기|device/.test(name)) {
      role = once.platform ? "ignore" : "platform";
      once.platform = true;
    }
    if (role === "date") { if (once.date) role = "ignore"; else once.date = true; }
    out[h] = { role, kind };
    if (role === "step") {
      out[h].stepMode = guessedStepMode(h);
      out[h].autoBoundaryKind = guessedOperationalBoundaryKind(h);
    }
    if (["reg", "paid", "react", "traffic", "purchasers", "revenue", "channel", "dummy", "step", "external", "reach", "frequency"].includes(role)) out[h].plat = guessPlat(h);
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

function mediaStem(name) {
  return String(name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(?:reach|frequency|freq|도달|빈도|평균.?노출|spend|cost|budget|impressions?|clicks?|비용|지출|예산)/g, "")
    .replace(/(?:brand|performance|perf|브랜드)/g, "")
    .replace(/(?:android|ios|aos|iphone|ipad|common)/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function matchMediaInput(channel, candidates) {
  const stem = mediaStem(channel.header || channel.label);
  if (!stem) return null;
  return candidates.find((candidate) => mediaStem(candidate.header) === stem)
    || candidates.find((candidate) => {
      const candidateStem = mediaStem(candidate.header);
      return candidateStem && (candidateStem.includes(stem) || stem.includes(candidateStem));
    })
    || null;
}

export function colMapRoles(headers, colMap) {
  const out = { week: [], date: null, reg: [], paid: [], react: [], traffic: [], purchasers: [], revenue: [], platform: null, geo: null, reach: [], frequency: [], channels: [], dummies: [], steps: [], externals: [] };
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
    else if (r === "paid") out.paid.push({ header: h, plat });
    else if (r === "react") out.react.push({ header: h, plat });
    else if (r === "traffic") out.traffic.push({ header: h, plat });
    else if (r === "purchasers") out.purchasers.push({ header: h, plat });
    else if (r === "revenue") out.revenue.push({ header: h, plat });
    else if (r === "platform" && !out.platform) out.platform = h;
    else if (r === "geo" && !out.geo) out.geo = h;
    else if (r === "reach") out.reach.push({ header: h, key: sanKey(h, used), label: h, plat });
    else if (r === "frequency") out.frequency.push({ header: h, key: sanKey(h, used), label: h, plat });
    else if (r === "channel") out.channels.push({ header: h, key: sanKey(h, used), label: h, kind: def.kind === "brand" ? "brand" : "perf", plat });
    else if (r === "dummy") out.dummies.push({ header: h, key: sanKey(h, used), label: h, plat });
    else if (r === "step") out.steps.push({
      header: h,
      key: sanKey(h, used),
      label: h,
      plat,
      stepMode: def.stepMode || "state",
      autoBoundaryKind: def.autoBoundaryKind || null,
    });
    else if (r === "external") out.externals.push({ header: h, key: sanKey(h, used), label: h, plat });
  }
  return out;
}

export function mmmForecastInputWarnings(headers, rows, colMap, locale = "ko") {
  const roles = colMapRoles(headers, colMap);
  const numberValue = (value) => {
    const parsed = Number(String(value ?? "").replace(/[,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const periodHeader = roles.date || roles.week[0]?.header || null;
  const periodAt = (row, index) => periodHeader ? String(row?.[periodHeader] ?? index) : String(index);
  const warnings = [];
  const rowOrder = (rows || []).map((_, index) => index).sort((a, b) => {
    if (!periodHeader) return a - b;
    const left = mappedTimeKey((rows || [])[a]?.[periodHeader]);
    const right = mappedTimeKey((rows || [])[b]?.[periodHeader]);
    if (!left || !right || left.kind !== right.kind) return a - b;
    return left.value - right.value || a - b;
  });
  const orderedStepSeries = Object.fromEntries(roles.steps.map((step) => [
    step.key,
    rowOrder.map((index) => mmmParseBinaryIndicator((rows || [])[index]?.[step.header], "step")),
  ]));
  const operationalIntervals = deriveOperationalStepIntervals(roles.steps, orderedStepSeries);
  const derivedShutdownHeaders = new Set(operationalIntervals.derived.map((item) => item.shutdown.header));
  const platformLabel = (platform) => platform === "android" ? "Android" : platform === "ios" ? "iOS" : locale === "en" ? "Common" : "공통";
  operationalIntervals.derived.forEach((item) => {
    const startPeriod = periodAt((rows || [])[rowOrder[item.startIndex]], item.startIndex);
    const reopenPeriod = periodAt((rows || [])[rowOrder[item.reopenIndex]], item.reopenIndex);
    warnings.push(locale === "en"
      ? `${item.shutdown.header} + ${item.reopen.header}: auto-derived the ${platformLabel(item.platform)} shutdown state as 1 from ${startPeriod} through the period before ${reopenPeriod}. The reopen column remains a separate post-reopen boundary.`
      : `${item.shutdown.header} + ${item.reopen.header}: ${platformLabel(item.platform)} 운영 중단 상태를 ${startPeriod}부터 ${reopenPeriod} 직전까지 1로 자동 생성합니다. 재개 열은 재개 후 수준 변화를 위한 별도 경계로 유지합니다.`);
  });
  operationalIntervals.unresolved
    .filter((group) => group.reason === "ambiguous")
    .forEach((group) => {
      const names = [...group.shutdown, ...group.reopen].map((step) => step.header).join(", ");
      warnings.push(locale === "en"
        ? `${platformLabel(group.platform)} operational boundaries are ambiguous (${names}). No shutdown interval was auto-derived; keep one unambiguous pair or provide the full state series.`
        : `${platformLabel(group.platform)} 운영 중단·재개 경계가 여러 개라 자동 연결하지 않았습니다(${names}). 한 쌍만 남기거나 전체 상태열을 직접 입력하세요.`);
    });
  operationalIntervals.unresolved
    .filter((group) => group.reason === "semantic-mismatch")
    .forEach((group) => {
      const shutdownNames = group.shutdown.map((step) => step.header).join(", ");
      const reopenNames = group.reopen.map((step) => step.header).join(", ");
      warnings.push(locale === "en"
        ? `${shutdownNames} + ${reopenNames}: the shutdown and reopen headers refer to different entities, so they remain separate boundaries. Use the same entity name only when they describe one interval.`
        : `${shutdownNames} + ${reopenNames}: 중단·재개 헤더의 대상 이름이 달라 별도 경계로 유지합니다. 하나의 기간을 뜻할 때만 같은 대상 이름을 사용하세요.`);
    });
  operationalIntervals.invalidPairs.forEach((item) => {
    warnings.push(locale === "en"
      ? `${item.shutdown.header} + ${item.reopen.header}: the same-platform boundaries are not one shutdown pulse followed by one reopen pulse. No interval was auto-derived; verify the dates or provide the full state series.`
      : `${item.shutdown.header} + ${item.reopen.header}: 같은 플랫폼에서 중단 pulse 1개 뒤에 재개 pulse 1개가 오는 형태가 아니어서 기간을 자동 생성하지 않았습니다. 날짜를 확인하거나 전체 상태열을 직접 입력하세요.`);
  });
  roles.steps
    .filter((step) => step.stepMode === "state" && /delist|shutdown|서비스.?중단/i.test(step.header))
    .forEach((step) => {
      const activePeriods = new Set((rows || [])
        .map((row, index) => numberValue(row[step.header]) !== 0 ? periodAt(row, index) : null)
        .filter(Boolean));
      if (activePeriods.size === 1 && !derivedShutdownHeaders.has(step.header)) {
        warnings.push(locale === "en"
          ? `${step.header}: a state series is active for only one period and no unambiguous later reopen pulse exists on the same platform. Mark every affected week as 1 (then return to 0) or provide one matching reopen boundary.`
          : `${step.header}: 상태열이 1개 기간에만 1이고 같은 플랫폼의 명확한 후속 재개 pulse가 없습니다. 영향받은 모든 주를 1로 채운 뒤 0으로 되돌리거나 재개 경계 한 개를 함께 주세요.`);
      }
    });
  const lateChannels = roles.channels.filter((channel) => {
    const values = (rows || []).map((row) => numberValue(row[channel.header]));
    const first = values.findIndex((value) => value > 0);
    return first >= Math.max(12, Math.floor(values.length * 0.25));
  }).map((channel) => channel.header);
  if (lateChannels.length) {
    const preview = lateChannels.slice(0, 4).join(", ");
    const more = lateChannels.length > 4 ? ` +${lateChannels.length - 4}` : "";
    warnings.push(locale === "en"
      ? `Cost coverage starts late for ${preview}${more}. Earlier zeros may be missing coverage rather than true no-spend; reconcile before interpreting them as Organic.`
      : `${preview}${more}의 Cost 커버리지가 뒤늦게 시작합니다. 초기 0은 실제 무집행이 아니라 미수집일 수 있으므로 Organic으로 해석하기 전에 확인하세요.`);
  }
  return warnings;
}

// GEO 원자료를 national 집계와 별도로 보존한다. 현재 national MMM은 기존
// panel을 사용하고, Meridian 계층 적합은 이 geoPanel의 geo-week 행을 사용한다.
function buildGeoPanelFromRows(headers, rows, roles, platform, weekStart) {
  if (!roles.geo) return null;
  const tagMode = !roles.platform && (headers || []).some((header) => /(?:android|ios|aos|iphone|ipad)/i.test(String(header)));
  const P = platform === "all" ? null : platform;
  const normalizedPlatform = P ? normalizePlatformValue(P) : null;
  const inPlat = (item) => !tagMode || !normalizedPlatform
    || item.plat === normalizedPlatform || item.plat === "common";
  const channels = roles.channels.filter(inPlat).filter((item) => !/(^|[_\s])(other|etc|misc|기타)([_\s]|$)/i.test(item.header));
  const targets = [
    ...roles.reg.map((item) => ({ ...item, targetKey: "Regs" })),
    ...roles.paid.map((item) => ({ ...item, targetKey: "PaidRegs" })),
    ...roles.react.map((item) => ({ ...item, targetKey: "React" })),
    ...roles.traffic.map((item) => ({ ...item, targetKey: "Traffic" })),
    ...roles.purchasers.map((item) => ({ ...item, targetKey: "Purchasers" })),
    ...roles.revenue.map((item) => ({ ...item, targetKey: "Revenue" })),
  ].filter(inPlat);
  const groups = new Map();
  for (const row of rows || []) {
    if (roles.platform && normalizedPlatform
      && normalizePlatformValue(row[roles.platform]) !== normalizedPlatform) continue;
    const geo = String(row[roles.geo] ?? "").trim();
    const parsed = mappedTimeKey(row[roles.date || roles.week[0]?.header]);
    if (!geo || !parsed) continue;
    const period = parsed.source === "calendar-date" && roles.date
      ? weekStartTimestamp(parsed.value, weekStart)
      : parsed.value;
    const segment = roles.platform ? normalizePlatformValue(row[roles.platform]) : "";
    const key = `${geo}\u0001${parsed.kind}:${period}\u0001${segment}`;
    const item = groups.get(key) || { geo, period, kind: parsed.kind, ch: {}, targets: {}, dummy: {}, steps: {}, external: {}, count: {} };
    channels.forEach((channel) => {
      const value = mmmParseNumericValue(row[channel.header]);
      item.ch[channel.key] = (item.ch[channel.key] || 0) + (Number.isFinite(value) ? value : 0);
    });
    targets.forEach((target) => {
      const value = mmmParseNumericValue(row[target.header]);
      const targetKey = target.targetKey;
      if (targetKey && Number.isFinite(value)) item.targets[targetKey] = (item.targets[targetKey] || 0) + value;
    });
    roles.dummies.filter(inPlat).forEach((dummy) => {
      const value = mmmParseBinaryIndicator(row[dummy.header], "dummy");
      if (Number.isFinite(value)) item.dummy[dummy.key] = Math.max(item.dummy[dummy.key] || 0, value);
    });
    roles.steps.filter(inPlat).forEach((step) => {
      const value = mmmParseBinaryIndicator(row[step.header], "step");
      if (Number.isFinite(value)) item.steps[step.key] = value;
    });
    groups.set(key, item);
  }
  const byGeo = new Map();
  [...groups.values()].forEach((item) => {
    const list = byGeo.get(item.geo) || [];
    list.push(item);
    byGeo.set(item.geo, list);
  });
  return [...byGeo.entries()].map(([geo, items]) => {
    const sorted = items.sort((a, b) => a.period - b.period);
    const panel = {
      geo,
      week: sorted.map((_, index) => index + 1),
      weekLabel: sorted.map((item) => item.kind === "date" ? formatWeekStart(item.period) : item.period),
      ch: Object.fromEntries(channels.map((channel) => [channel.key, sorted.map((item) => item.ch[channel.key] || 0)])),
      targets: Object.fromEntries([...new Set(sorted.flatMap((item) => Object.keys(item.targets)))].map((key) => [key, sorted.map((item) => item.targets[key] ?? NaN)])),
      dummy: Object.fromEntries(roles.dummies.filter(inPlat).map((dummy) => [dummy.key, sorted.map((item) => item.dummy[dummy.key] ?? 0)])),
      steps: Object.fromEntries(roles.steps.filter(inPlat).map((step) => [step.key, sorted.map((item) => item.steps[step.key] ?? NaN)])),
      external: {},
      channels: channels.map((channel) => ({ key: channel.key, label: channel.label, kind: channel.kind })),
      dummyDefs: roles.dummies.filter(inPlat).map((item) => ({ key: item.key, label: item.label })),
      stepDefs: roles.steps.filter(inPlat).map((item) => ({ key: item.key, label: item.label })),
      mediaInputMap: Object.fromEntries(channels.map((channel) => [channel.key, { type: "spend" }])),
    };
    if (panel.targets.Regs && panel.targets.React) panel.targets.RR = panel.targets.Regs.map((value, index) => value + panel.targets.React[index]);
    return panel;
  });
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
  [...r.reg, ...r.paid, ...r.react, ...r.traffic, ...r.purchasers, ...r.revenue, ...r.channels, ...r.externals, ...r.reach, ...r.frequency].forEach((x) => {
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
// 기본 계약은 target이 채널 행마다 반복된 주간 Total이다. 다만 Organic 행이 있고
// 같은 기간의 target이 채널별로 다른 귀속형 CSV는 Organic+Paid를 합산한다.
// 이 자동 분기는 Organic이라는 강한 구조 신호가 있을 때만 켜서, 더러운 반복 Total을
// 채널 귀속값으로 오인해 합산하는 것을 막는다.
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
    attributedTargetHeaders: [],
  };
  const targetHeaders = new Set([
    ...roles.reg, ...roles.paid, ...roles.react, ...roles.traffic, ...roles.purchasers, ...roles.revenue,
  ].map((item) => item.header));
  const externalHeaders = new Set(roles.externals.map((item) => item.header));
  const binaryHeaders = new Map([
    ...roles.dummies.map((item) => [item.header, "dummy"]),
    ...roles.steps.map((item) => [item.header, "step"]),
  ]);
  const hasOrganicChannel = (rows || []).some((row) =>
    /(^|[\s_-])(organic|오가닉|자연|비광고)([\s_-]|$)/i.test(String(row[channelHeader] ?? "").normalize("NFKC")),
  );
  const attributedTargetHeaders = new Set();
  if (hasOrganicChannel) {
    const targetValuesByPeriod = new Map();
    for (const row of rows || []) {
      const parsedTime = mappedTimeKey(row[timeHeader]);
      const channel = String(row[channelHeader] ?? "").trim();
      if (!parsedTime || !channel) continue;
      const segment = roles.platform ? String(row[roles.platform] ?? "") : "";
      const key = `${parsedTime.kind}:${parsedTime.value}\u0001${segment}`;
      const byHeader = targetValuesByPeriod.get(key) || new Map();
      targetHeaders.forEach((header) => {
        const value = mmmParseNumericValue(row[header]);
        if (!Number.isFinite(value)) return;
        const values = byHeader.get(header) || [];
        values.push(value);
        byHeader.set(header, values);
      });
      targetValuesByPeriod.set(key, byHeader);
    }
    targetHeaders.forEach((header) => {
      let comparable = 0;
      let differing = 0;
      targetValuesByPeriod.forEach((byHeader) => {
        const values = byHeader.get(header) || [];
        if (values.length < 2) return;
        comparable += 1;
        const first = values[0];
        if (values.some((value) => Math.abs(value - first) > 1e-9 * Math.max(1, Math.abs(value), Math.abs(first)))) differing += 1;
      });
      if (comparable >= 2 && differing / comparable >= 0.2) attributedTargetHeaders.add(header);
    });
  }
  diagnostics.attributedTargetHeaders = [...attributedTargetHeaders].sort((a, b) => a.localeCompare(b));
  const repeatedHeaders = new Set([
    ...[...targetHeaders].filter((header) => !attributedTargetHeaders.has(header)),
    ...externalHeaders,
    ...binaryHeaders.keys(),
  ]);
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
    if (!existing) {
      Object.defineProperty(item, "__mmmLongSeenChannels", { value: new Set(), enumerable: false, configurable: true });
      attributedTargetHeaders.forEach((header) => { item[header] = 0; });
    }
    attributedTargetHeaders.forEach((header) => {
      const value = mmmParseNumericValue(row[header]);
      if (Number.isFinite(value)) item[header] += value;
      else item[header] = NaN;
    });
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
    item.__mmmLongSeenChannels.add(dynamicHeader);
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
  const dynamicHeaders = [...channelToHeader.values()];
  grouped.forEach((item) => {
    dynamicHeaders.forEach((header) => {
      if (!item.__mmmLongSeenChannels.has(header)) item[header] = 0;
    });
    delete item.__mmmLongSeenChannels;
  });

  const nextHeaders = (headers || []).filter((header) => header !== channelHeader && header !== spendHeader);
  const nextMap = { ...colMap, [channelHeader]: { ...(colMap[channelHeader] || {}), role: "ignore" }, [spendHeader]: { ...(colMap[spendHeader] || {}), role: "ignore" } };
  for (const [channel, header] of channelToHeader) {
    nextHeaders.push(header);
    nextMap[header] = /(^|[\s_-])(organic|오가닉|자연|비광고)([\s_-]|$)/i.test(channel)
      ? { role: "ignore" }
      : { role: "channel", kind: /brand|브랜드/i.test(channel) ? "brand" : "perf", plat: "common" };
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
  const geoPanels = buildGeoPanelFromRows(headers, rows, r, platform, weekStart);
  const tagMode = !r.platform && mmmPlatformTags(headers, colMap).length > 0;
  const P = platform === "all" ? null : platform;
  const normalizedPlatform = P ? normalizePlatformValue(P) : null;
  const inPlat = (x) => !tagMode || !normalizedPlatform
    || x.plat === normalizedPlatform || x.plat === "common";
  // OS가 분리된 회귀에서는 귀속을 알 수 없는 `other_cost`를 매체 효과로
  // 추정하면 Android/iOS 계수가 왜곡된다. 사용자가 명시적으로 채널로
  // 매핑했더라도 이 패널에서는 제외한다.
  const isAmbiguousOtherCost = (x) => /(^|[_\s])(other|etc|misc|기타)([_\s]|$)/i.test(String(x.header || x.label || ""));
  let baseRows = rows || [];
  if (r.platform && normalizedPlatform) {
    baseRows = baseRows.filter((row) =>
      normalizePlatformValue(row[r.platform]) === normalizedPlatform);
  }
  const expectedSegments = r.platform
    ? [...new Set(baseRows.map((row) => normalizePlatformValue(row[r.platform])).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    : [];
  const timeDiagnostics = {
    sourceRows: inheritedDiagnostics?.sourceRows ?? baseRows.length,
    droppedInvalidRows: inheritedDiagnostics?.droppedInvalidRows || 0,
    blankTimeRows: inheritedDiagnostics?.blankTimeRows || 0,
    unparseableTimeRows: inheritedDiagnostics?.unparseableTimeRows || 0,
    blankChannelRows: inheritedDiagnostics?.blankChannelRows || 0,
    repeatedValueConflicts: inheritedDiagnostics?.repeatedValueConflicts || 0,
    conflictingHeaders: inheritedDiagnostics?.conflictingHeaders || [],
    attributedTargetHeaders: inheritedDiagnostics?.attributedTargetHeaders || [],
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
      ...r.reg, ...r.paid, ...r.react, ...r.traffic, ...r.purchasers, ...r.revenue, ...r.channels,
    ].map((item) => item.header));
    // 업계 지수는 일자/플랫폼 행에 반복될 수 있는 level control이다. KPI·spend처럼
    // 합산하면 주간 시장 규모가 행 수만큼 부풀므로 유효값 평균으로 묶는다.
    const externalHeaders = new Set(r.externals.map((item) => item.header));
    const rfHeaders = new Set([...r.reach, ...r.frequency].map((item) => item.header));
    const geoHeader = r.geo;
    const binaryRoles = new Map([
      ...r.dummies.map((item) => [item.header, "dummy"]),
      ...r.steps.map((item) => [item.header, "step"]),
    ]);
    const binaryHeaders = new Set(binaryRoles.keys());
    const modelHeaders = new Set([...additiveHeaders, ...externalHeaders, ...rfHeaders, ...binaryHeaders]);
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
        if (geoHeader) item[geoHeader] = String(row[geoHeader] ?? "").trim();
        for (const header of modelHeaders) {
          if (binaryHeaders.has(header)) {
            const role = binaryRoles.get(header);
            const value = mmmParseBinaryIndicator(row[header], role);
            item[header] = value;
            if (!Number.isFinite(value)) item.__mmmInvalidBinary.add(header);
            if (role === "step" && Number.isFinite(value)) item.__mmmStepStates.set(header, new Set([value]));
            continue;
          }
          if (rfHeaders.has(header)) {
            const value = numericValue(row[header]);
            item[header] = Number.isFinite(value) ? value : "";
            if (Number.isFinite(value)) item.__mmmExternalCounts.set(header, 1);
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
        if (geoHeader) {
          const currentGeo = String(item[geoHeader] ?? "").trim();
          const nextGeo = String(row[geoHeader] ?? "").trim();
          if (currentGeo && nextGeo && currentGeo !== nextGeo) item[geoHeader] = "";
          else if (!currentGeo && nextGeo) item[geoHeader] = nextGeo;
        }
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
          if (rfHeaders.has(header)) {
            if (!Number.isFinite(value)) continue;
            const current = numericValue(item[header]);
            const count = item.__mmmExternalCounts.get(header) || 0;
            item[header] = Number.isFinite(current) && count > 0 ? (current * count + value) / (count + 1) : value;
            item.__mmmExternalCounts.set(header, count + 1);
            continue;
          }
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
        const segment = r.platform ? normalizePlatformValue(row[r.platform]) : "";
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
        const segment = normalizePlatformValue(row[r.platform]);
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
  const panel = { week: baseRows.map((_, i) => i + 1), ch: {}, dummy: {}, steps: {}, external: {}, targets: {}, geo: null, reach: {}, frequency: {} };
  panel.geoPanel = geoPanels;
  const chans = r.channels.filter((channel) => inPlat(channel) && !isAmbiguousOtherCost(channel));
  const dummies = r.dummies.filter(inPlat);
  const steps = r.steps.filter(inPlat);
  const externals = r.externals.filter(inPlat);
  for (const ch of chans) panel.ch[ch.key] = num(ch.header, true);
  for (const d of dummies) panel.dummy[d.key] = baseRows.map((row) => mmmParseBinaryIndicator(row[d.header], "dummy"));
  for (const s of steps) panel.steps[s.key] = baseRows.map((row) => mmmParseBinaryIndicator(row[s.header], "step"));
  if (r.geo) panel.geo = baseRows.map((row) => String(row[r.geo] ?? "").trim() || null);
  for (const item of r.reach.filter(inPlat)) panel.reach[item.key] = num(item.header, true);
  for (const item of r.frequency.filter(inPlat)) panel.frequency[item.key] = num(item.header, true);
  // Total KPI에서는 같은 업계 지표의 Android/iOS 값을 한 level로 합산한다.
  // OS별 KPI 보기에서는 기존처럼 해당 OS 지표만 쓴다.
  const totalExternal = !P ? buildTotalExternalControls(externals, baseRows, num) : null;
  const panelExternals = totalExternal?.defs || externals;
  if (totalExternal) Object.assign(panel.external, totalExternal.values);
  else for (const external of externals) panel.external[external.key] = num(external.header, true);
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
  const regA = sumCols(r.reg), paidA = sumCols(r.paid), reactA = sumCols(r.react), trafficA = sumCols(r.traffic), purchasersA = sumCols(r.purchasers), revenueA = sumCols(r.revenue);
  if (regA) panel.targets.Regs = regA;
  if (paidA) panel.targets.PaidRegs = paidA;
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
  const orderedStepSeries = Object.fromEntries(Object.entries(panel.steps).map(([key, values]) => [key, re(values)]));
  const operationalIntervals = deriveOperationalStepIntervals(steps, orderedStepSeries);
  panel.steps = operationalIntervals.series;
  panel.operationalStepIntervals = operationalIntervals.derived.map((item) => ({
    platform: item.platform,
    shutdownKey: item.shutdown.key,
    shutdownLabel: item.shutdown.label,
    reopenKey: item.reopen.key,
    reopenLabel: item.reopen.label,
    startIndex: item.startIndex,
    reopenIndex: item.reopenIndex,
  }));
  const stepModeByKey = new Map(steps.map((step) => [step.key, step.stepMode]));
  for (const k in panel.steps) {
    const ordered = panel.steps[k];
    if (stepModeByKey.get(k) !== "boundary") {
      panel.steps[k] = ordered;
      continue;
    }
    let active = 0;
    panel.steps[k] = ordered.map((value) => {
      if (!Number.isFinite(value)) return NaN;
      if (value !== 0) active = 1;
      return active;
    });
  }
  for (const k in panel.external) panel.external[k] = re(panel.external[k]);
  if (panel.geo) panel.geo = re(panel.geo);
  for (const k in panel.reach) panel.reach[k] = re(panel.reach[k]);
  for (const k in panel.frequency) panel.frequency[k] = re(panel.frequency[k]);
  for (const k in panel.targets) panel.targets[k] = re(panel.targets[k]);
  if (panel.targets.Regs && panel.targets.React) {
    panel.targets.RR = panel.week.map((_, i) => panel.targets.Regs[i] + panel.targets.React[i]);
    if (!panel.targets.Traffic) panel.targets.Traffic = panel.targets.RR.slice();
  }
  // deriveWide와 동일한 패널 형태로 — 엔진(mmmChannelEffects/decomp)·렌더가 참조.
  panel.channels = chans.map((c) => ({ key: c.key, label: c.label, kind: c.kind }));
  panel.mediaInputMap = Object.fromEntries(chans.map((channel) => {
    const reach = matchMediaInput(channel, r.reach.filter(inPlat));
    const frequency = matchMediaInput(channel, r.frequency.filter(inPlat));
    return [channel.key, {
      channelLabel: channel.label,
      type: reach && frequency ? "reach-frequency" : "spend",
      reachKey: reach?.key || null,
      frequencyKey: frequency?.key || null,
      reachHeader: reach?.header || null,
      frequencyHeader: frequency?.header || null,
    }];
  }));
  const hasCompleteGeo = Boolean(panel.geo?.length && panel.geo.every(Boolean));
  panel.geoMode = hasCompleteGeo ? "geo-available" : panel.geo ? "geo-incomplete" : "national-fallback";
  panel.rfMode = Object.keys(panel.reach).length && Object.keys(panel.frequency).length ? "rf-available" : "spend-only";
  panel.meridianInput = {
    level: panel.geoMode === "geo-available" ? "geo" : "national",
    reach: Object.keys(panel.reach).length > 0,
    frequency: Object.keys(panel.frequency).length > 0,
    fitMode: Object.values(panel.mediaInputMap).some((item) => item.type === "reach-frequency") ? "mixed-spend-rf" : "spend-based",
    matchedRfChannels: Object.values(panel.mediaInputMap).filter((item) => item.type === "reach-frequency").length,
    unmatchedRfChannels: Object.values(panel.mediaInputMap).filter((item) => item.type !== "reach-frequency").map((item) => item.channelLabel).filter(Boolean),
  };
  panel.channelValueSemantics = "cost";
  panel.channelCostHeaders = chans
    .filter((channel) => isOperationalDeliveryCostHeader(channel.header))
    .map((channel) => channel.header);
  panel.dummyDefs = dummies.map((d) => ({ key: d.key, label: d.label }));
  const derivedIntervalKeys = new Set(panel.operationalStepIntervals.map((item) => item.shutdownKey));
  panel.stepDefs = steps.map((s) => ({ key: s.key, label: s.label, autoDerivedInterval: derivedIntervalKeys.has(s.key) }));
  panel.externalDefs = panelExternals.map((external) => ({
    key: external.key,
    label: external.label,
    isPlatformAggregate: Boolean(external.isPlatformAggregate),
    sourceHeaders: external.sourceHeaders,
  }));
  panel.reachDefs = r.reach.filter(inPlat).map((item) => ({ key: item.key, label: item.label }));
  panel.frequencyDefs = r.frequency.filter(inPlat).map((item) => ({ key: item.key, label: item.label }));
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
  if (timeDiagnostics.attributedTargetHeaders.length) timeDiagnostics.warnings.push({ code: "attributed-long-target", headers: timeDiagnostics.attributedTargetHeaders, messageKo: `Organic 행과 채널별로 다른 Y를 확인해 ${timeDiagnostics.attributedTargetHeaders.join(", ")}를 채널 귀속값으로 합산했습니다.`, messageEn: `An Organic row and channel-varying Y were detected, so ${timeDiagnostics.attributedTargetHeaders.join(", ")} was summed as channel-attributed outcomes.` });
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
  ["paid", "🎯 Paid 가입 Regs (선택)", "🎯 Paid regs (optional)", false, true],
  ["react", "🎯 재활성 React", "🎯 Reactivation", false, true],
  ["traffic", "🎯 총유입 Traffic", "🎯 Total traffic", false, true],
  ["purchasers", "🛍 구매자 Purchasers", "🛍 Purchasers", false, true],
  ["revenue", "💰 매출 Revenue", "💰 Revenue", false, true],
  ["channel", "📈 채널 spend (여러 개 · perf/brand · 플랫폼)", "📈 Channel spend (many · perf/brand · platform)", true, true],
  ["geo", "🌍 GEO (선택 · 없으면 National-level)", "🌍 GEO (optional · National-level fallback)", false, false],
  ["reach", "👥 Reach (선택 · RF)", "👥 Reach (optional · RF)", false, true],
  ["frequency", "🔁 Frequency (선택 · RF)", "🔁 Frequency (optional · RF)", false, true],
  ["external", "📊 업계 수요 지수 (MMM 전용 · 상대 변화로 변환 · 여러 개 · 플랫폼)", "📊 Industry-demand index (MMM only · converted to relative change · many · platform)", false, true],
  ["dummy", "🔢 더미/이벤트 (0·1 · true/false · yes/no · on/off)", "🔢 Dummy/event (0/1 · true/false · yes/no · on/off)", false, true],
  ["step", "📐 구조변화 step (상태열 또는 경계 pulse · 중단+재개 단일쌍은 기간 자동 생성)", "📐 Structural step (state or boundary pulse · one shutdown/reopen pair derives the interval)", false, true],
  ["platform", "🔀 세그먼트/플랫폼 단일 컬럼 (선택 · 성별·플랫폼·국가 등 값별로 나눠보기)", "🔀 Segment/platform single column (optional · split by gender/platform/country, etc.)", false, false],
];

const MAPPER_CLEAR_BUTTON_STYLE = {
  display: "inline-grid",
  placeItems: "center",
  flex: "0 0 44px",
  width: "44px",
  minWidth: "44px",
  height: "44px",
  minHeight: "44px",
  border: 0,
  padding: 0,
  background: "transparent",
  cursor: "pointer",
  color: "var(--text-muted)",
  touchAction: "manipulation",
};

// 역할 영역의 설명은 Zone 제목에서 충분히 제공한다. select에는 조작에 필요한
// 짧은 역할명만 보여, 채널의 보조 control이 같은 폭을 두고 경쟁하지 않게 한다.
function roleSelectLabel(role, locale) {
  const labels = {
    week: ["주차", "Week"], date: ["날짜", "Date"], reg: ["가입 Regs", "Regs"],
    paid: ["Paid 가입 Regs", "Paid regs"], react: ["재활성 React", "Reactivation"],
    traffic: ["총유입 Traffic", "Total traffic"], purchasers: ["구매자", "Purchasers"],
    revenue: ["매출", "Revenue"], channel: ["채널 spend", "Channel spend"],
    external: ["업계 수요 지수", "Industry demand"], dummy: ["더미/이벤트", "Dummy/event"],
    step: ["구조변화 step", "Structural step"], platform: ["세그먼트/플랫폼", "Segment/platform"],
    geo: ["GEO", "GEO"], reach: ["Reach", "Reach"], frequency: ["Frequency", "Frequency"],
  };
  return labels[role]?.[locale === "en" ? 1 : 0] || role;
}

export default function MmmColumnMapper({ headers, rows, colMap, onChange, locale = "ko", allowNoSpend = false }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const [dragCol, setDragCol] = useState(null);
  const [selectedCol, setSelectedCol] = useState(null);
  const [dragOverRole, setDragOverRole] = useState(null);
  const [mapperTab, setMapperTab] = useState("core");
  const cm = colMap || {};

  const setRole = (col, role) => {
    const next = { ...cm };
    if (["week", "date", "platform", "geo"].includes(role)) {
      for (const h of headers || []) {
        if (next[h] && next[h].role === role) next[h] = { ...next[h], role: "ignore" };
      }
    }
    const prev = next[col] || {};
    const nextDef = {
      ...prev,
      role,
      plat: ["reg", "paid", "react", "traffic", "purchasers", "revenue", "channel", "dummy", "step", "external", "reach", "frequency"].includes(role) ? prev.plat || guessPlat(col) : prev.plat,
      stepMode: role === "step" ? prev.stepMode || guessedStepMode(col) : prev.stepMode,
    };
    // 사용자가 직접 역할을 지정하면 자동 경계 추론보다 명시적 선택을 우선한다.
    delete nextDef.autoBoundaryKind;
    next[col] = nextDef;
    onChange(next);
  };
  const setField = (col, field, value) => {
    const nextDef = { ...(cm[col] || {}), [field]: value };
    if (nextDef.role === "step" && ["plat", "stepMode"].includes(field)) delete nextDef.autoBoundaryKind;
    onChange({ ...cm, [col]: nextDef });
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
    const isUnassigned = (def.role || "ignore") === "ignore";
    return (
      <span
        className={`reg-chip mmm-mapper-chip ${isUnassigned ? "mmm-mapper-chip--unassigned" : "mmm-mapper-chip--mapped"}`}
        role="group"
        tabIndex={0}
        aria-label={tr(`${col} 매핑 설정`, `${col} mapping controls`)}
        draggable
        onDragStart={(event) => beginDrag(event, col)}
        onDragEnd={() => { setDragCol(null); setDragOverRole(null); }}
        onClick={(event) => { event.stopPropagation(); setSelectedCol(col); }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          setSelectedCol(col);
        }}
        style={{ background: selectedCol === col ? "color-mix(in srgb, var(--primary) 14%, var(--bg-2))" : "var(--bg-2)", border: selectedCol === col ? "1px solid var(--primary)" : "1px solid var(--border)", boxShadow: selectedCol === col ? "0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent)" : "none" }}
      >
        <strong className="mmm-mapper-chip__label" title={col}>{col}</strong>
        <span className="mmm-mapper-chip__controls">
          <select
            className="mmm-mapper-chip__role"
            value={def.role || "ignore"}
            aria-label={tr(`${col} 역할`, `${col} role`)}
            title={tr("드래그 대신 역할을 직접 선택", "Choose a role instead of dragging")}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setRole(col, event.target.value)}
          >
            <option value="ignore">{tr("미지정", "Unassigned")}</option>
            {ZONES.map(([role]) => <option key={role} value={role}>{roleSelectLabel(role, locale)}</option>)}
          </select>
          {withKind && (
            <select className="mmm-mapper-chip__kind" value={def.kind || "perf"} aria-label={tr(`${col} 채널 유형`, `${col} channel type`)} onClick={(event) => event.stopPropagation()} onChange={(e) => setField(col, "kind", e.target.value)}>
              <option value="perf">perf spend</option>
              <option value="brand">brand spend</option>
            </select>
          )}
          {withPlat && (
            <select className="mmm-mapper-chip__platform" value={def.plat || "common"} aria-label={tr(`${col} 플랫폼`, `${col} platform`)} onClick={(event) => event.stopPropagation()} onChange={(e) => setField(col, "plat", e.target.value)}>
              <option value="common">{tr("공통", "Common")}</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          )}
          {def.role === "step" && (
            <select className="mmm-mapper-chip__step" value={def.stepMode || "state"} aria-label={tr(`${col} 구조변화 방식`, `${col} structural-step mode`)} onClick={(event) => event.stopPropagation()} onChange={(e) => setField(col, "stepMode", e.target.value)}>
              <option value="state">{tr("상태열 (입력값 유지)", "State series (keep input)")}</option>
              <option value="boundary">{tr("경계 pulse→이후 1", "Boundary pulse → post=1")}</option>
            </select>
          )}
        </span>
        <button type="button" className="mmm-mapper-chip__clear" onClick={(event) => { event.stopPropagation(); placeColumn(col, "ignore"); }} aria-label={tr(`${col} 매핑 해제`, `Clear ${col} mapping`)} style={MAPPER_CLEAR_BUTTON_STYLE}>✕</button>
      </span>
    );
  };

  const Zone = ({ role, label, withKind, withPlat }) => (
    <div
      data-mmm-role-zone={role}
      role={selectedCol ? "button" : undefined}
      tabIndex={selectedCol ? 0 : -1}
      aria-label={selectedCol ? tr(`${selectedCol}을 ${label}에 배치`, `Place ${selectedCol} in ${label}`) : undefined}
      onDragEnter={(event) => { event.preventDefault(); setDragOverRole(role); }}
      onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = "move"; setDragOverRole(role); }}
      onDragLeave={() => setDragOverRole((current) => current === role ? null : current)}
      onDrop={(event) => { event.preventDefault(); placeColumn(draggedColumn(event), role); }}
      onClick={() => placeColumn(selectedCol, role)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        placeColumn(selectedCol, role);
      }}
      className="mmm-mapper-zone"
      style={{ border: dragOverRole === role ? "2px solid var(--primary)" : "1px dashed var(--border)", background: dragOverRole === role ? "color-mix(in srgb, var(--primary) 8%, var(--bg-1))" : selectedCol ? "color-mix(in srgb, var(--primary) 3%, var(--bg-1))" : "transparent", cursor: selectedCol ? "pointer" : "default" }}
    >
      <div className="mmm-mapper-zone__label">{label}</div>
      <div>
        {inRole(role).length
          ? inRole(role).map((c) => <Chip key={c} col={c} withKind={withKind} withPlat={withPlat} />)
          : <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{tr("여기로 드래그하거나 칩에서 역할 선택", "Drag here or choose the role on a chip")}</span>}
      </div>
    </div>
  );

  const tray = (headers || []).filter((h) => (cm[h]?.role || "ignore") === "ignore");
  const missing = colMapMissing(headers, cm, locale).filter((item) =>
    !allowNoSpend || !["채널 spend 1개 이상", "1+ channel spend"].includes(item),
  );
  const hasMappedTime = (headers || []).some((header) => ["date", "week"].includes(cm[header]?.role));
  const hasMappedPlatform = (headers || []).some((header) => cm[header]?.role === "platform");
  const optionalRoles = new Set(["geo", "reach", "frequency"]);
  const visibleZones = ZONES.filter(([role]) => mapperTab === "meridian" ? optionalRoles.has(role) : !optionalRoles.has(role));
  const hasGeo = inRole("geo").length > 0;
  const hasReach = inRole("reach").length > 0;
  const hasFrequency = inRole("frequency").length > 0;
  const forecastInputWarnings = mmmForecastInputWarnings(headers, rows, cm, locale);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <p className="muted" style={{ fontSize: "12px", margin: 0 }}>
          {selectedCol
            ? tr(`“${selectedCol}” 선택됨 — 넣을 역할 영역을 한 번 클릭하세요.`, `“${selectedCol}” selected — click the role zone to place it.`)
            : tr("컬럼을 드래그하거나 칩의 역할 선택을 사용하세요. 칩을 클릭한 뒤 역할 영역을 클릭해도 됩니다.", "Drag columns or use each chip’s role selector. You can also click a chip and then a role zone.")}
        </p>
        <button
          type="button"
          className="ab-pill"
          onClick={() => onChange(autoGuessColMap(headers, rows, false))}
        >
          {tr("🪄 전부 자동 추정", "🪄 Auto-map all")}
        </button>
      </div>
      <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid var(--border)", marginBottom: "10px" }}>
        {["core", "meridian"].map((tab) => (
          <button key={tab} type="button" className="ab-pill" onClick={() => setMapperTab(tab)} style={{ borderBottom: mapperTab === tab ? "2px solid var(--primary)" : "2px solid transparent", borderRadius: "6px 6px 0 0" }}>
            {tab === "core" ? tr("기본 MMM", "Core MMM") : tr("Meridian 입력 (선택)", "Meridian inputs (optional)")}
          </button>
        ))}
      </div>
      {mapperTab === "meridian" && (
        <div className="callout" style={{ marginBottom: "10px" }}>
          <div className="ico">i</div>
          <div className="body"><strong>{tr("선택 입력입니다", "Optional inputs")}</strong><p>{tr("GEO가 없으면 National-level로 분석합니다. Reach/Frequency가 없으면 spend 기반으로 분석합니다. 현재 매핑은 입력을 보존하며 기본 적합은 spend 기반입니다.", "Without GEO, the model uses a national-level fallback. Without Reach/Frequency, it uses spend-based inputs. Mapping preserves these fields; the current fit remains spend-based.")}</p></div>
        </div>
      )}
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
      <div className="mmm-mapper-zones" style={{ display: "grid", gap: "10px", alignItems: "start" }}>
        {visibleZones.map(([role, koLabel, enLabel, withKind, withPlat]) => (
          <Zone key={role} role={role} label={tr(koLabel, enLabel)} withKind={withKind} withPlat={withPlat} />
        ))}
      </div>
      <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--text-muted)" }}>
        {tr(`Meridian 입력 상태 · GEO: ${hasGeo ? "매핑됨" : "없음 → National-level"} · Reach: ${hasReach ? "매핑됨" : "없음"} · Frequency: ${hasFrequency ? "매핑됨" : "없음"}`, `Meridian inputs · GEO: ${hasGeo ? "mapped" : "missing → National-level"} · Reach: ${hasReach ? "mapped" : "missing"} · Frequency: ${hasFrequency ? "mapped" : "missing"}`)}
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
      {forecastInputWarnings.length > 0 && (
        <div className="callout warning" style={{ marginTop: "10px" }}>
          <div className="ico">!</div>
          <div className="body">
            <strong>{tr("미래예측 입력 확인", "Forecast input check")}</strong>
            {forecastInputWarnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
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
