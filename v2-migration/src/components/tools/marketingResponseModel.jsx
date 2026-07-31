"use client";
import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import Chart from "chart.js/auto";
import * as XLSX from "xlsx";
import { MMM_METH_CONFIG, MMM_FORECAST_DEFAULT_TREND_DAMPING, MMM_NONMEDIA_GROUPS, mmmValidate, mmmBayesianRun, mmmBayesianHealth, mmmBayesianForecast, mmmForecastRollingSelection, mmmForecastBackgroundCandidateCap, mmmForecastDeclaredFitContract, mmmForecastApplySelectedBlend, mmmForecastSelectNestedRoute, mmmForecastGlobalBaseline, mmmForecastGlobalSeasonality, mmmForecastDampedTrendOffset, mmmForecastRestoreSeasonality, mmmResolveAbsorb, _mmmChans } from "@/utils/mmmMath";
import { mmmOls } from "@/utils/regMath";
import { mmmCannibLevel } from "@/utils/responseCannibRank";
import { trackProductEvent } from "@/lib/analytics";
import { buildPanelFromColMap, normalizePlatformValue } from "@/components/tools/MmmColumnMapper";
import { buildMmmAggregateMediaPanel, buildMmmWeeklyPerformance, sliceMmmChannelContributions } from "@/utils/mmmWeeklyPerformance";
import { mmmPriorMroiAtSpend } from "@/utils/mmmPriorMath";
import { mmmParseNumericValue } from "@/utils/mmmInputUtils";
import { runAnnualAnalogRouter } from "@/utils/annualAnalogForecast";
import { CHART_THEME as GLOBAL_CHART_THEME } from "@/utils/chartUtils";

/* ============================================================================
 * MarketingResponse (5-18) — MOCK → REAL 와이어링
 * index.html page_5_18 이식. 엔진(mmmMath/regMath/regForecastMath/regLabMath/
 * responseMath)은 이미 포팅·골든 검증됨 — 수학 재구현 금지, 이 컴포넌트는
 * (1) MmmColumnMapper(DnD colMap, index.html page_5_18 이식)가 PRIMARY 매퍼 — 단일 generic CSV를
 *     역할로 드래그 → buildPanelFromColMap로 패널 생성(모든 분석 공유)  (2) 엔진 호출  (3) 렌더.
 * 결정론(§3): 난수 사용 금지(0건). seededNoise만 사용.
 * ========================================================================== */

// 목표를 다시 전환했을 때 동일한 원자료·매핑·근거 조합을 재적합하지 않는다.
// 원자료 배열이 사라지면 함께 GC되는 WeakMap이고, 배열별 최근 10개 결과만 보관한다.
// 데이터는 브라우저 메모리 밖으로 나가지 않는다.
export const MMM_RESULT_CACHE = new WeakMap();
export const MMM_CACHE_OBJECT_IDS = new WeakMap();
export let mmmNextCacheObjectId = 1;

export function mmmCacheObjectId(value) {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return "none";
  if (!MMM_CACHE_OBJECT_IDS.has(value)) MMM_CACHE_OBJECT_IDS.set(value, mmmNextCacheObjectId++);
  return MMM_CACHE_OBJECT_IDS.get(value);
}

export function mmmCachedResult(raw, key) {
  return Array.isArray(raw) ? MMM_RESULT_CACHE.get(raw)?.get(key) || null : null;
}

export function mmmStoreCachedResult(raw, key, result) {
  if (!Array.isArray(raw) || !result || result.empty) return result;
  let bucket = MMM_RESULT_CACHE.get(raw);
  if (!bucket) {
    bucket = new Map();
    MMM_RESULT_CACHE.set(raw, bucket);
  }
  if (bucket.has(key)) bucket.delete(key);
  bucket.set(key, result);
  while (bucket.size > 10) bucket.delete(bucket.keys().next().value);
  return result;
}

export function mmmCsvSourceChanged(previousSignature, nextSignature, previousRaw, nextRaw) {
  return previousSignature !== nextSignature || previousRaw !== nextRaw;
}

export function mmmCsvParseFailure(result) {
  if (!result || !Array.isArray(result.data) || result.data.length === 0) return "empty";
  const fatalError = (result.errors || []).find((error) =>
    error?.type === "Quotes"
    || error?.type === "Delimiter"
    || error?.type === "Abort"
    || error?.code === "TooManyFields");
  return fatalError ? "parse" : null;
}

export function mmmAnalysisGateOpen({
  analyzedSignature,
  analysisSignature,
  analyzedRaw,
  currentRaw,
}) {
  return analyzedSignature != null
    && analyzedSignature === analysisSignature
    && analyzedRaw === currentRaw;
}

export function forecastRegimeInputChanged(previousSignature, nextSignature) {
  return previousSignature != null && previousSignature !== nextSignature;
}

export function forecastRegimeStateForInput({
  stateSignature,
  currentSignature,
  trainingWeeks,
  scanRequested,
}) {
  const hasRegimeState = Boolean(trainingWeeks) || scanRequested === true;
  if (hasRegimeState && stateSignature !== currentSignature) {
    return { trainingWeeks: null, scanRequested: false };
  }
  return {
    trainingWeeks: trainingWeeks || null,
    scanRequested: scanRequested === true,
  };
}

export function safeForecastRegimeScan(scan) {
  try {
    return scan();
  } catch {
    return {
      available: false,
      calculationFailed: true,
      reason: "regime-scan-error",
      candidates: [],
      recommended: null,
    };
  }
}

export function forecastCandidateSearchProvenance(forecast) {
  const audits = [];
  const visited = new Set();
  const visit = (node, scope) => {
    if (!node || typeof node !== "object" || visited.has(node)) return;
    visited.add(node);
    if (node.rollingSelection?.candidateSearchAudit) {
      audits.push({
        scope,
        platform: node.platform || null,
        ...node.rollingSelection.candidateSearchAudit,
      });
    }
    (node.components || []).forEach((child, index) => visit(child, `${scope}.components[${index}]`));
    (node.platformForecasts || []).forEach((child, index) => visit(child, `${scope}.platformForecasts[${index}]`));
    Object.entries(node.componentForecasts || {}).forEach(([key, child]) =>
      visit(child, `${scope}.${key}`));
  };
  visit(forecast, "forecast");
  return audits;
}

// 브랜드 채널 판별(이름 기반) — index kind='brand' 휴리스틱
export function isBrandName(name) {
  return /brand|branded|검색|search.?ads|asa\b|apple.?search|브랜드/i.test(String(name || ""));
}

// _mmmTrimToActive 이식 — targets+ch 전부 0인 선/후행 주 제거(n≥4 가드)
export function trimToActive(panel) {
  const n = panel.week.length;
  if (n < 4) return panel;
  const chKeys = Object.keys(panel.ch);
  const tgtKeys = Object.keys(panel.targets);
  const activeAt = (i) => {
    let s = 0;
    for (const k of tgtKeys) {
      const value = panel.targets[k][i];
      if (!Number.isFinite(value)) return true;
      s += Math.abs(value);
    }
    for (const k of chKeys) {
      const v = panel.ch[k][i];
      if (!Number.isFinite(v)) return true;
      s += Math.abs(v);
    }
    for (const values of Object.values(panel.reach || {})) {
      if (!Number.isFinite(values[i])) return true;
      s += Math.abs(values[i]);
    }
    for (const values of Object.values(panel.frequency || {})) {
      if (!Number.isFinite(values[i])) return true;
      s += Math.abs(values[i]);
    }
    for (const values of Object.values(panel.dummy || {})) if (!Number.isFinite(values[i])) return true;
    for (const values of Object.values(panel.steps || {})) if (!Number.isFinite(values[i])) return true;
    for (const values of Object.values(panel.external || {})) if (!Number.isFinite(values[i])) return true;
    return s > 0;
  };
  let head = 0;
  while (head < n && !activeAt(head)) head++;
  let tail = n - 1;
  while (tail > head && !activeAt(tail)) tail--;
  if (head === 0 && tail === n - 1) return panel;
  if (tail - head + 1 < 4) return panel; // 너무 짧아지면 트림 안 함
  const slice = (arr) => arr.slice(head, tail + 1);
  const out = {
    ...panel,
    week: slice(panel.week),
    weekLabel: panel.weekLabel ? slice(panel.weekLabel) : undefined,
    dateLabel: panel.dateLabel ? slice(panel.dateLabel) : undefined,
    dates: panel.dates ? slice(panel.dates) : undefined,
    ch: {},
    reach: {},
    frequency: {},
    dummy: {},
    steps: {},
    external: {},
    geo: Array.isArray(panel.geo) ? slice(panel.geo) : panel.geo,
    targets: {},
  };
  for (const k of chKeys) out.ch[k] = slice(panel.ch[k]);
  for (const k of Object.keys(panel.reach || {})) out.reach[k] = slice(panel.reach[k]);
  for (const k of Object.keys(panel.frequency || {})) out.frequency[k] = slice(panel.frequency[k]);
  for (const k of Object.keys(panel.dummy || {})) out.dummy[k] = slice(panel.dummy[k]);
  for (const k of Object.keys(panel.steps || {})) out.steps[k] = slice(panel.steps[k]);
  for (const k of Object.keys(panel.external || {})) out.external[k] = slice(panel.external[k]);
  for (const k of tgtKeys) out.targets[k] = slice(panel.targets[k]);
  out.trimmed = { droppedHead: head, droppedTail: n - 1 - tail, origN: n, usedN: tail - head + 1 };
  return out;
}

// 예측의 주기항은 "CSV의 첫 행부터 몇 번째인가"가 아니라 실제 달력 위상에
// 고정되어야 한다. 동일한 최근 구간 앞에 오래된 행을 붙이거나 제거해도 같은
// 날짜의 연간·분기 계절성 좌표가 바뀌지 않도록 월요일 epoch 기준 주차를 쓴다.
export function calendarizeForecastPanel(panel) {
  const n = panel?.week?.length || 0;
  if (!n) return panel;
  const sourceDates = Array.isArray(panel.dates) && panel.dates.length === n
    ? panel.dates
    : (panel.dateLabel || panel.weekLabel || []).map((value) => {
        const iso = isoDateFromLabel(value);
        return iso ? new Date(`${iso}T00:00:00Z`) : null;
      });
  if (sourceDates.length !== n) return panel;
  const epochMonday = Date.UTC(1970, 0, 5);
  const calendarWeeks = sourceDates.map((value) => {
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(time) ? Math.round((time - epochMonday) / (7 * 86400000)) : NaN;
  });
  if (!calendarWeeks.every(Number.isFinite)) return panel;
  if (calendarWeeks.some((value, index) => index > 0 && value <= calendarWeeks[index - 1])) return panel;
  return { ...panel, week: calendarWeeks };
}

export function forecastPlatformRouteGuard(values = []) {
  const normalized = (values || []).map(normalizePlatformValue).filter(Boolean);
  const hasAggregatePlatformRows = normalized.includes("all");
  const modeledPlatformSet = new Set(normalized.filter((value) => value !== "all"));
  return {
    normalized,
    hasAggregatePlatformRows,
    hasDisaggregatedPlatformRows: modeledPlatformSet.size > 0,
    hasAndroid: modeledPlatformSet.has("android"),
    hasIos: modeledPlatformSet.has("ios"),
    hasOnlyAndroidIos: [...modeledPlatformSet].every((value) =>
      value === "android" || value === "ios"),
  };
}

export function selectForecastProductionRoute(
  directNested,
  osNested,
  { horizon = 12, allowOsProduction = true } = {},
) {
  const diagnostic = mmmForecastSelectNestedRoute([directNested, osNested], { horizon });
  if (allowOsProduction) {
    return {
      ...diagnostic,
      componentGuardrailRequired: true,
    };
  }
  // Web/기타 플랫폼이 있으면 Android+iOS는 Total의 일부일 뿐이다. 두 route의
  // 공통-actual 진단은 보존하되 실제 감사·배포·인증은 Direct Total만 사용한다.
  const directOnly = mmmForecastSelectNestedRoute([directNested], { horizon });
  const directCandidate = (directOnly.candidates || [])
    .find((candidate) => candidate.route === "direct-total");
  const latestWmape = directOnly.latestWmape;
  const latestBaselineWmape = directOnly.latestBaselineWmape;
  const certified = directOnly.productionRoute === "direct-total"
    && Number.isFinite(latestWmape)
    && latestWmape < 10
    && Number.isFinite(directCandidate?.developmentWmape)
    && directCandidate.developmentWmape < 10
    && (!Number.isFinite(latestBaselineWmape) || latestWmape < latestBaselineWmape);
  return {
    ...diagnostic,
    auditRoute: directOnly.auditRoute,
    productionRoute: directOnly.productionRoute,
    latestWmape,
    latestBaselineWmape,
    certified,
    componentGuardrailRequired: false,
    diagnosticAuditRoute: diagnostic.auditRoute,
    diagnosticProductionRoute: diagnostic.productionRoute,
  };
}

export function buildForecastProductionModel(direct, components, routeDecision) {
  if (routeDecision?.productionRoute === "direct-total") {
    return {
      ...direct,
      isAdditiveTotal: false,
      isNestedDirect: true,
      paidOrganicUnavailable: true,
      routeDecision,
      challengerComponents: components,
    };
  }
  return {
    isAdditiveTotal: true,
    paidOrganicUnavailable: true,
    components,
    directChallenger: direct,
    routeDecision,
  };
}

export const MMM_USER_TARGETS = ["Traffic", "Regs", "React", "Purchasers", "Revenue"];

export function pickTarget(panel, preferred) {
  const avail = MMM_USER_TARGETS.filter((target) => Object.prototype.hasOwnProperty.call(panel.targets, target));
  if (preferred === "RR" && avail.includes("Traffic")) return "Traffic";
  if (preferred && avail.includes(preferred)) return preferred;
  if (avail.includes("Regs")) return "Regs";
  return avail[0] || "Regs";
}

// Prior 원자료의 Y는 현재 MMM에서 고른 목표와 의미가 정확히 같을 때만 쓴다.
// "첫 번째 KPI 컬럼"으로 폴백하면 가입 근거가 매출 모델에 섞일 수 있으므로 금지한다.
export const MMM_TARGET_HEADER_PATTERNS = {
  Traffic: /traffic|total.?visit|total.?user|총.?유입|방문자|sessions?/i,
  Regs: /signups?|registrations?|가입|등록/i,
  React: /reactiv|재유입|재활성/i,
  RR: /^(rr|total_reg_react)$|signups?.*reactiv|registrations?.*reactiv|가입.*(재유입|재활성)/i,
  Purchasers: /purchaser|buyer|구매자|결제자/i,
  Revenue: /revenue|sales|gmv|매출|결제금액|payment/i,
};

export const MMM_TARGET_HEADER_ALIASES = {
  Traffic: ["traffic", "totalvisit", "totaluser", "총유입", "방문자", "session", "sessions"],
  Regs: ["signup", "signups", "registration", "registrations", "가입", "등록"],
  React: ["reactivation", "reactivations", "reactivated", "재유입", "재활성"],
  RR: ["rr", "totalregreact", "signupreactivation", "registrationreactivation", "가입재유입", "가입재활성"],
  Purchasers: ["purchaser", "purchasers", "buyer", "buyers", "구매자", "결제자"],
  Revenue: ["revenue", "sales", "gmv", "매출", "결제금액", "payment"],
};

export function mmmNormalizedHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

export function mmmTargetDisplay(target, locale = "ko") {
  const labels = locale === "en"
    ? { Traffic: "traffic", Regs: "registrations", React: "reactivations", RR: "registrations + reactivations", Purchasers: "purchasers", Revenue: "revenue", Total: "registrations + reactivations" }
    : { Traffic: "총유입", Regs: "가입", React: "재유입", RR: "가입 + 재유입", Purchasers: "구매자", Revenue: "매출", Total: "가입 + 재유입" };
  return labels[target] || String(target || (locale === "en" ? "outcome" : "성과"));
}

export function mmmCanonicalSegment(value) {
  const normalized = String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, "");
  if (["android", "aos", "googleplay", "playstore"].includes(normalized)) return "android";
  if (["ios", "iphone", "ipad"].includes(normalized)) return "ios";
  return normalized;
}

export function mmmHeaderSegments(header) {
  return String(header || "").normalize("NFKC").toLocaleLowerCase("en-US").split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(mmmCanonicalSegment);
}

export function mmmTargetHeader(headers, target, { platform = "all", allowCommon = true } = {}) {
  const pattern = MMM_TARGET_HEADER_PATTERNS[target];
  if (!pattern) return null;
  // `revenue_spend`·`signup_cost`는 Y가 아니라 처리 강도다. exact KPI alias를
  // 먼저 고르고 spend/cost/budget 계열은 정규식 후보에서도 제외한다.
  const candidates = (headers || []).filter((header) => !/spend|cost|expense|budget|비용|지출|예산/i.test(String(header)));
  const aliases = new Set(MMM_TARGET_HEADER_ALIASES[target] || []);
  const platformKey = platform && platform !== "all" ? mmmCanonicalSegment(platform) : null;
  if (platformKey) {
    const matchingPlatform = candidates.filter((header) => mmmHeaderSegments(header).includes(platformKey));
    const taggedMatch = matchingPlatform.find((header) => aliases.has(mmmNormalizedHeader(header)))
      || matchingPlatform.find((header) => pattern.test(String(header)));
    if (taggedMatch) return taggedMatch;
    if (!allowCommon) return null;
    // 행 단위 platform 파일은 공통 Y 헤더를 platform 행 필터 뒤에 사용한다.
    // 반대 OS가 명시된 wide 헤더는 공통 헤더로 폴백하지 않는다.
    const common = candidates.filter((header) => {
      const segments = mmmHeaderSegments(header);
      return !segments.includes("android") && !segments.includes("ios");
    });
    return common.find((header) => aliases.has(mmmNormalizedHeader(header)))
      || common.find((header) => pattern.test(String(header)))
      || null;
  }
  return candidates.find((header) => aliases.has(mmmNormalizedHeader(header)))
    || candidates.find((header) => pattern.test(String(header)))
    || null;
}

// 실험 prior도 현재 MMM의 platform/segment grain을 따라야 한다. 행 단위
// platform이면 해당 행만 남기고, wide-tag 파일이면 호출부가 같은 태그의 Y를
// 반드시 고르도록 common fallback을 금지한다.
export function mmmEvidencePlatformSlice(headers, rows, platform = "all") {
  if (!platform || platform === "all") return { rows: rows || [], platformHeader: null, requireTaggedTarget: false, matched: true };
  const platformHeader = (headers || []).find((header) => /(^|[_\s])(platform|os|device|segment)([_\s]|$)|플랫폼|기기|세그먼트/i.test(String(header)));
  if (!platformHeader) return { rows: rows || [], platformHeader: null, requireTaggedTarget: true, matched: true };
  const platformKey = mmmCanonicalSegment(platform);
  const filteredRows = (rows || []).filter((row) => mmmCanonicalSegment(row?.[platformHeader]) === platformKey);
  return {
    rows: filteredRows,
    platformHeader,
    requireTaggedTarget: false,
    matched: filteredRows.length > 0,
  };
}

// 실험 원자료의 파생 Y를 만들 때도 엔진과 같은 숫자 규칙을 쓴다.
// CSV 값은 PapaParse의 dynamicTyping 없이 문자열로 들어오므로 `Number("2,488")`처럼
// 천단위 콤마가 있는 정상 숫자를 0으로 잃지 않도록 기호·구분자를 제거한다.
export function mmmEvidenceNumber(value) {
  return mmmParseNumericValue(value);
}

export function mmmDerivedTrafficValue(registrationsValue, reactivationsValue) {
  const registrations = mmmEvidenceNumber(registrationsValue);
  const reactivations = mmmEvidenceNumber(reactivationsValue);
  return Number.isFinite(registrations) && Number.isFinite(reactivations)
    ? registrations + reactivations
    : NaN;
}

// 메인 매핑과 동일한 Y 헤더가 prior 파일에 여러 개 있으면(Total의
// Android+iOS 등) 메인 패널과 같은 방식으로 합산한다. 한 구성값의 결측을 0으로
// 대체하지 않아 부분 Total이 더 정밀한 근거처럼 들어가는 일을 막는다.
export function mmmComposeEvidenceTarget(rows, headers, syntheticHeader = "__mmm_evidence_target") {
  const selectedHeaders = [...new Set((headers || []).filter(Boolean))];
  if (!selectedHeaders.length) return null;
  if (selectedHeaders.length === 1) return { rows: rows || [], targetHeader: selectedHeaders[0], sourceHeaders: selectedHeaders };
  return {
    targetHeader: syntheticHeader,
    sourceHeaders: selectedHeaders,
    rows: (rows || []).map((row) => {
      const values = selectedHeaders.map((header) => mmmEvidenceNumber(row?.[header]));
      return {
        ...row,
        [syntheticHeader]: values.every(Number.isFinite)
          ? values.reduce((sum, value) => sum + value, 0)
          : NaN,
      };
    }),
  };
}

export function mmmEvidenceBinary(value) {
  const text = String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!text) return null;
  if (/^(1|true|on|treated|treatment|test|enabled|post|after|처리|실험|온|켜기|사후)$/.test(text)) return 1;
  if (/^(0|false|off|control|holdout|disabled|pre|before|대조|통제|오프|끄기|사전)$/.test(text)) return 0;
  return null;
}

export function mmmEvidenceGroupMean(rows, predicate, spendHeader) {
  const values = (rows || []).filter(predicate).map((row) => mmmEvidenceNumber(row?.[spendHeader])).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

// 동일 포맷 파일에 여러 spend가 있어도 실험 처리와 실제로 함께 바뀐 채널만 후보로 둔다.
// 둘 이상이 유의미하게 바뀌면 단일 실험으로 채널 효과를 분리할 수 없으므로 호출부가 보류한다.
export function mmmEvidenceTreatmentContrast(rows, spendHeader, {
  stateHeader = null,
  armHeader = null,
  periodHeader = null,
} = {}) {
  const source = (rows || []).filter((row) => Number.isFinite(mmmEvidenceNumber(row?.[spendHeader])));
  if (!source.length) return null;
  let contrast = null;
  let design = null;
  if (armHeader && periodHeader) {
    const cell = (arm, period) => mmmEvidenceGroupMean(source, (row) => mmmEvidenceBinary(row?.[armHeader]) === arm && mmmEvidenceBinary(row?.[periodHeader]) === period, spendHeader);
    const tp = cell(1, 1); const tpre = cell(1, 0); const cp = cell(0, 1); const cpre = cell(0, 0);
    if ([tp, tpre, cp, cpre].every(Number.isFinite)) {
      contrast = (tp - tpre) - (cp - cpre);
      design = "geo-did";
    }
  }
  if (contrast == null && stateHeader) {
    const on = mmmEvidenceGroupMean(source, (row) => mmmEvidenceBinary(row?.[stateHeader]) === 1, spendHeader);
    const off = mmmEvidenceGroupMean(source, (row) => mmmEvidenceBinary(row?.[stateHeader]) === 0, spendHeader);
    if ([on, off].every(Number.isFinite)) {
      contrast = on - off;
      design = "on-off";
    }
  }
  if (contrast == null && armHeader) {
    const treated = mmmEvidenceGroupMean(source, (row) => mmmEvidenceBinary(row?.[armHeader]) === 1, spendHeader);
    const control = mmmEvidenceGroupMean(source, (row) => mmmEvidenceBinary(row?.[armHeader]) === 0, spendHeader);
    if ([treated, control].every(Number.isFinite)) {
      contrast = treated - control;
      design = "geo";
    }
  }
  if (contrast == null && periodHeader) {
    const post = mmmEvidenceGroupMean(source, (row) => mmmEvidenceBinary(row?.[periodHeader]) === 1, spendHeader);
    const pre = mmmEvidenceGroupMean(source, (row) => mmmEvidenceBinary(row?.[periodHeader]) === 0, spendHeader);
    if ([post, pre].every(Number.isFinite)) {
      contrast = post - pre;
      design = "pre-post";
    }
  }
  if (contrast == null && !stateHeader && !armHeader && !periodHeader) {
    const on = mmmEvidenceGroupMean(source, (row) => Math.abs(mmmEvidenceNumber(row?.[spendHeader])) > 1e-12, spendHeader);
    const off = mmmEvidenceGroupMean(source, (row) => Math.abs(mmmEvidenceNumber(row?.[spendHeader])) <= 1e-12, spendHeader);
    if ([on, off].every(Number.isFinite)) {
      contrast = on - off;
      design = "spend-zero-inferred-on-off";
    }
  }
  if (!Number.isFinite(contrast)) return null;
  const magnitudes = source.map((row) => Math.abs(mmmEvidenceNumber(row?.[spendHeader]))).filter(Number.isFinite);
  const scale = magnitudes.reduce((sum, value) => sum + value, 0) / Math.max(1, magnitudes.length);
  const relativeContrast = Math.abs(contrast) / Math.max(1e-8, scale);
  return { contrast, relativeContrast, design, isChanged: relativeContrast >= 0.05 };
}

export const MMM_COUNTRY_HEADER_PATTERN = /(^|[_\s])(country|market)([_\s]|$)|국가|시장/i;
export const MMM_EVIDENCE_SPEND_HEADER_PATTERN = /(^|[_\s])(spend|cost|budget|expense)([_\s]|$)|(?:spend|cost|budget|expense)$|비용|지출|예산/i;
export const MMM_EVIDENCE_TIME_HEADER_PATTERN = /(^|[_\s])(date|day|ds|week|wk|time)([_\s]|$)|(?:date|day|ds|week|wk|time)$|날짜|일자|주차|주인덱스/i;
export const MMM_TEMPLATE_CSV = "﻿country,date,traffic,registrations,reactivations,purchasers,revenue,google_spend,meta_spend,tiktok_spend,brand_spend\r\nKR,2024-01-01,1200,310,85,42,8400000,4200000,3100000,1200000,900000\r\nKR,2024-01-02,1260,325,88,45,8950000,4400000,3000000,1350000,920000\r\n";
export const MMM_EXPERIMENT_ONOFF_TEMPLATE_CSV = `﻿type,week,treatment_state,registrations,meta_spend\r\n${Array.from({ length: 16 }, (_, index) => {
  const block = Math.floor(index / 4);
  const isOn = block % 2 === 1;
  const date = new Date(Date.UTC(2024, 0, 1 + index * 7)).toISOString().slice(0, 10);
  return `OnOff,${date},${isOn ? "ON" : "OFF"},${1000 + index * 8 + (isOn ? 120 : 0)},${isOn ? 1000000 + index * 10000 : 0}`;
}).join("\r\n")}\r\n`;
export const MMM_EXPERIMENT_GEO_WIDE_TEMPLATE_CSV = `﻿type,week,period,target_geo,control_geo,target_registrations,control_registrations,target_meta_spend,control_meta_spend\r\n${Array.from({ length: 8 }, (_, weekIndex) => [0, 1].map((pairIndex) => {
  const isPost = weekIndex >= 4;
  const date = new Date(Date.UTC(2024, 0, 1 + weekIndex * 7)).toISOString().slice(0, 10);
  const base = 900 + weekIndex * 10 + pairIndex * 35;
  return `Geo,${date},${isPost ? "post" : "pre"},T${pairIndex + 1},C${pairIndex + 1},${base + (isPost ? 90 : 0)},${base},${isPost ? 950000 + pairIndex * 50000 : 500000},500000`;
}).join("\r\n")).join("\r\n")}\r\n`;
export const MMM_EXPERIMENT_GEO_LONG_TEMPLATE_CSV = `﻿type,week,period,geo,arm,registrations,meta_spend\r\n${Array.from({ length: 8 }, (_, weekIndex) => [
  ["T1", "treatment", 0], ["T2", "treatment", 1], ["C1", "control", 0], ["C2", "control", 1],
].map(([geo, arm, pairIndex]) => {
  const isPost = weekIndex >= 4;
  const date = new Date(Date.UTC(2024, 0, 1 + weekIndex * 7)).toISOString().slice(0, 10);
  const base = 900 + weekIndex * 10 + Number(pairIndex) * 35;
  const isTreatment = arm === "treatment";
  return `Geo,${date},${isPost ? "post" : "pre"},${geo},${arm},${base + (isPost && isTreatment ? 90 : 0)},${isTreatment && isPost ? 950000 + Number(pairIndex) * 50000 : 500000}`;
}).join("\r\n")).join("\r\n")}\r\n`;

export function mmmIsEvidenceSpendHeader(header) {
  return MMM_EVIDENCE_SPEND_HEADER_PATTERN.test(String(header || ""));
}

export function mmmEvidenceSpendHeaders(headers, mappedHeaders = []) {
  const available = headers || [];
  return [...new Set([
    ...(mappedHeaders || []).filter((header) => available.includes(header)),
    ...available.filter(mmmIsEvidenceSpendHeader),
  ])];
}

export function mmmIsEvidenceTimeHeader(header) {
  return MMM_EVIDENCE_TIME_HEADER_PATTERN.test(String(header || ""));
}

export function mmmFindEvidenceTimeHeader(headers, mappedHeader = null, excludedHeader = null) {
  const available = headers || [];
  if (mappedHeader && mappedHeader !== excludedHeader && available.includes(mappedHeader)) return mappedHeader;
  return available.find((header) => header !== excludedHeader && mmmIsEvidenceTimeHeader(header)) || null;
}

export function mmmFindEvidencePeriodHeader(headers, rows, excludedHeader = null) {
  const candidates = (headers || []).filter((header) => header !== excludedHeader && /post|pre|period|phase|사전|사후|기간/i.test(String(header)));
  return candidates.find((header) => {
    const values = (rows || []).map((row) => row?.[header]).filter((value) => value != null && String(value).trim() !== "");
    if (!values.length) return false;
    const parsed = values.map((value) => {
      const text = String(value).trim().toLowerCase().replace(/[\s_-]+/g, "");
      if (/^(post|after|1|true|yes|y|사후)$/.test(text)) return 1;
      if (/^(pre|before|0|false|no|n|사전)$/.test(text)) return 0;
      return null;
    });
    return parsed.every((value) => value != null) && parsed.includes(0) && parsed.includes(1);
  }) || null;
}

export function mmmFindExperimentBinaryHeader(headers, rows, kind) {
  const normalizedExact = kind === "arm"
    ? ["arm", "treatmentarm", "treatmentgroup", "experimentarm", "experimentgroup", "testgroup", "group"]
    : ["treatmentstate", "experimentstate", "teststate", "onoff", "state"];
  const candidates = (headers || []).filter((header) => {
    const key = mmmCanonicalEvidenceName(header);
    if (normalizedExact.includes(key)) return true;
    return kind === "arm"
      ? /(^|[_\s-])arm($|[_\s-])|처리군|대조군/i.test(String(header))
      : /treatment[_\s-]?state|on[_\s-]?off|처리.?상태|실험.?상태/i.test(String(header));
  }).sort((left, right) => {
    const leftIndex = normalizedExact.indexOf(mmmCanonicalEvidenceName(left));
    const rightIndex = normalizedExact.indexOf(mmmCanonicalEvidenceName(right));
    return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
  return candidates.find((header) => {
    const values = (rows || []).map((row) => row?.[header]).filter((value) => value != null && String(value).trim() !== "");
    if (!values.length) return false;
    const parsed = values.map(mmmEvidenceBinary);
    return parsed.every((value) => value != null) && parsed.includes(0) && parsed.includes(1);
  }) || null;
}

export function mmmCanonicalEvidenceName(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function mmmResolveExperimentType(headers, rows, requestedType = "auto") {
  if (["onoff", "geo"].includes(requestedType)) return { type: requestedType, source: "user" };
  const typeHeader = (headers || []).find((header) => /^(experiment_?|test_?)?type$|실험.?유형|테스트.?유형/i.test(String(header).trim()));
  if (typeHeader) {
    const values = [...new Set((rows || []).map((row) => String(row?.[typeHeader] ?? "").trim().toLowerCase()).filter(Boolean))];
    if (values.length === 1) {
      if (/geo|지역|지오/.test(values[0])) return { type: "geo", source: "type-column", typeHeader };
      if (/on.?off|switch|켜기|끄기|온.?오프/.test(values[0])) return { type: "onoff", source: "type-column", typeHeader };
    }
  }
  const hasWideGeo = (headers || []).some((header) => /^target[_\s-]?geo$/i.test(String(header)))
    && (headers || []).some((header) => /^control[_\s-]?geo$/i.test(String(header)));
  const hasLongGeo = (headers || []).some((header) => /(^|[_\s])(geo|region|location)([_\s]|$)|지역|권역/i.test(String(header)))
    && !!mmmFindExperimentBinaryHeader(headers, rows, "arm")
    && !!mmmFindEvidencePeriodHeader(headers, rows);
  return { type: hasWideGeo || hasLongGeo ? "geo" : "onoff", source: hasWideGeo ? "wide-schema" : hasLongGeo ? "long-schema" : "fallback" };
}

export function mmmFindPairedEvidenceHeader(headers, side, baseHeader, fallbackRole = null) {
  const sideKey = mmmCanonicalEvidenceName(side);
  const baseKey = mmmCanonicalEvidenceName(baseHeader);
  const exact = (headers || []).find((header) => {
    const key = mmmCanonicalEvidenceName(header);
    return key === `${sideKey}${baseKey}` || key === `${baseKey}${sideKey}`;
  });
  if (exact) return exact;
  if (!fallbackRole) return null;
  const fallbackKey = mmmCanonicalEvidenceName(fallbackRole);
  return (headers || []).find((header) => {
    const key = mmmCanonicalEvidenceName(header);
    return key === `${sideKey}${fallbackKey}` || key === `${fallbackKey}${sideKey}`;
  }) || null;
}

export function mmmNormalizeGeoWideEvidence(headers, rows, {
  targetHeaders = [],
  channelHeaders = [],
} = {}) {
  const targetGeoHeader = (headers || []).find((header) => /^target[_\s-]?geo$/i.test(String(header)));
  const controlGeoHeader = (headers || []).find((header) => /^control[_\s-]?geo$/i.test(String(header)));
  if (!targetGeoHeader || !controlGeoHeader) return { headers, rows, normalized: false, mode: "geo-long" };
  const expected = [...new Set([...(targetHeaders || []), ...(channelHeaders || [])])];
  const pairCandidates = expected.map((baseHeader) => {
    const isOnlyTarget = targetHeaders.length === 1 && targetHeaders.includes(baseHeader);
    const isOnlyChannel = channelHeaders.length === 1 && channelHeaders.includes(baseHeader);
    return {
      baseHeader,
      targetHeader: mmmFindPairedEvidenceHeader(headers, "target", baseHeader, isOnlyTarget ? "kpi" : isOnlyChannel ? "spend" : null),
      controlHeader: mmmFindPairedEvidenceHeader(headers, "control", baseHeader, isOnlyTarget ? "kpi" : isOnlyChannel ? "spend" : null),
    };
  });
  const incompletePairs = pairCandidates.filter((pair) => !!pair.targetHeader !== !!pair.controlHeader);
  if (incompletePairs.length) {
    return { headers, rows, normalized: false, mode: "geo-wide", error: "missing-wide-pairs", incompletePairs };
  }
  const pairs = pairCandidates.filter((pair) => pair.targetHeader && pair.controlHeader);
  const hasTargetPair = pairs.some((pair) => targetHeaders.includes(pair.baseHeader));
  const hasChannelPair = pairs.some((pair) => channelHeaders.includes(pair.baseHeader));
  if (!hasTargetPair || !hasChannelPair) return { headers, rows, normalized: false, mode: "geo-wide", error: "missing-wide-pairs" };
  const normalizedRows = [];
  let droppedBlankGeoRows = 0;
  (rows || []).forEach((row) => {
    const targetGeo = String(row?.[targetGeoHeader] ?? "").trim();
    const controlGeo = String(row?.[controlGeoHeader] ?? "").trim();
    if (!targetGeo || !controlGeo) {
      droppedBlankGeoRows += 1;
      return;
    }
    const makeRow = (side, geo, arm) => {
      const next = { ...row, __mmm_geo: geo, __mmm_arm: arm };
      pairs.forEach((pair) => { next[pair.baseHeader] = row?.[pair[`${side}Header`]]; });
      return next;
    };
    normalizedRows.push(makeRow("target", targetGeo, "treatment"), makeRow("control", controlGeo, "control"));
  });
  return {
    headers: [...new Set([...(headers || []), ...pairs.map((pair) => pair.baseHeader), "__mmm_geo", "__mmm_arm"])],
    rows: normalizedRows,
    normalized: true,
    mode: "geo-wide-to-long",
    pairedHeaders: pairs,
    droppedBlankGeoRows,
  };
}

export function mmmNormalizeExperimentLongMedia(headers, rows, channelRoles, targetHeaders = []) {
  const channelHeader = (headers || []).find((header) => /(^|[_\s])(channel|media|source|network)([_\s]|$)|채널|매체/i.test(String(header).trim()));
  const spendHeader = (headers || []).find((header) => /(^|[_\s])(spend|cost|budget|expense)([_\s]|$)|지출|비용|예산/i.test(String(header).trim()));
  if (!channelHeader || !spendHeader) return { headers, rows, normalized: false, mode: "wide" };
  const timeHeader = mmmFindEvidenceTimeHeader(headers);
  if (!timeHeader) return { headers, rows, normalized: false, mode: "long-media", error: "missing-long-time" };
  const geoHeader = (headers || []).find((header) => /(^|[_\s])(geo|region|location)([_\s]|$)|지역|권역/i.test(String(header)));
  const platformHeader = (headers || []).find((header) => /platform|(^|_)os($|_)|플랫폼|기기/i.test(String(header)));
  const designHeaders = [
    mmmFindExperimentBinaryHeader(headers, rows, "state"),
    mmmFindExperimentBinaryHeader(headers, rows, "arm"),
    mmmFindEvidencePeriodHeader(headers, rows, timeHeader),
  ].filter(Boolean);
  const aliases = new Map();
  (channelRoles || []).forEach((role) => {
    const label = String(role.label || role.header || "");
    const rawNames = [role.header, label, label.replace(/^MMM\s+spend\s*·\s*/i, ""), label.replace(/(?:[_\s-](?:spend|cost|budget|expense)|\s*비용|\s*지출|\s*예산)$/i, "")];
    rawNames.forEach((name) => aliases.set(mmmCanonicalEvidenceName(name), role.header));
  });
  const grouped = new Map();
  const seenMappedHeaders = new Set();
  const unmatchedChannels = new Set();
  let repeatedTargetConflicts = 0;
  let repeatedDesignConflicts = 0;
  (rows || []).forEach((row) => {
    const mappedHeader = aliases.get(mmmCanonicalEvidenceName(row?.[channelHeader]));
    if (!mappedHeader) {
      unmatchedChannels.add(String(row?.[channelHeader] ?? "").trim() || "(blank)");
      return;
    }
    const key = [row?.[timeHeader], geoHeader ? row?.[geoHeader] : "", platformHeader ? row?.[platformHeader] : ""].map((value) => String(value ?? "").trim()).join("\u0001");
    const existing = grouped.get(key);
    const item = existing || { ...row };
    if (existing) {
      designHeaders.forEach((header) => {
        const current = mmmCanonicalEvidenceName(item[header]);
        const incoming = mmmCanonicalEvidenceName(row?.[header]);
        const currentBinary = mmmEvidenceBinary(item[header]);
        const incomingBinary = mmmEvidenceBinary(row?.[header]);
        if (current && incoming && (currentBinary != null && incomingBinary != null ? currentBinary !== incomingBinary : current !== incoming)) repeatedDesignConflicts += 1;
      });
      (targetHeaders || []).forEach((header) => {
        const current = mmmEvidenceNumber(item[header]);
        const incoming = mmmEvidenceNumber(row?.[header]);
        if (Number.isFinite(current) && Number.isFinite(incoming) && Math.abs(current - incoming) > 1e-9 * Math.max(1, Math.abs(current), Math.abs(incoming))) {
          item[header] = NaN;
          repeatedTargetConflicts += 1;
        } else if (!Number.isFinite(current) && Number.isFinite(incoming) && !Number.isNaN(item[header])) item[header] = row[header];
      });
    }
    const spend = mmmEvidenceNumber(row?.[spendHeader]);
    const previous = existing ? mmmEvidenceNumber(item[mappedHeader]) : NaN;
    item[mappedHeader] = Number.isFinite(spend) ? (Number.isFinite(previous) ? previous + spend : spend) : NaN;
    seenMappedHeaders.add(mappedHeader);
    grouped.set(key, item);
  });
  return {
    headers: [...new Set([...(headers || []), ...seenMappedHeaders])],
    rows: grouped.size ? [...grouped.values()] : rows,
    normalized: grouped.size > 0,
    mode: "long-media-to-wide",
    unmatchedChannels: [...unmatchedChannels].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    repeatedTargetConflicts,
    repeatedDesignConflicts,
    error: grouped.size ? null : "no-matching-long-channel",
  };
}

// 타깃 원자료에서 국가 코드가 정확히 하나일 때만 자동 확정한다. 여러 값을
// 임의로 고르면 타깃 국가 자체를 참고 prior로 다시 넣는 self-reference가 생길 수 있다.
export function mmmDetectTargetCountry(headers, rows) {
  const header = (headers || []).find((value) => MMM_COUNTRY_HEADER_PATTERN.test(String(value)));
  if (!header) return { status: "missing", header: null, value: null, normalized: null };
  const unique = new Map();
  let blankRows = 0;
  (rows || []).forEach((row) => {
    const value = String(row?.[header] ?? "").trim();
    if (!value) {
      blankRows += 1;
      return;
    }
    const normalized = value.toLowerCase();
    if (!unique.has(normalized)) unique.set(normalized, value);
  });
  if (unique.size !== 1) return { status: unique.size ? "ambiguous" : "empty", header, value: null, normalized: null, blankRows, totalRows: (rows || []).length };
  const [normalized, value] = unique.entries().next().value;
  if (blankRows > 0) return { status: "incomplete", header, value: null, normalized: null, detectedValue: value, detectedNormalized: normalized, blankRows, totalRows: (rows || []).length };
  return { status: "single", header, value, normalized, blankRows: 0, totalRows: (rows || []).length };
}

export const MMM_HEALTH_FLAG_COPY = {
  residualAcf: {
    ko: "잔차에 1주 자기상관이 남아 있습니다. 빠진 추세·계절·이벤트 구조가 없는지 확인하세요.",
    en: "One-week autocorrelation remains in residuals. Check for omitted trend, seasonality, or events.",
  },
  coverage: {
    ko: "90% 예측 참고구간의 실제 포함률이 기대 범위를 벗어났습니다. 구간을 확정적 신뢰구간으로 해석하지 마세요.",
    en: "Empirical coverage of the 90% predictive reference interval is outside the expected range. Do not treat it as a definitive confidence interval.",
  },
  negativeBaseline: {
    ko: "일부 주의 자연수요 추정이 0보다 작습니다. baseline·이벤트·구조변화 설정을 점검하세요.",
    en: "Estimated natural demand is negative in some weeks. Review the baseline, event, and regime-change structure.",
  },
  priorShift: {
    ko: "posterior가 외부 prior 평균에서 2 SD 넘게 이동한 채널이 있습니다. 실험·국가 근거와 관측 데이터가 충돌할 수 있습니다.",
    en: "At least one posterior moved more than 2 prior SDs from its external prior mean. Experimental/market evidence may conflict with the observed data.",
  },
  priorScale: {
    ko: "잔차분산과 prior penalty를 맞추는 고정점 반복이 한도 안에 수렴하지 않았습니다. prior 기반 예산 추천은 보류됩니다.",
    en: "The residual-variance/prior-penalty fixed-point iteration did not converge within the limit. Prior-based budget recommendations are paused.",
  },
  identification: {
    ko: "매체 입력이 다른 매체 또는 비매체 설명변수와 강하게 공선이어서 개별 채널 효과를 안정적으로 분리하기 어렵습니다.",
    en: "A media input is highly collinear with another media or non-media explanatory variable, preventing stable separation of individual channel effects.",
  },
  information: {
    ko: "기간에 비해 추정 파라미터가 많아 채널 효과 정보가 부족합니다.",
    en: "The time span provides too little information for the number of estimated parameters.",
  },
};

export function mmmHealthFlagMessage(key, locale = "ko") {
  const copy = MMM_HEALTH_FLAG_COPY[key];
  return copy?.[locale === "en" ? "en" : "ko"] || String(key || "");
}

// 별도로 추정된 Normal prior는 precision 가중으로 합친다. 원자료 기간이 겹치면
// 통계적 독립은 보장되지 않으므로 UI에서 그 한계를 경고한다. 국가 prior가 실험
// prior를 덮어쓰지 않으며, 불확실할수록 자동 영향이 작아진다.
export function mergeMediaPrior(priors, key, next) {
  if (!next || !isFinite(next.mean) || !(next.precision > 0)) return;
  const current = priors[key];
  const componentsOf = (prior) => prior.sourceComponents || [{
    source: prior.source || "prior",
    mean: prior.mean,
    variance: prior.variance ?? 1 / prior.precision,
    precision: prior.precision,
    targetLockedTransform: prior.targetLockedTransform || null,
    transformUnitAligned: prior.transformUnitAligned ?? !!prior.targetLockedTransform,
  }];
  if (!current) {
    const sources = [...new Set(next.sources || [next.source || "prior"])];
    priors[key] = { ...next, source: sources.join("+"), sources, sourceComponents: componentsOf(next) };
    return;
  }
  const precision = current.precision + next.precision;
  const sources = [...new Set([...(current.sources || [current.source || "prior"]), ...(next.sources || [next.source || "prior"])])];
  priors[key] = {
    ...next,
    mean: (current.mean * current.precision + next.mean * next.precision) / precision,
    precision,
    variance: 1 / precision,
    source: sources.join("+"),
    sources,
    sourceComponents: [...componentsOf(current), ...componentsOf(next)],
  };
}

// 신뢰도 dots — p값 → ●●● / ●●○ / ●○○ / ○○○
export function pDots(p) {
  if (p == null || !isFinite(p)) return "○○○";
  if (p < 0.01) return "●●●";
  if (p < 0.05) return "●●○";
  if (p < 0.1) return "●○○";
  return "○○○";
}
export const POS = "#f87171";
export const NEG = "#22c55e";
export const MUTED = "var(--text-muted)";

export const VERDICT_META = {
  ko: {
    incremental: { txt: "증분 ✓", color: NEG },
    suppress: { txt: "잠식 의심 ⚠", color: POS },
    noise: { txt: "불확실", color: MUTED },
    uncertain: { txt: "불확실", color: MUTED },
    sparse: { txt: "데이터 부족 ⊘", color: MUTED },
  },
  en: {
    incremental: { txt: "Incremental ✓", color: NEG },
    suppress: { txt: "Cannibalization? ⚠", color: POS },
    noise: { txt: "Uncertain", color: MUTED },
    uncertain: { txt: "Uncertain", color: MUTED },
    sparse: { txt: "Insufficient data ⊘", color: MUTED },
  },
};

// 상태 배지(Red/Yellow/Green) — 카니발 판정 등 Card 레이아웃 전반에서 재사용.
export const BADGE_TONE = {
  ok: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.45)", color: "#22c55e" },
  warn: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.45)", color: "#fbbf24" },
  danger: { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.45)", color: "#f87171" },
  neutral: { bg: "var(--bg-2)", border: "var(--border)", color: MUTED },
};
export function Badge({ tone = "neutral", color, children }) {
  const c = BADGE_TONE[tone] || BADGE_TONE.neutral;
  const finalColor = color || c.color;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "999px", background: color ? `${color}1f` : c.bg, border: `1px solid ${color || c.border}`, color: finalColor, fontWeight: 700, fontSize: "11.5px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
// Card — border/shadow/rounded 래퍼(레거시 톤 복구, §6).
export function Card({ children, style }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "12px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", padding: "14px 16px", background: "var(--bg-2)", ...style }}>
      {children}
    </div>
  );
}

// 통계 상세(아코디언 B) 소제목 — 좌측 액센트 바 + 볼드 + 평어 한 줄로 섹션 구분.
export function StatHead({ title, hint }) {
  return (
    <div style={{ margin: "18px 0 8px", borderLeft: "3px solid var(--primary, #adc6ff)", paddingLeft: "10px" }}>
      <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-1)" }}>{title}</div>
      {hint ? <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px", lineHeight: 1.55 }}>{hint}</div> : null}
    </div>
  );
}

// 그룹별 기여 패널 — 단일 누적 막대는 큰 기본수요에 가려 마케팅·이벤트의
// 시계열이 읽히지 않는다. 회사 MMM과 같이 그룹마다 독립 y축을 쓴다.
export function ContributionGroupPanel({ label, values, labels, color, locale, formatValue }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    const css = getComputedStyle(document.body);
    const muted = css.getPropertyValue("--text-muted").trim() || "#718096";
    const grid = css.getPropertyValue("--border").trim() || "rgba(148,163,184,.25)";
    const chart = new Chart(ref.current.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [{ label, data: values, backgroundColor: color, borderColor: color, borderWidth: 0, borderRadius: 1 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${label}: ${formatValue ? formatValue(ctx.parsed.y, { sign: true }) : `${ctx.parsed.y >= 0 ? "+" : ""}${Math.round(ctx.parsed.y).toLocaleString()}${locale === "ko" ? "명" : ""}`}` } } },
        scales: {
          x: { ticks: { color: muted, autoSkip: true, maxTicksLimit: 12, maxRotation: 0 }, grid: { display: false } },
          y: { ticks: { color: muted, callback: (v) => formatValue ? formatValue(v) : Math.round(v).toLocaleString() }, grid: { color: grid } },
        },
      },
    });
    requestAnimationFrame(() => chart.resize());
    return () => chart.destroy();
  }, [label, values, labels, color, locale, formatValue]);
  return <div className="chart-container" style={{ height: "190px", minHeight: "190px" }}><canvas ref={ref}></canvas></div>;
}

// 공선성 경고에서 선택한 두 채널의 실제 입력 시계열을 비교한다. 채널 역할이 비용이면
// 소진액, 노출수면 노출수를 그대로 보여줘 서로 다른 단위를 비용으로 오해하지 않게 한다.
export function CollinearPairInputChart({ labels, pair, locale }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !pair?.series?.length) return undefined;
    const css = getComputedStyle(document.body);
    const muted = css.getPropertyValue("--text-muted").trim() || "#718096";
    const grid = css.getPropertyValue("--border").trim() || "rgba(148,163,184,.25)";
    const chart = new Chart(ref.current.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: pair.series.map((channel, index) => ({
          label: channel.label,
          data: channel.values,
          borderColor: index === 0 ? "#f59e0b" : "#7F77DD",
          backgroundColor: index === 0 ? "rgba(245,158,11,.12)" : "rgba(127,119,221,.12)",
          borderWidth: 2,
          pointRadius: 1.5,
          pointHoverRadius: 4,
          tension: 0.16,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: muted } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y || 0).toLocaleString()}` } },
        },
        scales: {
          x: { ticks: { color: muted, autoSkip: true, maxTicksLimit: 12, maxRotation: 0 }, grid: { display: false } },
          y: { ticks: { color: muted, callback: (value) => Number(value).toLocaleString() }, grid: { color: grid } },
        },
      },
    });
    requestAnimationFrame(() => chart.resize());
    return () => chart.destroy();
  }, [labels, pair, locale]);
  return <div className="chart-container" style={{ height: "250px", minHeight: "250px" }}><canvas ref={ref}></canvas></div>;
}

// 각 채널의 절대 단위(소진액·노출수)가 달라도 flight 시점은 비교할 수 있게,
// 채널별 최댓값을 100으로 맞춘 calendar heat-lane이다. 진한 세로 띠가 여러
// 행에 겹치면 해당 주에 여러 채널이 동시에 강하게 집행된 것이다.
export function ChannelSpendTimeline({ labels, channels, locale }) {
  const tx = (ko, en) => (locale === "en" ? en : ko);
  const activeChannels = channels.filter((channel) => channel.values.some((value) => Number(value) > 0));
  if (!activeChannels.length) return null;
  const maxByKey = Object.fromEntries(activeChannels.map((channel) => [channel.key, Math.max(0, ...channel.values.map((value) => Number(value) || 0))]));
  const activeByWeek = labels.map((_, index) => activeChannels.filter((channel) => {
    const maximum = maxByKey[channel.key] || 1;
    return (Number(channel.values[index]) || 0) / maximum >= 0.1;
  }).length);
  const overlapWeeks = activeByWeek.filter((count) => count >= 2).length;
  const timelineWidth = Math.max(720, labels.length * 6);
  const labelIndexes = new Set([0, Math.floor((labels.length - 1) / 2), labels.length - 1]);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap", margin: "8px 0 10px" }}>
        <strong style={{ fontSize: "12px", color: "var(--text-1)" }}>{tx("집행 동시 주", "Overlapping active weeks")}</strong>
        <span style={{ fontSize: "18px", fontWeight: 720, color: "#7F77DD" }}>{overlapWeeks}{tx("주", " wk")}</span>
        <span className="muted" style={{ fontSize: "10.5px" }}>{tx("두 채널 이상이 각 채널의 최대 집행 강도 10% 이상인 주", "Weeks where 2+ channels reach at least 10% of their own peak")}</span>
      </div>
      <div style={{ overflowX: "auto", paddingBottom: "3px" }}>
        <div style={{ minWidth: timelineWidth + "px", display: "grid", gridTemplateColumns: "168px 1fr", gap: "6px 10px", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: "10px" }}>{tx("채널", "Channel")}</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(" + labels.length + ", minmax(3px, 1fr))", gap: "1px", height: "15px", alignItems: "end" }}>
            {labels.map((label, index) => <span key={String(label) + "-" + index} style={{ fontSize: "9px", color: "var(--text-muted)", overflow: "visible", whiteSpace: "nowrap", transform: "translateX(-2px)" }}>{labelIndexes.has(index) ? String(label) : ""}</span>)}
          </div>
          {activeChannels.map((channel, channelIndex) => {
            const maximum = maxByKey[channel.key] || 1;
            const hue = channelIndex % 2 ? "127,119,221" : "93,202,165";
            return <React.Fragment key={channel.key}>
              <span title={channel.label} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "11px", color: "var(--text-1)" }}>{channel.label}</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(" + labels.length + ", minmax(3px, 1fr))", gap: "1px", height: "18px" }}>
                {channel.values.map((rawValue, index) => {
                  const value = Math.max(0, Number(rawValue) || 0);
                  const intensity = Math.min(1, value / maximum);
                  return <span key={index} title={String(labels[index]) + " · " + channel.label + ": " + value.toLocaleString()} style={{ minWidth: "3px", borderRadius: "1px", background: intensity > 0 ? "rgba(" + hue + ", " + (0.12 + intensity * 0.78) + ")" : "var(--bg-1)" }} />;
                })}
              </div>
            </React.Fragment>;
          })}
        </div>
      </div>
      <p className="muted" style={{ fontSize: "10.5px", lineHeight: 1.45, margin: "10px 0 0" }}>{tx(
        "색이 진할수록 그 채널이 자기 최대 집행 수준에 가까웠다는 뜻입니다. 이 표는 같은 시점에 집행했는지 확인하는 용도이며, 채널 효과나 예산 효율을 뜻하지 않습니다.",
        "Darker cells mean a channel was closer to its own peak input. Use this to inspect timing overlap, not channel effect or budget efficiency.",
      )}</p>
    </div>
  );
}

// ③ 순증분 검정은 막대차트보다 "0 포함 여부"가 판단 핵심이다. 점추정·구간·판정을
// 한 줄에 고정해, 녹색 막대가 오류인지 효과인지 혼동되지 않게 한다.
export function NetEffectEvidence({ net, locale }) {
  const tx = (ko, en) => (locale === "en" ? en : ko);
  const coef = Number(net?.net_elasticity);
  const lo = Number(net?.ci_lo);
  const hi = Number(net?.ci_hi);
  if (![coef, lo, hi].every(Number.isFinite)) return <Card style={{ fontSize: "12px", color: MUTED }}>{tx("순증분 효과를 추정할 데이터가 부족합니다.", "Not enough data to estimate net incremental effect.")}</Card>;
  const min = Math.min(lo, 0, coef) - Math.max(0.03, Math.abs(hi - lo) * 0.12);
  const max = Math.max(hi, 0, coef) + Math.max(0.03, Math.abs(hi - lo) * 0.12);
  const pos = (v) => `${((v - min) / Math.max(1e-9, max - min)) * 100}%`;
  const isPositive = lo > 0;
  const isNegative = hi < 0;
  const verdict = isPositive
    ? tx("0을 넘지 않음: 광고 증액 뒤 전체 성과가 늘어날 가능성이 높습니다.", "Interval stays above 0: additional spend likely lifts total outcome.")
    : isNegative
      ? tx("0을 넘지 않음: 광고 증액이 전체 성과를 깎을 가능성이 있습니다.", "Interval stays below 0: additional spend may reduce total outcome.")
      : tx("0을 포함함: 순증가·순감소 어느 쪽도 확정할 수 없습니다. 이 결과는 보류입니다.", "Interval includes 0: neither net lift nor decline is established. Treat as inconclusive.");
  const tone = isPositive ? NEG : isNegative ? POS : "#f59e0b";
  return <Card style={{ padding: "14px 16px" }}>
    <div style={{ display: "flex", gap: "18px", alignItems: "baseline", flexWrap: "wrap" }}>
      <div><div className="lbl">{tx("점추정", "Point estimate")}</div><div style={{ fontSize: "24px", fontWeight: 750, color: tone }}>{coef >= 0 ? "+" : ""}{fmtOne(coef)}%</div></div>
      <div><div className="lbl">{tx("95% 신뢰구간", "95% confidence interval")}</div><div style={{ fontSize: "16px", fontWeight: 650 }}>[{fmtOne(lo)}%, {fmtOne(hi)}%]</div></div>
    </div>
    <div style={{ position: "relative", height: "48px", margin: "14px 8px 4px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ position: "absolute", left: pos(0), top: "0", bottom: "0", borderLeft: "1px dashed var(--text-muted)" }}><span style={{ position: "absolute", top: "28px", left: "-4px", fontSize: "10px", color: MUTED }}>0</span></div>
      <div style={{ position: "absolute", left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})`, top: "18px", height: "5px", borderRadius: "4px", background: tone }}></div>
      <div style={{ position: "absolute", left: pos(coef), top: "11px", width: "18px", height: "18px", marginLeft: "-9px", borderRadius: "50%", background: tone, border: "3px solid var(--bg-2)", boxShadow: "0 0 0 1px var(--border)" }} title={tx("점추정", "Point estimate")}></div>
    </div>
    <p style={{ fontSize: "11.5px", color: "var(--text-1)", margin: "12px 0 0", lineHeight: 1.5 }}><strong style={{ color: tone }}>{verdict}</strong> {tx("값은 ‘이 채널 지출 1% 증가 시 전체 성과가 몇 % 움직였는가’입니다.", "Value means expected % change in total outcome for a 1% spend increase in this channel.")}</p>
  </Card>;
}

export function MmmBacktestChart({ labels, actual, variants, locale, validationStartIndex = null, formatValue = null }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !actual?.length) return undefined;
    const css = getComputedStyle(document.body);
    const muted = css.getPropertyValue("--text-muted").trim() || "#64748b";
    const grid = css.getPropertyValue("--border").trim() || "#e2e8f0";
    const splitPlugin = validationStartIndex == null ? null : {
      id: "validationBoundary",
      afterDraw(instance) {
        const x = instance.scales.x.getPixelForValue(validationStartIndex);
        const { ctx, chartArea } = instance;
        ctx.save();
        ctx.strokeStyle = "#f59e0b";
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = "#b45309"; ctx.font = "10px sans-serif";
        ctx.fillText(locale === "en" ? "validation starts" : "검증 시작", Math.min(x + 5, chartArea.right - 66), chartArea.top + 12);
        ctx.restore();
      },
    };
    const chart = new Chart(ref.current.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: locale === "en" ? "Actual" : "실제", data: actual, borderColor: CHART_THEME.text, borderWidth: 2.5, pointRadius: 2.5, tension: 0.18 },
          ...variants.map((series, index) => ({ label: series.label, data: series.predicted, borderColor: series.color || MMM_MEDIA_PALETTE[index % MMM_MEDIA_PALETTE.length], borderDash: series.dash || [5, 3], borderWidth: series.recommended ? 2.5 : 1.4, pointRadius: 0, tension: 0.18 })),
        ],
      }, plugins: splitPlugin ? [splitPlugin] : [],
      options: {
        ...chartBase(),
        plugins: {
          ...chartBase().plugins,
          legend: { position: "bottom", labels: { color: muted, boxWidth: 12, font: { size: 10 } } },
          tooltip: {
            ...chartBase().plugins.tooltip,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatValue ? formatValue(context.parsed.y) : fmtInt(context.parsed.y)}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: muted, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
          y: { ticks: { color: muted, callback: (value) => formatValue ? formatValue(value) : fmtInt(value) }, grid: { color: grid } },
        },
      },
    });
    requestAnimationFrame(() => chart.resize());
    return () => chart.destroy();
  }, [labels, actual, variants, locale, validationStartIndex, formatValue]);
  return <div className="chart-container" style={{ height: "270px", minHeight: "270px", marginTop: "10px" }}><canvas ref={ref}></canvas></div>;
}

export function MmmManualDownload({ locale = "ko", placement = "footer" }) {
  const isEnglish = locale === "en";
  const href = isEnglish ? "/manuals/mmm-model-manual-en.pdf" : "/manuals/mmm-model-manual-ko.pdf";
  const fileName = isEnglish ? "growth-opt-mmm-model-manual-en.pdf" : "growth-opt-mmm-model-manual-ko.pdf";
  return (
    <div
      data-mmm-manual-placement={placement}
      style={{ textAlign: placement === "footer" ? "center" : "left", padding: placement === "footer" ? "18px 0 6px" : "8px 0 10px" }}
    >
      <a
        className="ab-button"
        href={href}
        download={fileName}
        onClick={() => trackProductEvent("result_downloaded", { tool_id: "5-18", source: "manual", download_type: "pdf", locale, placement })}
      >
        {isEnglish ? "📘 View the MMM manual · PDF" : "📘 MMM 설명서 확인 · PDF"}
      </a>
      <p className="muted" style={{ fontSize: "10.5px", margin: "6px 0 0" }}>
        {isEnglish ? "Inputs, calculations, priors, validation, interpretation, and limitations" : "입력 준비부터 계산·prior·검증·해석·한계까지 한 번에 확인"}
      </p>
    </div>
  );
}

export function downloadMmmEvidenceTemplate(csv, fileName) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// Prior는 기본 MMM을 대체하는 숨은 설정이 아니라, 어떤 외부 근거를 썼는지
// 결과 화면에서 추적·비교할 수 있는 별도 레이어다. 아직 근거가 없으면 이 카드도
// 조용히 기본 모델만 보여 준다. 실제 prior 추정은 원자료 검증을 거친 뒤에만 켠다.
export function MmmEvidenceLedger({ locale, selectedEvidence, onToggleEvidence, evidence, onEvidence, onLoadDemo, appliedPriorCount = 0, experimentPriorDiagnostics = [], countryCandidates = [], countryIndividualCandidates = [], countryBacktests = null, countryPlan = null, formatValue = null }) {
  const tx = (ko, en) => (locale === "en" ? en : ko);
  const formatEffectValue = (value) => formatValue ? formatValue(value, { decimals: 2 }) : Number(value).toFixed(2);
  const experimentRef = useRef(null);
  const countryRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const parseEvidence = (file, kind) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: ({ data, meta }) => {
        const headers = meta.fields || [];
        const countryHeader = headers.find((h) => /(^|[_\s])(country|market)([_\s]|$)|국가|시장/i.test(String(h)));
        const countries = countryHeader
          ? [...new Set(data.map((row) => String(row[countryHeader] || "").trim()).filter(Boolean))].slice(0, 50)
          : [];
        onEvidence((current) => ({
          ...current,
          [kind]: {
            name: file.name,
            rows: data.length,
            countries,
            raw: data,
            headers,
            ...(kind === "experiment" ? { analysisType: "auto" } : {}),
          },
        }));
      },
    });
  };
  const hasExperiment = !!evidence.experiment;
  const hasCountry = !!evidence.country;
  const hasSelection = selectedEvidence.experiment || selectedEvidence.country;
  const experimentTypeResolution = hasExperiment
    ? mmmResolveExperimentType(evidence.experiment.headers, evidence.experiment.raw, evidence.experiment.analysisType || "auto")
    : null;
  const experimentTypeLabel = experimentTypeResolution?.type === "geo" ? "Geo" : "On/Off";
  return (
    <section className="mmm-evidence-ledger" aria-label={tx("근거 보정", "Evidence calibration")}>
      <div className="mmm-evidence-ledger__topline">
        <div>
          <span className="mmm-evidence-ledger__eyebrow">{tx("MODEL EVIDENCE", "MODEL EVIDENCE")}</span>
          <h2>{tx("결론의 근거를 분리해서 봅니다", "Keep the evidence behind the conclusion visible")}</h2>
          <p>{tx("근거가 없으면 지금의 기본 MMM만 사용합니다. 실험·국가 데이터는 선택적으로 추가하고, 적용 전후를 같은 화면에서 비교합니다.", "Without added evidence, this remains the current base MMM. Experiment and market data are optional and are compared beside the base model.")}</p>
        </div>
        <button className="ab-pill" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}>
          {isOpen ? tx("근거 설정 닫기", "Close evidence setup") : tx("근거 데이터 추가", "Add evidence")}
        </button>
      </div>

      <div className="mmm-evidence-ledger__views" aria-label={tx("적용할 근거", "Evidence to apply")}>
        {hasExperiment && <button type="button" aria-pressed={selectedEvidence.experiment} className={`mmm-evidence-ledger__view ${selectedEvidence.experiment ? "is-active" : ""}`} onClick={() => onToggleEvidence("experiment")}>
          <span aria-hidden>{selectedEvidence.experiment ? "☑" : "☐"}</span> {tx("실험 근거 사용", "Use experiment evidence")}
        </button>}
        {hasCountry && <button type="button" aria-pressed={selectedEvidence.country} className={`mmm-evidence-ledger__view ${selectedEvidence.country ? "is-active" : ""}`} onClick={() => onToggleEvidence("country")}>
          <span aria-hidden>{selectedEvidence.country ? "☑" : "☐"}</span> {tx("추천 국가 세트 사용", "Use recommended markets")}
        </button>}
        {!hasExperiment && !hasCountry && <span className="mmm-evidence-ledger__base-note">{tx("현재: 기본 MMM", "Current: base MMM")}</span>}
      </div>

      {hasSelection && (
        <div className="mmm-evidence-ledger__pending">
          <strong>{appliedPriorCount ? tx(`${appliedPriorCount}개 채널 prior가 현재 모델에 적용되었습니다.`, `${appliedPriorCount} channel priors are applied to this model.`) : tx("적용 가능한 prior를 찾지 못했습니다.", "No applicable prior was found.")}</strong>
          <span>{appliedPriorCount ? tx("선택한 외부 근거의 매체 효과만 반영합니다. 참고 국가의 baseline·추세·계절성은 이식하지 않습니다. 헤더 일치는 자동 확인하지만 KPI 정의·단위가 같은지는 사용자가 확인해야 합니다.", "Only media effects from the selected evidence are applied; reference-market baseline, trend, and seasonality are not transferred. Header matching is automatic, but you must confirm that KPI definitions and units are equivalent.") : tx("KPI·채널 헤더가 타깃 데이터와 같은지 확인하고, 정의·단위도 직접 확인하세요. 현재 수치는 기본 MMM 결과입니다.", "Check KPI/channel headers and manually confirm equivalent definitions and units. The figures shown remain the base MMM.")}</span>
        </div>
      )}
      {selectedEvidence.experiment && selectedEvidence.country && (
        <div className="mmm-evidence-ledger__pending">
          <strong>{tx("결합 검증 경계", "Combined-evidence validation boundary")}</strong>
          <span>{tx("국가 세트는 가장 이른 검증 cutoff까지의 근거만으로 country-only 대 base를 비교했습니다. 이 folds는 후보 선택용이며, 실험·국가 prior를 최종 전체기간 적합에서 결합한 결과에는 별도 독립 OOS가 없습니다.", "The market set was compared country-only versus the base using evidence available by the earliest validation cutoff. These folds tune candidate selection; the final all-history combination of experiment and market priors has no separate independent OOS score.")}</span>
        </div>
      )}
      {selectedEvidence.experiment && (
        <div className="mmm-evidence-ledger__pending">
          <strong>{tx("동일 KPI·기간 중복 사용 점검", "Same-KPI/time reuse check")}</strong>
          <span>{tx("실험 KPI가 메인 MMM의 같은 주 Y를 그대로 복제하면 같은 성과가 prior와 likelihood에 두 번 들어갑니다. 정확히 일치하는 national On/Off 재사용은 자동 보류하고, 일부 기간 중첩이나 Geo 근거는 진단에 표시하므로 독립 수집 여부를 확인하세요.", "If the experiment KPI simply duplicates the main MMM outcome for the same weeks, the same outcome enters both the prior and likelihood. Exact national On/Off reuse is blocked automatically; partial overlap and Geo evidence are disclosed in diagnostics so you can confirm whether collection was independent.")}</span>
        </div>
      )}
      {selectedEvidence.experiment && experimentPriorDiagnostics.some((item) => item?.mean != null && item?.transformParams) && (
        <div className="mmm-evidence-ledger__pending">
          <strong>{tx("실험 prior의 현재 지출점 mROI", "Experiment-prior mROI at current spend")}</strong>
          <span>{experimentPriorDiagnostics.filter((item) => item?.mean != null && item?.transformParams).map((item) => {
            const mroi = mmmPriorMroiAtSpend(item, item.transformParams, item.targetWeeklySpend);
            if (!mroi) return null;
            const fmt = (value) => formatValue ? formatValue(value, { decimals: 2 }) : Number(value).toFixed(2);
            return `${item.channel || item.key}: ${fmt(mroi.mean)} [${fmt(mroi.ci90[0])}, ${fmt(mroi.ci90[1])}] / wk spend ${fmt(mroi.weeklySpend)}`;
          }).filter(Boolean).join("   ")}</span>
          <small>{tx("현재 MMM 변환 단위의 계수 prior를 주간 spend 단위 한계효과로 읽은 표시값입니다. 별도의 ROI posterior를 추가 샘플링한 값은 아닙니다.", "This reads the coefficient prior in the current MMM transform units as a marginal effect per weekly spend. It is not a separately sampled ROI posterior.")}</small>
        </div>
      )}
      {selectedEvidence.country && countryCandidates.length > 0 && (
        <div className="mmm-evidence-ledger__pending">
          <strong>{countryPlan?.validationReason === "insufficient-validation-folds"
            ? tx(`국가 prior 보류 · 반복 검증 최소 2회 필요 (현재 ${countryPlan.validationFolds || 0}회)`, `Market prior paused · at least 2 validation folds required (${countryPlan.validationFolds || 0} available)`)
            : countryPlan?.finalRefitReason === "final-reference-refit-failed"
            ? tx("국가 prior 보류 · 선택 국가의 최종 전체기간 재적합 실패", "Market prior paused · selected markets failed the final all-history refit")
            : countryCandidates[0].isBaseline
            ? tx(`결론: 기본 MMM 유지 · ${countryCandidates[0].folds || 1}회 rolling 12주 as-of 후보 검증`, `Conclusion: keep the base MMM · ${countryCandidates[0].folds || 1} as-of rolling 12-week candidate checks`)
            : tx(`추천: ${countryCandidates[0].country} · ${countryCandidates[0].folds || 1}회 rolling 12주 as-of 후보 검증`, `Recommended: ${countryCandidates[0].country} · ${countryCandidates[0].folds || 1} as-of rolling 12-week candidate checks`)}</strong>
          <span>{countryCandidates.slice(0, 5).map((c, i) => tx(
            `${i + 1}. ${c.country} · 평균 RMSE ${formatValue ? formatValue(c.meanRmse || c.rmse) : Math.round(c.meanRmse || c.rmse).toLocaleString()} · 변동 ${formatValue ? formatValue(c.sdRmse || 0) : Math.round(c.sdRmse || 0).toLocaleString()} · 복잡도 반영 ${formatValue ? formatValue(c.score) : Math.round(c.score).toLocaleString()}`,
            `${i + 1}. ${c.country} · mean RMSE ${formatValue ? formatValue(c.meanRmse || c.rmse) : Math.round(c.meanRmse || c.rmse).toLocaleString()} · variation ${formatValue ? formatValue(c.sdRmse || 0) : Math.round(c.sdRmse || 0).toLocaleString()} · complexity-adjusted ${formatValue ? formatValue(c.score) : Math.round(c.score).toLocaleString()}`,
          )).join("   ")}</span>
          {countryBacktests && <MmmBacktestChart locale={locale} labels={countryBacktests.labels} actual={countryBacktests.actual} variants={countryBacktests.variants} formatValue={formatValue} />}
        </div>
      )}
      {selectedEvidence.country && countryIndividualCandidates.length > 0 && (
        <details className="mmm-evidence-ledger__pending">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>{tx(`개별 국가 1차 평가 ${countryIndividualCandidates.length}개`, `${countryIndividualCandidates.length} individual market screening results`)}</summary>
          <div className="table-wrap" style={{ marginTop: "8px" }}>
            <table className="data" style={{ fontSize: "10.5px" }}>
              <thead><tr><th>{tx("국가", "Market")}</th><th>{tx("판정", "Status")}</th><th>{tx("반복 검증", "Rolling checks")}</th><th>{tx("평균 RMSE", "Mean RMSE")}</th><th>{tx("기본 대비", "vs base")}</th><th>{tx("근거", "Reason")}</th></tr></thead>
              <tbody>{countryIndividualCandidates.map((candidate) => {
                const reasonLabels = {
                  "minimum-rows": tx(`유효 주간 ${candidate.validPeriodCount || 0}개 · 최소 ${candidate.minimumRows || 24}개 미달`, `${candidate.validPeriodCount || 0} valid weekly periods · fewer than the ${candidate.minimumRows || 24} minimum`),
                  "browser-fit-cap": tx("브라우저 1차 적합 상한 밖", "outside browser first-stage fit cap"),
                  "mapping-mismatch": tx("타깃과 매핑 구조 불일치", "mapping structure does not match target"),
                  "missing-target": tx("같은 Y 없음", "matching Y unavailable"),
                  "validation-failed": tx("입력 검증 실패", "input validation failed"),
                  "fit-failed": tx("개별 모델 적합 실패", "individual model fit failed"),
                  "insufficient-channel-evidence": tx("전이 가능한 채널 효과 부족", "insufficient transferable channel evidence"),
                  "rolling-fit-failed": tx("공통 rolling fold 평가 실패", "common rolling-fold evaluation failed"),
                  "insufficient-validation-folds": tx("12주 반복 검증 2회 미만", "fewer than two 12-week validation folds"),
                  "historical-alignment-failed": tx("earliest cutoff 기준 시간 정렬 실패", "earliest-cutoff time alignment failed"),
                  "target-transform-alignment-failed": tx("타깃 변환 단위 고정 실패", "target transform-unit lock failed"),
                  "transform-unit-mismatch": tx("채널 변환 단위 불일치", "channel transform-unit mismatch"),
                  "spend-scale-alignment-failed": tx("참고국 spend/adstock 규모 정렬 실패", "reference spend/adstock scale alignment failed"),
                  "target-scale-alignment-failed": tx("참고국과 타깃 KPI 규모 정렬 실패", "reference-to-target KPI scale alignment failed"),
                  "insufficient-as-of-weeks": tx("earliest cutoff 이전 유효 주 24개 미만", "fewer than 24 valid weeks by earliest cutoff"),
                  "final-reference-refit-failed": tx("선택 후 전체기간 참고국 재적합 실패", "selected reference failed the all-history refit"),
                  "final-reference-time-alignment-failed": tx("선택 후 타깃 종료일 기준 참고국 정렬 실패", "selected reference failed target-end time alignment"),
                  "below-material-improvement": tx("기본 대비 개선 2% 미만", "less than 2% improvement over base"),
                  "insufficient-fold-wins": tx("반복 fold 승률 부족", "insufficient repeated fold wins"),
                  "improvement-not-above-fold-noise": tx("평균 개선이 fold 잡음 1SE 이하", "mean improvement does not exceed 1 SE of fold noise"),
                  "penalized-score-not-better": tx("불안정성·복잡도 반영 점수 미개선", "instability/complexity-adjusted score is not better"),
                  "outside-combination-shortlist": tx("조합 탐색용 상위 4개 밖", "outside the top-four combination shortlist"),
                };
                const reason = candidate.status === "eligible"
                  ? tx("개별 적격", "individually eligible")
                  : String(candidate.reason || "").split(" | ").filter(Boolean).map((code) => reasonLabels[code] || code).join(" · ") || "—";
                return <tr key={`${candidate.country}-${candidate.status}-${candidate.reason || "eligible"}`}>
                  <td><strong>{candidate.country}</strong></td>
                  <td>{candidate.status === "eligible" ? tx("적격", "Eligible") : tx("보류", "Held")}</td>
                  <td className="tnum">{candidate.folds || "—"}</td>
                  <td className="tnum">{Number.isFinite(candidate.meanRmse) ? (formatValue ? formatValue(candidate.meanRmse) : candidate.meanRmse.toFixed(1)) : "—"}</td>
                  <td className="tnum">{Number.isFinite(candidate.relativeImprovement) ? `${candidate.relativeImprovement >= 0 ? "+" : ""}${(candidate.relativeImprovement * 100).toFixed(1)}%` : "—"}</td>
                  <td title={candidate.detail || undefined}>{reason}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </details>
      )}
      {selectedEvidence.country && countryPlan && (
        <div className="mmm-evidence-ledger__pending">
          <strong>{countryPlan.blocked
            ? countryPlan.blockReason === "target-transform-alignment-failed"
              ? tx("국가 prior 보류 — 타깃 변환 단위 정렬 실패", "Market prior paused — target transform-unit alignment failed")
              : tx("국가 prior 보류 — COUNTRY 식별 필요", "Market prior paused — COUNTRY identification required")
            : countryPlan.excludedTargetCountry
            ? tx(`타깃 국가 ${countryPlan.excludedTargetCountry} self-reference 제외`, `Target market ${countryPlan.excludedTargetCountry} excluded from reference evidence`)
            : countryPlan.targetCountryConfirmationRequired
              ? tx("타깃 국가 자동 확정 불가", "Target market could not be auto-confirmed")
              : tx(`타깃 국가 확인: ${countryPlan.targetCountry}`, `Target market confirmed: ${countryPlan.targetCountry}`)}</strong>
          <span>{countryPlan.blocked
            ? countryPlan.blockReason === "target-transform-alignment-failed"
              ? tx("가장 이른 학습 구간과 최종 전체기간에서 모든 채널의 alpha·ec·slope를 같은 단위로 고정하지 못해 참고국 계수를 적용하지 않았습니다.", "No market prior was applied because alpha, ec, and slope could not be locked for every channel in both the earliest training window and final all-history fit.")
              : countryPlan.blockReason === "reference-country"
              ? tx("참고국 CSV에 국가 컬럼이 없어 국가별 모델을 분리할 수 없습니다. COUNTRY 컬럼을 추가하면 다시 평가합니다.", "The reference CSV has no market column, so models cannot be separated by market. Add a COUNTRY column to evaluate it again.")
              : countryPlan.targetCountryDetection === "incomplete"
                ? tx(`메인 MMM CSV의 COUNTRY가 ${countryPlan.targetCountryBlankRows || 0}개 행에서 비어 있습니다. 분석 행마다 같은 단일 국가값이 있어야 하며, 그 전에는 self-reference 방지를 위해 국가 prior를 적용하지 않습니다.`, `COUNTRY is blank in ${countryPlan.targetCountryBlankRows || 0} main MMM row(s). Every analyzed row must contain the same single market value; no market prior is applied until then to prevent self-reference.`)
                : tx("메인 MMM CSV의 COUNTRY가 비어 있거나 여러 값입니다. 타깃 국가가 정확히 하나가 되기 전에는 self-reference 방지를 위해 국가 prior를 적용하지 않습니다.", "The main MMM CSV has no unique COUNTRY value. To prevent self-reference, no market prior is applied until exactly one target market is identified.")
            : countryPlan.excludedTargetCountry
            ? tx("메인 CSV의 단일 국가 코드와 같은 참고국 행을 적합 전에 제거했습니다.", "Rows matching the single market code in the main CSV were removed before reference fitting.")
            : countryPlan.targetCountryConfirmationRequired
              ? tx("타깃 국가를 임의로 고르지 않았습니다.", "The app did not guess a target market.")
              : tx("메인 CSV에서 비어 있지 않은 국가 코드가 하나임을 확인했습니다.", "The main CSV contains one non-empty market code.")}</span>
        </div>
      )}
      {selectedEvidence.experiment && experimentPriorDiagnostics.length > 0 && (
        <div className="mmm-evidence-ledger__pending">
          <strong>{experimentPriorDiagnostics.some((item) => item.unidentified)
            ? tx("실험 Prior 보류 · 채널 효과 분리 불가", "Experiment prior paused · channel effects not separable")
            : tx("실험 Prior · 효과 CI와 실제 처리 강도 반영", "Experiment prior · effect CI and actual treatment intensity applied")}</strong>
          <span>{experimentPriorDiagnostics.map((item) => item.unidentified
            ? tx(`${item.channel} · ${item.messageKo}`, `${item.channel} · ${item.messageEn}`)
            : tx(
              `${item.channel} · ${item.experimentType || "자동"}/${item.normalizationMode || "none"} · ${item.design} · 90% CI ${item.ci90.map(formatEffectValue).join(" ~ ")} / 변환 노출 1단위 · ${item.ciMethod} · ${item.cadence || "입력 순서"} · 원자료 ${item.sourceN ?? item.n}행 → 사용 ${item.n}${item.geoCount ? `개 geo-week 관측치/${item.usableUniquePeriods || "—"}개 고유 주` : "주"} · 숫자 해석 불가 ${item.droppedUnparseableRows || 0}행 제외 · 미지원 상태값 ${item.droppedUnknownCategoryWeeks || 0}주 제외 · 경계 혼합주 ${item.droppedMixedWeeks || 0}주 제외 · 결측주 ${item.droppedMissingWeeks || 0}주 제외${item.boundaryPartialWeeks ? ` · 경계 partial ${item.boundaryPartialWeeks}주 제외` : ""}${item.expectedDaysPerWeek ? ` · ${item.expectedDaysPerWeek}일 cadence` : ""}${item.geoCount ? ` · Geo ${item.geoCount}개` : ""}${item.smallClusterInflation > 1 ? ` · 소수 Geo 불확실성 ×${item.smallClusterInflation.toFixed(2)}` : ""}${item.smallSampleInflation > 1 ? ` · 소표본 불확실성 ×${item.smallSampleInflation.toFixed(2)}` : ""}${Number.isFinite(item.exposureStrength) ? ` · 처리강도 t=${item.exposureStrength.toFixed(2)}` : ""}${item.outcomeOverlapWeeks ? ` · 메인 Y와 고유 ${item.outcomeOverlapWeeks}주 중첩(${item.outcomeExactMatchWeeks || 0}주 정확 일치)` : ""}`,
              `${item.channel} · ${item.experimentType || "auto"}/${item.normalizationMode || "none"} · ${item.design} · 90% CI ${item.ci90.map(formatEffectValue).join(" ~ ")} per transformed-exposure unit · ${item.ciMethod} · ${item.cadence || "input order"} · ${item.sourceN ?? item.n} source rows → ${item.n} usable ${item.geoCount ? `geo-week observations/${item.usableUniquePeriods || "—"} unique weeks` : "weeks"} · ${item.droppedUnparseableRows || 0} unparseable rows dropped · ${item.droppedUnknownCategoryWeeks || 0} unsupported-category weeks dropped · ${item.droppedMixedWeeks || 0} mixed boundary weeks dropped · ${item.droppedMissingWeeks || 0} missing weeks dropped${item.boundaryPartialWeeks ? ` · ${item.boundaryPartialWeeks} boundary partial weeks dropped` : ""}${item.expectedDaysPerWeek ? ` · ${item.expectedDaysPerWeek}-day cadence` : ""}${item.geoCount ? ` · ${item.geoCount} geos` : ""}${item.smallClusterInflation > 1 ? ` · small-cluster uncertainty ×${item.smallClusterInflation.toFixed(2)}` : ""}${item.smallSampleInflation > 1 ? ` · small-sample uncertainty ×${item.smallSampleInflation.toFixed(2)}` : ""}${Number.isFinite(item.exposureStrength) ? ` · treatment-intensity t=${item.exposureStrength.toFixed(2)}` : ""}${item.outcomeOverlapWeeks ? ` · overlaps main Y for ${item.outcomeOverlapWeeks} unique weeks (${item.outcomeExactMatchWeeks || 0} exact matches)` : ""}`,
            )).join("   ")}</span>
        </div>
      )}

      {isOpen && (
        <div className="mmm-evidence-ledger__setup">
          <div className="mmm-evidence-ledger__source">
            <div className="mmm-evidence-ledger__source-head"><span>01</span><div><strong>{tx("홀드아웃 원자료", "Holdout source data")}</strong><p>{tx("On/Off 또는 Geo 실험의 기간·처리군·대조군·KPI·spend를 올립니다.", "Upload time period, treatment/control, KPI, and spend for an On/Off or geo experiment.")}</p></div></div>
            {hasExperiment ? <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}><div className="mmm-evidence-ledger__file"><b>{evidence.experiment.name}</b><span>{evidence.experiment.rows.toLocaleString()}{tx("행 업로드됨", " rows imported")} · {tx("판별", "Detected")}: {experimentTypeLabel} ({experimentTypeResolution?.source})</span></div><label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px" }}><span>{tx("실험 유형", "Experiment type")}</span><select aria-label={tx("실험 유형", "Experiment type")} value={evidence.experiment.analysisType || "auto"} onChange={(event) => onEvidence((current) => ({ ...current, experiment: { ...current.experiment, analysisType: event.target.value } }))}><option value="auto">{tx("자동 판별", "Auto detect")}</option><option value="onoff">On/Off</option><option value="geo">Geo</option></select></label><button type="button" className="ab-pill" onClick={() => experimentRef.current?.click()}>{tx("수정", "Replace")}</button></div> : <button className="ab-button" onClick={() => experimentRef.current?.click()}>{tx("실험 원자료 선택", "Choose experiment data")}</button>}
            <input ref={experimentRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { parseEvidence(e.target.files?.[0], "experiment"); e.target.value = null; }} />
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
              <button type="button" className="ab-pill" onClick={() => downloadMmmEvidenceTemplate(MMM_EXPERIMENT_ONOFF_TEMPLATE_CSV, "mmm_experiment_onoff_template.csv")}>{tx("On/Off 예시 CSV", "On/Off example CSV")}</button>
              <button type="button" className="ab-pill" onClick={() => downloadMmmEvidenceTemplate(MMM_EXPERIMENT_GEO_WIDE_TEMPLATE_CSV, "mmm_experiment_geo_wide_template.csv")}>{tx("Geo wide 예시 CSV", "Geo wide example CSV")}</button>
              <button type="button" className="ab-pill" onClick={() => downloadMmmEvidenceTemplate(MMM_EXPERIMENT_GEO_LONG_TEMPLATE_CSV, "mmm_experiment_geo_long_template.csv")}>{tx("Geo long 예시 CSV", "Geo long example CSV")}</button>
            </div>
            <p className="muted" style={{ fontSize: "10.5px", margin: "7px 0 0" }}>{tx("예시의 registrations·meta_spend는 메인 MMM에서 매핑한 실제 Y·채널 헤더와 똑같이 바꾸세요. type 컬럼이 있으면 우선 판별하며, 위 선택으로 강제할 수 있습니다.", "Replace registrations and meta_spend with the exact Y and channel headers mapped in the main MMM. A type column is used for detection when present, and the selector above can override it.")}</p>
          </div>
          <div className="mmm-evidence-ledger__source">
            <div className="mmm-evidence-ledger__source-head"><span>02</span><div><strong>{tx("참고 국가 MMM 데이터", "Reference-market MMM data")}</strong><p>{tx("타깃 국가와 같은 KPI·채널 포맷을 사용하고, 여러 국가라면 country 컬럼을 포함합니다. 앱은 양수 adstock 중앙값으로 채널 spend 규모를 타깃 운용점에 정렬하지만, KPI 정의·통화·전환창의 실질 동등성은 업로드 전에 확인하세요.", "Use the target market's KPI/channel format and include a country column for multiple markets. The app aligns channel spend scale to the target operating point by positive-adstock median, but you must confirm true equivalence of KPI definition, currency, and attribution window.")}</p></div></div>
            {hasCountry ? <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}><div className="mmm-evidence-ledger__file"><b>{evidence.country.name}</b><span>{evidence.country.countries.length ? evidence.country.countries.join(" · ") : tx("country 컬럼을 찾지 못함", "No country column found")}</span></div><button type="button" className="ab-pill" onClick={() => countryRef.current?.click()}>{tx("수정", "Replace")}</button></div> : <button className="ab-button" onClick={() => countryRef.current?.click()}>{tx("국가 데이터 선택", "Choose market data")}</button>}
            <input ref={countryRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { parseEvidence(e.target.files?.[0], "country"); e.target.value = null; }} />
          </div>
          <div className="mmm-evidence-ledger__rule">
            <strong>{tx("선택 원칙", "Selection rule")}</strong>
            <span>{tx("모든 국가를 합치지 않습니다. 개별 적격성 → 최대 2~3개 조합 → 기본 MMM과 반복 rolling 12주 비교 순서로 가장 단순한 충분성 세트 하나만 추천합니다. 타깃 변환·Y 스케일과 참고국 근거는 가장 이른 학습 cutoff에 고정해 이후 정보 누수를 막습니다. 다만 같은 folds로 후보를 골랐으므로 최종 독립 OOS 점수는 아닙니다.", "Markets are not pooled blindly. The flow is individual eligibility → combinations of up to 2–3 → repeated rolling 12-week comparisons against the base, then one simplest sufficient set is recommended. Target transforms, Y scale, and reference evidence are locked at the earliest training cutoff to prevent later-information leakage. Because those same folds select the candidate, they are not a final independent OOS score.")}</span>
          </div>
          <div className="mmm-evidence-ledger__rule">
            <strong>{tx("Y 매핑", "Y mapping")}</strong>
            <span>{tx("헤더·역할이 같은 Y에만 prior 후보를 연결합니다. KPI 정의·집계 창·단위가 실제로 같은지는 자동 판별할 수 없으므로 사용자가 확인해야 합니다. 예를 들어 가입만 매핑되면 매출·구매자·총유입에는 prior가 적용되지 않습니다.", "A prior candidate is connected only to a Y with a matching header and mapped role. The app cannot verify equivalent KPI definitions, attribution windows, or units, so you must confirm them. If only registrations are mapped, revenue, purchasers, and traffic remain unadjusted.")}</span>
          </div>
          <div className="mmm-evidence-ledger__rule">
            <strong>{tx("플랫폼/세그먼트", "Platform/segment")}</strong>
            <span>{tx("선택한 플랫폼과 같은 행 또는 Android/iOS 태그 Y만 사용합니다. Total은 메인 매핑에 포함된 플랫폼 Y를 모두 합산하며, 한 구성 Y라도 결측이면 그 행을 제외합니다. Total이나 다른 OS의 실험 근거를 세그먼트 모델에 자동 차용하지 않습니다.", "Only rows or tagged Y columns matching the selected platform are used. Total sums every platform Y included in the main mapping, and drops a row if any component Y is missing. Evidence from Total or another OS is never borrowed automatically for a segment model.")}</span>
          </div>
          <div className="mmm-evidence-ledger__rule">
            <strong>{tx("실험 근거의 독립성", "Experiment-evidence independence")}</strong>
            <span>{tx("동일 기간의 집계 KPI를 MMM CSV와 실험 CSV에 그대로 복사하지 마세요. On/Off는 최소 16주·상태별 4주·전환 2회가 필요하고, Geo는 최소 4개 지역(arm당 2개)과 각 지역의 공통 pre/post가 필요합니다. 앱의 중복 검사는 정확 일치만 차단하므로, 정의상 같은 원천인지 여부는 사용자가 확인해야 합니다.", "Do not copy the same period-level outcome from the MMM CSV into the experiment CSV. On/Off requires at least 16 weeks, four weeks per state, and two transitions; Geo requires at least four geos (two per arm) with common pre/post periods for every geo. The app only blocks exact matches, so you must confirm whether the outcomes share the same underlying source.")}</span>
          </div>
          {!hasExperiment && !hasCountry && (
            <button className="mmm-evidence-ledger__demo" onClick={onLoadDemo}>
              <span>✦</span>
              <strong>{tx("데모 근거 데이터 불러오기", "Load demo evidence data")}</strong>
              <small>{tx("반복 On/Off 홀드아웃 + JP·TW·SG·US 참고 국가", "Repeated On/Off holdout + JP · TW · SG · US reference markets")}</small>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function fmtInt(v) {
  if (v == null || !isFinite(v)) return "—";
  return Math.round(v).toLocaleString();
}

export function fmtSignedInt(v) {
  if (v == null || !isFinite(v)) return "—";
  const value = Math.round(v);
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString()}`;
}

export function fmtSignedOne(v) {
  if (v == null || !isFinite(v)) return "—";
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
}

export function fmtOne(v) {
  if (v == null || !isFinite(v)) return "—";
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// STL/모델의 "첫 주→마지막 주 변화"를 0 기준 양·음 막대로 보여주는 표시층.
// 원자료·모델 계산은 바꾸지 않고, 플랫한 추세가 어떤 조정 요인과 함께 만들어졌는지만 설명한다.
export function TrendChangeBars({ title, subtitle, rows, total, totalLabel, tx }) {
  const visibleRows = (rows || []).filter((row) => Number.isFinite(row.change));
  if (!visibleRows.length) return null;
  const maxAbs = Math.max(1, ...visibleRows.map((row) => Math.abs(row.change)));
  const signed = (value) => `${value >= 0 ? "+" : "−"}${fmtOne(Math.abs(value))}`;
  return (
    <section className="trend-change-ledger" aria-label={title}>
      <div className="trend-change-ledger__head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {Number.isFinite(total) && (
          <span className="trend-change-ledger__total">
            {totalLabel || tx("변화", "Change")} <strong>{signed(total)}</strong>
          </span>
        )}
      </div>
      <div className="trend-change-ledger__rows">
        {visibleRows.map((row) => {
          const width = Math.min(50, Math.abs(row.change) / maxAbs * 50);
          const isPositive = row.change >= 0;
          return (
            <div className="trend-change-row" key={row.key || row.label}>
              <div className="trend-change-row__label">
                <span className="trend-change-row__swatch" style={{ background: row.tone }} aria-hidden />
                <span>{row.label}</span>
              </div>
              <div className="trend-change-row__track" aria-label={`${row.label}: ${signed(row.change)}`}>
                <span className="trend-change-row__zero" aria-hidden />
                <span
                  className={`trend-change-row__bar ${isPositive ? "is-positive" : "is-negative"}`}
                  style={{
                    [isPositive ? "left" : "right"]: "50%",
                    width: `${width}%`,
                    background: row.tone,
                  }}
                />
              </div>
              <strong className={isPositive ? "is-positive" : "is-negative"}>{signed(row.change)}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function forecastScenarioReasonLabel(reason, tx) {
  const labels = {
    "fewer-than-three-holdouts": tx("요청 예측기간과 같은 학습 제외 검증이 3회 미만입니다", "Fewer than three holdouts matching the requested horizon are available"),
    "does-not-beat-persistence": tx("단순 최근 평균 기준선을 이기지 못했습니다", "It does not beat the recent-average baseline"),
    "wins-too-few-holdouts": tx("검증 구간 승리 횟수가 부족합니다", "It wins too few holdouts"),
    "does-not-beat-best-naive": tx("선택용 과거 구간에서 가장 강한 단순 기준선을 이기지 못했습니다", "It does not beat the strongest naive baseline on the development history"),
    "wins-too-few-naive-holdouts": tx("단순 기준선보다 나았던 과거 검증 구간이 절반 미만입니다", "It beats the naive baseline in fewer than half of the historical holdouts"),
    "spend-free-ablation-unavailable": tx("같은 모델의 Spend=0 기준선을 안정적으로 검증하지 못했습니다", "The same-model Spend=0 baseline could not be validated reliably"),
    "does-not-beat-spend-free": tx("Cost를 뺀 같은 모델보다 OOS가 낫지 않았습니다", "OOS is not better than the same model with Cost removed"),
    "wins-too-few-spend-free-holdouts": tx("Cost 포함 모델이 Spend=0 기준선보다 나은 검증 구간이 절반 미만입니다", "The Cost model beats its Spend=0 baseline in fewer than half of validation folds"),
    "naive-baseline-selected": tx("과거 검증에서 회귀보다 단순 기준선이 선택됐습니다", "Historical validation selected a naive baseline instead of the regression"),
    "development-oos-above-threshold": tx("선택과 분리한 과거 OOS가 10% 기준을 넘었습니다", "Development OOS, separated from selection, exceeds the 10% threshold"),
    "development-fold-above-threshold": tx("과거 OOS 구간 중 하나 이상이 10% 기준을 넘었습니다", "At least one development-OOS fold exceeds the 10% threshold"),
    "structural-controls-unavailable": tx("매핑한 구조 Step을 포함한 안정적 적합을 만들지 못했습니다", "A stable fit including the mapped structural Steps is unavailable"),
    "candidate-search-incomplete": tx("브라우저 후보 예산만큼 안정적으로 적합된 모델이 부족합니다", "Too few candidates fitted stably to fill the browser search budget"),
    "candidate-diversity-incomplete": tx("계획한 모델 구조 중 하나 이상을 안정적으로 비교하지 못했습니다", "At least one planned model structure could not be compared stably"),
    "forecast-validation": tx("rolling 검증 적격성이 확인되지 않았습니다", "Rolling validation eligibility is unavailable"),
    "high-collinearity": tx("최근 Cost 창에서 채널 예산이 함께 움직여 분리되지 않습니다", "Channel budgets move together in the recent Cost window"),
    "low-information": tx("최근 Cost 창의 독립적인 지출 변동이 부족합니다", "The recent Cost window lacks independent spend variation"),
    "scenario-identification": tx("채널별 Cost 시나리오 식별 조건을 충족하지 못했습니다", "Channel-level Cost scenario identification is not met"),
    "annual-analog-no-budget-response": tx("시계열 수준 예측은 Cost 증감 반응을 식별하지 않습니다", "The time-series level forecast does not identify budget-response effects"),
    "naive-horizon-selected": tx("모든 예측 주차에서 단순 기준선이 선택되어 Cost 변경이 예측에 반영되지 않습니다", "A naive baseline was selected at every forecast horizon, so Cost changes do not affect the forecast"),
    "latest-audit-failed": tx("봉인한 최신 예측구간 또는 하위 성분이 10% 인증 기준을 넘었습니다", "The sealed latest forecast horizon or a component exceeds the 10% certification threshold"),
    "route-certification-failed": tx("Direct Total과 OS 합산 경로의 공식 nested 검증이 10% 기준을 통과하지 못했습니다", "The official nested route audit between Direct Total and the OS sum did not pass the 10% threshold"),
    "component-certification-incomplete": tx("플랫폼·Organic/Paid 하위 오차를 모두 검증하지 못했습니다", "Not every platform and Organic/Paid component error could be validated"),
    "missing-model": tx("예측 회귀 모델을 만들지 못했습니다", "The forecast regression model is unavailable"),
  };
  return labels[reason] || String(reason);
}

export function ForecastHint({ label }) {
  return (
    <span
      className="data-confidence-hint"
      tabIndex={0}
      role="img"
      aria-label={label}
      data-tooltip={label}
    >
      ⓘ
    </span>
  );
}

export function reconcileForecastScenarioAudit(result, recentBacktest) {
  const base = result || { eligible: false, reasons: [] };
  if (recentBacktest?.reliable === true) return base;
  const threshold = Number(recentBacktest?.certificationThreshold) || 10;
  const latestScores = [
    recentBacktest?.wmape,
    ...(recentBacktest?.componentMetrics || []).map((metric) => metric?.wmape),
  ].filter(Number.isFinite);
  const didLatestAuditFail = latestScores.some((value) => value >= threshold);
  const reasons = new Set([
    ...(base.reasons || []),
    ...(recentBacktest?.decisionReasons || []),
  ]);
  if (didLatestAuditFail) reasons.add("latest-audit-failed");
  else if (!reasons.size) reasons.add("forecast-validation");
  return {
    ...base,
    eligible: false,
    reasons: [...reasons],
  };
}

export function forecastNaiveBaselineLabel(id, tx) {
  if (id === "last-value") return tx("마지막 값", "last value");
  if (id === "seasonal-naive-52") return tx("전년 동주", "same week last year");
  const recent = String(id || "").match(/^recent-mean-(\d+)$/);
  if (recent) return tx(`최근 ${recent[1]}주 평균`, `recent ${recent[1]}-week mean`);
  const trend = String(id || "").match(/^damped-local-trend-(\d+)$/);
  if (trend) return tx(`최근 ${trend[1]}주 감쇠 추세`, `damped ${trend[1]}-week trend`);
  return id || tx("단순 기준선", "naive baseline");
}

// 천단위 콤마 입력(§7 `type=number`는 콤마 불가 · §12.14 라이브 콤마+커서 보존 포트). type=text로
// 표시=콤마, 읽기=콤마 strip. onCommit(number|null) — 빈칸이면 null(부모가 기본값 복귀).
export function CommaNumberInput({ value, onCommit, style, placeholder, disabled = false }) {
  const ref = useRef(null);
  const focusedRef = useRef(false);
  const fmt = (n) => (n == null || n === "" || !isFinite(n) ? "" : Number(n).toLocaleString());
  const [txt, setTxt] = useState(fmt(value));
  useEffect(() => { if (!focusedRef.current) setTxt(fmt(value)); }, [value]);
  const handle = (e) => {
    const raw = e.target.value, caret = e.target.selectionStart;
    const digitsLeft = raw.slice(0, caret).replace(/[^\d]/g, "").length;
    const num = raw.replace(/[^\d]/g, "");
    const formatted = num === "" ? "" : Number(num).toLocaleString();
    setTxt(formatted);
    onCommit(num === "" ? null : Number(num));
    requestAnimationFrame(() => {
      if (!ref.current) return;
      let pos = 0, seen = 0;
      while (pos < formatted.length && seen < digitsLeft) { if (/\d/.test(formatted[pos])) seen++; pos++; }
      ref.current.setSelectionRange(pos, pos);
    });
  };
  return (
    <input ref={ref} type="text" inputMode="numeric" value={txt} placeholder={placeholder} disabled={disabled}
      onFocus={() => { focusedRef.current = true; }}
      onBlur={() => { focusedRef.current = false; setTxt(fmt(value)); }}
      onChange={handle} style={{ ...style, opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : undefined }} />
  );
}


/* ── CSV helpers (§7 CRLF+BOM, RFC4180 quoting) — index _mmmDownload/q 이식 ── */
export function csvQ(s) {
  s = String(s == null ? "" : s);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function csvSafeLiteral(s) {
  const value = String(s == null ? "" : s);
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
export function csvNum(v, d = 2) {
  return v == null || !isFinite(v) ? "" : (+v).toFixed(d);
}
export function csvDownload(name, lines) {
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

// “매주 성과는 무엇으로 이뤄졌나”의 보이는 그룹 막대와 같은 값을 wide 형식으로
// 내보낸다. Excel에서 첫 열을 가로축으로, 원하는 그룹 열을 계열로 바로 선택할 수 있다.
export function buildContributionGroupCsv(decomp, weekLabels, groupPanels) {
  if (!decomp?.weeks?.length || !groupPanels?.length) return [];
  const valueFor = (week, key) => key === "기본 수요" ? week.baseline : week.contrib?.[key] || 0;
  return [
    ["주차", "실제 성과", "모델 예측", "모델 오차", ...groupPanels.map((group) => group.label)].map(csvQ).join(","),
    ...decomp.weeks.map((week, index) => [
      weekLabels?.[index] || week.week,
      csvNum(week.actual, 6),
      csvNum(week.fitted, 6),
      csvNum(week.residual, 6),
      ...groupPanels.map((group) => csvNum(valueFor(week, group.key), 6)),
    ].map(csvQ).join(",")),
  ];
}

// 현재 필터·타깃 기준을 하나의 감사 가능한 분석 패키지로 내보낸다. 원본은 브라우저 안에서만
// 워크북으로 변환되고 서버 전송은 없다. 각 시트는 그래프용 long-format과 해석 안내를 함께 둔다.
export function downloadMmmWorkbook({ mmm, cannib, decomp, trend, forecast, csvData, colMap, locale, currency }) {
  if (!mmm || mmm.empty) return;
  const tx = (ko, en) => (locale === "en" ? en : ko);
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  const run = mmm.run;
  const health = mmm.health || mmmBayesianHealth(run);
  const identification = run.identification || {};
  const generated = new Date().toISOString();
  const sourceCurrency = csvData?.currency || currency || "KRW";
  const marginalStepSource = sourceCurrency === "KRW" ? 1_000_000 : 1_000;
  add("00_Index", [
    [tx("MMM 분석 패키지", "MMM analysis package")],
    [tx("생성 시각", "Generated"), generated],
    [tx("타깃", "Target"), mmm.target],
    [tx("원본 통화", "Source currency"), sourceCurrency],
    [tx("화면 표시 통화", "Display currency"), currency],
    [tx("내보낸 숫자 단위", "Exported numeric units"), tx(`모델·지출·매출 숫자는 원본 통화 ${sourceCurrency} 단위를 유지`, `Model, spend, and revenue values remain in source-currency ${sourceCurrency} units`)],
    [tx("모델", "Model"), run.methodLabel],
    [tx("방법론 버전", "Methodology version"), MMM_METH_CONFIG.version],
    [tx("기간", "Periods"), mmm.panel.week.length],
    [],
    [tx("시트", "Sheet"), tx("무엇을 확인하나", "What it contains")],
    ["01_Input", tx("분석에 사용한 원본·매핑", "Source rows and mapping")],
    ["02_STL", tx("추세·계절성·잔차·재구성 검증", "Trend, seasonality, residual, and reconstruction check")],
    ["02_STL_Notes", tx("STL 계산법·단위·해석 안내", "STL method, units, and interpretation notes")],
    ["03_Cannibal", tx("4개 잠식 검증의 채널별 결과", "Per-channel four-check cannibal evidence")],
    ["04_Model", tx("Empirical-Bayes 모델·적합도·채널 파라미터", "Empirical-Bayes model, fit, channel parameters")],
    ["05_WeeklyContribution", tx("주별 그룹 기여", "Weekly group contribution")],
    ["06_ChannelEffect", tx("양수확률·신뢰구간·한계효과", "Probability, interval, marginal effect")],
    ["07_ResponseData", tx("지출별 기여·CPA/ROAS 그래프용", "Spend response and CPA/ROAS chart data")],
    ["08_Forecast", tx("기준 예측·참고구간", "Baseline forecast and reference interval")],
    ["09_Glossary", tx("모델·지표 해석과 한계", "Model, metric definitions, limitations")],
    ["10_Health", tx("예측 적합·잔차·식별·prior 이동 진단", "Predictive fit, residual, identification, and prior-shift diagnostics")],
    ["11_Priors", tx("실험·국가 prior와 선택 검증", "Experiment/market priors and selection validation")],
  ]);
  const headers = csvData?.headers || [];
  add("01_Input", [
    [tx("컬럼", "Column"), tx("매핑", "Mapping")],
    ...headers.map((h) => [h, JSON.stringify(colMap?.[h] || { role: "ignore" })]),
    [],
    headers,
    ...(csvData?.raw || []).map((row) => headers.map((h) => row[h] ?? "")),
  ]);
  const stlActual = trend?.stl ? (trend.rawTarget || mmm.panel.targets[mmm.target] || []) : [];
  const stlPerformance = trend?.stl ? (trend.performanceContribution || []) : [];
  const stlBaseline = trend?.stl ? (trend.baselineTarget || stlActual) : [];
  const stlData = trend?.stl ? mmm.panel.week.map((w, i) => {
    const actual = Number(stlActual[i]);
    const performance = Number(stlPerformance[i]);
    const baseline = Number(stlBaseline[i]);
    const trendValue = Number(trend.stl.trend?.[i]);
    const seasonal = Number(trend.stl.seasonal?.[i]);
    const residual = Number(trend.stl.residual?.[i]);
    const finiteParts = [actual, performance, baseline, trendValue, seasonal, residual].every(Number.isFinite);
    return [
      i,
      mmm.panel.weekLabel?.[i] || w,
      actual,
      performance,
      baseline,
      trendValue,
      seasonal,
      residual,
      finiteParts ? seasonal + residual : null,
      finiteParts ? baseline - trendValue - seasonal - residual : null,
    ];
  }) : [];
  const stlIdentityError = stlData.length
    ? Math.max(...stlData.map((row) => Math.abs(Number(row[9]) || 0)))
    : null;
  add("02_STL", trend?.stl ? [
    ["week_index", "week", "actual", "performance_contribution_removed", "performance_excluded_baseline_input", "trend", "seasonality", "residual", "non_trend_seasonality_plus_residual", "recomposition_error"],
    ...stlData,
  ] : [[tx("STL 결과", "STL result")], [tx("이 패키지는 시계열 점검 단계에서 다운로드하면 STL 원자료를 포함합니다.", "Download from the time-series step to include STL source data.")]]);
  add("02_STL_Notes", trend?.stl ? [
    [tx("항목", "Item"), tx("내용", "Value")],
    [tx("대상", "Target"), mmm.target],
    [tx("단위", "Unit"), tx("타깃 CSV의 원래 성과 단위(예: 유저 수). 통화 단위가 아님.", "The original target unit from the CSV (for example, users); not a currency unit.")],
    [tx("방법", "Method"), trend.stl.method || "robust-additive-stl-weighted-phase-mean-lowess-trend"],
    [tx("계절성 템플릿", "Seasonal template"), trend.stl.seasonalSubseries || "weighted-phase-mean"],
    [tx("시즌 주기", "Seasonal period"), trend.stl.period || 52],
    [tx("Robust 반복 횟수", "Robust iterations"), trend.stl.robustIterations ?? null],
    [tx("Robust weight fallback", "Robust-weight fallbacks"), trend.stl.robustWeightFallbacks ?? 0],
    [tx("결측 주차", "Missing weeks"), trend.stl.missingCount ?? null],
    [tx("계절성 강도", "Seasonality strength"), trend.stl.seasonalStrength ?? null],
    [tx("추세 강도", "Trend strength"), trend.stl.trendStrength ?? null],
    [tx("분해 항등식", "Decomposition identity"), "performance_excluded_baseline_input = trend + seasonality + residual"],
    [tx("재구성 최대 오차", "Maximum reconstruction error"), stlIdentityError],
    [tx("해석 주의", "Interpretation warning"), tx("residual은 광고·이벤트·업황·측정오차가 섞인 불규칙 성분일 수 있으며 순수 광고효과가 아닙니다.", "Residual can contain media, events, industry movement, and measurement noise; it is not pure ad effect.")],
    [tx("외부 그래프 작성", "External plotting"), tx("02_STL의 week를 x축으로 사용하세요. actual에서 performance_contribution_removed를 빼면 performance_excluded_baseline_input이 됩니다. 그 입력의 trend/seasonality/residual을 각각 그리세요. Branding은 이 입력에 남아 있습니다.", "Use week as x-axis. Subtract performance_contribution_removed from actual to obtain performance_excluded_baseline_input, then plot its trend/seasonality/residual. Branding remains in this input.")],
  ] : [[tx("STL 안내", "STL notes")], [tx("STL 결과가 없어 안내를 만들 수 없습니다.", "No STL result is available for notes.")]]);
  add("03_Cannibal", cannib?.cannibRank ? [
    ["channel", "verdict", "eligible", "active_weeks", "precedence_vote", "detrend_vote", "net_vote", "lag_p", "lag_coef", "notes"],
    ...cannib.cannibRank.map((r) => {
      const c = cannib.cannibByChannel?.[r.key] || {};
      return [r.label, c.verdict, r.eligible, r.nActive, c.precedence?.vote, c.detrend_corr?.vote, c.net_incrementality?.vote, c.granger?.spend_to_organic?.p, c.granger?.spend_to_organic?.coefSum, c.power_gate?.reasons?.join(" | ") || ""];
    }),
  ] : [[tx("카니발 결과", "Cannibal result")], [tx("카니발 진단 단계에서 다운로드하면 4검증 원자료를 포함합니다.", "Download from the cannibalization step to include four-check evidence.")]]);
  add("04_Model", [
    ["model", run.methodLabel], ["R2", run.posterior?.r2], ["sigma", run.posterior?.sigma], ["target", mmm.target], [],
    ["weeks_per_parameter", identification.weeksPerParameter], ["max_media_correlation", identification.maxMediaCorrelation], ["high_collinearity", identification.highCollinearity], ["budget_eligible", identification.budgetEligible], [],
    ["industry_controls", JSON.stringify(mmm.panel.externalDefs || [])],
    ["pr416_provenance", JSON.stringify(run.pr416Provenance || null)], ["baseline_selection", JSON.stringify(run.baselineSelection || null)], ["seasonality_selection", JSON.stringify(run.seasonalitySelection || null)], ["media_penalty_selection", JSON.stringify(run.mediaPenaltySelection || null)], ["joint_transform_check", JSON.stringify(run.jointTransform || null)],
    ["channel", "adstock_alpha", "half_saturation", "hill_slope", "evaluated_transform_candidates", "total_transform_candidates", "candidate_search_capped", "prior_locked_transform", "effective_transform_candidates", "top_transform_weight", "posterior_positive_probability"],
    ...Object.values(run.saturationByChannel || {}).map((s) => [s.label, s.params.alpha, s.params.ec, s.params.slope, s.transformUncertainty?.candidateCount, s.transformUncertainty?.totalCandidateCount, s.transformUncertainty?.candidateSearchCapped, !!s.transformUncertainty?.priorLockedTransform, s.transformUncertainty?.effectiveCandidateCount, s.transformUncertainty?.topWeight, s.posteriorPositive]),
  ]);
  add("05_WeeklyContribution", decomp?.weeks ? [
    ["week", "actual", "fitted", "residual", "baseline", ...decomp.groupNames],
    ...decomp.weeks.map((w) => [w.week, w.actual, w.fitted, w.residual, w.baseline, ...decomp.groupNames.map((g) => w.contrib[g] || 0)]),
  ] : [[tx("주별 기여", "Weekly contribution")], [tx("기여 분해 결과가 없습니다.", "Contribution result unavailable.")]]);
  const channelPerformance = buildMmmWeeklyPerformance(mmm.panel, run.channelContributions);
  add("05b_ChannelAttribution", [
    ["channel", "group", `avg_cost_per_week_${sourceCurrency}`, `avg_${mmm.target}_per_week`, `total_spend_${sourceCurrency}`, `total_${mmm.target}`, mmm.target === "Revenue" ? "ROAS" : "CPA", "source", "identification", "by_construction"],
    ...channelPerformance.map((row) => {
      const contribution = run.channelContributions?.[row.key] || {};
      const channel = (mmm.panel.channels || []).find((item) => item.key === row.key);
      return [
        row.label,
        channel?.kind === "brand" ? "Brand" : "Performance",
        row.avgWeeklySpend,
        row.avgWeeklyPredicted,
        row.totalSpend,
        row.totalPredicted,
        mmm.target === "Revenue"
          ? (row.totalSpend > 0 ? row.totalPredicted / row.totalSpend : null)
          : row.predictedCpr,
        contribution.source,
        contribution.identificationVerdict,
        Boolean(contribution.identification?.byConstruction),
      ];
    }),
  ]);
  add("06_ChannelEffect", [
    ["channel", "posterior_positive_probability", "effect_size", "ci_low", "ci_high", `recent_spend_${sourceCurrency}`, `observed_raw_max_spend_${sourceCurrency}`, `observed_sustainable_spend_ceiling_${sourceCurrency}`, "range_profile_weight", `decision_step_${sourceCurrency}`, "incremental_mean", "incremental_ci_low", "incremental_ci_high", "increment_inside_observed_transformed_range", "budget_eligible", "budget_gate_reasons"],
    ...Object.values(run.saturationByChannel || {}).map((s) => {
      const marginal = s.incrementalAt(s.recentMean, marginalStepSource);
      const inObservedRange = s.isIncrementInObservedRange(s.recentMean, marginalStepSource);
      const gateReasons = [...(s.budgetGateReasons || []), ...(!inObservedRange ? ["outside-observed-spend-range"] : []), ...(marginal.ci?.[0] <= 0 ? ["marginal-interval-crosses-zero"] : [])];
      return [s.label, s.posteriorPositive, s.ln_coef, s.ci?.[0], s.ci?.[1], s.recentMean, s.coverage?.observedMax, s.observedSustainableSpendMax, s.observedRangeProfileWeight, marginalStepSource, marginal.mean, marginal.ci?.[0], marginal.ci?.[1], inObservedRange, s.budgetEligible && inObservedRange && marginal.ci?.[0] > 0, gateReasons.join("|")];
    }),
  ]);
  const grid = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5];
  const responseRows = [["channel", "spend", "incremental_contribution", mmm.target === "Revenue" ? "ROAS" : "CPA"]];
  Object.values(run.saturationByChannel || {}).forEach((s) => grid.forEach((mult) => {
    const spend = (s.recentMean || 1) * mult, result = s.responseAt(spend);
    responseRows.push([s.label, spend, result, spend > 0 && result > 0 ? (mmm.target === "Revenue" ? result / spend : spend / result) : null]);
  }));
  add("07_ResponseData", responseRows);
  add("08_Forecast", forecast ? [
    ["period", "actual", "fitted_or_forecast", "lower", "upper"],
    ...forecast.labels.map((label, i) => [label, forecast.actual?.[i] ?? null, forecast.fittedHist?.[i] ?? forecast.predFut?.[i - forecast.splitAt] ?? null, forecast.lo?.[i - forecast.splitAt] ?? null, forecast.hi?.[i - forecast.splitAt] ?? null]),
  ] : [[tx("예측", "Forecast")], [tx("예측 결과가 없습니다.", "Forecast unavailable.")]]);
  add("09_Glossary", [
    [tx("항목", "Term"), tx("설명", "Description")],
    ["Empirical-Bayes MMM", tx("잔차 분산을 plug-in 추정하고 Gaussian prior를 반영한 조건부 분석 근사입니다. 관측 데이터의 연관 모델이며 인과 확정이 아닙니다.", "Conditional Gaussian empirical-Bayes approximation with plug-in residual variance and Gaussian priors. Observational association, not causal proof.")],
    ["Trend stress profile", tx("현재 Decomp은 중립 추세계수의 하락 방향을 4배로 강제하는 stress prior를 사용합니다. 민감도 결과이며 OOS WMAPE가 기준을 넘으면 기본 추정으로 해석하지 마세요.", "Current Decomp uses a stress prior that forces the neutral trend coefficient four times further downward. This is a sensitivity profile; do not treat it as a base estimate when OOS WMAPE exceeds the gate.")],
    ["P(effect > 0)", tx("채널 효과가 양수일 posterior 확률. 80% 이상이면서 기간·공선성 식별 gate도 통과해야 예산 추천에 씁니다.", "Posterior probability that the channel effect is positive. Budget use requires ≥80% plus the time-span and collinearity identification gates.")],
    ["Adstock", tx("광고 효과의 다음 주 이월.", "Carryover of ad effect into later weeks.")],
    ["Hill saturation", tx("지출이 커질수록 추가 효과가 줄어드는 반응 곡선.", "Response curve with diminishing marginal return.")],
    ["Direction-constrained joint allocation", tx("약 78주 저주파 곡선에서 추세의 꺾임과 상승·하락 방향만 먼저 정하고, 추세 크기·업계·비즈니스 계절성·광고 기여는 같은 회귀에서 함께 추정합니다.", "Fixes only low-frequency trend bends and up/down directions first, then jointly estimates trend magnitude, industry, business seasonality, and media.")],
    ["STL", tx("성과를 장기추세·계절성·잔차로 나누는 시계열 분해.", "Time-series decomposition into trend, seasonality, residual.")],
    ["Cannibalization", tx("유료 광고가 기존 오가닉 성과를 대체했을 가능성. 4개 관측 검증은 확정이 아니며 holdout이 필요합니다.", "Possibility paid ads replace organic outcome. Four observational checks require holdout for confirmation.")],
    ["RMS contribution-magnitude share", tx("각 드라이버의 주별 기여값 제곱평균을 전체 합으로 나눈 크기 비중. Shapley R²나 인과 기여율이 아닙니다.", "Each driver's mean squared weekly contribution divided by the total. Not Shapley R² or causal attribution.")],
  ]);
  add("10_Health", health ? [
    [tx("진단", "Diagnostic"), tx("값", "Value"), tx("해석", "Interpretation")],
    ["in_sample_wMAPE_pct", health.wmape, tx("전체 기간 가중 절대 오차율", "Full-period weighted absolute percentage error")],
    ["oos_wMAPE_pct", health.oos?.wmape, tx("시간순 홀드아웃 가중 절대 오차율", "Time-ordered holdout weighted absolute percentage error")],
    ["empirical_90pct_interval_coverage", health.coverage90, tx("실제값이 90% 참고구간 안에 든 비율", "Share of actuals inside the 90% reference interval")],
    ["residual_acf_lag1", health.residualAcf1, tx("잔차 1주 자기상관; 절댓값 0.3 이상 주의", "One-week residual autocorrelation; caution at |value| ≥ 0.3")],
    ["negative_natural_demand_share", health.negativeBaselineShare, tx("자연수요 추정이 0 미만인 주의 비율", "Share of weeks with estimated natural demand below zero")],
    ["max_abs_prior_shift_sd", health.priorShifts?.length ? Math.max(...health.priorShifts.map((item) => Math.abs(item.shiftZ || 0))) : null, tx("prior 평균에서 posterior가 이동한 최대 표준편차", "Largest posterior shift from prior mean, in prior SDs")],
    ["sampling_diagnostic", "not_applicable", tx("조건부 Gaussian 근사라 MCMC chain을 샘플링하지 않아 R-hat·ESS가 적용되지 않습니다.", "R-hat and ESS do not apply because this conditional Gaussian approximation does not sample MCMC chains.")],
    ["interval_calibration", JSON.stringify(health.intervalCalibration || null), tx("시간순 holdout 잔차로 보수 보정한 경우의 메타데이터", "Metadata for conservative time-ordered holdout residual calibration")],
    ["trend_direction_plan", JSON.stringify(run.trendDirectionPlan || null), tx("저주파 곡선에서 먼저 고정한 추세 구간과 상승·하락 방향. 기여 숫자는 여기서 고정하지 않음", "Trend segments and directions fixed from the low-frequency curve; contribution magnitudes are not fixed here")],
    ["joint_structure_selection", JSON.stringify(run.jointStructureSelection || null), tx("방향 고정 모델에서는 사용하지 않음", "Not used by the direction-constrained model")],
    ["baseline_selection", JSON.stringify(run.baselineSelection || null), tx("자동 구조 탐색이 선택한 직선 또는 1·2회 꺾임 추세", "Linear, one-knot, or two-knot trend selected by automatic structure search")],
    ["joint_transform_check", JSON.stringify(run.jointTransform || null), tx("불확실성이 큰 최대 2개 채널의 제한적 조합 진단", "Bounded combination diagnostic for up to two uncertain channels")],
    ["country_validation_mode", mmm.countryValidationMode || "none", tx("as-of-earliest-fold는 가장 이른 학습 cutoff에서 타깃 변환·Y 스케일·참고국 근거를 고정해 이후 정보 누수를 막는다는 뜻입니다. 같은 rolling folds가 후보 선택에 쓰이므로 최종 독립 OOS는 아닙니다.", "As-of-earliest-fold locks target transforms, Y scale, and reference evidence at the earliest training cutoff to prevent later-information leakage. The same rolling folds tune candidate selection, so they are not a final independent OOS score.")],
    [],
    ["health_flag", "severity", "localized_message"],
    ...(health.flags || []).map((flag) => [flag.key, flag.severity, mmmHealthFlagMessage(flag.key, locale)]),
  ] : [[tx("건강 진단", "Health diagnostics")], [tx("계산할 수 없습니다.", "Unavailable.")]]);
  add("11_Priors", [
    [tx("적용 prior", "Applied priors")],
    ["channel_key", "sources", "mean", "variance", "precision", "source_components_json", "between_market_tau2", "country_count", "target_locked_transform_json", "reference_spend_scale_method", "reference_spend_scale_factors_json"],
    ...Object.entries(mmm.mediaPriors || {}).map(([key, prior]) => [key, (prior.sources || [prior.source]).filter(Boolean).join("+"), prior.mean, prior.variance, prior.precision, JSON.stringify(prior.sourceComponents || []), prior.tau2, prior.countryCount, JSON.stringify(prior.targetLockedTransform || null), prior.referenceSpendScaleMethod, JSON.stringify(prior.referenceSpendScaleFactors || null)]),
    [],
    [tx("실험 prior 진단", "Experiment-prior diagnostics")],
    ["channel", "status", "reason", "experiment_type", "experiment_type_source", "normalization_mode", "design", "ci90_low", "ci90_high", "fieller90_low", "fieller90_high", "jackknife_se", "ci_method", "cadence", "source_rows", "usable_rows_or_weeks", "usable_unique_periods", "dropped_unparseable_rows", "dropped_unknown_category_weeks", "dropped_mixed_boundary_weeks", "dropped_missing_weeks", "boundary_partial_weeks", "internal_partial_weeks", "missing_time_periods", "duplicate_periods", "expected_days_per_week", "geo_count", "small_cluster_inflation", "small_sample_inflation", "residual_df", "exposure_strength_t", "weak_exposure_critical_t", "effect_exposure_covariance", "geo_raw_adstock_return", "geo_target_basis_adstock", "geo_target_hill_derivative", "on_weeks", "off_weeks", "transition_count", "outcome_overlap_unique_weeks", "outcome_overlap_observations", "outcome_exact_match_weeks", "outcome_exact_match_share", "outcome_independence_check", "message"],
    ...(mmm.experimentPriorDiagnostics || []).map((item) => [item.channel, item.unidentified ? "not_applied_unidentified" : "applied", item.reason, item.experimentType, item.experimentTypeSource, item.normalizationMode, item.design, item.ci90?.[0], item.ci90?.[1], item.fieller90?.[0], item.fieller90?.[1], item.jackknifeSe, item.ciMethod, item.cadence, item.sourceN, item.n || item.usableWeeks, item.usableUniquePeriods, item.droppedUnparseableRows, item.droppedUnknownCategoryWeeks, item.droppedMixedWeeks, item.droppedMissingWeeks, item.boundaryPartialWeeks, item.internalPartialWeeks, item.missingTimePeriods, item.duplicateProvidedPeriods, item.expectedDaysPerWeek, item.geoCount, item.smallClusterInflation, item.smallSampleInflation, item.residualDf, item.exposureStrength, item.weakExposureCriticalValue, item.effectExposureCovariance, item.geoRawAdstockReturn, item.geoTargetBasisAdstock, item.geoTargetHillDerivative, item.onWeeks, item.offWeeks, item.transitionCount, item.outcomeOverlapWeeks, item.outcomeOverlapObservations, item.outcomeExactMatchWeeks, item.outcomeExactMatchShare, item.outcomeIndependenceCheck, locale === "en" ? item.messageEn : item.messageKo]),
    [],
    [tx("국가 prior 후보", "Market-prior candidates")],
    ["candidate", "selected", "base", "folds", "mean_rmse", "sd_rmse", "score", "relative_improvement", "fold_win_rate", "validation_mode"],
    ...(mmm.countryCandidates || []).map((candidate) => [candidate.country, !!candidate.isRecommended, !!candidate.isBaseline, candidate.folds, candidate.meanRmse, candidate.sdRmse, candidate.score, candidate.relativeImprovement, candidate.foldWinRate, candidate.validationMode || mmm.countryValidationMode]),
    [],
    [tx("개별 국가 1차 평가", "Individual market screening")],
    ["market", "status", "reason", "source_rows", "valid_weekly_periods", "minimum_weekly_periods", "folds", "mean_rmse", "sd_rmse", "relative_improvement", "detail"],
    ...(mmm.countryIndividualCandidates || []).map((candidate) => [candidate.country, candidate.status, candidate.reason, candidate.rowCount, candidate.validPeriodCount, candidate.minimumRows, candidate.folds, candidate.meanRmse, candidate.sdRmse, candidate.relativeImprovement, candidate.detail]),
    [],
    ["reference_market_total", mmm.countryPlan?.totalCountries],
    ["reference_market_fit_cap", mmm.countryPlan?.maxReferenceFits],
    ["reference_market_plan_capped", mmm.countryPlan?.capped],
    ["target_country_detection", mmm.countryPlan?.targetCountryDetection],
    ["target_country_blank_rows", mmm.countryPlan?.targetCountryBlankRows],
    ["target_country", mmm.countryPlan?.targetCountry],
    ["excluded_target_country", mmm.countryPlan?.excludedTargetCountry],
    ["target_country_confirmation_required", mmm.countryPlan?.targetCountryConfirmationRequired],
    ["country_prior_blocked", mmm.countryPlan?.blocked],
    ["country_prior_block_reason", mmm.countryPlan?.blockReason],
    ["country_validation_reason", mmm.countryPlan?.validationReason],
    ["country_validation_folds", mmm.countryPlan?.validationFolds],
    ["combined_prior_validation_boundary", tx("국가 prior는 experiment 없이 country-only 대 base로 검증; experiment+country 결합은 최종 전체기간 적합만 수행하며 독립 OOS 없음", "Market prior validated country-only versus base without experiment; experiment+market combination occurs only in final all-history fit and has no independent OOS")],
  ]);
  XLSX.writeFile(wb, `MMM_analysis_package_${mmm.target}_${_today()}.xlsx`);
}
// 엑셀 열 문자(0→A). index colL 이식.
export function csvColL(n) {
  let s = "",
    x = n + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}
export const _today = () => new Date().toISOString().slice(0, 10);

// 텍스트(.md) 다운로드 — "이 과정 자세히" 문서용.
export function textDownload(name, text) {
  const blob = new Blob(["﻿" + text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

// 카니발 진단 전 과정을 평어+전문 병기로 설명하는 자체완결 문서(현재 결과 요약 포함).
export function buildCannibGuideDoc(cannib, targetKo, locale = "ko") {
  if (locale === "en") return buildCannibGuideDocEn(cannib, targetKo);
  const L = [];
  L.push(`# 카니발(잠식) 진단 — 이 분석은 무엇이고 어떻게 판정하나`);
  L.push("");
  L.push(`대상 지표: ${targetKo} · 생성일: ${_today()}`);
  L.push("");
  L.push(`## 한 줄 요약`);
  L.push(`"카니발리제이션(잠식)"은 유료 광고가, 원래 광고 없이도 공짜로 들어왔을 오가닉(자연) 유입을 갉아먹는 현상입니다. 이 도구는 채널마다 "그 채널 광고가 오가닉을 잠식하는가?"를 4가지 서로 다른 각도로 따져보고, 그 결과를 종합해 **잠식 의심 / 애매함 / 문제 없음** 세 칸으로 분류합니다.`);
  L.push("");
  L.push(`## 왜 중요한가`);
  L.push(`광고 대시보드에 찍히는 전환은 "광고가 새로 만든 것"과 "원래 왔을 사람을 광고가 가로챈 것"이 섞여 있습니다. 뒤쪽(잠식)이 크면, 광고를 꺼도 성과가 별로 안 줄어드는데도 예산만 계속 쓰게 됩니다. 그래서 "이 채널을 늘려야 하나?"의 답이 달라집니다.`);
  L.push("");
  L.push(`## 4가지 신호 (각 채널마다 따져보는 것)`);
  L.push(`- **① 광고를 늘리기 전에 이미 줄고 있었나?** — 저지출 구간에서 선택 성과(유저수·매출 등)가 이미 하락 추세였다면, 그 하락은 광고 탓이 아닐 가능성이 큽니다. (전문: 저지출 구간 기울기 검정)`);
  L.push(`- **② 시간 추세를 걷어내도 광고와 성과가 반대로 움직이나?** — 공통 시간 추세를 제거한 뒤에도 광고비↑·성과↓ 또는 광고비↓·성과↑가 반복되면 잠식이 의심됩니다. (전문: 탈추세·1차차분 상관 + 방향 반복 검증)`);
  L.push(`- **③ 광고를 늘리면 (잠식을 빼고도) 전체 성과가 순증가하나?** — 잠식분을 감안하고도 전체가 순으로 늘면 방어 양호입니다. (전문: 순증분 탄력성, 95% 신뢰구간)`);
  L.push(`- **④ 광고비가 몇 주 뒤에 선택 성과를 끌어내리나?** — ①~③은 "같은 주"만 봅니다. ④는 시차를 두고(예: 3~6주 뒤) 광고비가 선택 성과를 떨어뜨리는지 봅니다. (전문: 그랜저 인과, prewhitening 후 F-검정)`);
  L.push(`- **⑤ 충격 반응(IRF)** — 지출을 한 번 확 늘렸을 때 이후 몇 주간 성과가 어떻게 반응하는지 곡선으로 봅니다. 아래로 내려가면 시차 잠식, 위로 올라가면 시차 증분.`);
  L.push("");
  L.push(`## 판정은 어떻게 종합하나 (입증책임 비대칭)`);
  L.push(`- **문제 없음(방어 양호)**: 네 방향 모두 뚜렷한 잠식 신호가 없을 때만. "잠식 신호가 없다"는 강한 증거가 있어야 OK를 줍니다.`);
  L.push(`- **잠식 의심**: 식별 가능성 게이트를 통과한 채널에서 서로 다른 신호가 2개 이상 같은 방향으로 일치할 때만 올립니다. 단일 음의 신호·장기 추세·산발 집행만으로는 red가 되지 않습니다.`);
  L.push(`- **애매함(판단 보류)**: 데이터가 부족하거나(집행 주 수가 적음) 채널끼리 지출이 거의 똑같이 움직여(공선) 서로 구분이 안 되면, 억지로 판정하지 않고 보류합니다.`);
  L.push("");
  L.push(`## 꼭 기억할 것`);
  L.push(`이 진단은 전부 **"연관(association)"**이지 **"인과(causation)"**가 아닙니다. 관측 데이터만으로는 "광고가 잠식을 유발했다"를 확정할 수 없습니다. 이 도구의 역할은 **의심 채널을 좁혀주는 것**이고, 확정은 반드시 **홀드아웃(geo/시간 분할) 실험**으로 해야 합니다. "잠식 의심" 칸의 채널부터 실험 1순위로 검토하세요.`);
  L.push("");
  L.push(`## 수학·통계 상세 (전문가용)`);
  L.push("");
  L.push(`### ① 시간 선행성 — 저지출 구간 선형 추세`);
  L.push(`저지출 구간(지출 ≤ 전체 지출의 25번째 백분위수, p25)만 잘라내 그 구간 안에서 선택 KPI의 시간 추세를 봅니다.`);
  L.push(`- **기울기·유의성**: 시간에 대한 OLS 선형회귀 기울기와 t 검정 p값을 사용합니다.`);
  L.push(`- **판정 규칙**: p<0.05이면서 구간 전체 변화가 −10% 이하이면 FOR(광고 확대 전부터 하락), +10% 이상이면 AGAINST(광고 확대 전 상승). 통계적으로 유의해도 실제 변화가 10% 미만이거나 표본(n=low_n)이 부족하면 ABSTAIN.`);
  L.push("");
  L.push(`### ② 허위상관 — 탈추세·1차차분 Pearson 상관`);
  L.push(`시간(t)에 걸쳐 같이 늘어나는 두 변수는 서로 무관해도 상관이 크게 나옵니다(허위상관). 이를 걸러내기 위해:`);
  L.push(`1. **원상관(raw)**: 광고비와 선택 KPI의 단순 Pearson r.`);
  L.push(`2. **탈추세(detrended)**: 각 시계열에서 선형 추세(OLS 적합값)를 빼고 남은 잔차끼리의 상관.`);
  L.push(`3. **1차차분(first_diff)**: yₜ − yₜ₋₁ 변환 후 상관(공통 장기 추세를 제거).`);
  L.push(`4. **방향 반복 검증**: 미세한 흔들림은 제외하고 지출↓·성과↑ 또는 지출↑·성과↓가 반복되는 주를 셉니다. 유효 주가 8주 이상이고 역행 비율이 65% 이상이며 Wilson 95% 하한도 50%를 넘으면 AGAINST입니다.`);
  L.push(`- **판정 규칙**: detrended ≤ −0.20, first_diff ≤ −0.20, 또는 방향 반복 검증 AGAINST 중 하나면 ②는 잠식 신호입니다. 두 상관이 모두 −0.10 이상이고 방향 반복도 역행이 아니면 FOR, 나머지는 ABSTAIN입니다.`);
  L.push("");
  L.push(`### ③ 순증분 — log-log 탄력성 회귀 (AR(1) 자기상관 보정)`);
  L.push(`ln(선택 KPI) = β·ln(1+광고비) + 통제변수 + 오차, 형태의 회귀를 적합해 계수 β(탄력성)를 추정합니다.`);
  L.push(`- **AR(1) 보정**: 잔차가 자기상관(어제 오차가 오늘 오차에 영향)을 가지면 OLS 표준오차가 과소평가돼 거짓 유의성이 나올 수 있습니다. Yule-Walker로 AR(1) 계수 ρ를 추정하고 Cochrane-Orcutt류 변환(yₜ−ρyₜ₋₁)으로 재적합해 보정된 표준오차·p값을 씁니다.`);
  L.push(`- **95% 신뢰구간**: β ± 1.96×SE(β). CI가 0을 포함하지 않고 β>0이면 FOR(순증분 확인), β<0이고 CI가 0 미포함이면 AGAINST(순수 잠식), CI가 0을 포함하면 ABSTAIN(증거 없음 ≠ 효과 없음).`);
  L.push(`- **검정력 게이트**: 표본(n)이 적거나 광고비 변동계수(CV)가 작으면(=지출이 거의 늘 비슷해서 효과를 식별할 통계적 힘이 없으면) ③을 강제로 ABSTAIN 처리 — "효과 없음"과 "증거 없음"을 구분하기 위한 안전장치.`);
  L.push("");
  L.push(`### ④ 그랜저 인과 — Prewhitening 후 lagged F-검정`);
  L.push(`①~③은 전부 "같은 주(동시점)" 관계만 봅니다. 그랜저 인과는 "광고비의 **과거값**이 선택 KPI의 **미래값**을 추가로 설명하는가"를 봐서 시차 효과를 잡습니다.`);
  L.push(`- **Prewhitening**: 두 시계열 각각에서 추세(선형)+52주 계절성(Fourier 2차 항)을 먼저 제거해 순수한 단기 변동만 남깁니다(장기 추세 때문에 생기는 허위 그랜저-인과 방지).`);
  L.push(`- **F-검정**: "성과ₜ = f(성과 과거값들)"만 있는 축소모형과, "성과ₜ = f(성과 과거값들, 광고비 과거값들)"인 완전모형을 비교. 완전모형이 유의하게 더 잘 맞으면(F-검정 p<0.05) 광고비가 선택 성과를 그랜저-인과함.`);
  L.push(`- **방향 두 가지**: 광고비→성과(시차 잠식/증분 여부), 성과→광고비(페이싱=예산 담당자가 성과가 약할 때 방어적으로 예산을 올리는 역인과 패턴 — 이게 유의하면 ②④의 음의 관계가 인과가 아니라 반응일 수 있음).`);
  L.push("");
  L.push(`### ⑤ 임펄스 응답 함수(IRF)`);
  L.push(`Prewhiten한 레벨 VAR(벡터자기회귀) 모형에서, 광고비에 1표준편차(1SD) 크기의 충격을 한 번 줬을 때 이후 여러 주에 걸쳐 선택 성과가 어떻게 반응하는지 경로를 계산합니다. 음수 구간이 있으면 시차 잠식, 양수면 시차 증분. n<24주면 신뢰할 수 없어 곡선을 생략합니다.`);
  L.push("");
  L.push(`### 추세 존재성 검정 — STL 분해 + Mann-Kendall 4변형 + 단위근 검정`);
  L.push(`- **STL(Seasonal-Trend decomposition using Loess)**: Performance 제외 baseline 입력을 52.18주 계절 주기와 주차별 가중 계절성 템플릿 + LOWESS 추세 + 잔차로 분해(robust 반복 3회).`);
  L.push(`- **Mann-Kendall 4가지**: 원본(raw), 자기상관 보정(Hamed-Rao, 순위 기반 분산 보정), 계절형(seasonal MK, 같은 계절끼리만 비교), 탈계절 잔차형(deseason). 네 개가 일치해야 "진짜 추세"로 확신.`);
  L.push(`- **ADF(Augmented Dickey-Fuller)**: 단위근(비정상성, 추세가 발산) 존재 여부 검정. p<0.05면 정상(추세가 있어도 발산 안 함).`);
  L.push(`- **KPSS**: ADF와 반대 귀무가설(정상성을 귀무가설로) — 두 검정이 서로 보완. 둘 다 통과해야 "trend-stationary" 확정.`);
  L.push("");
  L.push(`### 데이터 위생 + 매크로 — 모델-독립 검증`);
  L.push(`모델을 적합하기 전에 스키마·연속성·결측을 점검(위생 경고)하고, 2024 vs 2025처럼 연도 단위 YoY(spend·KPI)를 계산합니다. 이건 어떤 회귀 모형에도 의존하지 않는 "가장 확실한" 헤드라인 숫자라, 모델이 이상해도 이 숫자는 흔들리지 않습니다.`);
  L.push("");
  L.push(`### 단순 모델 audit — HAC(Newey-West) 표준오차`);
  L.push(`모든 채널 지출을 하나로 합친 naive 모델(ln_총지출)을 적합하고, 일반 OLS p값과 **HAC(Newey-West) 자기상관·이분산 견고** p값을 나란히 비교합니다. HAC 표준오차는 잔차 구조에 따라 OLS보다 크거나 작을 수 있으며, 둘이 크게 다르면 OLS의 독립·등분산 가정을 점검해야 한다는 신호입니다. 또한 브랜드 채널 추가 전후 R²·계수 변화로 공선성(다중공선성)을 점검합니다(회귀변수 추가는 이론상 R²를 못 낮추므로, 다른 target에서 총지출 계수가 크게 출렁이면 공선 증거).`);
  L.push("");
  if (cannib && cannib.cannibRank && cannib.cannibRank.length) {
    L.push(`## 현재 데이터 판정 요약`);
    for (const r of cannib.cannibRank) {
      const lv = mmmCannibLevel(r);
      const bucket = !r.eligible || lv.lv <= 4 ? "애매함(판단 보류)" : "잠식 의심";
      L.push(`- **${r.label}** → ${bucket}${r.eligible ? "" : ` (데이터 부족 ${r.nActive}/${r.total}주)`}`);
    }
    L.push("");
  }
  L.push(`## 함께 보는 다른 분석`);
  L.push(`- **추세 존재성**: 성과에 광고와 무관한 시간 흐름 자체의 추세가 있는지(STL 분해 + Mann-Kendall·ADF·KPSS 검정).`);
  L.push(`- **데이터 위생**: 분석 전에 데이터가 깨끗한지(결측·연속성) + 작년 대비 지표 변화.`);
  L.push(`- **단순 모델 점검**: "모든 지출을 하나로 뭉친 대충 만든 모델"이 왜 못 믿을 만한지(자기상관·공선성) 확인.`);
  L.push("");
  L.push(`— Growth Opt Playbook · 마케팅 반응 분석(MMM)`);
  return L.join("\n");
}

// English version of buildCannibGuideDoc (same structure/content, translated).
export function buildCannibGuideDocEn(cannib, targetLabel) {
  const L = [];
  L.push(`# Cannibalization Diagnosis — what this analysis is and how it's judged`);
  L.push("");
  L.push(`Target metric: ${targetLabel} · Generated: ${_today()}`);
  L.push("");
  L.push(`## One-line summary`);
  L.push(`"Cannibalization" is when paid ads eat into organic (free) traffic that would have arrived anyway. This tool checks, per channel, "is this channel's ads cannibalizing organic?" from 4 independent angles, then combines them into three buckets: **Cannibalization suspected / Unclear / No issue**.`);
  L.push("");
  L.push(`## Why it matters`);
  L.push(`Conversions on an ad dashboard mix "what ads newly created" with "people who would have come anyway, that ads intercepted." If the latter (cannibalization) is large, turning ads off won't hurt performance much even though you keep spending. That changes the answer to "should we scale this channel?"`);
  L.push("");
  L.push(`## The 4 signals (checked per channel)`);
  L.push(`- **① Was the selected outcome already declining before ad spend increased?** — If users, revenue, or the selected KPI was already trending down in low-spend periods, that decline is likely not ads' fault. (Technical: low-spend-window slope test)`);
  L.push(`- **② After removing the time trend, do spend and outcome repeatedly move opposite?** — Repeated spend↑/outcome↓ or spend↓/outcome↑ movement is a cannibalization signal. (Technical: detrended / first-difference correlation + repeated-direction check)`);
  L.push(`- **③ Does total performance net-increase when ads rise (even accounting for cannibalization)?** — If the net total still rises, defense is good. (Technical: net-incremental elasticity, 95% CI)`);
  L.push(`- **④ Does spend pull the selected outcome down a few weeks later?** — ①–③ only look at "the same week." ④ checks whether spend depresses the outcome with a lag (e.g. 3–6 weeks later). (Technical: Granger causality, F-test after prewhitening)`);
  L.push(`- **⑤ Impulse response (IRF)** — Shows, as a curve, how performance responds over the following weeks to a one-time spend shock. A dip below zero = lagged cannibalization; a rise = lagged incrementality.`);
  L.push("");
  L.push(`## How the verdict is combined (asymmetric burden of proof)`);
  L.push(`- **No issue (well-defended)**: only when none of the four signals show a clear cannibalization signal. Strong evidence of "no signal" is required to give an OK.`);
  L.push(`- **Cannibalization suspected**: only when an eligible channel has at least two independent signals pointing in the same direction. A single trend, sparse flight, or lagged signal alone remains withheld.`);
  L.push(`- **Unclear (verdict withheld)**: if data is insufficient (few active weeks) or channels move almost identically (collinear) and can't be separated, we withhold judgment rather than force a verdict.`);
  L.push("");
  L.push(`## Key takeaway`);
  L.push(`All of this is **association**, not **causation**. Observational data alone cannot confirm "ads caused cannibalization." This tool's job is to **narrow down suspect channels** — confirmation requires a **holdout (geo/time-split) experiment**. Prioritize testing channels in the "cannibalization suspected" bucket first.`);
  L.push("");
  L.push(`## Math & statistics detail (for specialists)`);
  L.push("");
  L.push(`### ① Temporal precedence — low-spend linear trend`);
  L.push(`We isolate the low-spend window (spend ≤ the 25th percentile of total spend, p25) and inspect the selected KPI's time trend within it.`);
  L.push(`- **Slope and significance**: OLS slope against time with its t-test p-value.`);
  L.push(`- **Decision rule**: with p<0.05, a full-window change of −10% or less is FOR (decline predates the ramp), while +10% or more is AGAINST. A statistically significant but immaterial change below 10%, or too little data (n=low_n), is ABSTAIN.`);
  L.push("");
  L.push(`### ② Spurious correlation — detrended / first-difference Pearson correlation`);
  L.push(`Two variables that both grow over time (t) can appear highly correlated even if unrelated (spurious correlation). To filter this out:`);
  L.push(`1. **Raw correlation**: simple Pearson r between spend and the selected KPI.`);
  L.push(`2. **Detrended**: correlation between the residuals left after subtracting a linear trend (OLS fit) from each series.`);
  L.push(`3. **First difference**: correlation after the yₜ − yₜ₋₁ transform, removing the shared long-run trend.`);
  L.push(`4. **Repeated-direction check**: after excluding tiny movements, count spend↓/outcome↑ and spend↑/outcome↓ weeks. With at least 8 informative weeks, an opposite-direction rate of at least 65%, and a Wilson 95% lower bound above 50%, the result is AGAINST.`);
  L.push(`- **Decision rule**: ② is AGAINST if detrended ≤ −0.20, first_diff ≤ −0.20, or the repeated-direction check is AGAINST. It is FOR only when both correlations are at least −0.10 and repeated movement is not opposite; otherwise ABSTAIN.`);
  L.push("");
  L.push(`### ③ Net incrementality — log-log elasticity regression (AR(1) autocorrelation correction)`);
  L.push(`Fits a regression of the form ln(selected KPI) = β·ln(1+spend) + controls + error, estimating coefficient β (elasticity).`);
  L.push(`- **AR(1) correction**: if residuals are autocorrelated (yesterday's error affects today's), OLS standard errors are underestimated, producing false significance. We estimate the AR(1) coefficient ρ via Yule-Walker and refit with a Cochrane-Orcutt-style transform (yₜ−ρyₜ₋₁) to get corrected SE/p-values.`);
  L.push(`- **95% CI**: β ± 1.96×SE(β). If CI excludes 0 and β>0 → FOR (net incrementality confirmed); β<0 with CI excluding 0 → AGAINST (pure cannibalization); CI including 0 → ABSTAIN (no evidence ≠ no effect).`);
  L.push(`- **Power gate**: if sample size (n) is small or spend's coefficient of variation (CV) is low (i.e. spend barely varies, so there's no statistical power to identify an effect), ③ is force-set to ABSTAIN — a safeguard distinguishing "no effect" from "no evidence."`);
  L.push("");
  L.push(`### ④ Granger causality — lagged F-test after prewhitening`);
  L.push(`①–③ only look at "same week" (contemporaneous) relationships. Granger causality checks whether **past values** of spend explain **future values** of the selected outcome beyond that outcome's own history, capturing lagged effects.`);
  L.push(`- **Prewhitening**: trend (linear) + 52-week seasonality (2nd-order Fourier terms) are first removed from each series, leaving only pure short-term variation (prevents spurious Granger causality from long-term trends).`);
  L.push(`- **F-test**: compares a restricted model "outcomeₜ = f(outcome's own past)" against a full model "outcomeₜ = f(outcome's own past, spend's past)." If the full model fits significantly better (F-test p<0.05), spend Granger-causes the selected outcome.`);
  L.push(`- **Two directions**: spend→outcome (lagged cannibalization/incrementality), outcome→spend (pacing = a reverse-causality pattern where budget owners raise spend defensively when performance is weak — if this is significant, the negative relationship in ②④ may be a response, not a cause).`);
  L.push("");
  L.push(`### ⑤ Impulse response function (IRF)`);
  L.push(`In a prewhitened level VAR (vector autoregression) model, we compute the path of how the selected outcome responds over the following weeks to a single one-standard-deviation (1SD) shock to spend. A negative stretch = lagged cannibalization; positive = lagged incrementality. With n<24 weeks the curve is omitted as unreliable.`);
  L.push("");
  L.push(`### Trend-existence test — STL decomposition + 4 Mann-Kendall variants + unit-root tests`);
  L.push(`- **STL (Seasonal-Trend decomposition using Loess)**: decomposes the Performance-excluded baseline input into a 52.18-week seasonal period, weighted week-of-year template, LOWESS trend, and residual (3 robust iterations).`);
  L.push(`- **4 Mann-Kendall variants**: raw, autocorrelation-corrected (Hamed-Rao, rank-based variance correction), seasonal MK (compares only within the same season), deseasonalized-residual MK. All four must agree to be confident it's a "real trend."`);
  L.push(`- **ADF (Augmented Dickey-Fuller)**: tests for a unit root (non-stationarity, a diverging trend). p<0.05 means stationary (even with a trend, it doesn't diverge).`);
  L.push(`- **KPSS**: opposite null hypothesis to ADF (stationarity as the null) — the two tests complement each other. Both must pass to confirm "trend-stationary."`);
  L.push("");
  L.push(`### Data hygiene + macro facts — model-independent verification`);
  L.push(`Before fitting any model, we check schema/continuity/missing data (hygiene warnings) and compute year-over-year (spend·KPI) changes like 2024 vs 2025. This is the "most certain" headline number, independent of any regression model — so it doesn't move even if the model looks odd.`);
  L.push("");
  L.push(`### Naive-model audit — HAC (Newey-West) standard errors`);
  L.push(`Fits a naive model lumping all channel spend together (ln_total_spend), and compares plain OLS p-values side by side with **HAC (Newey-West) autocorrelation/heteroskedasticity-robust** p-values. HAC standard errors may be larger or smaller than OLS depending on residual structure; a large gap signals that the OLS independence/homoskedasticity assumptions need review. We also check for collinearity (multicollinearity) via R²/coefficient shifts before/after adding a brand channel (adding a regressor can't theoretically lower R², so a large swing in the total-spend coefficient across targets is evidence of collinearity).`);
  L.push("");
  if (cannib && cannib.cannibRank && cannib.cannibRank.length) {
    L.push(`## Current-data verdict summary`);
    for (const r of cannib.cannibRank) {
      const lv = mmmCannibLevel(r);
      const bucket = !r.eligible || lv.lv <= 4 ? "Unclear (withheld)" : "Cannibalization suspected";
      L.push(`- **${r.label}** → ${bucket}${r.eligible ? "" : ` (insufficient data ${r.nActive}/${r.total} weeks)`}`);
    }
    L.push("");
  }
  L.push(`## Related analyses`);
  L.push(`- **Trend existence**: whether performance has a trend from pure time flow, unrelated to ads (STL decomposition + Mann-Kendall/ADF/KPSS tests).`);
  L.push(`- **Data hygiene**: whether the data is clean before analysis (missing data/continuity) + year-over-year metric change.`);
  L.push(`- **Naive-model check**: why "one crude model lumping all spend together" can't be trusted (autocorrelation/collinearity).`);
  L.push("");
  L.push(`— Growth Opt Playbook · Marketing Response Analysis (MMM)`);
  return L.join("\n");
}

// MMM 기여 분해 전 과정 설명 문서(평어 + 수학·통계 상세 + 현재 결과 요약).
export function buildMmmGuideDoc(mmm, targetKo, locale = "ko") {
  if (locale === "en") return buildMmmGuideDocEn(mmm, targetKo);
  const L = [];
  const run = mmm.run || {};
  const isRevenue = mmm.target === "Revenue";
  L.push(`# MMM 기여 분해 — 이 분석은 무엇이고 어떻게 계산하나`);
  L.push("");
  L.push(`대상 지표: ${targetKo} · 생성일: ${_today()}`);
  L.push("");
  L.push(`## 한 줄 요약`);
  L.push(`MMM(Marketing Mix Modeling·마케팅 믹스 모델링)은 "지난 ${targetKo} 성과의 등락을 무엇이 얼마나 만들었나"를 나눠보는 분석입니다. 시즌·추세 같은 비매체 요인과 각 광고 채널의 기여를 공정하게 분해하고, "다음 증액 단위를 어디에 쓰면 가장 효율적인가"까지 안내합니다.`);
  L.push("");
  L.push(`## 무엇을 보여주나 (평어)`);
  L.push(`- **무엇이 성과를 움직였나**: 각 드라이버의 주별 기여값 제곱평균을 전체 합으로 나눈 RMS 기여 크기 비중. 인과 기여율이나 Shapley R²가 아닙니다.`);
  L.push(`- **다음 예산은 어디로**: 지금 지출 수준에서 원본 통화 기준 실무 증액 단위(KRW 100만원·USD 1,000)를 더 쓸 때 채널별로 늘어나는 ${isRevenue ? `${targetKo} 금액` : `${targetKo} 인원`}과 90% 구간. 상위 구간이 겹치면 단일 순위를 확정하지 않습니다.`);
  L.push(`- **실제 vs 모델**: 모델이 실제 성과를 얼마나 잘 따라갔는지(오차), 어느 주가 크게 튀었는지.`);
  L.push("");
  L.push(`## 수학·통계 상세 (전문가용)`);
  L.push("");
  L.push(`### 1. Adstock (광고 잔효)`);
  L.push(`광고 효과는 집행한 주에만 나타나지 않고 다음 주로 이어집니다(잔향). adstockₜ = spendₜ + λ·adstockₜ₋₁ 형태의 기하 감쇠를 만듭니다. 채널별 α·반포화점·Hill 기울기 후보를 한 채널씩 바꿔 다시 적합하고 BIC 가중 평균합니다. 모든 채널 조합을 함께 샘플링한 joint MCMC posterior는 아닙니다.`);
  L.push("");
  L.push(`### 2. Saturation (수확체감)`);
  L.push(`같은 채널도 많이 쓸수록 통화 1단위당 효과가 줄어듭니다. Hill 곡선 ` + "`adstock^s/(ec^s + adstock^s)`" + `으로 반응을 만들며, 지출이 커질수록 한계효과가 감소합니다. ${isRevenue ? '"추가 지출당 매출"' : '"증액 단위당 추가 인원"'}은 현재 지출점에서 실무 증액 단위를 더한 반응 차이입니다.`);
  L.push("");
  L.push(`### 3. 추세 방향 제약 + Empirical-Bayes 공동 추정`);
  L.push(`먼저 약 78주 범위를 보는 저주파 곡선에서 장기 추세의 꺾이는 위치와 구간별 상승·하락 방향만 정합니다. 이때 기울기 숫자나 기여 인원은 확정하지 않습니다. 다음으로 추세 크기 + 데이터 길이에 따라 4~8개 중심점을 쓰는 부드러운 비즈니스 계절성 + 업계 현황 + 휴일·구조변화 + Σβᵢ·Hill(adstockᵢ)을 같은 모델에서 함께 추정합니다. 따라서 업계나 계절이 장기 변화를 먼저 선점하지 않으며, 추세는 앞서 확인한 방향을 거슬러 적합되지 않습니다. 완전 계층형 joint MCMC posterior는 아닙니다.`);
  L.push("");
  L.push(`### 4. 효과 신뢰도`);
  L.push(`효과 판정에서 legacy OLS p값은 제거했습니다. VIF와 채널 상관은 효과 확률이 아니라 식별·예산 보류 진단으로 유지합니다. 이 화면의 "효과 양수 확률"은 후보별 posterior를 BIC 가중 평균한 β>0 확률입니다. 90% 구간은 profile posterior 정규 혼합 CDF의 5%·95% 분위수를 직접 풀어 계산합니다. 다만 모든 채널 조합을 함께 샘플링한 joint MCMC posterior는 아닙니다.`);
  L.push("");
  L.push(`### 5. 추세 방향 선택`);
  L.push(`약 78주 저주파 곡선으로 주간 광고 출렁임과 연간 파형을 누른 뒤 꺾임 0·1·2개 후보를 BIC로 비교합니다. 여기서는 구간별 상승·하락 방향만 가져오고 진단용 기울기 숫자는 버립니다. 최종 추세 크기는 업계·비즈니스 계절성·광고와 함께 다시 추정되므로, 방향은 안정적으로 유지하면서 기여 크기는 데이터 전체가 결정합니다.`);
  L.push("");
  L.push(`### 6. 실험 prior의 mROI 읽기`);
  L.push(`실험 prior는 변환 feature 계수 단위로 적용되지만, 화면에서는 현재 주간 spend 운용점에서 Hill 곡선의 미분을 곱해 "추가 spend 1단위당 기대 KPI"인 mROI로도 표시합니다. 이 값은 기존 prior를 별도 샘플링한 ROI posterior가 아니며, Fieller·jackknife로 계산된 실험 불확실성을 변환한 참고값입니다.`);
  L.push("");
  L.push(`### 7. 기여 변동`);
  L.push(`각 드라이버의 주별 기여값 제곱평균을 전체 합으로 나눈 RMS 기여 크기 비중입니다. 인과 확정·설명된 R² 배분·Shapley 값이 아닙니다.`);
  L.push("");
  L.push(`### 8. 주별 기여 분해 (decomposition)`);
  L.push(`매주 실제값을 기본 수요·추세, 계절, 휴일·구조변화, 매체 절대기여로 쪼갭니다. 양수 매체 계수는 저지출 주에도 음수가 되지 않도록 원 단위 반응값으로 표시합니다. RMSE·MAPE로 실제 적합도를 확인합니다.`);
  L.push("");
  if (run.shapley && run.shapley.rows && run.shapley.rows.length) {
    L.push(`## 현재 데이터 RMS 기여 크기 비중 (정규화 합계 100%)`);
    [...run.shapley.rows].sort((a, b) => b.r2_share - a.r2_share).forEach((r) => {
      L.push(`- ${r.driver}: ${(r.pct || 0).toFixed(1)}%`);
    });
    L.push("");
  }
  L.push(`## 꼭 기억할 것`);
  L.push(`MMM는 관측 데이터 기반 **연관·기술(descriptive) 모델**이지 인과 확정이 아닙니다. "다음 예산 순위"는 반응곡선상의 가설이며, 실제 증분·ROI 확정은 홀드아웃 실험에서 합니다. 단기 캠페인 단위 배분은 예산 배분 시뮬레이터(5-3)를 쓰세요.`);
  L.push("");
  L.push(`— Growth Opt Playbook · 마케팅 반응 분석(MMM)`);
  return L.join("\n");
}

// English version of buildMmmGuideDoc.
export function buildMmmGuideDocEn(mmm, targetLabel) {
  const L = [];
  const run = mmm.run || {};
  const isRevenue = mmm.target === "Revenue";
  L.push(`# MMM Contribution Decomposition — what this analysis is and how it's computed`);
  L.push("");
  L.push(`Target metric: ${targetLabel} · Generated: ${_today()}`);
  L.push("");
  L.push(`## One-line summary`);
  L.push(`MMM (Marketing Mix Modeling) breaks down "what made last period's ${targetLabel} performance go up or down, and by how much." It fairly decomposes contribution across non-media factors (season, trend) and each ad channel, and guides you on where the next practical budget increment should go.`);
  L.push("");
  L.push(`## What it shows (plain language)`);
  L.push(`- **What moved performance**: RMS contribution-magnitude share, calculated from each driver's mean squared weekly contribution. It is not causal attribution or Shapley R².`);
  L.push(`- **Where the next budget should go**: channels compared by ${isRevenue ? `the additional ${targetLabel}` : `how many extra ${targetLabel}`} produced by a source-currency practical increment (KRW 1 million or USD 1,000), with a 90% interval. No single winner is declared when top intervals overlap.`);
  L.push(`- **Actual vs. model**: how well the model tracked actual performance (error), and which weeks spiked.`);
  L.push("");
  L.push(`## Math & statistics detail (for specialists)`);
  L.push("");
  L.push(`### 1. Adstock (ad carryover)`);
  L.push(`Ad effects carry into later weeks. We build geometric adstock candidates, adstockₜ = spendₜ + λ·adstockₜ₋₁. For each channel, α, half-saturation, and Hill-slope candidates are changed one channel at a time, refit, and BIC-weighted. This is not a jointly sampled all-channel MCMC posterior.`);
  L.push("");
  L.push(`### 2. Saturation (diminishing returns)`);
  L.push(`Even the same channel yields less per currency unit as spend grows. A Hill response curve makes marginal effect shrink at higher spend. ${isRevenue ? '"incremental revenue per added spend"' : '"additional people per budget increment"'} is the response difference after adding the practical budget increment at current spend.`);
  L.push("");
  L.push(`### 3. Direction-constrained joint empirical-Bayes approximation`);
  L.push(`The model first uses a roughly 78-week low-frequency curve to identify only the trend breakpoints and whether each segment rises or falls; it does not fix slope magnitudes or contribution counts. Trend magnitude, a smooth business-seasonality pattern with 4–8 centers depending on history length, industry movement, holidays/regime changes, and Σβᵢ·Hill(adstockᵢ) are then estimated together. Industry or seasonality therefore cannot pre-claim the long movement, while the fitted trend cannot reverse the identified direction.`);
  L.push("");
  L.push(`### 4. Effect confidence`);
  L.push(`Legacy OLS p-values are not used for effect decisions. VIF and media correlation remain as identification and budget-hold diagnostics, not effect probabilities. P(effect > 0) is BIC-weighted across candidate posteriors. The 90% interval directly solves the 5th and 95th percentiles of the profile-posterior normal-mixture CDF, but it is not a jointly sampled all-channel MCMC posterior.`);
  L.push("");
  L.push(`### 5. Trend-direction selection`);
  L.push(`After suppressing weekly ad pulses and annual waves with a roughly 78-week low-frequency curve, the model compares zero-, one-, and two-breakpoint paths by BIC. It retains only each segment's rising/falling direction and discards the diagnostic slope magnitude. Final trend magnitudes are estimated jointly with industry, business seasonality, and media.`);
  L.push("");
  L.push(`### 6. Reading experiment-prior mROI`);
  L.push(`Experiment priors remain applied in transformed-feature coefficient units. The UI also multiplies the coefficient prior by the Hill derivative at the current weekly spend to show marginal KPI per added spend (mROI). This is a transformed display of the existing prior uncertainty, not a separately sampled ROI posterior.`);
  L.push("");
  L.push(`### 7. Contribution variation`);
  L.push(`RMS contribution-magnitude share divides each driver's mean squared weekly contribution by the total. It is not causal attribution, allocated explained R², or a Shapley value.`);
  L.push("");
  L.push(`### 8. Weekly contribution decomposition`);
  L.push(`Splits each week into base demand/trend, seasonality, holidays/regime change, and absolute media contribution. Positive media effects remain positive at low spend. RMSE/MAPE measure fit to actuals.`);
  L.push("");
  if (run.shapley && run.shapley.rows && run.shapley.rows.length) {
    L.push(`## Current-data RMS contribution-magnitude share (normalized total: 100%)`);
    [...run.shapley.rows].sort((a, b) => b.r2_share - a.r2_share).forEach((r) => {
      L.push(`- ${r.driver}: ${(r.pct || 0).toFixed(1)}%`);
    });
    L.push("");
  }
  L.push(`## Key takeaway`);
  L.push(`MMM is an observational-data **association/descriptive model**, not a causal confirmation. The "next budget ranking" is a hypothesis based on the response curve — actual incrementality/ROI confirmation should come from a holdout experiment. For short-term campaign-level allocation, use the Budget Allocation simulator (5-3).`);
  L.push("");
  L.push(`— Growth Opt Playbook · Marketing Response Analysis (MMM)`);
  return L.join("\n");
}

export const FORECAST_INTERVAL_MIN_FOLDS = 8;

export function forecastSelectionIntervalMeta(selection, horizon) {
  if (!selection) return null;
  const nested = selection.nested || null;
  const production = selection.productionSelected || selection.selected || null;
  const minimumFolds = Number(nested?.intervalCalibrationMinFolds)
    || FORECAST_INTERVAL_MIN_FOLDS;
  const observedFolds = Number(nested?.developmentFolds?.length)
    || Number(production?.selectionFolds)
    || 0;
  const margins = production?.blendMargins;
  const eligible = nested?.intervalCalibrationEligible === true
    && observedFolds >= minimumFolds
    && Array.isArray(margins)
    && margins.length >= horizon;
  return { eligible, observedFolds, minimumFolds };
}

export function forecastComponentSelections(fc) {
  if (fc?.isPaidOrganicSplit) {
    return (fc.platformForecasts || []).flatMap((part) =>
      Object.values(part.componentForecasts || {}).map((component) => component?.rollingSelection),
    ).filter(Boolean);
  }
  if (fc?.isAdditiveTotal) {
    return (fc.components || []).map((component) => component?.rollingSelection).filter(Boolean);
  }
  return [];
}

export function forecastIntervalContract(fc) {
  const horizon = Math.max(1, Number(fc?.horizon) || fc?.predFut?.length || 1);
  if (!fc) {
    return {
      kind: "point",
      method: "point-forecast-no-empirical-interval",
      observedFolds: 0,
      minimumFolds: FORECAST_INTERVAL_MIN_FOLDS,
    };
  }
  if (fc.isStructural) {
    const observedFolds = Number(fc.intervalCalibrationFoldCount)
      || Number(fc.intervalObservedOuterFolds)
      || 0;
    const minimumFolds = Number(fc.intervalCalibrationMinFolds)
      || FORECAST_INTERVAL_MIN_FOLDS;
    const isCalibrated = fc.intervalCalibrationEligible === true
      && observedFolds >= minimumFolds;
    return {
      kind: isCalibrated ? "point-plus-outer-oos-p90" : "point",
      method: isCalibrated
        ? "point-forecast-plus-nested-outer-oos-p90-absolute-error"
        : "point-forecast-no-empirical-interval",
      observedFolds,
      minimumFolds,
    };
  }
  if (fc.isAnnualAnalog) {
    const observedFolds = Number(fc.intervalCalibrationFoldCount)
      || Number(fc.intervalObservedOuterFolds)
      || 0;
    const minimumFolds = Number(fc.intervalCalibrationMinFolds)
      || FORECAST_INTERVAL_MIN_FOLDS;
    const isCalibrated = fc.intervalCalibrationEligible === true
      && observedFolds >= minimumFolds;
    return {
      kind: isCalibrated ? "point-plus-outer-oos-p90" : "point",
      method: isCalibrated
        ? "point-forecast-plus-nested-outer-oos-p90-absolute-error"
        : "point-forecast-no-empirical-interval",
      observedFolds,
      minimumFolds,
    };
  }
  const componentSelections = forecastComponentSelections(fc);
  if (componentSelections.length) {
    const components = componentSelections
      .map((selection) => forecastSelectionIntervalMeta(selection, horizon))
      .filter(Boolean);
    const allEligible = components.length === componentSelections.length
      && components.every((component) => component.eligible);
    return {
      kind: allEligible ? "component-oos-envelope" : "model",
      method: allEligible
        ? "sum-of-component-model-intervals-widened-by-component-outer-oos-p90"
        : "sum-of-component-model-intervals-no-total-oos-calibration",
      observedFolds: components.length
        ? Math.min(...components.map((component) => component.observedFolds))
        : 0,
      minimumFolds: components.length
        ? Math.max(...components.map((component) => component.minimumFolds))
        : FORECAST_INTERVAL_MIN_FOLDS,
    };
  }
  const aggregate = forecastSelectionIntervalMeta(fc.rollingSelection, horizon);
  if (aggregate?.eligible) {
    return {
      kind: "aggregate-oos-envelope",
      method: "model-interval-widened-by-nested-outer-oos-p90",
      observedFolds: aggregate.observedFolds,
      minimumFolds: aggregate.minimumFolds,
    };
  }
  return {
    kind: "model",
    method: "model-reference-interval-no-outer-oos-calibration",
    observedFolds: aggregate?.observedFolds || 0,
    minimumFolds: aggregate?.minimumFolds || FORECAST_INTERVAL_MIN_FOLDS,
  };
}

export function forecastIntervalNote(fc, locale = "ko") {
  const meta = forecastIntervalContract(fc);
  const en = locale === "en";
  if (meta.kind === "point-plus-outer-oos-p90") {
    return en
      ? `Each point forecast is shown ± its horizon-specific P90 absolute error from ${meta.observedFolds} nested outer-OOS origins. No fitted-model interval is added; this is not a guaranteed 90% coverage or causal interval.`
      : `각 점 예측에 nested 바깥 OOS ${meta.observedFolds}회의 예측거리별 P90 절대오차를 ±로 더하고 뺀 참고범위입니다. 적합 모델 자체 구간은 더하지 않으며, 90% 포함률이나 인과효과를 보장하지 않습니다.`;
  }
  if (meta.kind === "aggregate-oos-envelope") {
    return en
      ? `The fitted-model interval is widened to at least horizon-specific P90 absolute errors from ${meta.observedFolds} nested outer-OOS origins. It is not a guaranteed 90% coverage or causal interval.`
      : `적합 모델 구간을 nested 바깥 OOS ${meta.observedFolds}회의 예측거리별 P90 절대오차 이상으로 넓힌 참고범위입니다. 90% 포함률이나 인과효과를 보장하지 않습니다.`;
  }
  if (meta.kind === "component-oos-envelope") {
    return en
      ? `Component intervals, each widened by component-level outer-OOS errors, are summed. This is not a Total-level P90 interval and does not guarantee Total coverage.`
      : `하위 성분별 바깥 OOS 오차로 넓힌 구간을 합산했습니다. Total 자체의 P90 구간이 아니며 Total 포함률을 보장하지 않습니다.`;
  }
  if (meta.kind === "point") {
    return en
      ? `Only ${meta.observedFolds} independent outer-OOS origins were available; at least ${meta.minimumFolds} are required. No empirical P90 interval is shown.`
      : `독립 바깥 OOS가 ${meta.observedFolds}회뿐이라 최소 ${meta.minimumFolds}회 기준에 미달합니다. 경험적 P90 구간은 표시하지 않습니다.`;
  }
  return en
    ? `The displayed bounds come from the fitted model only. With ${meta.observedFolds} independent outer-OOS origins, the minimum ${meta.minimumFolds} required for empirical P90 widening was not met.`
    : `표시 범위는 적합 모델 자체의 참고폭입니다. 독립 바깥 OOS ${meta.observedFolds}회로는 경험적 P90 보정 최소 ${meta.minimumFolds}회에 미달합니다.`;
}

export function forecastExcelComponentType(model) {
  if (model?.componentType === "organic" || model?.componentType === "paid") {
    return model.componentType;
  }
  if (model?.target === "OrganicRegs") return "organic";
  if (model?.target === "PaidRegs") return "paid";
  return null;
}

export function forecastCostRefKey(platform, channelKey, futureIndex) {
  return `${platform || "model"}::${channelKey}::${futureIndex}`;
}

export function forecastEffectiveCostFormula(requestedExpression, range) {
  const nonnegative = `MAX(0,${requestedExpression})`;
  if (!Number.isFinite(range?.min) || !Number.isFinite(range?.max)) {
    return nonnegative;
  }
  return `MIN(${csvNum(range.max, 10)},MAX(${csvNum(range.min, 10)},${nonnegative}))`;
}

export function forecastHasExactFormulaModels(forecast) {
  const models = (forecast?.excelModels || []).filter((model) => model?.names?.length);
  if (!models.length || !models.every((model) => model.formulaCapability === "exact")) {
    return false;
  }
  if (!forecast?.isPaidOrganicSplit) return true;
  const platforms = (forecast.platformForecasts || []).length
    ? [...new Set(forecast.platformForecasts.map((part) => part?.platform).filter(Boolean))]
    : [...new Set(models.map((model) => model.platform).filter(Boolean))];
  return platforms.length > 0 && platforms.every((platform) =>
    ["organic", "paid"].every((componentType) =>
      models.some((model) =>
        model.platform === platform
        && forecastExcelComponentType(model) === componentType)));
}

export function buildBayesianForecastCsv(fc, target, locale, sourceCurrency, displayCurrency) {
  const tx = (ko, en) => (locale === "en" ? en : ko);
  const sourceModels = (fc.excelModels || []).filter((model) => model?.names?.length);
  if (!forecastHasExactFormulaModels(fc)) return null;
  const models = sourceModels;
  const isPaidOrganicLive = fc.isPaidOrganicSplit === true
    && forecastHasExactFormulaModels(fc);
  const livePlatforms = [...new Set(models.map((model) => model.platform).filter(Boolean))];
  const liveScope = livePlatforms.length > 1
    ? tx("Android·iOS·Total", "Android, iOS, and Total")
    : tx(`${livePlatforms[0] || "OS"} 예측`, `${livePlatforms[0] || "OS"} forecast`);
  const lines = [];
  const push = (row) => lines.push(row.map(csvQ).join(","));
  push([
    tx("# 도구", "# Tool"),
    isPaidOrganicLive
      ? "Empirical-Bayes Paid/Organic MMM Forecast (5-18) · live Excel formulas"
      : "Empirical-Bayes MMM Forecast (5-18) · live Excel formulas",
  ]);
  push([tx("# 대상", "# Target"), `${mmmTargetDisplay(target, locale)} (${target})`]);
  push([tx("# 원본 통화", "# Source currency"), sourceCurrency]);
  push([tx("# 화면 표시 통화", "# Display currency"), displayCurrency]);
  push([
    tx("# 사용법", "# How to use"),
    isPaidOrganicLive
      ? tx(
        `아래 OS별 미래 Cost 입력만 수정하세요. 같은 Cost가 Organic halo와 Paid 예측 수준 모델에 함께 연결되고, ${liveScope}까지 즉시 재계산됩니다.`,
        `Edit only the future Cost inputs by OS below. The same Cost cells feed both the Organic-halo and Paid-level models, then recalculate the ${liveScope} immediately.`,
      )
      : tx("spend를 수정하면 adstock → 자동 선택된 선형/log1p/Hill 변환 → 예측이 즉시 재계산됩니다. 단순 기준선과 혼합된 모델은 선택된 회귀 비중만큼만 spend에 반응합니다.", "Editing spend recalculates adstock → the auto-selected identity/log1p/Hill transform → forecast immediately. When validation selected a naive blend, only the selected regression share responds to spend."),
  ]);
  push([tx("# 참고 범위", "# Reference interval"), forecastIntervalNote(fc, locale)]);
  push([
    tx("# Cost 수정 후 참고범위", "# Reference range after a Cost edit"),
    tx(
      "하한·상한은 다운로드 시점의 주차별 비대칭 오차폭을 고정한 채 새 점예측을 따라 이동합니다. Cost 수정 뒤 새로 재추정·재검증한 예측구간이 아닙니다.",
      "Lower and upper bounds move with the new point forecast while keeping the download-time asymmetric error widths fixed. They are not newly estimated or revalidated intervals after a Cost edit.",
    ),
  ]);
  push([
    tx("# 예측 분해", "# Forecast decomposition"),
    isPaidOrganicLive
      ? tx(
        "OS별 Total = Organic 기저 + Spend 연관 halo + Cost 조건부 Paid 예측 수준입니다. Organic은 Total−Paid 실측, Paid는 PaidRegs 실측에 따로 적합해 중복 합산하지 않습니다. Paid 값에는 회귀 절편이 포함될 수 있으며 관측 연관이지 인과 증명은 아닙니다.",
        "For each OS, Total = Organic baseline + spend-associated halo + the Cost-conditional Paid predicted level. Organic is fit to observed Total−Paid and Paid to observed PaidRegs, so the components do not double-count. The Paid level may include a regression intercept; these are observational associations, not causal proof.",
      )
      : tx("organic_predicted_live는 Performance 비용을 0으로 둔 예측입니다. Branding 채널이 있으면 Branding은 이 값에 남습니다. performance_predicted_live는 0원 대비 Performance 절대 반응이며 두 열의 합은 fitted_or_forecast_live와 같습니다.", "organic_predicted_live is the forecast with Performance spend set to zero; mapped Branding remains in this value. performance_predicted_live is the absolute Performance response versus zero spend, and the two columns sum to fitted_or_forecast_live."),
  ]);
  if (isPaidOrganicLive) {
    push([
      tx("# Cost 범위", "# Cost range"),
      tx(
        "입력 Cost는 요청값입니다. 각 모델 계산표의 effective_spend는 해당 모델 학습창에서 관측된 최소~최대 범위로 제한됩니다. 범위 밖 입력은 새로운 검증 결과가 아닙니다.",
        "Cost inputs are requested values. effective_spend in each model table is constrained to that model's observed minimum–maximum range. An out-of-range edit is not a newly validated result.",
      ),
    ]);
    if (fc.exportScenarioGate) {
      const isGateOpen = fc.exportScenarioGate.eligible === true;
      push([
        tx("# Cost 시나리오 게이트", "# Cost-scenario gate"),
        isGateOpen
          ? tx("통과", "passed")
          : tx("잠김 · 운영 판단에 사용 금지", "locked · do not use for operating decisions"),
      ]);
      push([
        tx("# 게이트 사유", "# Gate reasons"),
        (fc.exportScenarioGate.reasons || []).join("|"),
      ]);
    }
  }

  const futureCostRefs = new Map();
  const paidModelByPlatform = new Map();
  if (isPaidOrganicLive) {
    models
      .filter((model) => forecastExcelComponentType(model) === "paid")
      .forEach((model) => {
        paidModelByPlatform.set(model.platform, model);
        lines.push("");
        push([
          tx(`# ${model.platform} 미래 Cost 입력 — 이 표만 수정`, `# ${model.platform} future Cost inputs — edit this table only`),
        ]);
        push([
          "period",
          "segment",
          ...(model.chans || []).map((channel) => `cost_${channel.key}_${sourceCurrency}`),
        ]);
        (model.futLabels || []).forEach((label, futureIndex) => {
          const rowNumber = lines.length + 1;
          const values = (model.chans || []).map((channel, channelIndex) => {
            futureCostRefs.set(
              forecastCostRefKey(model.platform, channel.key, futureIndex),
              `$${csvColL(2 + channelIndex)}$${rowNumber}`,
            );
            return csvNum(
              model.requestedFutSpendByKey?.[channel.key]?.[futureIndex]
                ?? model.futSpendByKey?.[channel.key]?.[futureIndex],
              10,
            );
          });
          push([csvSafeLiteral(label), "forecast_cost_input", ...values]);
        });
      });
  }

  const tables = [];
  models.forEach((model) => {
    lines.push("");
    const componentType = forecastExcelComponentType(model);
    const componentLabel = componentType === "organic"
      ? tx("Organic 기저 + Spend 연관 halo", "Organic baseline + spend-associated halo")
      : componentType === "paid"
        ? tx("Cost 조건부 Paid 예측 수준", "Cost-conditional Paid predicted level")
        : "";
    push([
      tx("# 모델", "# Model"),
      `${model.platform} · ${model.target}${componentLabel ? ` · ${componentLabel}` : ""}`,
    ]);
    const requestedBlendWeight = Number(model.selectedBlend?.regressionWeight);
    const blendWeight = model.blendApplied && Number.isFinite(requestedBlendWeight)
      ? Math.max(0, Math.min(1, requestedBlendWeight))
      : 1;
    const hasLiveBlend = blendWeight < 1
      && model.blendBaselineFut?.length === model.futLabels?.length;
    push([
      tx("# 선택된 미래 결합", "# Selected future blend"),
      hasLiveBlend
        ? tx(
          `회귀 ${(blendWeight * 100).toFixed(0)}% + ${model.selectedBlend?.baselineId || "naive"} ${((1 - blendWeight) * 100).toFixed(0)}%`,
          `${(blendWeight * 100).toFixed(0)}% regression + ${((1 - blendWeight) * 100).toFixed(0)}% ${model.selectedBlend?.baselineId || "naive"}`,
        )
        : tx("회귀 100%", "100% regression"),
    ]);
    push([
      tx("# 결합 계산", "# Blend behavior"),
      hasLiveBlend
        ? tx("단순 기준선 부분은 선택된 학습 이력에서 고정하며, spend 수정 반응은 선택된 회귀 비중만큼만 반영합니다.", "The naive component stays fixed from the selected training history; spend edits affect only the selected regression share.")
        : tx("모든 미래 예측이 아래 회귀 수식으로 재계산됩니다.", "Every future prediction is recalculated from the regression formulas below."),
    ]);
    push([tx("# 계수·표준화 파라미터 (수정하면 아래 예측도 반영)", "# Coefficients and standardization (edits flow into forecast)")]);
    push(["term", "coefficient", "feature_mean", "feature_scale"]);
    const interceptRow = lines.length + 1;
    push(["(Intercept)", csvNum(model.intercept, 10), "", ""]);
    const featureRows = {};
    model.names.forEach((name, index) => {
      featureRows[name] = lines.length + 1;
      push([csvSafeLiteral(name), csvNum(model.beta[index], 10), csvNum(model.featureMeans[index], 10), csvNum(model.featureScales[index] || 1, 10)]);
    });
    lines.push("");
    push([tx("# 채널 변환 파라미터", "# Channel transform parameters")]);
    push([
      "channel",
      "adstock_alpha",
      "hill_ec",
      "hill_slope",
      "transform_family",
      `observed_spend_min_${sourceCurrency}`,
      `observed_spend_max_${sourceCurrency}`,
    ]);
    const channelRows = {};
    (model.chans || []).forEach((channel) => {
      const params = model.params[channel.key] || {};
      const spendRange = model.spendRanges?.[channel.key] || {};
      channelRows[channel.key] = lines.length + 1;
      push([
        csvSafeLiteral(channel.key),
        csvNum(params.alpha, 10),
        csvNum(params.ec, 10),
        csvNum(params.slope, 10),
        params.family || "hill",
        csvNum(spendRange.min, 10),
        csvNum(spendRange.max, 10),
      ]);
    });
    lines.push("");
    push([tx("# 시계열 — spend 수정 → adstock → 선택 변환 → 예측 자동 연쇄", "# Time series — edit spend → adstock → selected transform → forecast live chain")]);
    const decompositionColumns = 2;
    const intervalColumns = 2;
    const fixedColumns = 5 + decompositionColumns + intervalColumns;
    const featureStart = fixedColumns;
    const adstockStart = featureStart + model.names.length;
    const hillStart = adstockStart + model.chans.length;
    const logStart = hillStart + model.chans.length;
    const spendStart = logStart + model.chans.length;
    const featureCol = (index) => csvColL(featureStart + index);
    const adstockCol = (index) => csvColL(adstockStart + index);
    const hillCol = (index) => csvColL(hillStart + index);
    const logCol = (index) => csvColL(logStart + index);
    const spendCol = (index) => csvColL(spendStart + index);
    const mediaFeatureIndexes = model.names
      .map((name, featureIndex) => ({ name, featureIndex }))
      .filter(({ name }) => name.startsWith("media_"))
      .map(({ featureIndex }) => featureIndex);
    const performanceFeatureIndexes = model.names
      .map((name, featureIndex) => ({ name, featureIndex }))
      .filter(({ name }) => {
        if (!name.startsWith("media_")) return false;
        const channelKey = name.slice(6);
        const channel = model.chans.find((item) => item.key === channelKey);
        return channel?.kind !== "brand";
      })
      .map(({ featureIndex }) => featureIndex);
    const isOrganicSplitModel = isPaidOrganicLive && componentType === "organic";
    const isPaidSplitModel = isPaidOrganicLive && componentType === "paid";
    const isExactSplitDecomposition = isOrganicSplitModel || isPaidSplitModel;
    const zeroedMediaIndexes = isExactSplitDecomposition
      ? mediaFeatureIndexes
      : performanceFeatureIndexes;
    push([
      "t",
      "period",
      "segment",
      "actual",
      "fitted_or_forecast_live",
      isOrganicSplitModel
        ? "organic_baseline_live"
        : isPaidSplitModel
          ? "paid_at_zero_cost_live"
          : "organic_predicted_live",
      isOrganicSplitModel
        ? "organic_spend_halo_live"
        : isPaidSplitModel
          ? "paid_spend_associated_live"
          : "performance_predicted_live",
      "lower_live",
      "upper_live",
      ...model.names.map(csvSafeLiteral),
      ...model.chans.map((channel) => `adstock_${channel.key}`),
      ...model.chans.map((channel) => `hill_${channel.key}`),
      ...model.chans.map((channel) => `ln1p_adstock_${channel.key}_audit`),
      ...model.chans.map((channel) =>
        `${isPaidOrganicLive ? "effective_spend" : "spend"}_${channel.key}_${sourceCurrency}`),
    ]);
    const tableStart = lines.length + 1;
    const historyLength = model.histLabels.length;
    const horizon = model.futLabels.length;
    for (let index = 0; index < historyLength + horizon; index++) {
      const rowNumber = lines.length + 1;
      const isHistory = index < historyLength;
      const futureIndex = index - historyLength;
      const rawFeatures = isHistory ? model.rawFeatureHistory[index] || [] : model.futureRawFeatures[futureIndex] || [];
      const offset = isHistory ? model.historyOffset[index] || 0 : model.futureOffset[futureIndex] || 0;
      const values = model.names.map((name, featureIndex) => {
        const channelIndex = model.chans.findIndex((channel) => name === `media_${channel.key}`);
        if (channelIndex < 0) return csvNum(rawFeatures[featureIndex], 10);
        const family = model.params[model.chans[channelIndex].key]?.family || "hill";
        const transformedColumn = family === "identity"
          ? adstockCol(channelIndex)
          : family === "log1p"
            ? logCol(channelIndex)
            : hillCol(channelIndex);
        return `=${transformedColumn}${rowNumber}`;
      });
      const adstock = model.chans.map((channel, channelIndex) => {
        const paramRow = channelRows[channel.key];
        return index === 0
          ? `=${spendCol(channelIndex)}${rowNumber}`
          : `=${spendCol(channelIndex)}${rowNumber}+$B$${paramRow}*${adstockCol(channelIndex)}${rowNumber - 1}`;
      });
      const hill = model.chans.map((channel, channelIndex) => {
        const paramRow = channelRows[channel.key];
        const ad = `${adstockCol(channelIndex)}${rowNumber}`;
        return `=${ad}^$D$${paramRow}/($C$${paramRow}^$D$${paramRow}+${ad}^$D$${paramRow})`;
      });
      const logs = model.chans.map((_, channelIndex) => `=LN(1+${adstockCol(channelIndex)}${rowNumber})`);
      const spend = model.chans.map((channel) => {
        if (isHistory || !isPaidOrganicLive) {
          return csvNum(
            isHistory
              ? model.histSpendByKey[channel.key]?.[index]
              : model.futSpendByKey[channel.key]?.[futureIndex],
            10,
          );
        }
        const directRef = futureCostRefs.get(
          forecastCostRefKey(model.platform, channel.key, futureIndex),
        );
        if (componentType === "paid" && directRef) {
          return `=${forecastEffectiveCostFormula(
            directRef,
            model.spendRanges?.[channel.key],
          )}`;
        }
        if (componentType !== "organic") {
          return directRef
            ? `=${forecastEffectiveCostFormula(
              directRef,
              model.spendRanges?.[channel.key],
            )}`
            : csvNum(model.futSpendByKey[channel.key]?.[futureIndex], 10);
        }
        const group = (model.aggregateMediaGroups || [])
          .find((candidate) => candidate.key === channel.key);
        const paidModel = paidModelByPlatform.get(model.platform);
        const linkedMembers = (group?.members || [channel.key])
          .map((memberKey) => ({
            ref: futureCostRefs.get(
              forecastCostRefKey(model.platform, memberKey, futureIndex),
            ),
            baseline: paidModel?.requestedFutSpendByKey?.[memberKey]?.[futureIndex]
              ?? paidModel?.futSpendByKey?.[memberKey]?.[futureIndex],
          }))
          .filter((member) => member.ref);
        if (!linkedMembers.length) {
          return directRef
            ? `=${forecastEffectiveCostFormula(
              directRef,
              model.spendRanges?.[channel.key],
            )}`
            : csvNum(model.futSpendByKey[channel.key]?.[futureIndex], 10);
        }
        const groupBaseline = csvNum(
          model.requestedFutSpendByKey?.[channel.key]?.[futureIndex]
            ?? model.futSpendByKey[channel.key]?.[futureIndex],
          10,
        );
        const deltas = linkedMembers.map((member) =>
          `+(${member.ref}-${csvNum(member.baseline, 10)})`).join("");
        return `=${forecastEffectiveCostFormula(
          `(${groupBaseline}${deltas})`,
          model.spendRanges?.[channel.key],
        )}`;
      });
      const linearExpression = "$B$" + interceptRow + model.names.map((name, featureIndex) => {
        const featureRow = featureRows[name];
        return `+$B$${featureRow}*((${featureCol(featureIndex)}${rowNumber}-$C$${featureRow})/$D$${featureRow})`;
      }).join("");
      const offsetExpression = offset ? `+${csvNum(offset, 10)}` : "";
      const restoredRegressionExpression = isHistory
        ? `${linearExpression}${offsetExpression}`
        : `MAX(0,${linearExpression})${offsetExpression}`;
      const predictionExpression = !isHistory && hasLiveBlend
        ? `${csvNum(blendWeight, 10)}*(${restoredRegressionExpression})+${csvNum(1 - blendWeight, 10)}*${csvNum(model.blendBaselineFut[futureIndex], 10)}`
        : restoredRegressionExpression;
      const prediction = isHistory
        ? `=${predictionExpression}`
        : `=MAX(0,${predictionExpression})`;
      const performanceExpression = performanceFeatureIndexes.length
        ? performanceFeatureIndexes.map((featureIndex) => {
          const name = model.names[featureIndex];
          const featureRow = featureRows[name];
          return `$B$${featureRow}*(${featureCol(featureIndex)}${rowNumber}/$D$${featureRow})`;
        }).join("+")
        : "0";
      let organicPrediction;
      let performancePrediction;
      if (isExactSplitDecomposition) {
        const baselineLinearExpression = "$B$" + interceptRow + model.names
          .map((name, featureIndex) => {
            const featureRow = featureRows[name];
            const value = zeroedMediaIndexes.includes(featureIndex)
              ? "0"
              : `${featureCol(featureIndex)}${rowNumber}`;
            return `+$B$${featureRow}*((${value}-$C$${featureRow})/$D$${featureRow})`;
          })
          .join("");
        const restoredBaselineExpression = isHistory
          ? `${baselineLinearExpression}${offsetExpression}`
          : `MAX(0,MAX(0,${baselineLinearExpression})${offsetExpression})`;
        const baselineExpression = !isHistory && hasLiveBlend
          ? `${csvNum(blendWeight, 10)}*(${restoredBaselineExpression})+${csvNum(1 - blendWeight, 10)}*${csvNum(model.blendBaselineFut[futureIndex], 10)}`
          : restoredBaselineExpression;
        organicPrediction = isHistory
          ? `=${baselineExpression}`
          : `=MAX(0,${baselineExpression})`;
        performancePrediction = `=${csvColL(4)}${rowNumber}-${csvColL(5)}${rowNumber}`;
      } else {
        performancePrediction = !isHistory && hasLiveBlend
          ? `=MAX(0,${csvNum(blendWeight, 10)}*(${performanceExpression}))`
          : `=MAX(0,${performanceExpression})`;
        organicPrediction = `=${csvColL(4)}${rowNumber}-${csvColL(6)}${rowNumber}`;
      }
      const lowerMargin = isHistory
        ? null
        : model.futureLowerMargins?.[futureIndex]
          ?? model.futureMargins?.[futureIndex]
          ?? 0;
      const upperMargin = isHistory
        ? null
        : model.futureUpperMargins?.[futureIndex]
          ?? model.futureMargins?.[futureIndex]
          ?? 0;
      push([
        index + 1,
        csvSafeLiteral(isHistory ? model.histLabels[index] : model.futLabels[futureIndex]),
        isHistory ? "history" : "forecast",
        isHistory ? csvNum(model.actual[index], 10) : "",
        prediction,
        organicPrediction,
        performancePrediction,
        lowerMargin == null ? "" : `=MAX(0,E${rowNumber}-${csvNum(lowerMargin, 10)})`,
        upperMargin == null ? "" : `=E${rowNumber}+${csvNum(upperMargin, 10)}`,
        ...values,
        ...adstock,
        ...hill,
        ...logs,
        ...spend,
      ]);
    }
    tables.push({
      model,
      componentType,
      tableStart,
      historyLength,
      horizon,
    });
  });

  if (isPaidOrganicLive) {
    const platformTables = [...new Set(tables.map((table) => table.model.platform))]
      .map((platform) => {
        const organic = tables.find((table) =>
          table.model.platform === platform && table.componentType === "organic");
        const paid = tables.find((table) =>
          table.model.platform === platform && table.componentType === "paid");
        if (!organic || !paid) return null;
        const historyLength = Math.min(organic.historyLength, paid.historyLength);
        const horizon = Math.min(organic.horizon, paid.horizon);
        lines.push("");
        push([
          tx(
            `# ${platform} = Organic 기저 + halo + Paid (아래도 모두 수식)`,
            `# ${platform} = Organic baseline + halo + Paid (all formulas below)`,
          ),
        ]);
        push([
          "period",
          "segment",
          "actual_total",
          "predicted_total_live",
          "organic_baseline_live",
          "organic_spend_halo_live",
          "organic_total_live",
          "paid_predicted_level_live",
          "lower_live",
          "upper_live",
        ]);
        const tableStart = lines.length + 1;
        for (let index = 0; index < historyLength + horizon; index++) {
          const isHistory = index < historyLength;
          const organicRow = isHistory
            ? organic.tableStart + (organic.historyLength - historyLength) + index
            : organic.tableStart + organic.historyLength + (index - historyLength);
          const paidRow = isHistory
            ? paid.tableStart + (paid.historyLength - historyLength) + index
            : paid.tableStart + paid.historyLength + (index - historyLength);
          const rowNumber = lines.length + 1;
          const label = isHistory
            ? organic.model.histLabels.at(-(historyLength - index))
            : organic.model.futLabels[index - historyLength];
          push([
            csvSafeLiteral(label),
            isHistory ? "history" : "forecast",
            isHistory ? `=D${organicRow}+D${paidRow}` : "",
            `=G${rowNumber}+H${rowNumber}`,
            `=MAX(0,F${organicRow})`,
            `=G${rowNumber}-E${rowNumber}`,
            `=MAX(0,E${organicRow})`,
            `=MAX(0,E${paidRow})`,
            isHistory ? "" : `=MAX(0,H${organicRow}+H${paidRow})`,
            isHistory ? "" : `=MAX(D${rowNumber},I${organicRow}+I${paidRow})`,
          ]);
        }
        return {
          platform,
          tableStart,
          historyLength,
          horizon,
          labels: organic.model.histLabels,
          futureLabels: organic.model.futLabels,
        };
      })
      .filter(Boolean);

    if (platformTables.length > 1) {
      const historyLength = Math.min(...platformTables.map((table) => table.historyLength));
      const horizon = Math.min(...platformTables.map((table) => table.horizon));
      lines.push("");
      push([
        tx(
          "# Total = Android + iOS (아래도 모두 수식)",
          "# Total = Android + iOS (all formulas below)",
        ),
      ]);
      push([
        "period",
        "segment",
        "actual_total",
        "predicted_total_live",
        "organic_baseline_live",
        "organic_spend_halo_live",
        "organic_total_live",
        "paid_predicted_level_live",
        "lower_live",
        "upper_live",
      ]);
      for (let index = 0; index < historyLength + horizon; index++) {
        const isHistory = index < historyLength;
        const refs = platformTables.map((table) => {
          const row = isHistory
            ? table.tableStart + (table.historyLength - historyLength) + index
            : table.tableStart + table.historyLength + (index - historyLength);
          return row;
        });
        const label = isHistory
          ? platformTables[0].labels.at(-(historyLength - index))
          : platformTables[0].futureLabels[index - historyLength];
        const sumRefs = (column) => refs.map((row) => `${column}${row}`).join("+");
        push([
          csvSafeLiteral(label),
          isHistory ? "history" : "forecast",
          isHistory ? `=${sumRefs("C")}` : "",
          `=${sumRefs("D")}`,
          `=${sumRefs("E")}`,
          `=${sumRefs("F")}`,
          `=${sumRefs("G")}`,
          `=${sumRefs("H")}`,
          isHistory ? "" : `=${sumRefs("I")}`,
          isHistory ? "" : `=${sumRefs("J")}`,
        ]);
      }
    }
  } else if (fc.isAdditiveTotal && tables.length === 2) {
    const historyLength = Math.min(...tables.map((table) => table.historyLength));
    const horizon = Math.min(...tables.map((table) => table.horizon));
    lines.push("");
    push([tx("# Total = Android + iOS (아래도 모두 수식)", "# Total = Android + iOS (all formulas below)")]);
    push(["period", "segment", "actual_total", "prediction_total_live", "organic_total_live", "performance_total_live", "lower_total_live", "upper_total_live"]);
    for (let index = 0; index < historyLength + horizon; index++) {
      const isHistory = index < historyLength;
      const refs = tables.map((table) => {
        const row = isHistory
          ? table.tableStart + (table.historyLength - historyLength) + index
          : table.tableStart + table.historyLength + (index - historyLength);
        return { actual: `D${row}`, prediction: `E${row}`, organic: `F${row}`, performance: `G${row}`, lower: `H${row}`, upper: `I${row}` };
      });
      const label = isHistory ? tables[0].model.histLabels.at(-(historyLength - index)) : tables[0].model.futLabels[index - historyLength];
      push([
        csvSafeLiteral(label),
        isHistory ? "history" : "forecast",
        isHistory ? `=${refs.map((ref) => ref.actual).join("+")}` : "",
        `=${refs.map((ref) => ref.prediction).join("+")}`,
        `=${refs.map((ref) => ref.organic).join("+")}`,
        `=${refs.map((ref) => ref.performance).join("+")}`,
        isHistory ? "" : `=${refs.map((ref) => ref.lower).join("+")}`,
        isHistory ? "" : `=${refs.map((ref) => ref.upper).join("+")}`,
      ]);
    }
  }
  return lines;
}

/* ── §7 살아있는 수식 예측 CSV (index downloadMmmForecastCsv 이식) ──
 * spend 칸을 바꾸면 adstock→변환→예측이 엑셀에서 자동 연쇄 계산.  */
export function buildForecastCsv(fc, target, locale = "ko", sourceCurrency = "KRW", displayCurrency = sourceCurrency) {
  const tx = (ko, en) => (locale === "en" ? en : ko);
  const tKo = mmmTargetDisplay(target, locale);
  if (fc.isStructural) {
    const rows = [
      [tx("# 도구", "# Tool"), "Organic + Paid structural forecast router (5-18)"],
      [tx("# 대상", "# Target"), `${tKo} (${target})`],
      [tx("# 선택 경로", "# Selected route"), fc.structuralRoute],
      [tx("# 선택 사양", "# Selected specification"), fc.structuralSelectedSpec?.id || ""],
      [tx("# 선택 학습 기간", "# Selected training window"), `${fc.structuralSelectedSpec?.trainingWindow || ""}${tx("주", " weeks")}`],
      [tx("# 학습 기간 비교", "# Training-window comparison"), (fc.structuralLookbackCandidates || []).map((candidate) => candidate.available ? `${candidate.trainingWindow}w=${candidate.pooledWmape.toFixed(2)}%` : `${candidate.trainingWindow}w=${tx("근거 부족", "insufficient evidence")}`).join(" / ")],
      [tx("# 상태", "# Status"), fc.structuralEligible ? tx("공식 10% 인증", "official 10% certified") : fc.structuralShortTermEligible ? tx(`단기 ${fc.structuralRecommendedHorizon}주만 사용`, `short-term use only: ${fc.structuralRecommendedHorizon} weeks`) : tx("사용 불가 · 진단 전용", "unavailable · diagnostic only")],
      [tx("# 사용 기준", "# Use gate"), `${tx("전체 rolling OOS의 Total·구성요소 최악 wMAPE", "worst Total and component wMAPE across full rolling OOS")} < ${fc.structuralThreshold}%`],
      [tx("# 비용 조건", "# Spend condition"), tx("화면의 미래 예산 입력값에 조건부인 예측입니다. 입력하지 않은 채널은 선택된 비용 예측 사양을 사용합니다.", "The forecast is conditional on future budgets entered in the UI. Channels without an input use the selected spend-forecast specification.")],
      [tx("# 분해 정의", "# Decomposition"), tx("Organic Predicted는 Organic 수준, Perf Predicted는 비용으로 예측한 0 이상 Paid 절대 수준이며 두 열의 합이 fitted_or_forecast_live입니다.", "Organic Predicted is the Organic level; Perf Predicted is the non-negative absolute Paid level predicted from cost, and their sum is fitted_or_forecast_live.")],
      [tx("# 구간 출처", "# Interval provenance"), forecastIntervalNote(fc, locale)],
      [],
      ["period", "segment", "actual", "fitted_or_forecast_live", "Organic Predicted", "Perf Predicted", "lower_live", "upper_live"],
    ];
    const append = (period, segment, actual, fitted, organic, performance, lower, upper) => {
      const rowNumber = rows.length + 1;
      const hasParts = Number.isFinite(Number(organic)) && Number.isFinite(Number(performance));
      rows.push([
        period,
        segment,
        actual ?? "",
        hasParts ? `=E${rowNumber}+F${rowNumber}` : fitted ?? "",
        hasParts ? organic : "",
        hasParts ? performance : "",
        lower ?? "",
        upper ?? "",
      ]);
    };
    (fc.actual || []).forEach((actual, index) => append(
      fc.histLabels?.[index] ?? index + 1,
      "history",
      actual,
      fc.fittedHist?.[index],
      fc.organicHist?.[index],
      fc.performanceHist?.[index],
      "",
      "",
    ));
    (fc.predFut || []).forEach((prediction, index) => append(
      fc.futLabels?.[index] ?? `+${index + 1}`,
      fc.structuralEligible
        ? "forecast"
        : index < (fc.structuralRecommendedHorizon || 0)
          ? "forecast_short_term"
          : "scenario_only",
      "",
      prediction,
      fc.organicFut?.[index],
      fc.performanceFut?.[index],
      fc.lo?.[index],
      fc.hi?.[index],
    ));
    return rows.map((row) => row.map(csvQ).join(","));
  }
  if (fc.isPaidOrganicSplit) {
    const liveCsv = buildBayesianForecastCsv(
      fc,
      target,
      locale,
      sourceCurrency,
      displayCurrency,
    );
    if (liveCsv) return liveCsv;
    const rows = [
      [tx("# 도구", "# Tool"), "Organic baseline + spend halo + Paid spend regression (5-18)"],
      [tx("# 대상", "# Target"), `${tKo} (${target})`],
      [tx("# 합산", "# Identity"), "Total = Android(Organic + Paid) + iOS(Organic + Paid)"],
      [tx("# Organic", "# Organic"), tx("Total−Paid 실측을 자연 추세·계절성·Spend 연관 halo로 예측", "Forecasts observed Total−Paid with natural trend, seasonality, and a spend-associated halo")],
      [tx("# Paid", "# Paid"), tx("PaidRegs 실측의 Cost 조건부 예측 수준입니다. 회귀 절편·비매체 성분이 포함될 수 있습니다.", "This is the Cost-conditional predicted level of observed PaidRegs and may include an intercept or non-media component.")],
      [tx("# 주의", "# Note"), tx("halo와 Paid 예측은 서로 다른 실측 성분에 적합하므로 합산 시 중복되지 않습니다. 관측 연관이며 인과 증명은 아닙니다.", "The halo and Paid prediction are fit to disjoint observed components, so their sum does not double-count. These are observational associations, not causal proof.")],
      [tx("# 구간 출처", "# Interval provenance"), forecastIntervalNote(fc, locale)],
      [],
      ["platform", "period", "segment", "actual_total", "predicted_total", "organic_baseline", "organic_spend_halo", "organic_total", "paid_predicted_level", "lower", "upper"],
    ];
    const appendForecast = (part, platform) => {
      (part.actual || []).forEach((actual, index) => {
        rows.push([
          platform,
          csvSafeLiteral(part.histLabels?.[index] ?? index + 1),
          "history",
          actual,
          part.fittedHist?.[index],
          "",
          "",
          part.organicHist?.[index],
          part.performanceHist?.[index],
          "",
          "",
        ]);
      });
      (part.predFut || []).forEach((prediction, index) => {
        rows.push([
          platform,
          csvSafeLiteral(part.futLabels?.[index] ?? `+${index + 1}`),
          "forecast",
          "",
          prediction,
          part.organicBaseFut?.[index],
          part.organicHaloFut?.[index],
          part.organicFut?.[index],
          part.performanceFut?.[index],
          part.lo?.[index],
          part.hi?.[index],
        ]);
      });
    };
    appendForecast(fc, "Total");
    (fc.platformForecasts || []).forEach((part) => appendForecast(part, part.platform));
    return rows.map((row) => row.map(csvQ).join(","));
  }
  if (fc.isAnnualAnalog) {
    const hasPaidOrganic = fc.paidOrganicHybrid === true;
    const auditSelected = fc.rollingSelection?.selected;
    const productionSelected = fc.rollingSelection?.productionSelected || auditSelected;
    const validatedHorizon = fc.predFut?.length || 0;
    const rows = [
      [tx("# 도구", "# Tool"), hasPaidOrganic ? "Paid/Organic time-series auto-search (5-18)" : "Organic time-series auto-search (5-18)"],
      [tx("# 대상", "# Target"), `${tKo} (${target})`],
      [tx("# 선택 경로", "# Selected route"), fc.selectedRoute],
      [tx("# 봉인 감사 모델", "# Sealed-audit model"), `${auditSelected?.route || ""} · ${auditSelected?.spec || ""} · ${auditSelected?.window || ""}${tx("주", " weeks")}`],
      [tx("# 미래 재적합 모델", "# Production-refit model"), `${productionSelected?.route || ""} · ${productionSelected?.spec || ""} · ${productionSelected?.window || ""}${tx("주", " weeks")}`],
      [tx("# 상태", "# Status"), fc.annualQualified
        ? tx("공식 10% 인증", "official 10% certified")
        : tx("미인증 best-available · 예산 반응 해석 금지", "uncertified best-available · no budget-response interpretation")],
      [tx(`# 봉인 최신 ${validatedHorizon}주 OOS`, `# Sealed latest-${validatedHorizon}-week OOS`), auditSelected?.latestWmape],
      [tx("# 선택과 분리된 rolling OOS", "# Nested rolling OOS"), auditSelected?.wmape],
      [tx("# 예측 참고폭", "# Forecast reference width"), locale === "en" ? fc.intervalLabelEn : fc.intervalLabelKo],
      [tx("# 구간 주의", "# Interval note"), forecastIntervalNote(fc, locale)],
      [tx("# 자동 탐색", "# Auto-search"), fc.adaptiveModelSearch
        ? tx(
          `flat/추세/Holt/ridge/계절/유사시즌과 여러 기간을 비중첩 rolling OOS로 비교`,
          `flat/trend/Holt/ridge/seasonal/similar-season families and multiple windows compared with non-overlapping rolling OOS`,
        )
        : ""],
      [tx("# 선정 이유", "# Selection rationale"), forecastSelectionDecisionText(fc.modelSearch?.routeDecision, locale)],
      [tx("# 성과 악화 자동 제외", "# Automatic deterioration rejection"), forecastGuardrailSummaryText(fc.modelSearch, locale)],
      [tx("# 유사 시즌 결과", "# Similar-season result"), fc.modelSearch?.similarSeason
        ? tx(
          `선택됨 · ${fc.modelSearch.similarSeason.matchWeeks}주 모양 비교 · ${fc.modelSearch.similarSeason.analogLags?.join("/")}주 전 유사 구간`,
          `selected · ${fc.modelSearch.similarSeason.matchWeeks}-week shape match · analogous periods ${fc.modelSearch.similarSeason.analogLags?.join("/")} weeks back`,
        )
        : tx("후보로 비교했으나 현재 데이터에서는 다른 모델이 우세", "evaluated as a candidate, but another model was stronger for this dataset")],
      [tx("# Paid=0 정규화", "# Paid=0 normalization"), fc.adaptiveModelSearch
        ? `Android ${fc.modelSearch?.android?.zeroedPaidWeeks || 0} / iOS ${fc.modelSearch?.ios?.zeroedPaidWeeks || 0}`
        : ""],
      [tx("# 미래 결합비", "# Live future blend"), fc.paidOrganicHybrid
        ? `Android ${Math.round((fc.modelSearch?.android?.productionBlendWeight ?? 0.5) * 100)}% / iOS ${Math.round((fc.modelSearch?.ios?.productionBlendWeight ?? 0.5) * 100)}%`
        : ""],
      [fc.annualComponentGuardrailRequired === false
        ? tx("# OS 진단(인증 비적용)", "# OS diagnostic (not a certification gate)")
        : tx("# OS guardrail", "# OS guardrail"), (fc.annualOsGuardrail || []).map((component) =>
        `${component.component}: history ${forecastPct(component.developmentWmape)} / latest ${forecastPct(component.latestWmape)} / ${component.passed ? "pass" : "fail"}`
      ).join(" | ")],
      [tx("# 분해", "# Decomposition"), hasPaidOrganic
        ? tx("Total과 Paid 실측을 사용했습니다. Organic Predicted = fitted_or_forecast_live − Perf Predicted이며 두 열의 합은 항상 Total 예측과 같습니다.", "Observed Total and Paid outcomes were used. Organic Predicted = fitted_or_forecast_live − Perf Predicted, so the two columns always reconcile to the Total forecast.")
        : tx("Paid/Organic 실측이 없어 Organic Predicted와 Perf Predicted는 비워 둡니다.", "Organic Predicted and Perf Predicted are blank because observed Paid/Organic outcomes are unavailable.")],
      [],
      ["period", "segment", "actual", "fitted_or_forecast_live", "Organic Predicted", "Perf Predicted", "lower_live", "upper_live"],
      ...(fc.actual || []).map((actual, index) => [
        fc.histLabels?.[index] ?? index + 1,
        "history",
        actual,
        fc.fittedHist?.[index],
        hasPaidOrganic ? fc.organicHist?.[index] : "",
        hasPaidOrganic ? fc.performanceHist?.[index] : "",
        "",
        "",
      ]),
      ...(fc.predFut || []).map((prediction, index) => [
        fc.futLabels?.[index] ?? `+${index + 1}`,
        fc.annualQualified ? "forecast" : "best_available_uncertified",
        "",
        prediction,
        hasPaidOrganic ? fc.organicFut?.[index] : "",
        hasPaidOrganic ? fc.performanceFut?.[index] : "",
        fc.lo?.[index],
        fc.hi?.[index],
      ]),
    ];
    return rows.map((row) => row.map(csvQ).join(","));
  }
  if (fc.isBayesian) {
    const liveCsv = buildBayesianForecastCsv(fc, target, locale, sourceCurrency, displayCurrency);
    if (liveCsv) return liveCsv;
    const intervalMeta = forecastIntervalContract(fc);
    const rows = [
      [tx("# 도구", "# Tool"), "Empirical-Bayes MMM Forecast (5-18)"],
      [tx("# 대상", "# Target"), `${tKo} (${target})`],
      [tx("# 원본 통화", "# Source currency"), sourceCurrency],
      [tx("# 화면 표시 통화", "# Display currency"), displayCurrency],
      [tx("# 숫자 단위", "# Numeric units"), tx(`지출·매출 값은 원본 통화 ${sourceCurrency} 단위`, `Spend and revenue values remain in source-currency ${sourceCurrency} units`)],
      [tx("# 모델", "# Model"), fc.model],
      [tx("# 모델 적합 R²", "# Model-fit R²"), fc.r2],
      [tx("# 예측 범위", "# Predictive range"), intervalMeta.method],
      [tx("# 구간 출처", "# Interval provenance"), forecastIntervalNote(fc, locale)],
      [tx("# 주의", "# Note"), fc.isAdditiveTotal
        ? tx("Total 예측은 Android 예측 + iOS 예측의 주별 합입니다. 별도 Total 회귀가 아니며, 아래 값은 고정 스냅샷입니다.", "Total forecasts are weekly Android + iOS sums, not a separate Total regression. Values below are a fixed snapshot.")
        : tx("관측 모델의 시나리오 외삽이며 인과·증분 보장이 아닙니다. 비선형 profile 모델이라 아래 값은 고정 스냅샷이며 살아있는 엑셀 수식이 아닙니다.", "Scenario extrapolation from an observational model; it is not causal or incremental proof. Because this is a nonlinear profile model, values below are a fixed snapshot, not live Excel formulas.")],
      [],
      ...(!fc.isAdditiveTotal ? [
        [tx("# 계수", "# Coefficients")],
        ["term", "standardized_coefficient"],
        ["(Intercept)", fc.intercept],
        ...(fc.names || []).map((name, index) => [name, fc.beta?.[index]]),
      ] : []),
      [],
      ["period", "segment", "actual_source_unit", "fitted_or_forecast_source_unit", "lower_source_unit", "upper_source_unit", ...(fc.chans || []).map((channel) => `${channel.label}_spend_${sourceCurrency}`)],
      ...(fc.actual || []).map((actual, index) => [fc.labels?.[index] ?? index + 1, "history", actual, fc.fittedHist?.[index], "", "", ...(fc.chans || []).map(() => "")]),
      ...(fc.predFut || []).map((prediction, index) => [fc.futLabels?.[index] ?? `+${index + 1}`, "forecast", "", prediction, fc.lo?.[index], fc.hi?.[index], ...(fc.chans || []).map((channel) => fc.futSpendByKey?.[channel.key]?.[index])]),
    ];
    return rows.map((row) => row.map(csvQ).join(","));
  }
  const chByLn = {};
  fc.chans.forEach((ch) => (chByLn["ln_" + ch.key] = ch.label));
  const evLbl = {};
  (fc.steps || []).forEach((s) => {
    evLbl["d_" + s.key] = s.label;
    evLbl[s.key] = s.label;
  });
  const featPlain = (nm) => {
    if (nm === "(Intercept)") return tx("기본값 — 모든 재료가 0일 때의 출발점", "Baseline — starting point when every ingredient is 0");
    if (nm === "trend" || nm.startsWith("trend_dir_")) return tx("방향을 고정하고 크기는 함께 추정한 시간 추세", "Direction-constrained time trend with jointly estimated magnitude");
    if (nm.startsWith("season_rbf_")) return tx("공동 추정 비즈니스 계절 패턴", "Jointly estimated business-seasonality pattern");
    if (nm.startsWith("industry_")) return tx("공동 추정 업계 현황 변화", "Jointly estimated industry-demand movement");
    if (/^(sin|cos)_0$/.test(nm)) return tx("계절 패턴 (1년 주기)", "Seasonal pattern (annual cycle)");
    if (/^(sin|cos)_/.test(nm)) return tx("계절 패턴 (보조 주기)", "Seasonal pattern (secondary cycle)");
    if (nm.startsWith("ln_"))
      return (
        (chByLn[nm] || nm.replace(/^ln_c_/, "").replace(/_/g, " ")) +
        tx(" 지출 — 광고잔효+수확체감 변환값(클수록 예측↑, 계수 부호 따라)", " spend — adstock+saturation-transformed value (larger → prediction↑, depending on coefficient sign)")
      );
    if (nm.startsWith("d_"))
      return tx("이벤트/휴일: ", "Event/holiday: ") + (evLbl[nm] || nm.slice(2)) + tx(" — 그 주 해당하면 1, 아니면 0", " — 1 if that week applies, else 0");
    if (evLbl[nm]) return tx("구조변화: ", "Regime change: ") + evLbl[nm] + tx(" — 전환 후 1로 지속", " — stays 1 after the switch");
    return tx("재료 ", "Ingredient ") + nm;
  };
  const L = [];
  let lamRow = 4;
  [
    [tx("# 도구", "# Tool"), "MMM Trend Forecast (5-18)"],
    [tx("# 대상", "# Target"), tKo + " (" + target + ")"],
    [tx("# 모델", "# Model"), fc.model],
    [tx("# adstock_lambda(광고잔효 λ)", "# adstock_lambda (carryover λ)"), fc.lam],
    [tx("# R2(모델 적합도·1에 가까울수록 잘맞음)", "# R2 (model fit · closer to 1 = better)"), fc.r2],
    [tx("# sigma_resid(과거 잔차 표준편차)", "# sigma_resid (historical residual standard deviation)"), fc.sigma],
    [tx("# 과거 데이터 행수", "# Historical rows"), fc.n],
    [tx("# 예측 기간(행)", "# Forecast horizon (rows)"), fc.horizon],
    [
      tx("# 참고 범위 종류", "# Reference-range type"),
      fc.isRidge
        ? tx("릿지 모델 과거 잔차 참고 범위 — ±1.96×잔차 σ, 확률 보장 아님", "Ridge historical-residual reference — ±1.96×residual σ, not probability-calibrated")
        : fc.bandMode === "mean"
          ? tx("과거 잔차 기반 평균 추세 참고 범위 — t·σ·√leverage, 확률 보장 아님", "Historical-residual average-trend reference — t·σ·√leverage, not probability-calibrated")
          : tx("과거 잔차 기반 개별 주 참고 범위 — t·σ·√(1+leverage), 확률 보장 아님", "Historical-residual individual-week reference — t·σ·√(1+leverage), not probability-calibrated"),
    ],
    [
      tx("# 주의", "# Note"),
      tx(
        "관측 회귀의 외삽(가설)입니다. 인과/증분 아님 — 확정은 holdout(5-15). 미래 휴일=0, 이벤트는 마지막 값 지속.",
        "This is an extrapolation (hypothesis) from observational regression. Not causal/incremental — confirm via holdout (5-15). Future holidays=0, events carry the last value.",
      ),
    ],
  ].forEach((kv) => {
    if (String(kv[0]).includes("adstock_lambda") || String(kv[0]).toLowerCase().includes("adstock_lambda")) lamRow = L.length + 1;
    L.push(kv.map(csvQ).join(","));
  });
  L.push("");
  // 계수표 (coef는 B열 — 아래 수식이 참조)
  L.push([tx("# 계수 (이 값들을 바꾸면 아래 예측이 자동 재계산됩니다)", "# Coefficients (change these values and the forecast below auto-recalculates)")].map(csvQ).join(","));
  L.push(
    [
      tx("term(재료)", "term (ingredient)"),
      tx("coef(계수)", "coef (coefficient)"),
      tx("std_error(편차·불확실성)", "std_error (uncertainty)"),
      tx("p_value(작을수록 신뢰)", "p_value (smaller = more confident)"),
      tx("의미 (쉬운 설명)", "meaning (plain explanation)"),
    ]
      .map(csvQ)
      .join(","),
  );
  const coefRow = {};
  fc.coefTable.forEach((ct) => {
    coefRow[ct.term] = L.length + 1;
    L.push(
      [
        ct.term,
        csvNum(ct.coef, 6),
        ct.se == null ? "—" : csvNum(ct.se, 4),
        ct.p == null ? "—" : csvNum(ct.p, 4),
        featPlain(ct.term),
      ]
        .map(csvQ)
        .join(","),
    );
  });
  if (fc.isRidge)
    L.push([tx("# (릿지 모델은 정규화 추정이라 편차·p값이 없습니다)", "# (Ridge model is a regularized estimate, so it has no std error/p-value)")].map(csvQ).join(","));
  L.push("");
  L.push([tx("# ── 아래 '예측값' 칸은 어떻게 나오나요? (엑셀 수식으로 살아있음) ──", "# ── How is the 'forecast' column below computed? (live Excel formulas) ──")].map(csvQ).join(","));
  (locale === "en" ? [
    "# 1) Start from the 'Intercept' (baseline) above.",
    "# 2) Each ingredient has a 'coefficient.' We add up that week's 'ingredient value × coefficient' one by one.",
    "# 3) A positive coefficient means the forecast rises as the ingredient grows; a negative one lowers it.",
    "# 4) Change a channel's spend cell → the 'adstock' cell → the 'ln_channel' cell → the forecast automatically recalculates in a chain (all formulas).",
    "# 5) adstock (carryover) = this week's spend + λ × last week's adstock — the cumulative value of ad effect carrying into next week.",
    "# 6) ln_channel = LN(1 + adstock) — a transform where extra effect shrinks the more you spend (diminishing returns).",
    "# 7) The sum of all ingredients is that week's forecast value.",
    "# * Lower/upper columns are historical-residual reference bounds (future only), not calibrated 95% confidence or prediction intervals.",
    "# * The adstock λ references the 'adstock_lambda' cell in the metadata above (B" + lamRow + ").",
  ] : [
    "# 1) 위 '기본값(Intercept)'에서 출발합니다.",
    "# 2) 각 재료마다 '계수'가 있습니다. 그 주의 '재료 값 × 계수'를 차례로 더합니다.",
    "# 3) 계수가 양수면 그 재료가 클수록 예측이 올라가고, 음수면 내려갑니다.",
    "# 4) 채널 지출(spend) 칸을 바꾸면 → 'adstock' 칸 → 'ln_채널' 칸 → 예측이 자동으로 줄줄이 다시 계산됩니다 (전부 수식).",
    "# 5) adstock(광고잔효) = 이번 주 지출 + λ × 지난주 adstock — 광고 효과가 다음 주로 이어지는 누적값입니다.",
    "# 6) ln_채널 = LN(1 + adstock) — 많이 쓸수록 추가 효과가 줄어드는(수확체감) 변환.",
    "# 7) 모든 재료를 더한 합이 그 주의 예측값입니다.",
    "# ※ 하한/상한은 과거 잔차를 예측값 주변에 적용한 참고 범위입니다(미래만). 보정된 95% 신뢰·예측구간이 아닙니다.",
    "# ※ adstock λ는 위 메타의 'adstock_lambda' 셀(B" + lamRow + ")을 참조합니다.",
  ]).forEach((s) => L.push([s].map(csvQ).join(",")));
  L.push("");
  // 시계열 — spend → adstock → ln → 예측 살아있는 수식 체인
  const fcMatrix = fc.featMatrix;
  const featStart = 7,
    nNames = fc.names.length;
  const lnChanK = {};
  fc.chans.forEach((ch, k) => {
    const j = fc.names.indexOf("ln_" + ch.key);
    if (j >= 0) lnChanK[j] = k;
  });
  const chansLn = fc.chans.map((_, k) => k).filter((k) => Object.values(lnChanK).includes(k));
  const adStart = featStart + nNames,
    spStart = adStart + chansLn.length;
  const featCol = (j) => csvColL(featStart + j);
  const adCol = (k) => csvColL(adStart + chansLn.indexOf(k));
  const spCol = (k) => csvColL(spStart + k);
  const header = [
    "t",
    "label",
    "segment",
    tx("actual(실측)", "actual"),
    tx("fitted_or_forecast(예측·수식)", "fitted_or_forecast"),
    tx("residual_reference_low(참고하한)", "residual_reference_low"),
    tx("residual_reference_high(참고상한)", "residual_reference_high"),
    ...fc.names,
    ...chansLn.map((k) => "adstock_" + fc.chans[k].label),
    ...fc.chans.map((ch) => "spend_" + ch.label),
  ];
  L.push(tx("# 시계열 — spend 칸을 바꾸면 adstock·ln·예측이 자동 연쇄 계산 (전부 수식)", "# Time series — change a spend cell and adstock/ln/forecast auto-recalculate in a chain (all formulas)"));
  L.push(header.map(csvQ).join(","));
  const buildFitted = (er) =>
    "=$B$" +
    coefRow["(Intercept)"] +
    fc.names.map((nm, j) => "+$B$" + coefRow[nm] + "*" + featCol(j) + er).join("");
  const firstRow = L.length + 1;
  for (let i = 0; i < fc.n + fc.horizon; i++) {
    const er = L.length + 1,
      isHist = i < fc.n;
    const lbl = isHist ? fc.histLabels[i] : fc.futLabels[i - fc.n];
    const feats = fc.names.map((nm, j) =>
      lnChanK[j] != null ? "=LN(1+" + adCol(lnChanK[j]) + er + ")" : csvNum(fcMatrix[i][j], 6),
    );
    const adcells = chansLn.map((k) =>
      er === firstRow
        ? "=" + spCol(k) + er
        : "=" + spCol(k) + er + "+$B$" + lamRow + "*" + adCol(k) + (er - 1),
    );
    const spend = fc.chans.map((ch, k) =>
      isHist
        ? csvNum((fc.histSpendByKey[ch.key] || [])[i], 0)
        : csvNum(fc.futSpendByKey[ch.key][i - fc.n], 0),
    );
    let loCell = "",
      hiCell = "";
    if (!isHist) {
      const k = i - fc.n,
        margin = +(fc.hi[k] - fc.predFut[k]).toFixed(2);
      loCell = "=E" + er + "-" + margin;
      hiCell = "=E" + er + "+" + margin;
    }
    L.push(
      [
        i + 1,
        lbl,
        isHist ? "history" : "forecast",
        isHist ? Math.round(fc.actual[i]) : "",
        buildFitted(er),
        loCell,
        hiCell,
        ...feats,
        ...adcells,
        ...spend,
      ]
        .map(csvQ)
        .join(","),
    );
  }
  return L;
}

/* ── 채널별 카니발 삼각검증 + 탄력성·커버리지 CSV (index downloadMmmCannibCsv 이식) ── */
export function buildCannibCsv(cannib, effects, target) {
  const chans = cannib.cannChannels || [];
  const effByKey = {};
  (effects || []).forEach((e) => (effByKey[e.key] = e));
  const header = [
    "channel", "channel_label", "is_brand_intercept", "verdict", "verdict_class",
    "vote_FOR", "vote_AGAINST", "vote_ABSTAIN", "for_bar", "power_gate_blocked",
    "power_gate_reasons", "reverse_causality_risk", "spend_time_corr",
    "prec_vote", "prec_low_n", "prec_p25", "prec_slope_per_wk", "prec_slope_p", "prec_change_pct",
    "detrend_vote", "detrend_raw", "detrend_detrended", "detrend_first_diff",
    "direction_vote", "direction_informative_n", "direction_opposite_n", "direction_opposite_rate",
    "spend_down_target_up", "spend_up_target_down", "spend_up_target_up", "spend_down_target_down",
    "net_vote", "net_elasticity", "net_p", "net_ci_lo", "net_ci_hi",
    "elasticity", "ci_lo", "ci_hi", "p", "significant", "effect_verdict",
    "per10pct_pct", "weekly_per_1k", "mean_spend",
    "coverage_nonzero", "coverage_total", "coverage_ratio", "sparse", "trailing_zero",
    "granger_cannibal", "granger_help", "pacing",
    "granger_s2o_lag", "granger_s2o_F", "granger_s2o_p", "granger_s2o_coefsum",
    "granger_o2s_lag", "granger_o2s_F", "granger_o2s_p", "granger_o2s_coefsum",
  ];
  const lines = [header.map(csvQ).join(",")];
  for (const k of chans) {
    const cn = cannib.cannibByChannel[k];
    if (!cn) continue;
    const e = effByKey[k] || {};
    const pr = cn.precedence,
      dt = cn.detrend_corr,
      ni = cn.net_incrementality,
      vt = cn.votes || {},
      pg = cn.power_gate || {},
      g = cn.granger;
    const per10 = e.elas != null ? +(e.elas * 10).toFixed(2) : "";
    const cov = e.total ? +(e.nonzero / e.total).toFixed(3) : "";
    lines.push(
      [
        k, cn.channelLabel, cn.is_brand_intercept, cn.verdict, cn.verdict_class,
        vt.FOR, vt.AGAINST, vt.ABSTAIN, cn.for_bar, pg.blocked,
        (pg.reasons || []).join(" | "), cn.reverse_causality_risk, cn.spend_time_corr,
        pr.vote, pr.low_n, pr.p25, pr.kpi_slope_per_wk, pr.slope_p, pr.kpi_change_over_window_pct,
        dt.vote, dt.raw, dt.detrended, dt.first_diff,
        dt.directional?.vote || "", dt.directional?.informative_n ?? "",
        dt.directional?.opposite_n ?? "", dt.directional?.opposite_rate ?? "",
        dt.directional?.spend_down_target_up ?? "", dt.directional?.spend_up_target_down ?? "",
        dt.directional?.spend_up_target_up ?? "", dt.directional?.spend_down_target_down ?? "",
        ni.vote, ni.net_elasticity, ni.p,
        ni.ci_lo != null ? ni.ci_lo : "", ni.ci_hi != null ? ni.ci_hi : "",
        e.elas != null ? e.elas : "", e.ci ? e.ci[0] : "", e.ci ? e.ci[1] : "",
        e.p != null ? e.p : "", e.sig != null ? e.sig : "", e.verdict || "",
        per10, e.weeklyPer1k == null ? "" : e.weeklyPer1k, e.meanSpend != null ? e.meanSpend : "",
        e.nonzero != null ? e.nonzero : "", e.total != null ? e.total : "", cov,
        e.sparse != null ? e.sparse : "", e.trailingZero != null ? e.trailingZero : "",
        cn.granger_cannibal, cn.granger_help, cn.pacing,
        g && g.spend_to_organic ? g.spend_to_organic.lag : "",
        g && g.spend_to_organic ? g.spend_to_organic.F : "",
        g && g.spend_to_organic ? g.spend_to_organic.p : "",
        g && g.spend_to_organic ? g.spend_to_organic.coefSum : "",
        g && g.organic_to_spend ? g.organic_to_spend.lag : "",
        g && g.organic_to_spend ? g.organic_to_spend.F : "",
        g && g.organic_to_spend ? g.organic_to_spend.p : "",
        g && g.organic_to_spend ? g.organic_to_spend.coefSum : "",
      ]
        .map(csvQ)
        .join(","),
    );
  }
  return lines;
}

/* ── §4 검정 원자료 CSV — 주별 타깃·채널별 ln(1+지출)·탈추세 잔차·1차차분
 * (index downloadMmmCannibSeriesCsv 이식 — 엑셀 CORREL로 화면 상관 직접 재현) ── */
export function buildCannibSeriesCsv(panel, target) {
  const y = panel.targets[target],
    week = panel.week,
    n = week.length;
  const tr = week.map((_, i) => [1, i]);
  const yFit = mmmOls(tr, y);
  const yResid = yFit ? yFit.resid : y.map(() => null);
  const chans = _mmmChans(panel).filter((ch) => panel.ch[ch.key]);
  const series = chans.map((ch) => {
    const lnG = panel.ch[ch.key].map((v) => Math.log1p(v > 0 ? v : 0));
    const gFit = mmmOls(tr, lnG);
    return { ch, spend: panel.ch[ch.key], lnG, resid: gFit ? gFit.resid : lnG.map(() => null) };
  });
  const wl = (i) => (panel.weekLabel ? panel.weekLabel[i] : week[i]);
  const header = ["t", "week", target, target + "_detrend", target + "_diff"];
  chans.forEach((ch) =>
    header.push(
      "spend_" + ch.label,
      "ln_" + ch.label,
      "ln_" + ch.label + "_detrend",
      "ln_" + ch.label + "_diff",
    ),
  );
  const lines = [header.map(csvQ).join(",")];
  for (let i = 0; i < n; i++) {
    const row = [
      i + 1,
      wl(i),
      Math.round(y[i]),
      csvNum(yResid[i], 4),
      i > 0 ? (y[i] - y[i - 1]).toFixed(1) : "",
    ];
    series.forEach((s) =>
      row.push(
        isFinite(s.spend[i]) ? Math.round(s.spend[i]) : "",
        csvNum(s.lnG[i], 5),
        csvNum(s.resid[i], 5),
        i > 0 ? (s.lnG[i] - s.lnG[i - 1]).toFixed(5) : "",
      ),
    );
    lines.push(row.map(csvQ).join(","));
  }
  return lines;
}

// MMM 흐름: 시계열 점검 → 카니발 → 기여 → 예측.
// locale-aware — 함수로 감싸 ko/en 두 세트를 제공(§12.20 렌더층 다국어 패턴).
export function mmmStageDefs(locale) {
  if (locale === "en") {
    return [
      { id: "trend", no: "① Time series", title: "STL trend check", icon: "〰", desc: "Separate natural trend, seasonality, and irregular weeks before judging ad effects." },
      { id: "diagnose", no: "② Cannibalization", title: "Cannibalization diagnosis", icon: "🔬", desc: "Is paid advertising eating into organic traffic that would have come for free? — checked per channel." },
      { id: "mmm", no: "③ Contribution", title: "MMM contribution breakdown", icon: "🧩", desc: "What actually moved performance? Where should the next budget go?" },
      { id: "lab", no: "④ Forecast", title: "Regression · Forecast", icon: "📈", desc: "If things stay the same, or if you change the budget, how will the next weeks look?" },
    ];
  }
  return [
    { id: "trend", no: "① 시계열 점검", title: "STL 추세 분석", icon: "〰", desc: "광고 판단 전에 자연 추세·계절성·이상 주차를 분리합니다." },
    { id: "diagnose", no: "② 잠식 진단", title: "카니발 진단", icon: "🔬", desc: "유료 광고가 공짜로 들어올 오가닉 유입을 갉아먹고 있나? — 채널별로 점검합니다." },
    { id: "mmm", no: "③ 기여 분해", title: "MMM 기여 분해", icon: "🧩", desc: "무엇이 우리 성과를 실제로 움직였나? 다음 예산은 어디에 써야 하나?" },
    { id: "lab", no: "④ 미래 예측", title: "회귀 · 미래 예측", icon: "📈", desc: "이대로 가면, 또는 예산을 바꾸면 다음 몇 주 성과는 어떻게 될까?" },
  ];
}

// ② 기여 분해 스택 차트 버킷 — 12+ 드라이버를 마케터가 한눈에 읽는 4묶음으로.
// 엔진 groupNames→버킷 매핑(수학 불변, 표시 그룹핑만). tone은 다크/라이트 둘 다 읽히는 중간 채도.
export function mmmBucketMeta(locale) {
  if (locale === "en") {
    return {
      base: { label: "Seasonality", tone: "#94a3b8" },
      trend: { label: "Base demand · trend", tone: "#38bdf8" },
      event: { label: "Events · regime change", tone: "#f59e0b" },
      industry: { label: "Industry trend", tone: "#a78bfa" },
      media: { label: "Ad effect", tone: "#8b7ff0" },
    };
  }
  return {
    base: { label: "계절 요인", tone: "#94a3b8" },
    trend: { label: "기본 수요·추세", tone: "#38bdf8" },
    event: { label: "이벤트·구조변화", tone: "#f59e0b" },
    industry: { label: "업계 현황", tone: "#a78bfa" },
    media: { label: "광고 효과", tone: "#8b7ff0" },
  };
}
// 아래→위 쌓는 순서. base(=baseline+계절)는 절대 밴드로 별도 처리, 나머지는 그 위 누적.
export const MMM_BUCKET_ORDER = ["base", "trend", "event", "industry", "media"];
export function decompBucketOf(g) {
  if (g === "Seasonality") return "base";
  if (g === "Trend") return "trend";
  if (g === "Industry Trend") return "industry";
  if (g === "Holidays" || g === "Regime(steps)") return "event";
  return MMM_NONMEDIA_GROUPS.includes(g) ? "event" : "media";
}
// 개별 채널(광고) 밴드용 팔레트 — 보라 계열 명도차. hex+alpha는 fill에만.
export const MMM_MEDIA_PALETTE = ["#8b7ff0", "#a78bfa", "#c084fc", "#e879f9", "#7dd3fc", "#67e8f9"];

// 차트 테마·공통 옵션 — 컴포넌트 밖(상수)로 두어 effect 의존성 안정화
export const CHART_THEME = GLOBAL_CHART_THEME;
export function chartBase() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { labels: { color: CHART_THEME.text, font: { size: 11 } } },
      tooltip: { backgroundColor: "rgba(15,23,42,0.9)", padding: 10, cornerRadius: 6 },
    },
    scales: {
      x: { ticks: { color: CHART_THEME.muted, font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: CHART_THEME.muted, font: { size: 10 } }, grid: { color: CHART_THEME.grid } },
    },
  };
}

export function sliceMmmPanel(panel, end, start = 0) {
  return {
    ...panel,
    week: panel.week.slice(start, end),
    weekLabel: panel.weekLabel?.slice(start, end),
    dateLabel: panel.dateLabel?.slice(start, end),
    dates: panel.dates?.slice(start, end),
    ch: Object.fromEntries(Object.entries(panel.ch).map(([key, values]) => [key, values.slice(start, end)])),
    reach: Object.fromEntries(Object.entries(panel.reach || {}).map(([key, values]) => [key, values.slice(start, end)])),
    frequency: Object.fromEntries(Object.entries(panel.frequency || {}).map(([key, values]) => [key, values.slice(start, end)])),
    dummy: Object.fromEntries(Object.entries(panel.dummy || {}).map(([key, values]) => [key, values.slice(start, end)])),
    steps: Object.fromEntries(Object.entries(panel.steps || {}).map(([key, values]) => [key, values.slice(start, end)])),
    external: Object.fromEntries(Object.entries(panel.external || {}).map(([key, values]) => [key, values.slice(start, end)])),
    geo: Array.isArray(panel.geo) ? panel.geo.slice(start, end) : panel.geo,
    targets: Object.fromEntries(Object.entries(panel.targets).map(([key, values]) => [key, values.slice(start, end)])),
  };
}

export function sliceMmmRun(run, start, end) {
  if (!run) return run;
  const channelContributions = sliceMmmChannelContributions(run.channelContributions, start, end);
  return { ...run, weeks: (run.weeks || []).slice(start, end), channelContributions };
}

// 상관 채널 묶음도 모델은 전체 이력으로 한 번만 다시 적합한다. 날짜 필터에서는
// 그 적합 결과의 주별 기여만 잘라 합계를 다시 만들고, 전체 기간 총기여를 섞지 않는다.
export function sliceMmmCollinearityGroupRefit(groupRefit, start, end) {
  if (!groupRefit?.enabled) return groupRefit;
  const sliceContribution = (contribution = {}) => {
    const weeklyMean = Array.isArray(contribution.weeklyMean) ? contribution.weeklyMean.slice(start, end) : [];
    const weeklyLow = Array.isArray(contribution.weeklyLow) ? contribution.weeklyLow.slice(start, end) : [];
    const weeklyHigh = Array.isArray(contribution.weeklyHigh) ? contribution.weeklyHigh.slice(start, end) : [];
    return {
      ...contribution,
      weeklyMean,
      weeklyLow,
      weeklyHigh,
      totalMean: weeklyMean.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0),
      totalLow: weeklyLow.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0),
      totalHigh: weeklyHigh.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0),
    };
  };
  return {
    ...groupRefit,
    groups: groupRefit.groups.map((group) => ({ ...group, contribution: sliceContribution(group.contribution) })),
    individualContributions: Object.fromEntries(Object.entries(groupRefit.individualContributions || {}).map(([key, contribution]) => [key, sliceContribution(contribution)])),
  };
}

// 반응 곡선의 모양은 전체 이력으로 학습한 계수를 유지한다. 다만 ● 현재 지출과
// 한계효과 표의 기준점은 사용자가 고른 표시 기간의 달력 주 평균으로 바꾼다.
export function withMmmViewSpend(saturationByChannel = {}, panel, isDateFiltered = false) {
  return Object.fromEntries(Object.entries(saturationByChannel).map(([key, channel]) => {
    const allSpends = panel?.ch?.[key] || [];
    // 필터가 없을 땐 기존 정의(최근 12개 달력 주 평균)를 보존한다.
    const spends = (isDateFiltered ? allSpends : allSpends.slice(-12)).filter(Number.isFinite);
    const recentMean = spends.length ? spends.reduce((sum, value) => sum + value, 0) / spends.length : 0;
    return [key, { ...channel, recentMean, currentMarginal: channel.marginalAt(recentMean) * 1000 }];
  }));
}

// Brand/Performance 전체 곡선은 구성 채널의 현재 집행 비중을 고정해 함께
// 증감시키는 시나리오다. 새로 합산 채널을 재적합한 결과가 아니라, 개별 곡선을
// 같은 mix로 합친 예산 의사결정용 보기임을 UI에서 분명히 밝힌다.
export function buildMmmSaturationCurveGroups(saturationByChannel = {}, channels = [], locale = "ko") {
  const channelByKey = new Map((channels || []).map((channel) => [channel.key, channel]));
  return ["brand", "perf"].map((kind) => {
    const members = Object.values(saturationByChannel).filter((channel) => channelByKey.get(channel.key)?.kind === kind);
    const recentMean = members.reduce((sum, channel) => sum + Math.max(0, Number(channel.recentMean) || 0), 0);
    if (!members.length || !(recentMean > 0)) return null;
    const weights = Object.fromEntries(members.map((channel) => [channel.key, Math.max(0, Number(channel.recentMean) || 0) / recentMean]));
    return {
      key: "group:" + kind,
      label: locale === "en" ? (kind === "brand" ? "Brand total" : "Performance total") : (kind === "brand" ? "브랜딩 전체" : "퍼포먼스 전체"),
      recentMean,
      isGroup: true,
      color: kind === "brand" ? "#d5df8e" : "#df8392",
      members,
      responseAt: (spend) => members.reduce((sum, channel) => sum + channel.responseAt(Math.max(0, spend) * weights[channel.key]), 0),
    };
  }).filter(Boolean);
}

export function isoDateFromLabel(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? match[0] : null;
}

export function weekBoundaryDate(isoDate, weekStart, boundary) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  const startDay = weekStart === "sunday" ? 0 : 1;
  const offset = (date.getUTCDay() - startDay + 7) % 7;
  date.setUTCDate(date.getUTCDate() - offset + (boundary === "end" ? 6 : 0));
  return date.toISOString().slice(0, 10);
}

export function buildForecastModelForSelection(sourcePanel, sourceCfg, target, selected, selection = null) {
  const controlledSourcePanel = selected.controlPolicy === "none"
    ? { ...sourcePanel, dummy: {}, steps: {}, dummyDefs: [], stepDefs: [] }
    : sourcePanel;
  const trainStart = selected.windowMode === "expanding"
    ? 0
    : Math.max(0, controlledSourcePanel.week.length - selected.window);
  const rawPanel = sliceMmmPanel(controlledSourcePanel, controlledSourcePanel.week.length, trainStart);
  const baselineStart = Math.max(
    0,
    controlledSourcePanel.week.length - (selected.baselineHistoryWeeks || 104),
  );
  const baselinePanel = sliceMmmPanel(
    controlledSourcePanel,
    controlledSourcePanel.week.length,
    baselineStart,
  );
  const seasonalityStart = Math.max(
    0,
    controlledSourcePanel.week.length - (selected.seasonalityHistoryWeeks || selected.window),
  );
  const seasonalModel = selected.seasonalityScope === "global"
    ? mmmForecastGlobalSeasonality(
      sliceMmmPanel(controlledSourcePanel, controlledSourcePanel.week.length, seasonalityStart),
      target,
      selected.seasonalityPeriods,
    )
    : null;
  const trendStart = Math.max(
    0,
    controlledSourcePanel.week.length - (selected.trendHistoryWeeks || selected.window),
  );
  const trendModel = selected.trendScope === "global"
    ? mmmForecastGlobalBaseline(sliceMmmPanel(controlledSourcePanel, controlledSourcePanel.week.length, trendStart), target, [])
    : null;
  if ((selected.seasonalityScope === "global" && !seasonalModel) || (selected.trendScope === "global" && !trendModel)) return { rawPanel, panel: null, cfg: null, run: null };
  const lastWeek = rawPanel.week.at(-1);
  const offsetModel = seasonalModel || trendModel ? {
    offsetAt: (week) => (seasonalModel?.offsetAt(week) || 0) + (trendModel?.trendOffsetAt(week) || 0),
    futureOffsetAt: (week) => (seasonalModel?.offsetAt(week) || 0) + mmmForecastDampedTrendOffset(
      trendModel,
      lastWeek,
      week,
      selected.trendDamping ?? MMM_FORECAST_DEFAULT_TREND_DAMPING,
    ),
  } : null;
  const panel = offsetModel
    ? { ...rawPanel, targets: { ...rawPanel.targets, [target]: rawPanel.targets[target].map((value, index) => value - offsetModel.offsetAt(rawPanel.week[index])) } }
    : rawPanel;
  const declaredCfg = {
    ...sourceCfg,
    absorbed: new Set(),
    // Rolling selector가 identity/log1p/Hill+adstock을 비교했으면 최종 전체이력
    // 재적합도 같은 후보군 계약을 사용해야 한다. 이 값을 빼면 최종 run만
    // sourceCfg 기본값(Hill-only)으로 되돌아가 선택과 배포 모델이 달라진다.
    // Refit the exact transform policy that won rolling selection. Falling
    // back to the full grid here would deploy a different estimator.
    mediaTransformFamilies: selected?.mediaTransformFamilies?.length
      ? selected.mediaTransformFamilies.slice()
      : selection?.transformGrid?.families?.length
        ? selection.transformGrid.families.slice()
        : sourceCfg.mediaTransformFamilies,
    mediaPenalty: Number.isFinite(selected.mediaPenalty) ? selected.mediaPenalty : sourceCfg.mediaPenalty,
    seasonalityPeriods: selected.seasonalityScope === "recent" ? selected.seasonalityPeriods : [],
    includeTrend: selected.trendScope === "recent",
    baselineKnots: [],
  };
  declaredCfg.absorbed = mmmResolveAbsorb(panel, declaredCfg).absorbed;
  const fitContract = mmmForecastDeclaredFitContract(declaredCfg, {
    skipTransformUncertainty: true,
    trendDamping: selected.trendDamping ?? MMM_FORECAST_DEFAULT_TREND_DAMPING,
  });
  const run = mmmBayesianRun(panel, fitContract.cfg, target, false, fitContract.options);
  return { rawPanel, baselinePanel, panel, cfg: fitContract.cfg, run, seasonalModel: offsetModel };
}

export function buildForecastOnlyModelFromPanel(sourcePanel, sourceCfg, target, options = {}) {
  const forecastPanel = calendarizeForecastPanel(sourcePanel);
  const selection = Object.prototype.hasOwnProperty.call(options, "selection")
    ? options.selection
    : mmmForecastRollingSelection(forecastPanel, sourceCfg, target, {
      horizon: options.horizon,
      ...(Number.isInteger(options.maxCandidateConfigurations)
        ? { maxCandidateConfigurations: options.maxCandidateConfigurations }
        : {}),
    });
  const selected = selection?.productionSelected || selection?.selected;
  if (!selected) return { selection, sourcePanel: forecastPanel, sourceCfg, target, panel: null, cfg: null, run: null };
  return { ...buildForecastModelForSelection(forecastPanel, sourceCfg, target, selected, selection), selection, forecastSelected: selected, sourcePanel: forecastPanel, sourceCfg, target };
}

// 과거 운영 체제가 현재와 달라진 경우, 최근 구간만으로 다시 학습·검증할 수 있다.
// 단순히 최근 window를 고르는 기존 내부 Cost window와 다르다. 이 함수는 입력의
// 앞부분을 통째로 제외한 뒤 그 남은 기간 안에서만 rolling OOS를 만든다.
export function sliceForecastTrainingWindow(panel, trainingWeeks = null) {
  const n = panel?.week?.length || 0;
  const keep = Number(trainingWeeks);
  if (!Number.isInteger(keep) || keep <= 0 || keep >= n) return panel;
  return sliceMmmPanel(panel, n, n - keep);
}

export function scanForecastRegimeWindows(models, { candidateWeeks = [208, 156, 130, 104, 78], minimumWeeks = 78 } = {}) {
  const items = (Array.isArray(models) ? models : [models]).filter((model) => model?.sourcePanel && model?.sourceCfg && model?.target);
  if (!items.length) return { available: false, reason: "missing-source", candidates: [], recommended: null };
  const maxWeeks = Math.min(...items.map((model) => model.sourcePanel.week?.length || 0));
  const windows = [...new Set([maxWeeks, ...candidateWeeks])]
    .filter((weeks) => Number.isInteger(weeks) && weeks >= minimumWeeks && weeks <= maxWeeks)
    .sort((a, b) => b - a);
  const candidates = windows.map((trainingWeeks) => {
    const fitted = items.map((model) => {
      const sourcePanel = sliceForecastTrainingWindow(model.sourcePanel, trainingWeeks);
      return buildForecastOnlyModelFromPanel(sourcePanel, model.sourceCfg, model.target, {
        horizon: model.selection?.horizon || 13,
        maxCandidateConfigurations: forecastBackgroundCandidateCap(sourcePanel),
      });
    });
    // 후보 기간 비교는 마지막 12주를 보지 않은 nested 선택값으로만 한다.
    // productionSelected는 감사가 끝난 뒤 실제 미래 예측에 쓰는 값이라 여기의
    // 기간 추천에 쓰면 마지막 감사 구간이 간접적으로 새어 들어갈 수 있다.
    const selections = fitted.map((model) => model.selection?.selected);
    const backtests = fitted.map((model) => buildForecastRecentBacktest(model));
    const available = selections.every((selection) => Number.isFinite(selection?.wmape))
      && backtests.every((backtest) => Number.isFinite(backtest?.wmape));
    const startLabel = fitted[0]?.sourcePanel?.weekLabel?.[0] || null;
    const endLabel = fitted[0]?.sourcePanel?.weekLabel?.at(-1) || null;
    return {
      trainingWeeks,
      startLabel,
      endLabel,
      available,
      // 여러 OS를 합산하는 경우 한 OS만 좋아도 추천하지 않는다. 각 OS의 개발
      // OOS·봉인 OOS 중 가장 나쁜 값을 대표값으로 삼는다.
      developmentWmape: available ? Math.max(...selections.map((selection) => selection.wmape)) : null,
      latestWmape: available ? Math.max(...backtests.map((backtest) => Number(backtest.wmape))) : null,
      decisionEligible: available && fitted.every((model) => model.selection?.decisionEligible),
    };
  });
  const full = candidates.find((candidate) => candidate.trainingWeeks === maxWeeks && candidate.available) || null;
  const eligibleShorter = candidates.filter((candidate) => candidate.available && candidate.decisionEligible && candidate.trainingWeeks < maxWeeks);
  const bestShorter = eligibleShorter.slice().sort((a, b) => a.developmentWmape - b.developmentWmape || b.trainingWeeks - a.trainingWeeks)[0] || null;
  // 마지막 12주는 후보 선택에 사용하지 않는다. 추천 판단은 development OOS만으로,
  // 오래된 체제가 실제로 방해가 된 경우(상대 20% + 절대 3%p 개선)에만 열린다.
  const recommended = full && bestShorter
    && full.developmentWmape > 10
    && bestShorter.developmentWmape <= full.developmentWmape * 0.8
    && full.developmentWmape - bestShorter.developmentWmape >= 3
    ? bestShorter
    : null;
  return { available: !!full, full, candidates, recommended };
}

// Paid·Organic 자동 탐색은 모델 내부에서 104주 이하의 보조 창을 고르지만,
// 오래된 운영 체계를 통째로 제외한 뒤 OOS를 다시 평가하지는 않았다. 이 함수는
// 그 바깥 학습 기간까지 비교한다. 연간/유사시즌 후보에는 최소 91주가 필요하다.
export function scanAnnualForecastRegimeWindows({
  totalPanel,
  androidPanel,
  iosPanel,
  target,
  horizon = 13,
  allowedProductionRoutes,
} = {}, { candidateWeeks = [208, 156, 130, 104, 91] } = {}) {
  const panels = [totalPanel, androidPanel, iosPanel];
  if (panels.some((panel) => !panel?.week?.length) || !target) {
    return { available: false, reason: "missing-source", candidates: [], recommended: null };
  }
  const minimumWeeks = Math.max(91, 68 + horizon);
  const maxWeeks = Math.min(...panels.map((panel) => panel.week.length));
  const windows = [...new Set([maxWeeks, ...candidateWeeks])]
    .filter((weeks) => Number.isInteger(weeks) && weeks >= minimumWeeks && weeks <= maxWeeks)
    .sort((a, b) => b - a);
  const candidates = windows.map((trainingWeeks) => {
    const annual = runAnnualAnalogRouter({
      totalPanel: sliceForecastTrainingWindow(totalPanel, trainingWeeks),
      androidPanel: sliceForecastTrainingWindow(androidPanel, trainingWeeks),
      iosPanel: sliceForecastTrainingWindow(iosPanel, trainingWeeks),
      target,
      horizon,
      allowedProductionRoutes,
    });
    const selected = annual?.selected;
    const componentDevelopmentPass = annual?.componentGuardrailRequired === false
      || ((annual?.osGuardrail || []).length >= 2
        && annual.osGuardrail.every((item) => Number.isFinite(item.developmentWmape) && item.developmentWmape < 10));
    const available = Number.isFinite(selected?.developmentWmape) && Number.isFinite(selected?.latestWmape);
    return {
      trainingWeeks,
      startLabel: totalPanel.weekLabel?.[Math.max(0, totalPanel.week.length - trainingWeeks)] || null,
      endLabel: totalPanel.weekLabel?.at(-1) || null,
      available,
      developmentWmape: available ? selected.developmentWmape : null,
      latestWmape: available ? selected.latestWmape : null,
      // 마지막 12주 감사는 기간 선택에 쓰지 않는다. 개발 OOS와 OS별 개발
      // 검증만으로 "더 짧은 기간을 검토할 자격"을 판정한다.
      decisionEligible: available && selected.developmentWmape < 10 && componentDevelopmentPass,
    };
  });
  const full = candidates.find((candidate) => candidate.trainingWeeks === maxWeeks && candidate.available) || null;
  const bestShorter = candidates
    .filter((candidate) => candidate.available && candidate.decisionEligible && candidate.trainingWeeks < maxWeeks)
    .sort((a, b) => a.developmentWmape - b.developmentWmape || b.trainingWeeks - a.trainingWeeks)[0] || null;
  const recommended = full && bestShorter
    && full.developmentWmape > 10
    && bestShorter.developmentWmape <= full.developmentWmape * 0.8
    && full.developmentWmape - bestShorter.developmentWmape >= 3
    ? bestShorter
    : null;
  return { available: !!full, full, candidates, recommended };
}

export function buildForecastOnlyModel(mmm, horizon = 12) {
  return buildForecastOnlyModelFromPanel(mmm.panel, mmm.cfg, mmm.target, { horizon });
}

export function sumTail(parts, field, length) {
  return Array.from({ length }, (_, index) => parts.reduce((sum, part) => {
    const values = part[field] || [];
    return sum + (Number(values[values.length - length + index]) || 0);
  }, 0));
}

// Total 미래예측은 독립 Total 회귀가 아니라 OS별 예측의 항등 합이다.
// 두 OS의 학습창이 다를 수 있어 과거 차트·검증은 공통 최신 구간으로 맞춘다.
export function mmmSumOsForecasts(parts) {
  const valid = (parts || []).filter((part) => part?.actual?.length && part?.predFut?.length);
  if (valid.length !== 2) return null;
  const historyLength = Math.min(...valid.map((part) => part.actual.length));
  const horizon = Math.min(...valid.map((part) => part.predFut.length));
  if (historyLength < 1 || horizon < 1) return null;
  const actual = sumTail(valid, "actual", historyLength);
  const fittedHist = sumTail(valid, "fittedHist", historyLength);
  const predFut = Array.from({ length: horizon }, (_, index) => valid.reduce((sum, part) => sum + (Number(part.predFut[index]) || 0), 0));
  const baselineFut = Array.from({ length: horizon }, (_, index) => valid.reduce((sum, part) => sum + (Number(part.baselineFut?.[index]) || 0), 0));
  const lo = Array.from({ length: horizon }, (_, index) => valid.reduce((sum, part) => sum + (Number(part.lo?.[index]) || 0), 0));
  const hi = Array.from({ length: horizon }, (_, index) => valid.reduce((sum, part) => sum + (Number(part.hi?.[index]) || 0), 0));
  const mean = actual.reduce((sum, value) => sum + value, 0) / historyLength;
  const sse = actual.reduce((sum, value, index) => sum + (value - fittedHist[index]) ** 2, 0);
  const sst = actual.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const last = valid[0];
  return {
    model: "android-ios-additive",
    isBayesian: true,
    isAdditiveTotal: true,
    horizon,
    r2: sst > 0 ? +(1 - sse / sst).toFixed(4) : null,
    actual,
    fittedHist,
    predFut,
    baselineFut,
    lo,
    hi,
    histLabels: (last.histLabels || []).slice(-historyLength),
    futLabels: (last.futLabels || []).slice(0, horizon),
    labels: [...(last.histLabels || []).slice(-historyLength), ...(last.futLabels || []).slice(0, horizon)],
    splitAt: historyLength,
    intervalLabel: "90% additive reference interval (Android + iOS bounds)",
    chans: valid.flatMap((part) => part.chans || []),
    recentMean: Object.assign({}, ...valid.map((part) => part.recentMean || {})),
    futSpendByKey: Object.assign({}, ...valid.map((part) => part.futSpendByKey || {})),
    scenarioWarnings: valid.flatMap((part) => part.scenarioWarnings || []),
    steps: valid.flatMap((part) => part.steps || []),
    excelModels: valid.flatMap((part) => part.excelModels || []),
    components: valid,
  };
}

export function buildPaidOrganicPlatformModel(
  prepared,
  horizon = 12,
  buildModel = null,
) {
  const sourcePanel = prepared?.sourcePanel;
  const target = prepared?.target;
  const total = sourcePanel?.targets?.[target];
  const paid = sourcePanel?.targets?.PaidRegs;
  if (!total?.length || paid?.length !== total.length) {
    return {
      platform: prepared?.platform,
      reason: "paid-target-unavailable",
    };
  }
  const invalidIndex = paid.findIndex((value, index) =>
    !Number.isFinite(value)
    || value < 0
    || !Number.isFinite(total[index])
    || value > total[index] + Math.max(1, Math.abs(total[index]) * 0.001),
  );
  if (invalidIndex >= 0) {
    return {
      platform: prepared.platform,
      reason: `paid-total-identity-invalid:${invalidIndex}`,
    };
  }
  const detailedOrganicPanel = {
    ...sourcePanel,
    targets: {
      ...sourcePanel.targets,
      OrganicRegs: forecastOrganicTargetValues("Regs", total, paid),
    },
  };
  // Organic halo는 채널 귀속 실측이 아니다. 희소 채널별 계수를 각각 적합하면
  // 동일한 총 Spend 움직임을 여러 계수가 나눠 먹으며 OOS가 불안정해진다.
  // Brand/Performance 총량으로만 적합하고, Paid 직접반응은 원 채널을 유지한다.
  const organicPanel = buildMmmAggregateMediaPanel(detailedOrganicPanel) || detailedOrganicPanel;
  const organicCfg = { ...prepared.cfg, absorbed: new Set(), allowSignedMedia: true };
  organicCfg.absorbed = mmmResolveAbsorb(organicPanel, organicCfg).absorbed;
  const resolveModel = buildModel || ((panel, cfg, modelTarget) =>
    buildForecastOnlyModelFromPanel(panel, cfg, modelTarget, { horizon }));
  const organicModel = {
    ...resolveModel(
      organicPanel,
      organicCfg,
      "OrganicRegs",
      `${prepared.platform}-organic`,
    ),
    sourcePanel: organicPanel,
    sourceCfg: organicCfg,
    target: "OrganicRegs",
    platform: prepared.platform,
    componentType: "organic",
    aggregateHalo: Boolean(organicPanel.aggregateMediaGroups?.length),
    haloMemberRecentMean: Object.fromEntries(Object.entries(detailedOrganicPanel.ch || {}).map(([key, values]) => {
      const recent = values.slice(-12).filter(Number.isFinite);
      return [key, recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : 0];
    })),
  };
  const paidModel = {
    ...resolveModel(
      sourcePanel,
      prepared.cfg,
      "PaidRegs",
      `${prepared.platform}-paid`,
    ),
    sourcePanel,
    sourceCfg: prepared.cfg,
    target: "PaidRegs",
    platform: prepared.platform,
    componentType: "paid",
  };
  return {
    platform: prepared.platform,
    target,
    sourcePanel,
    organicModel,
    paidModel,
    reason: !organicModel.run || !organicModel.panel
      ? "organic-model-unavailable"
      : !paidModel.run || !paidModel.panel
        ? "paid-model-unavailable"
        : null,
  };
}

export function paidOrganicHaloBudgets(model, budgets = {}) {
  const groups = model?.panel?.aggregateMediaGroups;
  if (!groups?.length) return budgets;
  return Object.fromEntries(groups.map((group) => {
    const changed = group.members.filter((key) => Number.isFinite(Number(budgets[key])));
    if (!changed.length) return [group.key, null];
    const groupHistory = model.panel.ch?.[group.key] || [];
    const recent = groupHistory.slice(-12).filter(Number.isFinite);
    const base = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : 0;
    const adjusted = changed.reduce((sum, key) =>
      sum + Number(budgets[key]) - (Number(model.haloMemberRecentMean?.[key]) || 0), base);
    return [group.key, Math.max(0, adjusted)];
  }).filter(([, value]) => value != null));
}

export function combinePaidOrganicForecastParts(organic, paid, platform) {
  const combined = mmmSumOsForecasts([organic, paid]);
  if (!combined) return null;
  const historyLength = combined.actual.length;
  const horizon = combined.predFut.length;
  const organicHist = (organic.fittedHist || []).slice(-historyLength).map((value) => Math.max(0, Number(value) || 0));
  const performanceHist = (paid.fittedHist || []).slice(-historyLength).map((value) => Math.max(0, Number(value) || 0));
  const organicFut = (organic.predFut || []).slice(0, horizon).map((value) => Math.max(0, Number(value) || 0));
  const performanceFut = (paid.predFut || []).slice(0, horizon).map((value) => Math.max(0, Number(value) || 0));
  const organicBaseFut = (organic.baselineFut || []).slice(0, horizon).map((value) => Math.max(0, Number(value) || 0));
  const organicHaloFut = organicFut.map((value, index) =>
    value - (Number(organicBaseFut[index]) || 0),
  );
  const fittedHist = organicHist.map((value, index) => value + performanceHist[index]);
  const actualMean = combined.actual.reduce((sum, value) => sum + value, 0) / historyLength;
  const fittedSse = combined.actual.reduce((sum, value, index) => sum + (value - fittedHist[index]) ** 2, 0);
  const fittedSst = combined.actual.reduce((sum, value) => sum + (value - actualMean) ** 2, 0);
  // 예산 입력은 Paid의 원 채널만 노출한다. Organic aggregate halo는 같은 원
  // 채널 예산을 Brand/Performance 총량으로 변환해 내부에서만 사용한다.
  const chans = paid.chans?.length
    ? paid.chans
    : [...new Map([...(organic.chans || []), ...(paid.chans || [])].map((channel) => [channel.key, channel])).values()];
  return {
    ...combined,
    model: "organic-paid-spend-split",
    isPaidOrganicSplit: true,
    platform,
    r2: fittedSst > 0 ? +(1 - fittedSse / fittedSst).toFixed(4) : null,
    fittedHist,
    predFut: organicFut.map((value, index) => value + performanceFut[index]),
    lo: (combined.lo || []).slice(0, horizon).map((value) => Math.max(0, Number(value) || 0)),
    hi: (combined.hi || []).slice(0, horizon).map((value, index) =>
      Math.max(organicFut[index] + performanceFut[index], Number(value) || 0),
    ),
    organicHist,
    performanceHist,
    organicFut,
    performanceFut,
    organicBaseFut,
    organicHaloFut,
    // PaidRegs는 정의상 Spend가 0이면 0이다. Total의 zero-media 기준선에는
    // Paid 회귀의 절편을 더하지 않고 Organic의 비매체 기준선만 사용한다.
    baselineFut: organicBaseFut,
    chans,
    recentMean: paid.recentMean || combined.recentMean,
    futSpendByKey: paid.futSpendByKey || combined.futSpendByKey,
    steps: organic.steps || [],
    scenarioWarnings: [
      ...(organic.scenarioWarnings || []).map((warning) => ({ ...warning, component: "organic" })),
      ...(paid.scenarioWarnings || []).map((warning) => ({ ...warning, component: "paid" })),
    ],
    componentForecasts: { organic, paid },
  };
}

export function combinePaidOrganicPlatforms(parts) {
  const valid = (parts || []).filter((part) => part?.isPaidOrganicSplit);
  if (valid.length === 1) {
    return {
      ...valid[0],
      isAdditiveTotal: false,
      platformForecasts: valid,
      components: valid,
    };
  }
  const combined = mmmSumOsForecasts(valid);
  if (!combined || valid.length !== 2) return null;
  const historyLength = combined.actual.length;
  const horizon = combined.predFut.length;
  const sumHistory = (field) => sumTail(valid, field, historyLength);
  const sumFuture = (field) => Array.from({ length: horizon }, (_, index) =>
    valid.reduce((sum, part) => sum + (Number(part[field]?.[index]) || 0), 0),
  );
  const chans = [...new Map(valid.flatMap((part) => part.chans || []).map((channel) => [channel.key, channel])).values()];
  return {
    ...combined,
    model: "android-ios-organic-paid-spend-split",
    isPaidOrganicSplit: true,
    isAdditiveTotal: true,
    actual: sumHistory("actual"),
    fittedHist: sumHistory("fittedHist"),
    organicHist: sumHistory("organicHist"),
    performanceHist: sumHistory("performanceHist"),
    predFut: sumFuture("predFut"),
    organicFut: sumFuture("organicFut"),
    performanceFut: sumFuture("performanceFut"),
    organicBaseFut: sumFuture("organicBaseFut"),
    organicHaloFut: sumFuture("organicHaloFut"),
    baselineFut: sumFuture("organicBaseFut"),
    lo: sumFuture("lo"),
    hi: sumFuture("hi"),
    chans,
    recentMean: Object.assign({}, ...valid.map((part) => part.recentMean || {})),
    futSpendByKey: Object.assign({}, ...valid.map((part) => part.futSpendByKey || {})),
    platformForecasts: valid,
    components: valid,
  };
}

export function runPaidOrganicSplitScenario(model, horizon, budgets, stepOff, options = {}) {
  const platformForecasts = (model?.components || []).map((component) => {
    const organic = runForecastScenario(
      component.organicModel,
      horizon,
      paidOrganicHaloBudgets(component.organicModel, budgets),
      stepOff,
      options,
    );
    const paid = runForecastScenario(component.paidModel, horizon, budgets, stepOff, options);
    return combinePaidOrganicForecastParts(organic, paid, component.platform);
  });
  return combinePaidOrganicPlatforms(platformForecasts);
}

export function nonnegativeForecastBacktest(backtest) {
  if (!backtest?.actual?.length || backtest.predicted?.length !== backtest.actual.length) return backtest;
  const predicted = backtest.predicted.map((value) => Math.max(0, Number(value) || 0));
  const start = Math.max(0, backtest.validationStartIndex || 0);
  const actual = backtest.actual.slice(start);
  const validationPredicted = predicted.slice(start);
  const absoluteErrors = actual.map((value, index) => Math.abs(value - validationPredicted[index]));
  const denominator = actual.reduce((sum, value) => sum + Math.abs(value), 0);
  const updatedWmape = denominator > 0
    ? absoluteErrors.reduce((sum, value) => sum + value, 0) / denominator * 100
    : null;
  return {
    ...backtest,
    predicted,
    rmse: absoluteErrors.length
      ? Math.sqrt(absoluteErrors.reduce((sum, value) => sum + value ** 2, 0) / absoluteErrors.length)
      : null,
    mae: absoluteErrors.length
      ? absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length
      : null,
    wmape: updatedWmape,
    reliable: Number.isFinite(updatedWmape) && updatedWmape < 10,
    referenceOnly: Number.isFinite(updatedWmape) && updatedWmape >= 10 && updatedWmape < 30,
  };
}

export function certifyForecastBacktest(backtest, componentMetrics = []) {
  if (!backtest) return null;
  const metrics = (componentMetrics || []).map((metric) => ({
    ...metric,
    passed: Number.isFinite(metric.wmape) && metric.wmape < 10,
  }));
  const finiteComponents = metrics.filter((metric) => Number.isFinite(metric.wmape));
  const worstComponent = finiteComponents.slice().sort((left, right) => right.wmape - left.wmape)[0] || null;
  const totalPassed = Number.isFinite(backtest.wmape) && backtest.wmape < 10;
  const componentsPassed = metrics.length === 0 || (finiteComponents.length === metrics.length && metrics.every((metric) => metric.passed));
  // Structural and annual routers also require development-OOS and component
  // guardrails. A good latest Total fold must never overwrite that authoritative
  // decision and unlock budget scenarios on its own.
  const authoritativeGatePassed = backtest.certificationGate !== false;
  return {
    ...backtest,
    componentMetrics: metrics.length ? metrics : backtest.componentMetrics,
    worstComponent,
    reliable: totalPassed && componentsPassed && authoritativeGatePassed,
    referenceOnly: Number.isFinite(backtest.wmape)
      && backtest.wmape >= 10
      && backtest.wmape < 30
      && componentsPassed
      && authoritativeGatePassed,
    certificationThreshold: 10,
  };
}

export function buildPaidOrganicRecentBacktest(model) {
  const platformBacktests = (model?.components || []).map((component) => {
    const organic = nonnegativeForecastBacktest(buildForecastRecentBacktest(component.organicModel));
    const paid = nonnegativeForecastBacktest(buildForecastRecentBacktest(component.paidModel));
    const total = mmmSumOsBacktests([organic, paid]);
    return total ? {
      platform: component.platform,
      total,
      organic,
      paid,
    } : null;
  }).filter(Boolean);
  if (platformBacktests.length === 1) {
    const item = platformBacktests[0];
    const componentMetrics = [
      { platform: item.platform, component: "organic", wmape: item.organic.wmape },
      { platform: item.platform, component: "paid", wmape: item.paid.wmape },
      { platform: item.platform, component: "total", wmape: item.total.wmape },
    ];
    return certifyForecastBacktest({
      ...item.total,
      segmentMetrics: {
        organic: item.organic.wmape,
        paid: item.paid.wmape,
        total: item.total.wmape,
      },
    }, componentMetrics);
  }
  if (platformBacktests.length !== 2) return null;
  const organic = mmmSumOsBacktests(platformBacktests.map((item) => item.organic));
  const paid = mmmSumOsBacktests(platformBacktests.map((item) => item.paid));
  const total = organic && paid ? mmmSumOsBacktests([organic, paid]) : null;
  const componentMetrics = platformBacktests.flatMap((item) => [
    { platform: item.platform, component: "organic", wmape: item.organic.wmape },
    { platform: item.platform, component: "paid", wmape: item.paid.wmape },
    { platform: item.platform, component: "total", wmape: item.total.wmape },
  ]);
  return total ? certifyForecastBacktest({
    ...total,
    segmentMetrics: {
      organic: organic.wmape,
      paid: paid.wmape,
      total: total.wmape,
    },
  }, componentMetrics) : null;
}

export function mmmSumOsBacktests(parts) {
  const valid = (parts || []).filter((part) => part?.actual?.length && part?.predicted?.length);
  if (valid.length !== 2) return null;
  const length = Math.min(...valid.map((part) => part.actual.length));
  const validationLength = Math.min(...valid.map((part) => part.actual.length - part.validationStartIndex));
  if (length < 2 || validationLength < 1) return null;
  const actual = sumTail(valid, "actual", length);
  const predicted = sumTail(valid, "predicted", length);
  const validationStartIndex = length - validationLength;
  const validationActual = actual.slice(validationStartIndex);
  const validationPredicted = predicted.slice(validationStartIndex);
  const absErrors = validationActual.map((value, index) => Math.abs(value - validationPredicted[index]));
  const actualTotal = validationActual.reduce((sum, value) => sum + Math.abs(value), 0);
  const wmape = actualTotal > 0 ? absErrors.reduce((sum, value) => sum + value, 0) / actualTotal * 100 : null;
  return certifyForecastBacktest({
    labels: (valid[0].labels || []).slice(-length),
    actual,
    predicted,
    validationStartIndex,
    rmse: Math.sqrt(absErrors.reduce((sum, value) => sum + value ** 2, 0) / validationLength),
    mae: absErrors.reduce((sum, value) => sum + value, 0) / validationLength,
    wmape,
    certificationGate: valid.every((part) => part.certificationGate !== false),
  });
}

export function annualAnalogForecastShape(model) {
  const selected = model?.annual?.selected;
  const auditSelected = model?.annual?.auditSelected || selected?.auditSelected;
  const productionSelected = model?.annual?.productionSelected || selected?.productionSelected;
  const interval = model?.annual?.interval || selected?.interval;
  const panel = model?.totalPanel;
  const target = model?.target;
  const future = selected?.future?.predicted;
  const latest = selected?.latest;
  const actualSeries = panel?.targets?.[target];
  if (!future?.length || !latest?.predicted?.length || !actualSeries?.length) return null;
  const margin = selected.marginByHorizon || Array(future.length).fill(0);
  const labels = panel.weekLabel || panel.dateLabel || panel.week;
  const futureLabels = Array.from({ length: future.length }, (_, index) => {
    const raw = labels.at(-1);
    const parsed = isoDateFromLabel(raw);
    if (!parsed) return `+${index + 1}`;
    const date = new Date(`${parsed}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 7 * (index + 1));
    return date.toISOString().slice(0, 10);
  });
  return {
    model: model.annual.model,
    isAnnualAnalog: true,
    annualQualified: model.annual.qualified,
    annualBestAvailable: model.annual.bestAvailable === true,
    organicOnly: model.organicOnly === true,
    paidOrganicHybrid: model.annual.paidOrganicHybrid === true,
    adaptiveModelSearch: model.annual.adaptiveModelSearch === true,
    modelSearch: model.annual.modelSearch || null,
    annualOsGuardrail: model.annual.osGuardrail || [],
    annualComponentGuardrailRequired: model.annual.componentGuardrailRequired !== false,
    selectedRoute: model.annual.selectedRoute,
    annualCandidates: model.annual.candidates.map((candidate) => ({
      route: candidate.route,
      developmentWmape: candidate.developmentWmape,
      allWmape: candidate.allWmape,
      latestWmape: candidate.latestWmape,
      latestPersistenceWmape: candidate.latestPersistenceWmape,
      comparisonOrigins: candidate.comparisonOrigins,
      comparisonScope: candidate.comparisonScope,
    })),
    actual: actualSeries.slice(-latest.actual.length),
    fittedHist: latest.predicted,
    organicHist: latest.organicPredicted,
    performanceHist: latest.performancePredicted,
    predFut: future,
    organicFut: selected.future.organic,
    performanceFut: selected.future.performance,
    baselineFut: future,
    lo: future.map((value, index) => Math.max(0, value - (margin[index] || 0))),
    hi: future.map((value, index) => value + (margin[index] || 0)),
    histLabels: labels.slice(-latest.actual.length),
    futLabels: futureLabels,
    labels: [...labels.slice(-latest.actual.length), ...futureLabels],
    splitAt: latest.actual.length,
    horizon: future.length,
    intervalLabel: interval?.labelEn || "Reference range from horizon-specific P90 absolute errors in rolling OOS",
    intervalLabelKo: interval?.labelKo || "Rolling OOS의 예측 주차별 P90 절대오차 참고범위",
    intervalLabelEn: interval?.labelEn || "Reference range from horizon-specific P90 absolute errors in rolling OOS",
    intervalCalibration: interval?.method || "rolling-oos-horizon-p90-absolute-error",
    intervalCalibrationEligible: interval?.calibrationEligible === true,
    intervalCalibrationFoldCount: Number(interval?.calibrationFoldCount) || 0,
    intervalCalibrationMinFolds: Number(interval?.minimumFolds) || FORECAST_INTERVAL_MIN_FOLDS,
    intervalObservedOuterFolds: Number(interval?.observedOuterFoldCount) || 0,
    intervalCoverageGuarantee: interval?.isCoverageGuarantee === true,
    forecastSelectionProvenance: model.annual.provenance || null,
    chans: [],
    recentMean: {},
    futSpendByKey: {},
    scenarioWarnings: [],
    steps: (panel.stepDefs || []).map((step) => ({ ...step, label: step.label })),
    rollingSelection: {
      enabled: true,
      decisionEligible: false,
      decisionReasons: ["annual-analog-no-budget-response"],
      foldStep: model.annual.provenance?.foldStride || model.annual.foldStep,
      selected: {
        window: auditSelected?.window || selected.spec?.window || selected.spec?.maxTrainingWeeks || null,
        windowMode: "auto-selected",
        spec: auditSelected?.specId || selected.spec?.id || "time-series-auto-search",
        family: auditSelected?.family || selected.spec?.kind || "auto",
        route: auditSelected?.route || selected.route,
        controlPolicy: "time-series-auto-search",
        folds: model.annual.provenance?.selectionFolds || selected.folds,
        wmape: selected.developmentWmape,
        latestWmape: selected.latestWmape,
        persistenceWmape: selected.latestPersistenceWmape,
      },
      productionSelected: {
        window: productionSelected?.window || selected.spec?.window || selected.spec?.maxTrainingWeeks || null,
        windowMode: "auto-selected",
        spec: productionSelected?.specId || selected.spec?.id || "time-series-auto-search",
        family: productionSelected?.family || selected.spec?.kind || "auto",
        route: productionSelected?.route || selected.route,
        controlPolicy: "time-series-auto-search",
        folds: model.annual.provenance?.selectionFolds || selected.folds,
        wmape: selected.developmentWmape,
        latestWmape: selected.latestWmape,
        persistenceWmape: selected.latestPersistenceWmape,
      },
    },
  };
}

export function annualAnalogBacktestShape(model) {
  const selected = model?.annual?.selected;
  const panel = model?.totalPanel;
  const target = model?.target;
  const latest = selected?.latest;
  if (!latest || !panel?.targets?.[target]) return null;
  const targetSeries = panel.targets[target];
  const contextLength = Math.min(
    latest.actual.length,
    Math.max(0, targetSeries.length - latest.actual.length),
  );
  return {
    labels: (panel.weekLabel || panel.dateLabel || panel.week).slice(-(latest.actual.length + contextLength)),
    actual: targetSeries.slice(-(latest.actual.length + contextLength)),
    predicted: [...targetSeries.slice(-(latest.actual.length + contextLength), -latest.actual.length), ...latest.predicted],
    validationStartIndex: contextLength,
    wmape: latest.wmape,
    reliable: model.annual.qualified === true,
    certificationGate: model.annual.qualified === true,
  };
}

export function buildOsForecastPanel(headers, rows, colMap, platform, target, locale, weekStart, allowNoSpend = false) {
  const built = buildPanelFromColMap(headers, rows, colMap, platform, locale, null, { weekStart });
  const missing = allowNoSpend
    ? built.missing.filter((item) => !["채널 spend 1개 이상", "1+ channel spend"].includes(item))
    : built.missing;
  if (missing.length) return { platform, reason: `missing: ${missing.join(", ")}` };
  const panel = calendarizeForecastPanel(trimToActive(built.panel));
  const resolvedTarget = pickTarget(panel, target);
  const validate = mmmValidate(panel, locale, resolvedTarget);
  if (validate.issues?.length) return { platform, reason: validate.issues.join(" ") };
  const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
  cfg.absorbed = mmmResolveAbsorb(panel, cfg).absorbed;
  return { platform, target: resolvedTarget, sourcePanel: panel, cfg };
}

export function buildOsForecastComponent(headers, rows, colMap, platform, target, locale, weekStart, horizon = 12) {
  const prepared = buildOsForecastPanel(headers, rows, colMap, platform, target, locale, weekStart);
  if (!prepared.sourcePanel) return prepared;
  const { sourcePanel: panel, cfg, target: resolvedTarget } = prepared;
  const model = buildForecastOnlyModelFromPanel(panel, cfg, resolvedTarget, { horizon });
  return { ...model, ...prepared };
}

export function forecastOrganicTargetValues(target, total, paid) {
  if (!Array.isArray(total)) return [];
  if (target !== "Regs" || !Array.isArray(paid) || paid.length !== total.length) return total.slice();
  return total.map((value, index) => Math.max(0, value - paid[index]));
}

export function hasForecastSpendHistory(panel) {
  return Object.values(panel?.ch || {})
    .some((values) => (values || [])
      .some((value) => Number.isFinite(value) && value > 0));
}

export function hasPaidRegistrationTargets(preparedByPlatform) {
  if (preparedByPlatform?.all?.target !== "Regs") return false;
  return ["android", "ios"].every((platform) => {
    const prepared = preparedByPlatform?.[platform];
    const panel = prepared?.sourcePanel;
    return prepared?.target === "Regs"
      && Array.isArray(panel?.targets?.PaidRegs)
      && panel.targets.PaidRegs.length === panel.targets.Regs?.length;
  });
}

export function buildForecastExcelModel(model, rawForecast, restoredForecast, finalForecast = restoredForecast) {
  if (!model?.run || !rawForecast || !restoredForecast) return null;
  const historyOffset = (model.panel.week || []).map((week) => model.seasonalModel?.offsetAt?.(week) || 0);
  const futureOffset = (rawForecast.predFut || []).map((value, index) => (restoredForecast.predFut?.[index] ?? value) - value);
  return {
    platform: model.platform || "model",
    target: model.target,
    componentType: model.componentType || null,
    formulaCapability: model.run.meridianSpec?.enabled === true ? "snapshot" : "exact",
    formulaCapabilityReason: model.run.meridianSpec?.enabled === true
      ? "meridian-or-reach-frequency-transform-not-represented-by-the-csv-formula-compiler"
      : null,
    names: rawForecast.names || [],
    beta: rawForecast.beta || [],
    intercept: rawForecast.intercept,
    featureMeans: model.run.featureMeans || [],
    featureScales: model.run.featureScales || [],
    rawFeatureHistory: model.run.rawFeatureHistory || [],
    futureRawFeatures: (rawForecast.futureRows || []).map((row) => row.slice(1).map((value, index) =>
      value * (model.run.featureScales?.[index] || 1) + (model.run.featureMeans?.[index] || 0),
    )),
    params: model.run.params || {},
    chans: rawForecast.chans || [],
    aggregateMediaGroups: model.panel.aggregateMediaGroups || [],
    haloMemberRecentMean: model.haloMemberRecentMean || {},
    spendRanges: rawForecast.spendRanges || {},
    histSpendByKey: model.panel.ch || {},
    futSpendByKey: rawForecast.futSpendByKey || {},
    requestedFutSpendByKey: Object.fromEntries((rawForecast.chans || []).map((channel) => {
      const requested = rawForecast.spendRanges?.[channel.key]?.requested;
      const effective = rawForecast.futSpendByKey?.[channel.key] || [];
      return [
        channel.key,
        Number.isFinite(requested)
          ? Array(effective.length).fill(requested)
          : effective.slice(),
      ];
    })),
    histLabels: rawForecast.histLabels || [],
    futLabels: rawForecast.futLabels || [],
    actual: restoredForecast.actual || [],
    historyOffset,
    futureOffset,
    futureLowerMargins: (finalForecast.lo || []).map((value, index) =>
      Math.max(0, (finalForecast.predFut?.[index] || 0) - value)),
    futureUpperMargins: (finalForecast.hi || []).map((value, index) =>
      Math.max(0, value - (finalForecast.predFut?.[index] || 0))),
    futureMargins: (finalForecast.hi || []).map((value, index) =>
      Math.max(0, value - (finalForecast.predFut?.[index] || 0))),
  };
}

export function runForecastScenario(model, horizon, budgets, stepOff, options = {}) {
  if (!model?.run || !model?.panel) return null;
  const chans = _mmmChans(model.panel).filter((ch) => model.panel.ch[ch.key]);
  const futureSpend = {};
  chans.forEach((ch) => {
    const budget = budgets[ch.key];
    if (budget != null && Number.isFinite(budget)) futureSpend[ch.key] = Array(horizon).fill(budget);
  });
  const futureSteps = {};
  Object.entries(stepOff).forEach(([scopedKey, keepWeeks]) => {
    const [platform, ...keyParts] = scopedKey.split("::");
    if (platform !== model.platform || !Number.isFinite(keepWeeks)) return;
    const key = keyParts.join("::");
    const rawIndex = model.run.names.indexOf(key);
    if (rawIndex < 0) return;
    const lastValue = model.run.rawFeatureHistory?.at(-1)?.[rawIndex] || 0;
    futureSteps[key] = options.eventPolicy === "off"
      ? Array(horizon).fill(0)
      : Array.from({ length: horizon }, (_, index) => index < keepWeeks ? lastValue : 0);
  });
  const result = mmmBayesianForecast(
    model.run,
    model.panel,
    Object.keys(futureSpend).length ? futureSpend : null,
    horizon,
    {
      futureSteps,
      trendDamping: model.forecastSelected?.trendDamping
        ?? options.trendDamping
        ?? MMM_FORECAST_DEFAULT_TREND_DAMPING,
    },
  );
  const restoredRegression = mmmForecastRestoreSeasonality(result, model.panel, model.seasonalModel);
  if (!restoredRegression) return null;
  const restored = mmmForecastApplySelectedBlend(
    restoredRegression,
    model.baselinePanel || model.rawPanel,
    model.target,
    model.forecastSelected,
  );
  const excelModel = buildForecastExcelModel(model, result, restoredRegression, restored);
  if (excelModel) {
    excelModel.selectedBlend = restored.selectedBlend;
    excelModel.blendApplied = restored.blendApplied === true;
    excelModel.blendBaselineFut = restored.blendBaselineFut || [];
  }
  return {
    ...restored,
    rollingSelection: model.selection,
    modelWindow: model.panel.week.length,
    platform: model.platform,
    scenarioWarnings: (restored.scenarioWarnings || []).map((warning) => ({ ...warning, key: `${model.platform}::${warning.key}` })),
    steps: (restored.steps || []).map((step) => ({ ...step, key: `${model.platform}::${step.key}`, label: `${model.platform} · ${step.label}` })),
    excelModels: excelModel ? [excelModel] : [],
  };
}

// rolling selector가 이미 만든 최신 nested outer fold를 그대로 공식 봉인 감사로
// 사용한다. 여기서 마지막 H주를 다시 자르고 selector를 또 호출하면 H를 이중으로
// 예약해, 충분한 데이터도 "이력 부족"으로 오판한다.
export function buildForecastRecentBacktest(model) {
  const sourcePanel = model?.sourcePanel;
  const target = model?.target;
  const holdout = Math.max(1, Math.min(52, model?.selection?.horizon || 13));
  const latest = model?.selection?.nested?.latest;
  if (!sourcePanel?.week?.length
    || !target
    || latest?.actual?.length !== holdout
    || latest?.predicted?.length !== holdout) return null;
  const actual = latest.actual.slice();
  const predicted = latest.predicted.map((value) => Math.max(0, Number(value) || 0));
  const absErrors = actual.map((value, index) => Math.abs(value - predicted[index]));
  const actualTotal = actual.reduce((sum, value) => sum + Math.abs(value), 0);
  const wmape = actualTotal > 0 ? absErrors.reduce((sum, value) => sum + value, 0) / actualTotal * 100 : null;
  return {
    labels: (sourcePanel.weekLabel || sourcePanel.week).slice(-holdout),
    actual,
    predicted,
    validationStartIndex: 0,
    validationHorizon: holdout,
    selectionTrainingWeeks: Math.max(0, sourcePanel.week.length - holdout),
    selectionWindow: latest.window ?? model.selection?.selected?.window ?? null,
    candidateId: latest.candidateId || null,
    rmse: Math.sqrt(absErrors.reduce((sum, value) => sum + value ** 2, 0) / holdout),
    mae: absErrors.reduce((sum, value) => sum + value, 0) / holdout,
    wmape,
    certificationGate: model.selection?.forecastDecisionEligible === true,
    decisionReasons: model.selection?.forecastDecisionReasons || [],
    reliable: Number.isFinite(wmape) && wmape < 10,
    referenceOnly: Number.isFinite(wmape) && wmape >= 10 && wmape < 30,
    certificationThreshold: 10,
  };
}

export function attributedForecastShape(route) {
  if (!route?.forecast || !route?.backtest) return null;
  const historyLength = route.backtest.actual.length;
  const channels = (route.forecast.channels || []).map((key) => ({ key, label: key.replace("::", " · "), kind: "perf" }));
  const futureSpendByKey = {};
  const recentMean = {};
  if (route.selectedRoute === "direct-total") {
    channels.forEach((channel, column) => {
      const values = (route.forecast.futureCosts || []).map((row) => Number(row[column]) || 0);
      futureSpendByKey[channel.key] = values;
      recentMean[channel.key] = Number(route.forecast.recentCosts?.[column]) || 0;
    });
  } else {
    (route.forecast.parts || []).forEach((part) => {
      part.panel.channels.forEach((name, column) => {
        const key = `${part.panel.platform}::${name}`;
        const values = (part.futureCosts || []).map((row) => Number(row[column]) || 0);
        futureSpendByKey[key] = values;
        recentMean[key] = Number(part.recentCosts?.[column]) || 0;
      });
    });
  }
  return {
    model: route.model,
    isBayesian: true,
    isStructural: true,
    structuralModelSpec: route.selectedSpec,
    structuralSelectedSpec: route.selectedSpec,
    structuralRoute: route.selectedRoute,
    structuralCandidates: route.candidates,
    structuralLookbackCandidates: route.lookbackCandidates,
    structuralEligible: route.eligible,
    structuralBudgetResponseEligible: route.budgetResponseEligible === true,
    structuralOsBreakdownEligible: route.osBreakdownEligible,
    structuralComponentCertificationComplete: route.componentCertificationComplete === true,
    structuralAllowedProductionRoutes: route.allowedProductionRoutes || [],
    structuralHistoricallyStable: route.historicallyStable,
    structuralThreshold: route.threshold,
    structuralShortTermEligible: route.shortTermEligible,
    structuralRecommendedHorizon: route.recommendedHorizon,
    structuralFoldStep: route.foldStep,
    structuralDiagnostics: route.diagnostics,
    intervalCalibrationEligible: route.intervalCalibrationEligible === true,
    intervalCalibrationFoldCount: Number(route.intervalCalibrationFoldCount || 0),
    intervalCalibrationMinFolds: Number(route.intervalCalibrationMinFolds) || FORECAST_INTERVAL_MIN_FOLDS,
    intervalObservedOuterFolds: Number(route.intervalObservedOuterFolds)
      || Number(route.intervalCalibrationFoldCount)
      || 0,
    r2: null,
    actual: route.backtest.actual,
    fittedHist: route.backtest.predicted,
    organicHist: route.backtest.organic,
    performanceHist: route.backtest.performance,
    predFut: route.forecast.predicted,
    organicFut: route.forecast.organic,
    performanceFut: route.forecast.performance,
    baselineFut: route.forecast.organic,
    lo: route.forecast.lo,
    hi: route.forecast.hi,
    histLabels: route.backtest.labels,
    futLabels: route.forecast.labels,
    labels: [...route.backtest.labels, ...route.forecast.labels],
    splitAt: historyLength,
    horizon: route.forecast.predicted.length,
    intervalLabel: route.intervalCalibrationEligible
      ? "Nested outer-OOS P90 absolute-error reference width"
      : "Point forecast; outer-OOS interval calibration unavailable",
    chans: channels,
    recentMean,
    futSpendByKey: futureSpendByKey,
    scenarioWarnings: [],
    steps: [],
    excelModels: [],
  };
}

export function forecastAssistPct(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}%` : null;
}

export function forecastPct(value, digits = 2) {
  return Number.isFinite(value) ? `${value.toFixed(digits)}%` : "—";
}

export function forecastSelectionDecisionText(decision, lang = "ko") {
  const winner = decision?.winner;
  if (!winner) return "";
  const pct = (value) => Number.isFinite(value) ? `${value.toFixed(2)}%` : "—";
  const rank = (key) => Number.isFinite(winner.ranks?.[key]) ? `#${winner.ranks[key]}` : "—";
  const reasonLabels = lang === "en"
    ? {
      overall: "best full-history OOS",
      recent: "best recent OOS",
      tailRisk: "lowest bad-window risk",
      instability: "most stable across folds",
      balanced: "best balance across criteria",
      simpler: "no added complexity penalty",
    }
    : {
      overall: "전체 OOS 1위",
      recent: "최근 OOS 1위",
      tailRisk: "나쁜 구간 위험 1위",
      instability: "fold 간 안정성 1위",
      balanced: "기준 간 균형 우수",
      simpler: "추가 복잡도 벌점 없음",
    };
  const reasons = (winner.reasonCodes || []).map((code) => reasonLabels[code] || code).join(", ");
  const gap = Number.isFinite(decision.scoreGap)
    ? lang === "en"
      ? ` Its composite score beat the runner-up by ${decision.scoreGap.toFixed(2)} points.`
      : ` 종합점수는 2위보다 ${decision.scoreGap.toFixed(2)}p 낮았습니다.`
    : "";
  const evaluated = decision.candidatesEvaluated || decision.candidatesCompared || 0;
  const rejected = decision.guardrail?.rejectedCount || 0;
  if (lang === "en") {
    return `Selected after evaluating ${evaluated} candidates and rejecting ${rejected} that breached the baseline guardrail. Full-history OOS ${pct(winner.overallWmape)} (${rank("overall")}), recent OOS ${pct(winner.recentWmape)} (${rank("recent")}), bad-window P90 ${pct(winner.tailRiskWmape)} (${rank("tailRisk")}), and fold instability ${pct(winner.instabilityWmape)} (${rank("instability")}); strengths: ${reasons || "balanced result"}.${gap}`;
  }
  return `${evaluated}개 후보를 평가하고 기준선 안전장치를 위반한 ${rejected}개를 먼저 제외했습니다. 전체 OOS ${pct(winner.overallWmape)}(${rank("overall")}), 최근 OOS ${pct(winner.recentWmape)}(${rank("recent")}), 나쁜 구간 P90 ${pct(winner.tailRiskWmape)}(${rank("tailRisk")}), fold 변동성 ${pct(winner.instabilityWmape)}(${rank("instability")})을 함께 평가했습니다. 강점: ${reasons || "기준 간 균형"}.${gap}`;
}

export function forecastGuardrailSummaryText(modelSearch, lang = "ko") {
  const decisions = [
    [lang === "en" ? "route" : "최종 경로", modelSearch?.routeDecision],
    [lang === "en" ? "Android blend" : "Android 결합비", modelSearch?.android?.productionDecision],
    [lang === "en" ? "iOS blend" : "iOS 결합비", modelSearch?.ios?.productionDecision],
    ...Object.entries(modelSearch?.android?.componentDecisions || {}).map(([key, decision]) =>
      [`Android ${key}`, decision]),
    ...Object.entries(modelSearch?.ios?.componentDecisions || {}).map(([key, decision]) =>
      [`iOS ${key}`, decision]),
  ].filter(([, decision]) => decision?.guardrail?.enabled);
  if (!decisions.length) return "";
  const rejected = decisions.reduce((sum, [, decision]) => sum + (decision.guardrail.rejectedCount || 0), 0);
  const fallback = decisions.filter(([, decision]) => decision.guardrail.fallbackUsed).map(([label]) => label);
  const reasonCounts = decisions.reduce((counts, [, decision]) => {
    Object.entries(decision.guardrail.rejectedByReason || {}).forEach(([reason, count]) => {
      counts[reason] = (counts[reason] || 0) + count;
    });
    return counts;
  }, {});
  const reasonLabels = lang === "en"
    ? {
      "overall-worse-than-baseline": "worse full OOS",
      "recent-worse-than-baseline": "worse recent OOS",
      "tail-risk-worse-than-baseline": "excess bad-window risk",
      "insufficient-fold-wins": "won fewer than half of folds",
    }
    : {
      "overall-worse-than-baseline": "전체 OOS 악화",
      "recent-worse-than-baseline": "최근 OOS 악화",
      "tail-risk-worse-than-baseline": "나쁜 구간 위험 초과",
      "insufficient-fold-wins": "fold 절반 미만 승리",
    };
  const reasons = Object.entries(reasonCounts).map(([reason, count]) =>
    `${reasonLabels[reason] || reason} ${count}`).join(" · ");
  if (lang === "en") {
    return `${rejected} deteriorating candidate(s) were removed before selection${reasons ? `: ${reasons}` : ""}. ${fallback.length ? `Baseline fallback was used for ${fallback.join(", ")}.` : "Every selected layer beat its baseline guardrail; no fallback was needed."}`;
  }
  return `선택 전에 성과가 악화된 후보 ${rejected}개를 자동 제외했습니다${reasons ? `: ${reasons}` : ""}. ${fallback.length ? `${fallback.join(", ")}은 통과 모델이 없어 최근평균 기준선으로 자동 전환했습니다.` : "최종 선택된 각 레이어는 기준선 안전장치를 통과해 fallback이 필요하지 않았습니다."}`;
}

export function forecastAssistRouteLabel(route, lang) {
  if (route === "direct-total") return "Direct Total";
  if (route === "android-ios-sum" || route === "android-ios-additive") return lang === "en" ? "Android + iOS" : "Android + iOS 합산";
  return lang === "en" ? "current forecast" : "현재 예측";
}

export function annualCandidateRouteLabel(route, tx) {
  if (route === "direct-total") return "Direct Total";
  if (route === "android-ios-sum") return tx("Android + iOS 합산", "Android + iOS");
  if (route === "bounded-total-router") return tx("Total/OS 자동 경로", "Auto Total/OS route");
  if (route === "paid-organic-hybrid") return tx("Paid·Organic 분리", "Paid/Organic split");
  return route || "—";
}

export function buildForecastAssistInsight(forecast, recentBacktest, forecastScenario = {}) {
  if (!forecast) return null;
  // 화면의 대표 점수는 인증에 실제로 쓰는 봉인 OOS wMAPE 하나로 고정한다.
  // known-Cost conditional 점수는 상세 진단에만 남겨 서로 다른 수치로 같은
  // "통과/미통과" 결론을 설명하는 모순을 막는다.
  const score = recentBacktest?.wmape;
  const scoreText = forecastAssistPct(score);
  const horizon = forecast.predFut?.length || forecast.horizon || 12;
  const scenarioEligible = forecastScenario?.eligible !== false;
  let certified = false;
  let routeKo = "현재 예측";
  let routeEn = "current forecast";
  let modelKo = "";
  let modelEn = "";

  if (forecast.isStructural) {
    certified = recentBacktest?.reliable === true && Boolean(forecast.structuralEligible);
    routeKo = forecastAssistRouteLabel(forecast.structuralRoute, "ko");
    routeEn = forecastAssistRouteLabel(forecast.structuralRoute, "en");
    const window = forecast.structuralSelectedSpec?.trainingWindow;
    modelKo = window ? `선택 학습창은 최근 ${window}주입니다.` : "";
    modelEn = window ? `The selected training window is the latest ${window} weeks.` : "";
  } else if (forecast.isAnnualAnalog) {
    certified = recentBacktest?.reliable === true && Boolean(forecast.annualQualified);
    routeKo = forecastAssistRouteLabel(forecast.selectedRoute, "ko");
    routeEn = forecastAssistRouteLabel(forecast.selectedRoute, "en");
    modelKo = `flat·추세·Holt·ridge·계절·유사시즌 후보를 개발 OOS로 비교했고, 마지막 ${horizon}주는 감사용으로 남겼습니다.`;
    modelEn = `Flat, trend, Holt, ridge, seasonal, and similar-season candidates were compared on development OOS; the final ${horizon} weeks remain an audit.`;
  } else if (forecast.isAdditiveTotal) {
    const components = (forecast.components || []).map((component) => {
      const selected = component.rollingSelection?.productionSelected
        || component.rollingSelection?.selected;
      return selected ? {
        ko: `${component.platform} ${selected.window}주`,
        en: `${component.platform} ${selected.window} weeks`,
      } : null;
    }).filter(Boolean);
    certified = recentBacktest?.reliable === true;
    routeKo = "Android + iOS 합산";
    routeEn = "Android + iOS";
    modelKo = components.length ? `OS별 선택 학습창은 ${components.map((item) => item.ko).join(", ")}입니다.` : "";
    modelEn = components.length ? `OS-specific training windows: ${components.map((item) => item.en).join(", ")}.` : "";
  } else {
    const selected = forecast.rollingSelection?.productionSelected
      || forecast.rollingSelection?.selected;
    certified = recentBacktest?.reliable === true;
    modelKo = selected ? `선택 학습창은 최근 ${selected.window}주, 과거 rolling wMAPE는 ${forecastAssistPct(selected.wmape) || "계산 불가"}입니다.` : "";
    modelEn = selected ? `The selected window is the latest ${selected.window} weeks; historical rolling wMAPE is ${forecastAssistPct(selected.wmape) || "unavailable"}.` : "";
  }

  const annualRollingScore = forecastAssistPct(forecast.rollingSelection?.selected?.wmape);
  const statusKo = forecast.isAnnualAnalog && scoreText
    ? `봉인 최신 ${horizon}주 ${scoreText} · 개발 OOS ${annualRollingScore || "계산 불가"}. ${certified ? "기본 예측 사용 가능" : "예측 사용 보류 · 예산 변경 잠금"}.`
    : scoreText
      ? `봉인한 최근 ${horizon}주에 실제 Cost를 입력한 OOS wMAPE는 ${scoreText}로, 10% 목표를 ${certified ? "통과했습니다" : "통과하지 못했습니다"}.`
      : `현재 데이터로 최근 ${horizon}주 OOS 점수를 계산하지 못했습니다.`;
  const statusEn = forecast.isAnnualAnalog && scoreText
    ? `Sealed latest ${horizon} weeks: ${scoreText} · development OOS: ${annualRollingScore || "unavailable"}. ${certified ? "Base forecast available." : "Hold forecast use · budget changes locked."}`
    : scoreText
      ? `With Actual Cost supplied to the sealed latest ${horizon} weeks, OOS wMAPE is ${scoreText}; the 10% target is ${certified ? "passed" : "not passed"}.`
      : `The latest ${horizon}-week OOS score could not be computed from the current data.`;

  const actionsKo = certified
    ? [
      `선택 경로(${routeKo})의 ${horizon}주 예측을 단일 숫자가 아니라 참고 범위와 함께 사용하세요.`,
      scenarioEligible ? "예산 변경은 현재 Cost 대비 작은 폭부터 시나리오로 비교하세요." : "Cost 증감 시나리오는 잠금 상태로 두고 기본 예측만 사용하세요.",
      "실제 증분 효과는 홀드아웃 또는 지역 실험으로 확인하세요.",
    ]
    : [
      "현재 예측값으로 예산 증감이나 목표치를 확정하지 마세요.",
      `최근 레짐 데이터를 추가한 뒤 같은 ${horizon}주 OOS 검증을 다시 실행하세요.`,
      scenarioEligible ? "Step 매핑과 Direct/OS 경로를 재검토하고, 통과 전에는 보수적 기준선을 사용하세요." : "채널별 Cost 시나리오 잠금을 유지하고 최근평균 기준선을 사용하세요.",
    ];
  const actionsEn = certified
    ? [
      `Use the ${horizon}-week ${routeEn} forecast with its reference interval, not as a single point estimate.`,
      scenarioEligible ? "Compare budget changes in small increments from current Cost." : "Keep Cost scenarios locked and use only the base forecast.",
      "Confirm true incrementality with a holdout or geo experiment.",
    ]
    : [
      "Do not set budget changes or targets from the current forecast.",
      `Add more observations from the current regime, then rerun the same sealed ${horizon}-week OOS test.`,
      scenarioEligible ? "Review Step mapping and Direct/OS routing; use a conservative baseline until certification." : "Keep channel Cost scenarios locked and use the recent-average baseline.",
    ];

  return {
    titleKo: certified ? "10% 인증을 통과한 예측 결과" : "10% 미인증 — 운영 판단 보류",
    titleEn: certified ? "Forecast passed the 10% gate" : "Not certified under 10% — hold decisions",
    summaryKo: `${statusKo} 선택 경로는 ${routeKo}입니다. ${modelKo}`.trim(),
    summaryEn: `${statusEn} The selected route is ${routeEn}. ${modelEn}`.trim(),
    actionsKo,
    actionsEn,
  };
}

export function forecastHorizonDraftState(draft, appliedHorizon) {
  const horizon = Math.max(1, Math.min(52, Number.parseInt(draft, 10) || 1));
  const normalized = String(horizon);
  return {
    horizon,
    normalized,
    dirty: horizon !== appliedHorizon || String(draft ?? "").trim() !== normalized,
  };
}

export function forecastDownloadTitle(forecast, locale = "ko") {
  const tx = (ko, en) => (locale === "en" ? en : ko);
  if (forecast?.isStructural) {
    return tx(
      "Organic·Performance 절대 예측과 합계 항등식을 포함한 고정 스냅샷 CSV",
      "Fixed snapshot CSV with absolute Organic and Performance predictions and their additive identity",
    );
  }
  if (forecast?.isAnnualAnalog) {
    return tx(
      "자동 선택한 시계열 예측과 참고범위를 담은 고정 스냅샷 CSV",
      "Fixed snapshot CSV with the auto-selected time-series forecast and reference range",
    );
  }
  if (forecast?.isPaidOrganicSplit) {
    const hasLiveModels = forecastHasExactFormulaModels(forecast);
    const platforms = [...new Set((forecast.excelModels || [])
      .map((model) => model?.platform)
      .filter(Boolean))];
    const scope = platforms.length > 1
      ? tx("Android·iOS·Total", "Android, iOS, and Total")
      : tx(`${platforms[0] || "OS"} 예측`, `${platforms[0] || "OS"} forecast`);
    return hasLiveModels
      ? tx(
        `OS별 Cost를 수정하면 Organic halo·Paid 예측 수준·${scope}가 연쇄 재계산되는 엑셀 수식 CSV`,
        `Excel-formula CSV: editing Cost by OS recalculates Organic halo, Paid predicted level, and the ${scope}`,
      )
      : tx(
        "OS별 Organic 기저·halo·Paid 예측 수준·Total 항등식을 포함한 고정 스냅샷 CSV",
        "Fixed snapshot CSV with OS-level Organic baseline, halo, Paid predicted level, and Total identity",
      );
  }
  if (forecast?.isBayesian && !forecastHasExactFormulaModels(forecast)) {
    return tx(
      "현재 선택 모델은 CSV 수식으로 정확히 재현할 수 없어 고정 스냅샷으로 내보냅니다",
      "The selected model cannot be reproduced exactly with CSV formulas, so this export is a fixed snapshot",
    );
  }
  return tx(
    "채널 spend를 수정하면 자동 선택된 adstock·미디어 변환·예측이 연쇄 재계산되는 엑셀 수식 CSV",
    "Excel-formula CSV: editing channel spend recalculates the selected adstock, media transform, and forecast",
  );
}

export const FORECAST_SOURCE_IDS = new WeakMap();
export let forecastSourceSequence = 0;

export function forecastSourceIdentity(rows) {
  if (!rows || (typeof rows !== "object" && typeof rows !== "function")) return "none";
  if (!FORECAST_SOURCE_IDS.has(rows)) {
    forecastSourceSequence += 1;
    FORECAST_SOURCE_IDS.set(rows, forecastSourceSequence);
  }
  return FORECAST_SOURCE_IDS.get(rows);
}

export function forecastWorkerConfigDto(cfg) {
  const cloneValue = (value) => {
    if (
      value == null
      || typeof value === "string"
      || typeof value === "number"
      || typeof value === "boolean"
    ) return value;
    if (typeof value === "function" || typeof value === "symbol") return undefined;
    if (Array.isArray(value)) {
      return value.map(cloneValue).filter((item) => item !== undefined);
    }
    if (value instanceof Set) {
      return [...value].map(cloneValue).filter((item) => item !== undefined);
    }
    if (value instanceof Map) {
      return Object.fromEntries([...value.entries()]
        .map(([key, item]) => [String(key), cloneValue(item)])
        .filter(([, item]) => item !== undefined));
    }
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") {
      return Object.fromEntries(Object.entries(value)
        .map(([key, item]) => [key, cloneValue(item)])
        .filter(([, item]) => item !== undefined));
    }
    return undefined;
  };
  return cloneValue(cfg) || {};
}

export function mergeForecastSelectionCache(current, signature, results) {
  return {
    signature,
    results: current?.signature === signature
      ? { ...(current.results || {}), ...(results || {}) }
      : { ...(results || {}) },
  };
}

export function runOnLatestAnimationFrame(requestRef, requestSequence, callback) {
  requestAnimationFrame(() => {
    if (requestRef.current === requestSequence) callback();
  });
}

export function forecastBackgroundCandidateCap(panel) {
  const featureCount = Object.keys(panel?.ch || {}).length
    + Object.keys(panel?.dummy || {}).length
    + Object.keys(panel?.steps || {}).length
    + Object.keys(panel?.external || {}).length;
  return mmmForecastBackgroundCandidateCap(featureCount);
}
