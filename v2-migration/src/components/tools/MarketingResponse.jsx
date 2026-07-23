"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Papa from "papaparse";
import Chart from "chart.js/auto";
import * as XLSX from "xlsx";
import { useAppStore } from "@/store/useDataStore";
import {
  MMM_METH_CONFIG,
  MMM_CHANNELS,
  MMM_NONMEDIA_GROUPS,
  mmmValidate,
  mmmBayesianRun,
  mmmBayesianHealth,
  mmmBayesianWeeklyDecomp,
  mmmBayesianForecast,
  mmmForecastRollingSelection,
  mmmForecastScenarioEligibility,
  mmmForecastGlobalBaseline,
  mmmForecastGlobalSeasonality,
  mmmForecastDampedTrendOffset,
  mmmForecastRestoreSeasonality,
  mmmTrendExistence,
  mmmElasticities,
  mmmCannibalization,
  mmmChannelCoverage,
  mmmIRF,
  mmmAdstock,
  mmmAudit,
  mmmMacroFacts,
  mmmResolveAbsorb,
  _mmmChans,
} from "@/utils/mmmMath";
import { mmmOls } from "@/utils/regMath";
import {
  mmmBuildCannibRank,
  mmmCannibLevel,
  mmmCannibActionShort,
  mmmGlobalCannib,
  mmmRankCfg,
  CANNIBAL_RANK,
} from "@/utils/responseCannibRank";
import CsvUploader from "@/components/CsvUploader";
import { trackProductEvent } from "@/lib/analytics";
import DemoLoadButton from "@/components/DemoLoadButton";
import CsvGuide from "@/components/ds/CsvGuide";
import AnalyzingOverlay from "@/components/ds/AnalyzingOverlay";
import { buildDemoCsv, buildMmmPriorDemo } from "@/utils/demoData";
import MmmColumnMapper, { autoGuessColMap, buildPanelFromColMap, colMapMissing, mmmPlatformTags, mmmSegmentValues } from "@/components/tools/MmmColumnMapper";
import BasisCurrencyToggleBar from "@/components/dashboard/BasisCurrencyToggleBar";
import AnalysisControlBar from "@/components/dashboard/AnalysisControlBar";
import { CURRENCY_SYMBOLS, convertCurrency, fmtCompact } from "@/utils/format";
import { buildMmmWeeklyPerformance } from "@/utils/mmmWeeklyPerformance";
import { buildExperimentMediaPriorDetailed, mmmRollingOrigins, summarizeRollingErrors, mmmPriorMroiAtSpend } from "@/utils/mmmPriorMath";
import {
  planCountryReferenceFits,
  buildCountryTransferPrior,
  buildCountryCombinations,
  mmmCountryRowsAsOfFold,
  selectCountryPriorCandidate,
  rescaleCountryPriorToTarget,
} from "@/utils/mmmCountryPrior";
import { mmmParseNumericValue } from "@/utils/mmmInputUtils";

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
const MMM_RESULT_CACHE = new WeakMap();
const MMM_CACHE_OBJECT_IDS = new WeakMap();
let mmmNextCacheObjectId = 1;

function mmmCacheObjectId(value) {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return "none";
  if (!MMM_CACHE_OBJECT_IDS.has(value)) MMM_CACHE_OBJECT_IDS.set(value, mmmNextCacheObjectId++);
  return MMM_CACHE_OBJECT_IDS.get(value);
}

function mmmCachedResult(raw, key) {
  return Array.isArray(raw) ? MMM_RESULT_CACHE.get(raw)?.get(key) || null : null;
}

function mmmStoreCachedResult(raw, key, result) {
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

// 브랜드 채널 판별(이름 기반) — index kind='brand' 휴리스틱
function isBrandName(name) {
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
    for (const values of Object.values(panel.dummy || {})) if (!Number.isFinite(values[i])) return true;
    for (const values of Object.values(panel.steps || {})) if (!Number.isFinite(values[i])) return true;
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
    dummy: {},
    steps: {},
    targets: {},
  };
  for (const k of chKeys) out.ch[k] = slice(panel.ch[k]);
  for (const k of Object.keys(panel.dummy || {})) out.dummy[k] = slice(panel.dummy[k]);
  for (const k of Object.keys(panel.steps || {})) out.steps[k] = slice(panel.steps[k]);
  for (const k of tgtKeys) out.targets[k] = slice(panel.targets[k]);
  out.trimmed = { droppedHead: head, droppedTail: n - 1 - tail, origN: n, usedN: tail - head + 1 };
  return out;
}

const MMM_USER_TARGETS = ["Traffic", "Regs", "React", "Purchasers", "Revenue"];

function pickTarget(panel, preferred) {
  const avail = MMM_USER_TARGETS.filter((target) => Object.prototype.hasOwnProperty.call(panel.targets, target));
  if (preferred === "RR" && avail.includes("Traffic")) return "Traffic";
  if (preferred && avail.includes(preferred)) return preferred;
  if (avail.includes("Regs")) return "Regs";
  return avail[0] || "Regs";
}

// Prior 원자료의 Y는 현재 MMM에서 고른 목표와 의미가 정확히 같을 때만 쓴다.
// "첫 번째 KPI 컬럼"으로 폴백하면 가입 근거가 매출 모델에 섞일 수 있으므로 금지한다.
const MMM_TARGET_HEADER_PATTERNS = {
  Traffic: /traffic|total.?visit|total.?user|총.?유입|방문자|sessions?/i,
  Regs: /signups?|registrations?|가입|등록/i,
  React: /reactiv|재유입|재활성/i,
  RR: /^(rr|total_reg_react)$|signups?.*reactiv|registrations?.*reactiv|가입.*(재유입|재활성)/i,
  Purchasers: /purchaser|buyer|구매자|결제자/i,
  Revenue: /revenue|sales|gmv|매출|결제금액|payment/i,
};

const MMM_TARGET_HEADER_ALIASES = {
  Traffic: ["traffic", "totalvisit", "totaluser", "총유입", "방문자", "session", "sessions"],
  Regs: ["signup", "signups", "registration", "registrations", "가입", "등록"],
  React: ["reactivation", "reactivations", "reactivated", "재유입", "재활성"],
  RR: ["rr", "totalregreact", "signupreactivation", "registrationreactivation", "가입재유입", "가입재활성"],
  Purchasers: ["purchaser", "purchasers", "buyer", "buyers", "구매자", "결제자"],
  Revenue: ["revenue", "sales", "gmv", "매출", "결제금액", "payment"],
};

function mmmNormalizedHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function mmmTargetDisplay(target, locale = "ko") {
  const labels = locale === "en"
    ? { Traffic: "traffic", Regs: "registrations", React: "reactivations", RR: "registrations + reactivations", Purchasers: "purchasers", Revenue: "revenue", Total: "registrations + reactivations" }
    : { Traffic: "총유입", Regs: "가입", React: "재유입", RR: "가입 + 재유입", Purchasers: "구매자", Revenue: "매출", Total: "가입 + 재유입" };
  return labels[target] || String(target || (locale === "en" ? "outcome" : "성과"));
}

function mmmCanonicalSegment(value) {
  const normalized = String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, "");
  if (["android", "aos", "googleplay", "playstore"].includes(normalized)) return "android";
  if (["ios", "iphone", "ipad"].includes(normalized)) return "ios";
  return normalized;
}

function mmmHeaderSegments(header) {
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

function mmmEvidenceBinary(value) {
  const text = String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!text) return null;
  if (/^(1|true|on|treated|treatment|test|enabled|post|after|처리|실험|온|켜기|사후)$/.test(text)) return 1;
  if (/^(0|false|off|control|holdout|disabled|pre|before|대조|통제|오프|끄기|사전)$/.test(text)) return 0;
  return null;
}

function mmmEvidenceGroupMean(rows, predicate, spendHeader) {
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

const MMM_COUNTRY_HEADER_PATTERN = /(^|[_\s])(country|market)([_\s]|$)|국가|시장/i;
const MMM_EVIDENCE_SPEND_HEADER_PATTERN = /(^|[_\s])(spend|cost|budget|expense)([_\s]|$)|(?:spend|cost|budget|expense)$|비용|지출|예산/i;
const MMM_EVIDENCE_TIME_HEADER_PATTERN = /(^|[_\s])(date|day|ds|week|wk|time)([_\s]|$)|(?:date|day|ds|week|wk|time)$|날짜|일자|주차|주인덱스/i;
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

function mmmCanonicalEvidenceName(value) {
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

function mmmFindPairedEvidenceHeader(headers, side, baseHeader, fallbackRole = null) {
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

const MMM_HEALTH_FLAG_COPY = {
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
function mergeMediaPrior(priors, key, next) {
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
function pDots(p) {
  if (p == null || !isFinite(p)) return "○○○";
  if (p < 0.01) return "●●●";
  if (p < 0.05) return "●●○";
  if (p < 0.1) return "●○○";
  return "○○○";
}
const POS = "#f87171";
const NEG = "#22c55e";
const MUTED = "var(--text-muted)";

const VERDICT_META = {
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
const BADGE_TONE = {
  ok: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.45)", color: "#22c55e" },
  warn: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.45)", color: "#fbbf24" },
  danger: { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.45)", color: "#f87171" },
  neutral: { bg: "var(--bg-2)", border: "var(--border)", color: MUTED },
};
function Badge({ tone = "neutral", color, children }) {
  const c = BADGE_TONE[tone] || BADGE_TONE.neutral;
  const finalColor = color || c.color;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "999px", background: color ? `${color}1f` : c.bg, border: `1px solid ${color || c.border}`, color: finalColor, fontWeight: 700, fontSize: "11.5px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
// Card — border/shadow/rounded 래퍼(레거시 톤 복구, §6).
function Card({ children, style }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "12px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", padding: "14px 16px", background: "var(--bg-2)", ...style }}>
      {children}
    </div>
  );
}

// 통계 상세(아코디언 B) 소제목 — 좌측 액센트 바 + 볼드 + 평어 한 줄로 섹션 구분.
function StatHead({ title, hint }) {
  return (
    <div style={{ margin: "18px 0 8px", borderLeft: "3px solid var(--primary, #adc6ff)", paddingLeft: "10px" }}>
      <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-1)" }}>{title}</div>
      {hint ? <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px", lineHeight: 1.55 }}>{hint}</div> : null}
    </div>
  );
}

// 그룹별 기여 패널 — 단일 누적 막대는 큰 기본수요에 가려 마케팅·이벤트의
// 시계열이 읽히지 않는다. 회사 MMM과 같이 그룹마다 독립 y축을 쓴다.
function ContributionGroupPanel({ label, values, labels, color, locale, formatValue }) {
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
function CollinearPairInputChart({ labels, pair, locale }) {
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

// ③ 순증분 검정은 막대차트보다 "0 포함 여부"가 판단 핵심이다. 점추정·구간·판정을
// 한 줄에 고정해, 녹색 막대가 오류인지 효과인지 혼동되지 않게 한다.
function NetEffectEvidence({ net, locale }) {
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

function MmmBacktestChart({ labels, actual, variants, locale, validationStartIndex = null, formatValue = null }) {
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
          { label: locale === "en" ? "Actual" : "실제", data: actual, borderColor: "#475569", borderWidth: 2.5, pointRadius: 2.5, tension: 0.18 },
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

function MmmManualDownload({ locale = "ko", placement = "footer" }) {
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

function downloadMmmEvidenceTemplate(csv, fileName) {
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
function MmmEvidenceLedger({ locale, selectedEvidence, onToggleEvidence, evidence, onEvidence, onLoadDemo, appliedPriorCount = 0, experimentPriorDiagnostics = [], countryCandidates = [], countryIndividualCandidates = [], countryBacktests = null, countryPlan = null, formatValue = null }) {
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

function fmtInt(v) {
  if (v == null || !isFinite(v)) return "—";
  return Math.round(v).toLocaleString();
}

function fmtOne(v) {
  if (v == null || !isFinite(v)) return "—";
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function forecastScenarioReasonLabel(reason, tx) {
  const labels = {
    "fewer-than-three-holdouts": tx("12주 학습 제외 검증이 3회 미만입니다", "Fewer than three 12-week holdouts are available"),
    "does-not-beat-persistence": tx("단순 최근 평균 기준선을 이기지 못했습니다", "It does not beat the recent-average baseline"),
    "wins-too-few-holdouts": tx("검증 구간 승리 횟수가 부족합니다", "It wins too few holdouts"),
    "forecast-validation": tx("rolling 검증 적격성이 확인되지 않았습니다", "Rolling validation eligibility is unavailable"),
    "high-collinearity": tx("최근 Cost 창에서 채널 예산이 함께 움직여 분리되지 않습니다", "Channel budgets move together in the recent Cost window"),
    "low-information": tx("최근 Cost 창의 독립적인 지출 변동이 부족합니다", "The recent Cost window lacks independent spend variation"),
    "scenario-identification": tx("채널별 Cost 시나리오 식별 조건을 충족하지 못했습니다", "Channel-level Cost scenario identification is not met"),
    "missing-model": tx("예측 회귀 모델을 만들지 못했습니다", "The forecast regression model is unavailable"),
  };
  return labels[reason] || String(reason);
}

// 천단위 콤마 입력(§7 `type=number`는 콤마 불가 · §12.14 라이브 콤마+커서 보존 포트). type=text로
// 표시=콤마, 읽기=콤마 strip. onCommit(number|null) — 빈칸이면 null(부모가 기본값 복귀).
function CommaNumberInput({ value, onCommit, style, placeholder, disabled = false }) {
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
function csvQ(s) {
  s = String(s == null ? "" : s);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvNum(v, d = 2) {
  return v == null || !isFinite(v) ? "" : (+v).toFixed(d);
}
function csvDownload(name, lines) {
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
function buildContributionGroupCsv(decomp, weekLabels, groupPanels) {
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
function downloadMmmWorkbook({ mmm, cannib, decomp, trend, forecast, csvData, colMap, locale, currency }) {
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
    ["02_STL", tx("추세·계절성·잔차", "Trend, seasonality, residual")],
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
  add("02_STL", trend?.stl ? [
    ["week", "actual", "trend", "seasonality", "residual"],
    ...mmm.panel.week.map((w, i) => [mmm.panel.weekLabel?.[i] || w, mmm.panel.targets[mmm.target][i], trend.stl.trend?.[i], trend.stl.seasonal?.[i], trend.stl.residual?.[i]]),
  ] : [[tx("STL 결과", "STL result")], [tx("이 패키지는 시계열 점검 단계에서 다운로드하면 STL 원자료를 포함합니다.", "Download from the time-series step to include STL source data.")]]);
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
    ["baseline_selection", JSON.stringify(run.baselineSelection || null)], ["seasonality_selection", JSON.stringify(run.seasonalitySelection || null)], ["media_penalty_selection", JSON.stringify(run.mediaPenaltySelection || null)], ["joint_transform_check", JSON.stringify(run.jointTransform || null)],
    ["channel", "adstock_alpha", "half_saturation", "hill_slope", "evaluated_transform_candidates", "total_transform_candidates", "candidate_search_capped", "prior_locked_transform", "effective_transform_candidates", "top_transform_weight", "posterior_positive_probability"],
    ...Object.values(run.saturationByChannel || {}).map((s) => [s.label, s.params.alpha, s.params.ec, s.params.slope, s.transformUncertainty?.candidateCount, s.transformUncertainty?.totalCandidateCount, s.transformUncertainty?.candidateSearchCapped, !!s.transformUncertainty?.priorLockedTransform, s.transformUncertainty?.effectiveCandidateCount, s.transformUncertainty?.topWeight, s.posteriorPositive]),
  ]);
  add("05_WeeklyContribution", decomp?.weeks ? [
    ["week", "actual", "fitted", "residual", "baseline", ...decomp.groupNames],
    ...decomp.weeks.map((w) => [w.week, w.actual, w.fitted, w.residual, w.baseline, ...decomp.groupNames.map((g) => w.contrib[g] || 0)]),
  ] : [[tx("주별 기여", "Weekly contribution")], [tx("기여 분해 결과가 없습니다.", "Contribution result unavailable.")]]);
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
    ["P(effect > 0)", tx("채널 효과가 양수일 posterior 확률. 80% 이상이면서 기간·공선성 식별 gate도 통과해야 예산 추천에 씁니다.", "Posterior probability that the channel effect is positive. Budget use requires ≥80% plus the time-span and collinearity identification gates.")],
    ["Adstock", tx("광고 효과의 다음 주 이월.", "Carryover of ad effect into later weeks.")],
    ["Hill saturation", tx("지출이 커질수록 추가 효과가 줄어드는 반응 곡선.", "Response curve with diminishing marginal return.")],
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
    ["baseline_selection", JSON.stringify(run.baselineSelection || null), tx("78주 이상에서 0/1/2 knot BIC 후보 비교", "0/1/2-knot BIC candidates when history is at least 78 weeks")],
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
function csvColL(n) {
  let s = "",
    x = n + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}
const _today = () => new Date().toISOString().slice(0, 10);

// 텍스트(.md) 다운로드 — "이 과정 자세히" 문서용.
function textDownload(name, text) {
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
function buildCannibGuideDoc(cannib, targetKo, locale = "ko") {
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
  L.push(`- **① 광고를 늘리기 전에 이미 줄고 있었나?** — 저지출 구간에서 오가닉이 이미 하락 추세였다면, 그 하락은 광고 탓이 아닐 가능성이 큽니다. (전문: 저지출 구간 기울기 검정)`);
  L.push(`- **② 시즌·추세를 걷어내도 광고 늘 때 오가닉이 줄어드나?** — 계절성·전반 추세를 제거한 뒤에도 광고비↑ 시 오가닉↓이면 잠식이 의심됩니다. (전문: 탈추세·1차차분 상관)`);
  L.push(`- **③ 광고를 늘리면 (잠식을 빼고도) 전체 성과가 순증가하나?** — 잠식분을 감안하고도 전체가 순으로 늘면 방어 양호입니다. (전문: 순증분 탄력성, 95% 신뢰구간)`);
  L.push(`- **④ 광고비가 몇 주 뒤에 오가닉을 끌어내리나?** — ①~③은 "같은 주"만 봅니다. ④는 시차를 두고(예: 3~6주 뒤) 광고비가 오가닉을 떨어뜨리는지 봅니다. (전문: 그랜저 인과, prewhitening 후 F-검정)`);
  L.push(`- **⑤ 충격 반응(IRF)** — 지출을 한 번 확 늘렸을 때 이후 몇 주간 성과가 어떻게 반응하는지 곡선으로 봅니다. 아래로 내려가면 시차 잠식, 위로 올라가면 시차 증분.`);
  L.push("");
  L.push(`## 판정은 어떻게 종합하나 (입증책임 비대칭)`);
  L.push(`- **문제 없음(방어 양호)**: 네 방향 모두 뚜렷한 잠식 신호가 없을 때만. "잠식 신호가 없다"는 강한 증거가 있어야 OK를 줍니다.`);
  L.push(`- **잠식 의심**: 어느 한 신호라도 잠식을 가리키면(특히 ④ 시차 신호가 있으면) 의심으로 올립니다. 같은 주 지표가 괜찮아도 시차에서 걸리면 의심입니다.`);
  L.push(`- **애매함(판단 보류)**: 데이터가 부족하거나(집행 주 수가 적음) 채널끼리 지출이 거의 똑같이 움직여(공선) 서로 구분이 안 되면, 억지로 판정하지 않고 보류합니다.`);
  L.push("");
  L.push(`## 꼭 기억할 것`);
  L.push(`이 진단은 전부 **"연관(association)"**이지 **"인과(causation)"**가 아닙니다. 관측 데이터만으로는 "광고가 잠식을 유발했다"를 확정할 수 없습니다. 이 도구의 역할은 **의심 채널을 좁혀주는 것**이고, 확정은 반드시 **홀드아웃(geo/시간 분할) 실험**으로 해야 합니다. "잠식 의심" 칸의 채널부터 실험 1순위로 검토하세요.`);
  L.push("");
  L.push(`## 수학·통계 상세 (전문가용)`);
  L.push("");
  L.push(`### ① 시간 선행성 — Theil-Sen 기울기 + Mann-Kendall 유의성`);
  L.push(`저지출 구간(지출 ≤ 전체 지출의 25번째 백분위수, p25)만 잘라내 그 구간 안에서 오가닉 KPI의 시간 추세를 봅니다.`);
  L.push(`- **기울기 추정**: Theil-Sen estimator — 모든 두 점 쌍 (i,j)의 기울기 (yⱼ−yᵢ)/(j−i)를 계산해 그 **중앙값**을 대표 기울기로 씀(이상치에 강함, OLS보다 로버스트).`);
  L.push(`- **유의성 검정**: Mann-Kendall 검정 통계량 S = Σᵢ<ⱼ sign(yⱼ−yᵢ). 분산 Var(S) = n(n−1)(2n+5)/18(동순위 보정 포함). Z = (S−sign(S))/√Var(S). |Z| > 1.96(양측 α=0.05)이면 유의한 추세로 판정.`);
  L.push(`- **판정 규칙**: 유의하게 하락(slope<0, p<0.05) → FOR(오가닉, 광고와 무관한 하락). 유의하게 상승 → AGAINST(카니발 의심). 유의하지 않거나 표본(n=low_n) 부족 → ABSTAIN.`);
  L.push("");
  L.push(`### ② 허위상관 — 탈추세·1차차분 Pearson 상관`);
  L.push(`시간(t)에 걸쳐 같이 늘어나는 두 변수는 서로 무관해도 상관이 크게 나옵니다(허위상관). 이를 걸러내기 위해:`);
  L.push(`1. **원상관(raw)**: 광고비와 오가닉 KPI의 단순 Pearson r.`);
  L.push(`2. **탈추세(detrended)**: 각 시계열에서 선형 추세(OLS 적합값)를 빼고 남은 잔차끼리의 상관.`);
  L.push(`3. **1차차분(first_diff)**: yₜ − yₜ₋₁ 변환 후 상관(단위근 제거 효과, 추세를 완전히 없앰).`);
  L.push(`- **판정 규칙**: detrended ≥ −0.10 AND first_diff ≥ −0.10 → FOR(허위상관이었을 뿐, 진짜 음의 관계 아님). detrended ≤ −0.20 OR first_diff ≤ −0.20 → AGAINST(탈추세해도 음의 관계 유지 = 잠식 의심). 그 사이는 ABSTAIN.`);
  L.push("");
  L.push(`### ③ 순증분 — log-log 탄력성 회귀 (AR(1) 자기상관 보정)`);
  L.push(`ln(오가닉 KPI) = β·ln(1+광고비) + 통제변수 + 오차, 형태의 회귀를 적합해 계수 β(탄력성)를 추정합니다.`);
  L.push(`- **AR(1) 보정**: 잔차가 자기상관(어제 오차가 오늘 오차에 영향)을 가지면 OLS 표준오차가 과소평가돼 거짓 유의성이 나올 수 있습니다. Yule-Walker로 AR(1) 계수 ρ를 추정하고 Cochrane-Orcutt류 변환(yₜ−ρyₜ₋₁)으로 재적합해 보정된 표준오차·p값을 씁니다.`);
  L.push(`- **95% 신뢰구간**: β ± 1.96×SE(β). CI가 0을 포함하지 않고 β>0이면 FOR(순증분 확인), β<0이고 CI가 0 미포함이면 AGAINST(순수 잠식), CI가 0을 포함하면 ABSTAIN(증거 없음 ≠ 효과 없음).`);
  L.push(`- **검정력 게이트**: 표본(n)이 적거나 광고비 변동계수(CV)가 작으면(=지출이 거의 늘 비슷해서 효과를 식별할 통계적 힘이 없으면) ③을 강제로 ABSTAIN 처리 — "효과 없음"과 "증거 없음"을 구분하기 위한 안전장치.`);
  L.push("");
  L.push(`### ④ 그랜저 인과 — Prewhitening 후 lagged F-검정`);
  L.push(`①~③은 전부 "같은 주(동시점)" 관계만 봅니다. 그랜저 인과는 "광고비의 **과거값**이 오가닉의 **미래값**을 추가로 설명하는가"를 봐서 시차 효과를 잡습니다.`);
  L.push(`- **Prewhitening**: 두 시계열 각각에서 추세(선형)+52주 계절성(Fourier 2차 항)을 먼저 제거해 순수한 단기 변동만 남깁니다(장기 추세 때문에 생기는 허위 그랜저-인과 방지).`);
  L.push(`- **F-검정**: "오가닉ₜ = f(오가닉 과거값들)"만 있는 축소모형과, "오가닉ₜ = f(오가닉 과거값들, 광고비 과거값들)"인 완전모형을 비교. 완전모형이 유의하게 더 잘 맞으면(F-검정 p<0.05) 광고비가 오가닉을 그랜저-인과함.`);
  L.push(`- **방향 두 가지**: 광고비→오가닉(시차 잠식/증분 여부), 오가닉→광고비(페이싱=예산 담당자가 오가닉이 약할 때 방어적으로 예산을 올리는 역인과 패턴 — 이게 유의하면 ②④의 음의 관계가 인과가 아니라 반응일 수 있음).`);
  L.push("");
  L.push(`### ⑤ 임펄스 응답 함수(IRF)`);
  L.push(`Prewhiten한 레벨 VAR(벡터자기회귀) 모형에서, 광고비에 1표준편차(1SD) 크기의 충격을 한 번 줬을 때 이후 여러 주에 걸쳐 오가닉이 어떻게 반응하는지 경로를 계산합니다. 음수 구간이 있으면 시차 잠식, 양수면 시차 증분. n<24주면 신뢰할 수 없어 곡선을 생략합니다.`);
  L.push("");
  L.push(`### 추세 존재성 검정 — STL 분해 + Mann-Kendall 4변형 + 단위근 검정`);
  L.push(`- **STL(Seasonal-Trend decomposition using Loess)**: 시계열을 추세+계절+잔차로 분해(52주 주기, 2회 반복).`);
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
      const bucket = !r.eligible || lv.lv === 1 ? "애매함(판단 보류)" : lv.lv >= 4 ? "잠식 의심" : "문제 없음";
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
function buildCannibGuideDocEn(cannib, targetLabel) {
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
  L.push(`- **① Was organic already declining before ad spend increased?** — If organic was already trending down in low-spend periods, that decline is likely not ads' fault. (Technical: low-spend-window slope test)`);
  L.push(`- **② After removing season/trend, does organic still fall when ads rise?** — If organic still moves opposite to spend after detrending, cannibalization is suspected. (Technical: detrended / first-difference correlation)`);
  L.push(`- **③ Does total performance net-increase when ads rise (even accounting for cannibalization)?** — If the net total still rises, defense is good. (Technical: net-incremental elasticity, 95% CI)`);
  L.push(`- **④ Does spend pull organic down a few weeks later?** — ①–③ only look at "the same week." ④ checks whether spend depresses organic with a lag (e.g. 3–6 weeks later). (Technical: Granger causality, F-test after prewhitening)`);
  L.push(`- **⑤ Impulse response (IRF)** — Shows, as a curve, how performance responds over the following weeks to a one-time spend shock. A dip below zero = lagged cannibalization; a rise = lagged incrementality.`);
  L.push("");
  L.push(`## How the verdict is combined (asymmetric burden of proof)`);
  L.push(`- **No issue (well-defended)**: only when none of the four signals show a clear cannibalization signal. Strong evidence of "no signal" is required to give an OK.`);
  L.push(`- **Cannibalization suspected**: if any signal points to cannibalization (especially the lagged signal ④), it's flagged as suspected — even if same-week metrics look fine.`);
  L.push(`- **Unclear (verdict withheld)**: if data is insufficient (few active weeks) or channels move almost identically (collinear) and can't be separated, we withhold judgment rather than force a verdict.`);
  L.push("");
  L.push(`## Key takeaway`);
  L.push(`All of this is **association**, not **causation**. Observational data alone cannot confirm "ads caused cannibalization." This tool's job is to **narrow down suspect channels** — confirmation requires a **holdout (geo/time-split) experiment**. Prioritize testing channels in the "cannibalization suspected" bucket first.`);
  L.push("");
  L.push(`## Math & statistics detail (for specialists)`);
  L.push("");
  L.push(`### ① Temporal precedence — Theil-Sen slope + Mann-Kendall significance`);
  L.push(`We isolate the low-spend window (spend ≤ the 25th percentile of total spend, p25) and look at the organic KPI's time trend within it.`);
  L.push(`- **Slope estimate**: Theil-Sen estimator — computes the slope (yⱼ−yᵢ)/(j−i) for every pair of points (i,j) and takes the **median** as the representative slope (robust to outliers, more robust than OLS).`);
  L.push(`- **Significance test**: Mann-Kendall test statistic S = Σᵢ<ⱼ sign(yⱼ−yᵢ). Variance Var(S) = n(n−1)(2n+5)/18 (with tie correction). Z = (S−sign(S))/√Var(S). |Z| > 1.96 (two-sided α=0.05) is judged a significant trend.`);
  L.push(`- **Decision rule**: significantly declining (slope<0, p<0.05) → FOR (organic decline unrelated to ads). Significantly rising → AGAINST (cannibalization suspected). Not significant or sample too small (n=low_n) → ABSTAIN.`);
  L.push("");
  L.push(`### ② Spurious correlation — detrended / first-difference Pearson correlation`);
  L.push(`Two variables that both grow over time (t) can appear highly correlated even if unrelated (spurious correlation). To filter this out:`);
  L.push(`1. **Raw correlation**: simple Pearson r between spend and the organic KPI.`);
  L.push(`2. **Detrended**: correlation between the residuals left after subtracting a linear trend (OLS fit) from each series.`);
  L.push(`3. **First difference**: correlation after the yₜ − yₜ₋₁ transform (removes unit roots, fully removes trend).`);
  L.push(`- **Decision rule**: detrended ≥ −0.10 AND first_diff ≥ −0.10 → FOR (was just spurious correlation, not a real negative relationship). detrended ≤ −0.20 OR first_diff ≤ −0.20 → AGAINST (negative relationship survives detrending = cannibalization suspected). In between → ABSTAIN.`);
  L.push("");
  L.push(`### ③ Net incrementality — log-log elasticity regression (AR(1) autocorrelation correction)`);
  L.push(`Fits a regression of the form ln(organic KPI) = β·ln(1+spend) + controls + error, estimating coefficient β (elasticity).`);
  L.push(`- **AR(1) correction**: if residuals are autocorrelated (yesterday's error affects today's), OLS standard errors are underestimated, producing false significance. We estimate the AR(1) coefficient ρ via Yule-Walker and refit with a Cochrane-Orcutt-style transform (yₜ−ρyₜ₋₁) to get corrected SE/p-values.`);
  L.push(`- **95% CI**: β ± 1.96×SE(β). If CI excludes 0 and β>0 → FOR (net incrementality confirmed); β<0 with CI excluding 0 → AGAINST (pure cannibalization); CI including 0 → ABSTAIN (no evidence ≠ no effect).`);
  L.push(`- **Power gate**: if sample size (n) is small or spend's coefficient of variation (CV) is low (i.e. spend barely varies, so there's no statistical power to identify an effect), ③ is force-set to ABSTAIN — a safeguard distinguishing "no effect" from "no evidence."`);
  L.push("");
  L.push(`### ④ Granger causality — lagged F-test after prewhitening`);
  L.push(`①–③ only look at "same week" (contemporaneous) relationships. Granger causality checks whether **past values** of spend explain **future values** of organic beyond organic's own history, capturing lagged effects.`);
  L.push(`- **Prewhitening**: trend (linear) + 52-week seasonality (2nd-order Fourier terms) are first removed from each series, leaving only pure short-term variation (prevents spurious Granger causality from long-term trends).`);
  L.push(`- **F-test**: compares a restricted model "organicₜ = f(organic's own past)" against a full model "organicₜ = f(organic's own past, spend's past)." If the full model fits significantly better (F-test p<0.05), spend Granger-causes organic.`);
  L.push(`- **Two directions**: spend→organic (lagged cannibalization/incrementality), organic→spend (pacing = a reverse-causality pattern where budget owners raise spend defensively when organic is weak — if this is significant, the negative relationship in ②④ may be a response, not a cause).`);
  L.push("");
  L.push(`### ⑤ Impulse response function (IRF)`);
  L.push(`In a prewhitened level VAR (vector autoregression) model, we compute the path of how organic responds over the following weeks to a single one-standard-deviation (1SD) shock to spend. A negative stretch = lagged cannibalization; positive = lagged incrementality. With n<24 weeks the curve is omitted as unreliable.`);
  L.push("");
  L.push(`### Trend-existence test — STL decomposition + 4 Mann-Kendall variants + unit-root tests`);
  L.push(`- **STL (Seasonal-Trend decomposition using Loess)**: decomposes the series into trend + seasonal + residual (52-week period, 2 iterations).`);
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
      const bucket = !r.eligible || lv.lv === 1 ? "Unclear (withheld)" : lv.lv >= 4 ? "Cannibalization suspected" : "No issue";
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
function buildMmmGuideDoc(mmm, targetKo, locale = "ko") {
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
  L.push(`### 3. Empirical-Bayes 조건부 Gaussian 근사`);
  L.push(`${targetKo} = 절편 + Σβᵢ·Hill(adstockᵢ) + 추세 + 계절(Fourier) + 휴일·구조변화 + 오차를 Gaussian prior로 추정합니다. 잔차 분산은 데이터에서 plug-in 추정하며, 그 값과 profile 변환 후보에 조건부인 분석 근사입니다. 완전 계층형 joint MCMC posterior가 아닙니다. 예산 추천은 **P(효과>0) 80% 이상**뿐 아니라 최소 기간·파라미터당 주 수·채널 공선성 식별 gate를 모두 통과해야 합니다.`);
  L.push("");
  L.push(`### 4. 효과 신뢰도`);
  L.push(`효과 판정에서 legacy OLS p값은 제거했습니다. VIF와 채널 상관은 효과 확률이 아니라 식별·예산 보류 진단으로 유지합니다. 이 화면의 "효과 양수 확률"은 후보별 posterior를 BIC 가중 평균한 β>0 확률입니다. 90% 구간은 profile posterior 정규 혼합 CDF의 5%·95% 분위수를 직접 풀어 계산합니다. 다만 모든 채널 조합을 함께 샘플링한 joint MCMC posterior는 아닙니다.`);
  L.push("");
  L.push(`### 5. 제한적 baseline·joint 보정`);
  L.push(`데이터가 78주 이상이면 baseline knot 0·1·2개 후보를 비교하고, BIC가 최소 6 이상 개선될 때만 knot을 적용합니다. 개선이 작거나 불안정하면 기본 추세를 유지합니다. 변환 상호작용은 불확실성이 큰 최대 2개 채널의 상위 후보를 최대 4개 조합으로만 추가 점검합니다. 이는 브라우저 계산량과 과적합을 통제하기 위한 제한이며, 전체 채널 joint posterior를 의미하지 않습니다.`);
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
function buildMmmGuideDocEn(mmm, targetLabel) {
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
  L.push(`### 3. Empirical-Bayes conditional Gaussian approximation`);
  L.push(`${targetLabel} = intercept + Σβᵢ·Hill(adstockᵢ) + trend + seasonality + holiday/regime change + error. Gaussian priors stabilize the estimate, while residual variance is plug-in estimated from the data. The analytical result is conditional on that estimate and the profile transform candidates; it is not a fully hierarchical joint MCMC posterior. Budget recommendations require P(effect > 0) ≥80% plus the minimum-history, weeks-per-parameter, and media-collinearity identification gates.`);
  L.push("");
  L.push(`### 4. Effect confidence`);
  L.push(`Legacy OLS p-values are not used for effect decisions. VIF and media correlation remain as identification and budget-hold diagnostics, not effect probabilities. P(effect > 0) is BIC-weighted across candidate posteriors. The 90% interval directly solves the 5th and 95th percentiles of the profile-posterior normal-mixture CDF, but it is not a jointly sampled all-channel MCMC posterior.`);
  L.push("");
  L.push(`### 5. Limited baseline and joint-transform checks`);
  L.push(`With at least 78 weeks, the model compares 0-, 1-, and 2-knot baseline candidates and applies a knot only when BIC improves by at least 6. Otherwise it keeps the base trend. For transform interaction, only the two most uncertain channels are checked across at most four combinations of their top candidates. This controls browser cost and overfitting; it is not a full all-channel joint posterior.`);
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

function buildBayesianForecastCsv(fc, target, locale, sourceCurrency, displayCurrency) {
  const tx = (ko, en) => (locale === "en" ? en : ko);
  const models = (fc.excelModels || []).filter((model) => model?.names?.length);
  if (!models.length) return null;
  const lines = [];
  const push = (row) => lines.push(row.map(csvQ).join(","));
  push([tx("# 도구", "# Tool"), "Empirical-Bayes MMM Forecast (5-18) · live Excel formulas"]);
  push([tx("# 대상", "# Target"), `${mmmTargetDisplay(target, locale)} (${target})`]);
  push([tx("# 원본 통화", "# Source currency"), sourceCurrency]);
  push([tx("# 화면 표시 통화", "# Display currency"), displayCurrency]);
  push([tx("# 사용법", "# How to use"), tx("spend를 수정하면 adstock → Hill 수확체감 변환 → 예측이 전부 즉시 재계산됩니다. 현재 Empirical-Bayes 모델은 log가 아니라 Hill 변환을 사용합니다.", "Edit spend and adstock → Hill saturation transform → forecast recalculate immediately. The current Empirical-Bayes model uses Hill saturation, not a log transform.")]);
  push([tx("# 참고 범위", "# Reference interval"), tx("상·하한은 현재 모수·잔차 기준 폭을 유지한 채 예측값 변화에 연동됩니다.", "Upper/lower bounds move with the recalculated forecast while retaining the current parameter/residual margin.")]);

  const tables = [];
  models.forEach((model) => {
    lines.push("");
    push([tx("# 모델", "# Model"), `${model.platform} · ${model.target}`]);
    push([tx("# 계수·표준화 파라미터 (수정하면 아래 예측도 반영)", "# Coefficients and standardization (edits flow into forecast)")]);
    push(["term", "coefficient", "feature_mean", "feature_scale"]);
    const interceptRow = lines.length + 1;
    push(["(Intercept)", csvNum(model.intercept, 10), "", ""]);
    const featureRows = {};
    model.names.forEach((name, index) => {
      featureRows[name] = lines.length + 1;
      push([name, csvNum(model.beta[index], 10), csvNum(model.featureMeans[index], 10), csvNum(model.featureScales[index] || 1, 10)]);
    });
    lines.push("");
    push([tx("# 채널 변환 파라미터", "# Channel transform parameters")]);
    push(["channel", "adstock_alpha", "hill_ec", "hill_slope"]);
    const channelRows = {};
    (model.chans || []).forEach((channel) => {
      const params = model.params[channel.key] || {};
      channelRows[channel.key] = lines.length + 1;
      push([channel.key, csvNum(params.alpha, 10), csvNum(params.ec, 10), csvNum(params.slope, 10)]);
    });
    lines.push("");
    push([tx("# 시계열 — spend 수정 → adstock → Hill → 예측 자동 연쇄", "# Time series — edit spend → adstock → Hill → forecast live chain")]);
    const featureStart = 7;
    const adstockStart = featureStart + model.names.length;
    const hillStart = adstockStart + model.chans.length;
    const logStart = hillStart + model.chans.length;
    const spendStart = logStart + model.chans.length;
    const featureCol = (index) => csvColL(featureStart + index);
    const adstockCol = (index) => csvColL(adstockStart + index);
    const hillCol = (index) => csvColL(hillStart + index);
    const logCol = (index) => csvColL(logStart + index);
    const spendCol = (index) => csvColL(spendStart + index);
    push([
      "t", "period", "segment", "actual", "fitted_or_forecast_live", "lower_live", "upper_live",
      ...model.names,
      ...model.chans.map((channel) => `adstock_${channel.key}`),
      ...model.chans.map((channel) => `hill_${channel.key}`),
      ...model.chans.map((channel) => `ln1p_adstock_${channel.key}_audit`),
      ...model.chans.map((channel) => `spend_${channel.key}_${sourceCurrency}`),
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
        return channelIndex >= 0 ? `=${hillCol(channelIndex)}${rowNumber}` : csvNum(rawFeatures[featureIndex], 10);
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
      const spend = model.chans.map((channel) => csvNum(
        isHistory ? model.histSpendByKey[channel.key]?.[index] : model.futSpendByKey[channel.key]?.[futureIndex],
        10,
      ));
      const prediction = "=$B$" + interceptRow + model.names.map((name, featureIndex) => {
        const featureRow = featureRows[name];
        return `+$B$${featureRow}*((${featureCol(featureIndex)}${rowNumber}-$C$${featureRow})/$D$${featureRow})`;
      }).join("") + (offset ? `+${csvNum(offset, 10)}` : "");
      const margin = isHistory ? null : model.futureMargins[futureIndex] || 0;
      push([
        index + 1,
        isHistory ? model.histLabels[index] : model.futLabels[futureIndex],
        isHistory ? "history" : "forecast",
        isHistory ? csvNum(model.actual[index], 10) : "",
        prediction,
        margin == null ? "" : `=E${rowNumber}-${csvNum(margin, 10)}`,
        margin == null ? "" : `=E${rowNumber}+${csvNum(margin, 10)}`,
        ...values,
        ...adstock,
        ...hill,
        ...logs,
        ...spend,
      ]);
    }
    tables.push({ model, tableStart, historyLength, horizon });
  });

  if (fc.isAdditiveTotal && tables.length === 2) {
    const historyLength = Math.min(...tables.map((table) => table.historyLength));
    const horizon = Math.min(...tables.map((table) => table.horizon));
    lines.push("");
    push([tx("# Total = Android + iOS (아래도 모두 수식)", "# Total = Android + iOS (all formulas below)")]);
    push(["period", "segment", "actual_total", "prediction_total_live", "lower_total_live", "upper_total_live"]);
    for (let index = 0; index < historyLength + horizon; index++) {
      const isHistory = index < historyLength;
      const refs = tables.map((table) => {
        const row = isHistory
          ? table.tableStart + (table.historyLength - historyLength) + index
          : table.tableStart + table.historyLength + (index - historyLength);
        return { actual: `D${row}`, prediction: `E${row}`, lower: `F${row}`, upper: `G${row}` };
      });
      const label = isHistory ? tables[0].model.histLabels.at(-(historyLength - index)) : tables[0].model.futLabels[index - historyLength];
      push([
        label,
        isHistory ? "history" : "forecast",
        isHistory ? `=${refs.map((ref) => ref.actual).join("+")}` : "",
        `=${refs.map((ref) => ref.prediction).join("+")}`,
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
  if (fc.isBayesian) {
    const liveCsv = buildBayesianForecastCsv(fc, target, locale, sourceCurrency, displayCurrency);
    if (liveCsv) return liveCsv;
    const rows = [
      [tx("# 도구", "# Tool"), "Empirical-Bayes MMM Forecast (5-18)"],
      [tx("# 대상", "# Target"), `${tKo} (${target})`],
      [tx("# 원본 통화", "# Source currency"), sourceCurrency],
      [tx("# 화면 표시 통화", "# Display currency"), displayCurrency],
      [tx("# 숫자 단위", "# Numeric units"), tx(`지출·매출 값은 원본 통화 ${sourceCurrency} 단위`, `Spend and revenue values remain in source-currency ${sourceCurrency} units`)],
      [tx("# 모델", "# Model"), fc.model],
      [tx("# 모델 적합 R²", "# Model-fit R²"), fc.r2],
      [tx("# 예측 범위", "# Predictive range"), fc.intervalLabel || "90% analytical predictive reference interval"],
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
    if (nm === "trend") return tx("시간 추세 (전반적으로 늘고 있나 줄고 있나)", "Time trend (is it generally rising or falling)");
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
function buildCannibCsv(cannib, effects, target) {
  const chans = cannib.cannChannels || [];
  const effByKey = {};
  (effects || []).forEach((e) => (effByKey[e.key] = e));
  const header = [
    "channel", "channel_label", "is_brand_intercept", "verdict", "verdict_class",
    "vote_FOR", "vote_AGAINST", "vote_ABSTAIN", "for_bar", "power_gate_blocked",
    "power_gate_reasons", "reverse_causality_risk", "spend_time_corr",
    "prec_vote", "prec_low_n", "prec_p25", "prec_slope_per_wk", "prec_slope_p", "prec_change_pct",
    "detrend_vote", "detrend_raw", "detrend_detrended", "detrend_first_diff",
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
function buildCannibSeriesCsv(panel, target) {
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
function mmmStageDefs(locale) {
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
function mmmBucketMeta(locale) {
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
const MMM_BUCKET_ORDER = ["base", "trend", "event", "industry", "media"];
function decompBucketOf(g) {
  if (g === "Seasonality") return "base";
  if (g === "Trend") return "trend";
  if (g === "Industry Trend") return "industry";
  if (g === "Holidays" || g === "Regime(steps)") return "event";
  return MMM_NONMEDIA_GROUPS.includes(g) ? "event" : "media";
}
// 개별 채널(광고) 밴드용 팔레트 — 보라 계열 명도차. hex+alpha는 fill에만.
const MMM_MEDIA_PALETTE = ["#8b7ff0", "#a78bfa", "#c084fc", "#e879f9", "#7dd3fc", "#67e8f9"];

// 차트 테마·공통 옵션 — 컴포넌트 밖(상수)로 두어 effect 의존성 안정화
const CHART_THEME = { text: "#334155", muted: "#64748b", grid: "#e2e8f0" };
function chartBase() {
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

function sliceMmmPanel(panel, end, start = 0) {
  return {
    ...panel,
    week: panel.week.slice(start, end),
    weekLabel: panel.weekLabel?.slice(start, end),
    dateLabel: panel.dateLabel?.slice(start, end),
    dates: panel.dates?.slice(start, end),
    ch: Object.fromEntries(Object.entries(panel.ch).map(([key, values]) => [key, values.slice(start, end)])),
    dummy: Object.fromEntries(Object.entries(panel.dummy || {}).map(([key, values]) => [key, values.slice(start, end)])),
    steps: Object.fromEntries(Object.entries(panel.steps || {}).map(([key, values]) => [key, values.slice(start, end)])),
    targets: Object.fromEntries(Object.entries(panel.targets).map(([key, values]) => [key, values.slice(start, end)])),
  };
}

function buildForecastModelForSelection(sourcePanel, sourceCfg, target, selected) {
  const rawPanel = sliceMmmPanel(sourcePanel, sourcePanel.week.length, Math.max(0, sourcePanel.week.length - selected.window));
  const seasonalModel = selected.seasonalityScope === "global"
    ? mmmForecastGlobalSeasonality(sourcePanel, target, selected.seasonalityPeriods)
    : null;
  const trendStart = selected.trendWindow === "all" ? 0 : Math.max(0, sourcePanel.week.length - (selected.trendWindow || 0));
  const trendModel = selected.trendScope === "global"
    ? mmmForecastGlobalBaseline(sliceMmmPanel(sourcePanel, sourcePanel.week.length, trendStart), target, [])
    : null;
  if ((selected.seasonalityScope === "global" && !seasonalModel) || (selected.trendScope === "global" && !trendModel)) return { rawPanel, panel: null, cfg: null, run: null };
  const lastWeek = rawPanel.week.at(-1);
  const offsetModel = seasonalModel || trendModel ? {
    offsetAt: (week) => (seasonalModel?.offsetAt(week) || 0) + (trendModel?.trendOffsetAt(week) || 0),
    futureOffsetAt: (week) => (seasonalModel?.offsetAt(week) || 0) + mmmForecastDampedTrendOffset(trendModel, lastWeek, week),
  } : null;
  const panel = offsetModel
    ? { ...rawPanel, targets: { ...rawPanel.targets, [target]: rawPanel.targets[target].map((value, index) => value - offsetModel.offsetAt(rawPanel.week[index])) } }
    : rawPanel;
  const cfg = {
    ...sourceCfg,
    seasonalityPeriods: selected.seasonalityScope === "recent" ? selected.seasonalityPeriods : [],
    includeTrend: selected.trendScope !== "global",
    baselineKnots: [],
  };
  const run = mmmBayesianRun(panel, cfg, target, false, {
    skipTransformUncertainty: true,
    enableBaselineSelection: false,
  });
  return { rawPanel, panel, cfg, run, seasonalModel: offsetModel };
}

export function buildForecastOnlyModelFromPanel(sourcePanel, sourceCfg, target) {
  const selection = mmmForecastRollingSelection(sourcePanel, sourceCfg, target);
  const selected = selection.selected;
  if (!selected) return { selection, sourcePanel, sourceCfg, target, panel: null, cfg: null, run: null };
  return { ...buildForecastModelForSelection(sourcePanel, sourceCfg, target, selected), selection, sourcePanel, sourceCfg, target };
}

function buildForecastOnlyModel(mmm) {
  return buildForecastOnlyModelFromPanel(mmm.panel, mmm.cfg, mmm.target);
}

function sumTail(parts, field, length) {
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

function mmmSumOsBacktests(parts) {
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
  return {
    labels: (valid[0].labels || []).slice(-length),
    actual,
    predicted,
    validationStartIndex,
    rmse: Math.sqrt(absErrors.reduce((sum, value) => sum + value ** 2, 0) / validationLength),
    mae: absErrors.reduce((sum, value) => sum + value, 0) / validationLength,
    wmape,
    reliable: Number.isFinite(wmape) && wmape <= 30,
  };
}

function buildOsForecastComponent(headers, rows, colMap, platform, target, locale, weekStart) {
  const built = buildPanelFromColMap(headers, rows, colMap, platform, locale, null, { weekStart });
  if (built.missing.length) return { platform, reason: `missing: ${built.missing.join(", ")}` };
  const panel = trimToActive(built.panel);
  const resolvedTarget = pickTarget(panel, target);
  const validate = mmmValidate(panel, locale, resolvedTarget);
  if (validate.issues?.length) return { platform, reason: validate.issues.join(" ") };
  const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
  cfg.absorbed = mmmResolveAbsorb(panel, cfg).absorbed;
  const model = buildForecastOnlyModelFromPanel(panel, cfg, resolvedTarget);
  return { ...model, platform, target: resolvedTarget, sourcePanel: panel };
}

function buildForecastExcelModel(model, rawForecast, restoredForecast) {
  if (!model?.run || !rawForecast || !restoredForecast) return null;
  const historyOffset = (model.panel.week || []).map((week) => model.seasonalModel?.offsetAt?.(week) || 0);
  const futureOffset = (rawForecast.predFut || []).map((value, index) => (restoredForecast.predFut?.[index] ?? value) - value);
  return {
    platform: model.platform || "model",
    target: model.target,
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
    histSpendByKey: model.panel.ch || {},
    futSpendByKey: rawForecast.futSpendByKey || {},
    histLabels: rawForecast.histLabels || [],
    futLabels: rawForecast.futLabels || [],
    actual: restoredForecast.actual || [],
    historyOffset,
    futureOffset,
    futureMargins: (rawForecast.hi || []).map((value, index) => Math.max(0, value - (rawForecast.predFut?.[index] || 0))),
  };
}

function runForecastScenario(model, horizon, budgets, stepOff) {
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
    futureSteps[key] = Array.from({ length: horizon }, (_, index) => index < keepWeeks ? lastValue : 0);
  });
  const result = mmmBayesianForecast(
    model.run,
    model.panel,
    Object.keys(futureSpend).length ? futureSpend : null,
    horizon,
    { futureSteps },
  );
  const restored = mmmForecastRestoreSeasonality(result, model.panel, model.seasonalModel);
  if (!restored) return null;
  const excelModel = buildForecastExcelModel(model, result, restored);
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

// 선택된 Cost 창이 30주처럼 짧아도, 최근 24주 검증은 전체 이력에서 마지막
// 12주를 완전히 빼고 같은 선택 사양으로 다시 적합한다. 짧은 Cost 창 때문에
// 검증 카드를 숨기던 기존 동작을 없애면서 holdout의 실제값은 학습에 섞지 않는다.
export function buildForecastRecentBacktest(model) {
  const sourcePanel = model?.sourcePanel;
  const target = model?.target;
  const n = sourcePanel?.week?.length || 0;
  const holdout = 12;
  if (!model?.sourceCfg || !target || n < 36) return null;
  const trainSource = sliceMmmPanel(sourcePanel, n - holdout);
  const trainModel = model.selection?.selected
    ? buildForecastModelForSelection(trainSource, model.sourceCfg, target, model.selection.selected)
    : null;
  if (!trainModel.run || !trainModel.panel) return null;
  const futureSpend = Object.fromEntries(Object.entries(sourcePanel.ch).map(([key, values]) => [key, values.slice(-holdout)]));
  const futureDummy = Object.fromEntries(Object.entries(sourcePanel.dummy || {}).map(([key, values]) => [key, values.slice(-holdout)]));
  const futureSteps = Object.fromEntries(Object.entries(sourcePanel.steps || {}).map(([key, values]) => [key, values.slice(-holdout)]));
  const result = mmmBayesianForecast(trainModel.run, trainModel.panel, futureSpend, holdout, {
    futureDummy,
    futureSteps,
    clampScenario: false,
    trendDamping: 0,
  });
  const restored = mmmForecastRestoreSeasonality(result, trainModel.panel, trainModel.seasonalModel);
  if (!restored?.predFut || restored.predFut.length !== holdout) return null;
  const contextLength = 12;
  const actual = [
    ...sourcePanel.targets[target].slice(-(holdout + contextLength), -holdout),
    ...sourcePanel.targets[target].slice(-holdout),
  ];
  const predicted = [...restored.fittedHist.slice(-contextLength), ...restored.predFut];
  const validationActual = actual.slice(contextLength);
  const validationPredicted = predicted.slice(contextLength);
  const absErrors = validationActual.map((value, index) => Math.abs(value - validationPredicted[index]));
  const actualTotal = validationActual.reduce((sum, value) => sum + Math.abs(value), 0);
  const wmape = actualTotal > 0 ? absErrors.reduce((sum, value) => sum + value, 0) / actualTotal * 100 : null;
  return {
    labels: (sourcePanel.weekLabel || sourcePanel.week).slice(-(holdout + contextLength)),
    actual,
    predicted,
    validationStartIndex: contextLength,
    rmse: Math.sqrt(absErrors.reduce((sum, value) => sum + value ** 2, 0) / holdout),
    mae: absErrors.reduce((sum, value) => sum + value, 0) / holdout,
    wmape,
    reliable: Number.isFinite(wmape) && wmape <= 30,
  };
}

export default function MarketingResponse({ locale = "ko" }) {
  // 3단계(index MMM_STAGE_DEFS): diagnose | mmm | lab. 구 "forecast" 스테이지는 lab에 흡수 —
  // ③ lab이 mmmForecast(②계수) §7 미래예측을 렌더(stage==="lab"). 셋 다 shared mmmColMap 사용.
  const tx = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]); // 인라인 텍스트 로컬라이즈 헬퍼(§12.20 v2 i18n 패턴)
  const bucketMeta = mmmBucketMeta(locale);
  const [stage, setStage] = useState("trend"); // trend | diagnose | mmm | lab
  const [target, setTarget] = useState("Regs");
  const decompModel = "bayesian";
  const [decompGrouped, setDecompGrouped] = useState(true); // §5.5 true=4버킷 묶음 / false=광고 개별채널
  // RMS 비중에서 기본 수요·추세가 너무 큰 경우, 나머지 동인끼리의 상대 크기를
  // 볼 수 있게 한다. 모델·원본 기여값은 바꾸지 않고 이 표시용 분모만 전환한다.
  const [includeBaseDemandInShare, setIncludeBaseDemandInShare] = useState(true);
  const [satHidden, setSatHidden] = useState({}); // 수확체감 곡선 채널별 표시 토글 { [chKey]: true=숨김 }
  const [spikeNotes, setSpikeNotes] = useState({}); // §5.5 튀는 구간 메모 { [target|week]: note }
  const [fcHorizon, setFcHorizon] = useState(13);
  const [fcBudget, setFcBudget] = useState({}); // {chKey: 주 평균 예산} — 미입력 채널은 최근평균
  const [fcStepOff, setFcStepOff] = useState({}); // {stepKey: 켜둘 미래 기간 N} — 빈값=지속
  const [cannibChannel, setCannibChannel] = useState(null);
  const [cannibQuestion, setCannibQuestion] = useState("precedence");
  const [selectedCollinearPairKey, setSelectedCollinearPairKey] = useState(null);
  // 기본 결과는 기존 MMM 그대로. prior 관련 데이터가 실제로 있을 때만 결과 탭 후보가 추가된다.
  // 원자료는 이 컴포넌트 메모리에만 두며 서버로 보내지 않는다.
  const [selectedEvidence, setSelectedEvidence] = useState({ experiment: false, country: false });
  const [priorEvidence, setPriorEvidence] = useState({ experiment: null, country: null });
  const csvData = useAppStore((state) => state.csvData);
  const setCsvData = useAppStore((state) => state.setCsvData);
  const demoDisabled = useAppStore((state) => state.demoDisabled);
  const requestAd = useAppStore((state) => state.requestAd);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const setDisplayCurrency = useAppStore((state) => state.setDisplayCurrency);
  const currencySym = CURRENCY_SYMBOLS[displayCurrency] || "$";
  // 숫자만 있는 CSV는 USD/KRW를 안전하게 추론할 수 없다. 미선택인데 KRW로
  // 가정해 환산하면 $16,772를 $12처럼 망가뜨리므로, 선택 전에는 환산하지 않는다.
  const selectedSourceCurrency = ["KRW", "USD"].includes(csvData?.currency) ? csvData.currency : null;
  const sourceCurrency = selectedSourceCurrency || displayCurrency;
  const convAmt = (v) => selectedSourceCurrency ? convertCurrency(v, sourceCurrency, displayCurrency) : Number(v);
  const hasData = csvData?.raw?.length > 0;
  const isDemo = !!(csvData?.fileName && csvData.fileName.startsWith("demo_"));
  const setMmmSourceCurrency = (currency) => {
    setCsvData({ ...csvData, currency });
    setDisplayCurrency(currency);
  };

  // 5-18 = colMap DnD가 PRIMARY 매퍼(index.html page_5_18 이식). 단일 generic CSV를
  // 주차/날짜/가입/재활성/채널(perf·brand)/더미/step 역할로 드래그 → 모든 분석(진단·MMM·시뮬)
  // 이 이 하나의 패널을 공유. 표준필드(DataFeatureMatrix) 경로 미사용.
  const [mmmColMap, setMmmColMap] = useState(null);
  const [mmmWeekStart, setMmmWeekStart] = useState("monday");
  const [mmmAnalyzedSig, setMmmAnalyzedSig] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisEventRef = useRef(null);
  const analysisTransitionRef = useRef(0);
  // 타깃·플랫폼·prior를 처음 전환할 때도 수백 회 profile/rolling fit이 필요할 수
  // 있다. 오버레이를 두 프레임 먼저 그린 뒤 상태를 커밋해 첫 클릭이 멈춘 것처럼
  // 보이지 않게 한다. 같은 조합 재방문은 위 WeakMap 캐시에서 즉시 반환된다.
  const deferMmmUpdate = useCallback((update) => {
    const transition = ++analysisTransitionRef.current;
    setIsAnalyzing(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (transition !== analysisTransitionRef.current) return;
        update();
        requestAnimationFrame(() => {
          if (transition === analysisTransitionRef.current) setIsAnalyzing(false);
        });
      });
    });
  }, []);
  // 분석하기: 무거운 mmm useMemo가 커밋 렌더에서 동기 실행되므로, 로딩 오버레이를 먼저
  // 페인트(더블 rAF)한 뒤 시그니처를 커밋 → "멈춤" 대신 "분석 중" 표시(§7 성능).
  // 분석 시작은 현재 매핑 위치에서 하는 행동이므로 스크롤을 강제로 옮기지 않는다.
  const runMmmAnalyze = (sig) => {
    trackProductEvent("analysis_started", { tool_id: "5-18", source: isDemo ? "demo" : "csv", row_count: csvData?.raw?.length || 0, analysis_type: "mmm" });
    deferMmmUpdate(() => setMmmAnalyzedSig(sig));
  };
  // 플랫폼 필터(Total/Android/iOS) — colMap 헤더 태그(_android/_ios) 기준. 태그 없으면 토글 자체 숨김.
  const [platformFilter, setPlatformFilter] = useState("all"); // all | android | ios

  // CSV 로드 시 colMap 자동 초기화(이름 기반 부분 추정 — reg/react/채널만, 나머지는 트레이).
  const csvSig = hasData ? `${csvData.fileName}|${(csvData.headers || []).join(",")}` : "";
  const colMapSig = mmmColMap ? JSON.stringify(mmmColMap) : "";
  const mmmAnalysisSig = `${colMapSig}\u001fweek-start:${mmmWeekStart}`;
  const prevCsvSig = useRef(null);
  // Set by the demo button so the auto-guessed colMap is also auto-confirmed
  // (analyze gate opened) — results render instantly, matching other tools.
  const demoPending = useRef(false);
  useEffect(() => {
    if (hasData && prevCsvSig.current !== csvSig) {
      const guess = autoGuessColMap(csvData.headers, csvData.raw);
      setMmmColMap(guess);
      setMmmAnalyzedSig(demoPending.current ? `${JSON.stringify(guess)}\u001fweek-start:${mmmWeekStart}` : null);
      setSelectedEvidence({ experiment: false, country: false });
      setPriorEvidence({ experiment: null, country: null });
      demoPending.current = false;
      prevCsvSig.current = csvSig;
    } else if (!hasData && prevCsvSig.current !== null) {
      setMmmColMap(null);
      setMmmAnalyzedSig(null);
      prevCsvSig.current = null;
    }
  }, [hasData, csvSig, csvData.headers, csvData.raw, mmmWeekStart]);

  // 파일 업로드(자체 dropzone — 5-18은 표준 CsvUploader/DataFeatureMatrix 미사용).
  const mmmFileRef = useRef(null);
  const handleMmmFile = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (res) => {
        if (!res.data || !res.data.length) return;
        setCsvData({ raw: res.data, headers: res.meta.fields || [], mapping: {}, fileName: file.name });
      },
    });
  };
  const handleLoadDemo = () => {
    demoPending.current = true;
    setCsvData(buildDemoCsv("response"));
  };
  const handleLoadPriorDemo = () => {
    const demo = buildMmmPriorDemo();
    setPriorEvidence({
      experiment: { name: demo.experiment.fileName, rows: demo.experiment.raw.length, countries: ["KR"], raw: demo.experiment.raw, headers: demo.experiment.headers, analysisType: "auto" },
      country: {
        name: demo.country.fileName,
        rows: demo.country.raw.length,
        countries: [...new Set(demo.country.raw.map((row) => row.country))],
        raw: demo.country.raw,
        headers: demo.country.headers,
      },
    });
    setSelectedEvidence({ experiment: false, country: false });
  };

  // 첫 진입(데이터 없음) 시 샘플 데이터 자동 로드(CsvUploader와 동일 패턴, SEO·첫인상).
  useEffect(() => {
    if (!hasData && !demoDisabled) handleLoadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mmmAnalyzed = mmmAnalyzedSig != null && mmmAnalyzedSig === mmmAnalysisSig;
  const changeMmmWeekStart = (weekStart) => {
    if (weekStart === mmmWeekStart) return;
    const shouldReanalyze = mmmAnalyzed;
    setMmmWeekStart(weekStart);
    if (shouldReanalyze) deferMmmUpdate(() => setMmmAnalyzedSig(`${colMapSig}\u001fweek-start:${weekStart}`));
  };

  // 단일 컬럼 세그먼트(platform role) 모드 — 그 컬럼 고유값(성별·플랫폼·국가 등) pill 토글.
  // 태그 모드(mmmPlatformTags)와 상호배타(buildPanelFromColMap: r.platform 있으면 태그 무시).
  const segmentSel = useMemo(
    () => (hasData && mmmColMap && mmmAnalyzed ? mmmSegmentValues(csvData.headers, csvData.raw, mmmColMap) : null),
    [hasData, mmmColMap, csvData, mmmAnalyzed],
  );
  // platformFilter가 현재 세그먼트 값에 없으면(매핑 변경 잔상) Total로 파생(setState 대신
  // 렌더타임 파생 — AHA validSeg 패턴, 캐스케이딩 렌더 회피). 패널·pill 모두 이 값 사용.
  const effPlatformFilter = useMemo(() => {
    if (segmentSel && platformFilter !== "all" && !segmentSel.values.some((v) => v.value === platformFilter)) return "all";
    return platformFilter;
  }, [segmentSel, platformFilter]);

  // Chart refs
  const cvRef = useRef(null);
  const shapleyRef = useRef(null);
  const satRef = useRef(null);
  const efficiencyRef = useRef(null);
  const fitRef = useRef(null);
  const decompRef = useRef(null);
  const forecastRef = useRef(null);
  const trendRef = useRef(null);
  const simpleRef = useRef(null);
  const irfRef = useRef(null);

  // ── MMM 캐시 (buildMmmMethCache 축약) — 매핑·데이터·target·model 변경 시 재계산 ──
  const mmm = useMemo(() => {
    if (!hasData) return null;
    // 분석 게이트(index 분석하기): 매핑 확정 전엔 무거운 엔진(mmmRunMmm 등)을 돌리지 않음 —
    // 드래그 도중 반쯤 매핑된 colMap으로 엔진이 도는 것을 막고(성능·크래시 방지) 게이트 후에만 계산.
    if (!mmmAnalyzed) return { empty: true, reason: tx("매핑 확정(분석하기) 후 결과가 표시됩니다.", "Results appear after you confirm the mapping (Analyze).") };
    try {
      // colMap(PRIMARY) → 패널. 미완성이면 매핑 안내(패널 empty).
      if (!mmmColMap) return { empty: true, reason: tx("컬럼 역할을 매핑하세요 (날짜/주차 · 목표 Y · 채널 spend).", "Map column roles (date/week · target Y · channel spend).") };
      const resultCacheKey = [
        mmmAnalyzedSig,
        colMapSig,
        target,
        effPlatformFilter,
        locale,
        csvData.headers?.join("\u001f"),
        selectedEvidence.experiment ? `e:${mmmCacheObjectId(priorEvidence.experiment?.raw)}:${priorEvidence.experiment?.analysisType || "auto"}` : "e:off",
        selectedEvidence.country ? `c:${mmmCacheObjectId(priorEvidence.country?.raw)}` : "c:off",
      ].join("\u001e");
      const cachedResult = mmmCachedResult(csvData.raw, resultCacheKey);
      if (cachedResult) return cachedResult;
      const built = buildPanelFromColMap(csvData.headers, csvData.raw, mmmColMap, effPlatformFilter, locale, null, { weekStart: mmmWeekStart });
      if (built.missing.length) return { empty: true, reason: tx("필수 역할 미지정: ", "Required role not set: ") + built.missing.join(", ") };
      const panel = trimToActive(built.panel);
      const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
      const t = pickTarget(panel, target);
      const validate = mmmValidate(panel, locale, t);
      // 실제 달력 주가 비어 있으면 행 번호를 t=1…N으로 압축하는 순간 adstock과
      // 계절성이 틀어진다. 결측 주를 0으로 임의 보간하지 않고 사용자가 실제 KPI·
      // 지출 행을 채우도록 모델 적합 전에 명시적으로 중단한다.
      if (validate.issues?.length) {
        return {
          empty: true,
          reason: validate.issues.join(" "),
          issues: validate.issues,
          validate,
          panel,
        };
      }
      const derived = {
        orientation: "colmap",
        target: t,
        availableTargets: MMM_USER_TARGETS.filter((target) => Object.prototype.hasOwnProperty.call(panel.targets, target)),
        channels: built.roles.channels.map((c) => c.label),
        time: built.roles.week.length ? tx("매핑된 주차 컬럼", "Mapped week column") : tx("행 순서", "Row order"),
        n: panel.week.length,
        dummies: built.roles.dummies.map((d) => d.label),
        useDummies: panel.useDummies,
      };
      // 공선쌍 감지. 사용자 선택이 없으면 어느 변수도 임의 제거하지 않고 식별·예산 gate로 보류한다.
      const absorb = mmmResolveAbsorb(panel, cfg);
      cfg.absorbed = absorb.absorbed;
      // 국가 prior: 동일 포맷의 참고 시장을 각각 적합한 뒤 매체 β만 평균낸다.
      // baseline·추세·계절성은 절대 이식하지 않으며, country 컬럼별 개별 모델이
      // 성공한 경우만 약한 precision으로 참고한다.
      const mediaPriors = {};
      const experimentPriorDiagnostics = [];
      let countryCandidates = [];
      let countryIndividualCandidates = [];
      let countryBacktests = null;
      let countryValidationMode = null;
      let countryPlan = null;
      let isCountryPriorTuned = false;
      const experiment = selectedEvidence.experiment ? priorEvidence.experiment : null;
      if (experiment?.raw?.length && experiment.headers?.length) {
        const allTargetRoleItems = [
          ...built.roles.traffic, ...built.roles.reg, ...built.roles.react, ...built.roles.purchasers, ...built.roles.revenue,
        ];
        const requestedExperimentType = experiment.analysisType || "auto";
        let experimentType = mmmResolveExperimentType(experiment.headers, experiment.raw, requestedExperimentType);
        const geoNormalized = experimentType.type === "geo"
          ? mmmNormalizeGeoWideEvidence(experiment.headers, experiment.raw, {
            targetHeaders: allTargetRoleItems.map((item) => item.header),
            channelHeaders: built.roles.channels.map((item) => item.header),
          })
          : { headers: experiment.headers, rows: experiment.raw, normalized: false, mode: "onoff" };
        const longNormalized = mmmNormalizeExperimentLongMedia(
          geoNormalized.headers,
          geoNormalized.rows,
          built.roles.channels,
          allTargetRoleItems.map((item) => item.header),
        );
        const experimentHeaders = longNormalized.headers;
        const experimentSourceRows = longNormalized.rows;
        experimentType = mmmResolveExperimentType(experimentHeaders, experimentSourceRows, requestedExperimentType);
        const normalizationMode = [geoNormalized.normalized ? geoNormalized.mode : null, longNormalized.normalized ? longNormalized.mode : null].filter(Boolean).join(" + ") || "none";
        const normalizationFailure = geoNormalized.error
          ? { reason: geoNormalized.error, detail: "geo-wide" }
          : geoNormalized.droppedBlankGeoRows > 0
            ? { reason: "blank-geo-wide-rows", detail: `${geoNormalized.droppedBlankGeoRows}` }
            : longNormalized.error
              ? { reason: longNormalized.error, detail: "long-media" }
              : longNormalized.repeatedDesignConflicts > 0
                ? { reason: "conflicting-long-design", detail: `${longNormalized.repeatedDesignConflicts}` }
                : longNormalized.repeatedTargetConflicts > 0
                  ? { reason: "conflicting-long-target", detail: `${longNormalized.repeatedTargetConflicts}` }
                : longNormalized.unmatchedChannels?.length
                  ? { reason: "unmatched-long-channels", detail: longNormalized.unmatchedChannels.join(", ") }
                  : null;
        const platformSlice = mmmEvidencePlatformSlice(experimentHeaders, experimentSourceRows, effPlatformFilter);
        let experimentRows = platformSlice.rows;
        const exactHeaderSet = new Set(experimentHeaders);
        const platformKey = mmmCanonicalSegment(effPlatformFilter);
        const activeMappedHeaders = (items) => (items || [])
          .filter((item) => platformSlice.platformHeader || effPlatformFilter === "all" || item.plat === "common" || mmmCanonicalSegment(item.plat) === platformKey)
          .map((item) => item.header)
          .filter((header) => exactHeaderSet.has(header));
        const targetRoleItems = {
          Traffic: built.roles.traffic,
          Regs: built.roles.reg,
          React: built.roles.react,
          Purchasers: built.roles.purchasers,
          Revenue: built.roles.revenue,
        };
        let targetComposition = platformSlice.matched
          ? mmmComposeEvidenceTarget(experimentRows, activeMappedHeaders(targetRoleItems[t]), `__mmm_${t.toLowerCase()}_target`)
          : null;
        let targetHeader = targetComposition?.targetHeader || null;
        if (targetComposition) experimentRows = targetComposition.rows;
        let hasTargetDiagnostic = !!normalizationFailure;
        // Traffic 컬럼 없이 Regs+React로 자동 생성된 총유입은 실험 원자료도 같은
        // 정의로 맞춰야 한다. 별도 traffic 헤더가 있더라도 정의가 달라질 수 있으므로
        // 가입+재유입 합계를 사용하고, 둘 중 하나라도 없으면 prior를 적용하지 않는다.
        if (t === "Traffic" && built.roles.traffic.length === 0 && platformSlice.matched && !normalizationFailure) {
          const regsHeaders = activeMappedHeaders(built.roles.reg);
          const reactHeaders = activeMappedHeaders(built.roles.react);
          if (regsHeaders.length && reactHeaders.length) {
            targetComposition = mmmComposeEvidenceTarget(
              platformSlice.rows,
              [...regsHeaders, ...reactHeaders],
              "__mmm_derived_traffic_target",
            );
            targetHeader = targetComposition.targetHeader;
            experimentRows = targetComposition.rows;
          } else {
            targetHeader = null;
            hasTargetDiagnostic = true;
            experimentPriorDiagnostics.push({
              unidentified: true,
              channel: mmmTargetDisplay("Traffic", locale),
              messageKo: "가입+재유입으로 자동 생성된 총유입 목표에는 실험 원자료에도 가입·재유입 두 컬럼이 모두 필요합니다. 같은 Y를 만들 수 없어 prior를 적용하지 않았습니다.",
              messageEn: "Traffic was derived from registrations + reactivations, so the experiment source also needs both columns. No prior was applied because the same Y could not be constructed.",
            });
          }
        }
        if (!targetHeader && !hasTargetDiagnostic) {
          const platformLabel = effPlatformFilter === "all" ? "" : ` (${effPlatformFilter})`;
          experimentPriorDiagnostics.push({
            unidentified: true,
            channel: `${mmmTargetDisplay(t, locale)}${platformLabel}`,
            messageKo: effPlatformFilter === "all"
              ? "실험 원자료에서 현재 목표와 같은 Y를 찾지 못해 prior를 적용하지 않았습니다. Y 헤더와 비즈니스 정의를 확인하세요."
              : "현재 선택한 플랫폼/세그먼트와 같은 실험 Y 또는 행을 찾지 못했습니다. Total이나 다른 OS의 근거를 자동 차용하지 않았습니다.",
            messageEn: effPlatformFilter === "all"
              ? "No prior was applied because the experiment source has no Y matching the current target. Check the Y header and business definition."
              : "No experiment Y or rows matched the selected platform/segment. Evidence from Total or another OS was not borrowed automatically.",
          });
        }
        const stateHeader = experimentType.type === "onoff" ? mmmFindExperimentBinaryHeader(experimentHeaders, experimentRows, "state") : null;
        const armHeader = experimentType.type === "geo" ? (experimentHeaders.includes("__mmm_arm") ? "__mmm_arm" : mmmFindExperimentBinaryHeader(experimentHeaders, experimentRows, "arm")) : null;
        const mappedTimeHeader = built.roles.date || built.roles.week[0]?.header || null;
        // 메인에서 `period`라는 날짜 컬럼을 매핑한 경우 이름만 보고 pre/post로
        // 먼저 빼앗지 않는다. 시간축을 우선 확정하고, 실제 값이 양쪽 pre/post
        // 범주로 완전히 파싱되는 별도 열만 실험 period로 인정한다.
        const timeHeader = mmmFindEvidenceTimeHeader(experimentHeaders, mappedTimeHeader);
        const periodHeader = experimentType.type === "geo" ? mmmFindEvidencePeriodHeader(experimentHeaders, experimentRows, timeHeader) : null;
        const geoHeader = experimentType.type === "geo" ? experimentHeaders.find((h) => h === "__mmm_geo" || /(^|[_\s])(geo|region|location)([_\s]|$)|지역|권역/i.test(String(h))) : null;
        const spends = mmmEvidenceSpendHeaders(experimentHeaders, built.roles.channels.map((role) => role.header));
        const hasValidTypeSchema = !!timeHeader && (experimentType.type === "onoff" || !!(geoHeader && armHeader && periodHeader));
        if (normalizationFailure) {
          experimentPriorDiagnostics.push({
            unidentified: true,
            experimentType: experimentType.type,
            experimentTypeSource: experimentType.source,
            normalizationMode,
            channel: mmmTargetDisplay(t, locale),
            reason: normalizationFailure.reason,
            detail: normalizationFailure.detail,
            messageKo: normalizationFailure.reason === "unmatched-long-channels"
              ? `long 형식의 channel 값이 메인 MMM 채널과 모두 일치해야 합니다. 미매핑: ${normalizationFailure.detail}`
              : normalizationFailure.reason === "conflicting-long-design"
                ? "같은 기간·지역의 long 행에서 state·arm·period가 서로 달라 prior를 적용하지 않았습니다. 반복 채널 행의 실험 범주를 동일하게 맞추세요."
              : normalizationFailure.reason === "conflicting-long-target"
                ? "같은 기간·지역의 long 행에서 KPI 값이 서로 달라 prior를 적용하지 않았습니다. 반복 행의 Y를 동일하게 맞추세요."
                : normalizationFailure.reason === "blank-geo-wide-rows"
                  ? `target_geo/control_geo가 빈 wide 행 ${normalizationFailure.detail}개가 있어 prior를 적용하지 않았습니다.`
                  : "실험 wide/long 형식을 안전하게 변환하지 못했습니다. 쌍 헤더·channel 값·time을 확인하세요.",
            messageEn: normalizationFailure.reason === "unmatched-long-channels"
              ? `Every long-format channel value must match a main MMM channel. Unmapped: ${normalizationFailure.detail}`
              : normalizationFailure.reason === "conflicting-long-design"
                ? "No prior was applied because repeated long rows disagree on state, arm, or period for the same time and geo. Make experiment categories identical across channel rows."
              : normalizationFailure.reason === "conflicting-long-target"
                ? "No prior was applied because repeated long rows disagree on the KPI for the same time and geo. Make repeated Y values identical."
                : normalizationFailure.reason === "blank-geo-wide-rows"
                  ? `${normalizationFailure.detail} wide row(s) have a blank target_geo/control_geo, so no prior was applied.`
                  : "The experiment wide/long source could not be normalized safely. Check paired headers, channel values, and time.",
          });
        } else if (!hasValidTypeSchema) {
          experimentPriorDiagnostics.push({
            unidentified: true,
            experimentType: experimentType.type,
            experimentTypeSource: experimentType.source,
            normalizationMode,
            channel: mmmTargetDisplay(t, locale),
            reason: "invalid-experiment-type-schema",
            messageKo: experimentType.type === "geo"
              ? "Geo 유형에는 time·geo·arm·period와 같은 채널 spend·KPI가 필요합니다. target_geo/control_geo wide 형식이면 target_/control_ 쌍 헤더를 확인하세요."
              : "On/Off 유형에는 정렬 가능한 time과 같은 채널 spend·KPI가 필요합니다. state가 없으면 검증된 spend 0=OFF·양수=ON으로만 추론합니다.",
            messageEn: experimentType.type === "geo"
              ? "Geo type requires time, geo, arm, period, matching channel spend, and KPI. For target_geo/control_geo wide input, verify every target_/control_ header pair."
              : "On/Off type requires a sortable time column plus matching channel spend and KPI. Without state, only verified spend zero=OFF and positive=ON are inferred.",
          });
        } else if (targetHeader && spends.length) {
          const baseRun = mmmBayesianRun(panel, cfg, t, false, { skipTransformUncertainty: true });
          const matchedSpends = spends.map((spendHeader) => {
            const mappedRole = built.roles.channels.find((role) => role.header === spendHeader);
            const channel = mappedRole ? baseRun?.saturationByChannel?.[mappedRole.key] : null;
            const contrast = channel ? mmmEvidenceTreatmentContrast(experimentRows, spendHeader, { stateHeader, armHeader, periodHeader }) : null;
            return channel ? { spendHeader, key: mappedRole.key, channel, contrast } : null;
          }).filter(Boolean);
          const changedSpends = matchedSpends.filter((item) => item.contrast?.isChanged);
          const identifiedSpends = changedSpends;
          if (identifiedSpends.length > 1) {
            experimentPriorDiagnostics.push({
              unidentified: true,
              channel: identifiedSpends.map((item) => item.channel.label).join(" + "),
              experimentType: experimentType.type,
              experimentTypeSource: experimentType.source,
              normalizationMode,
              messageKo: "동시에 처리된 여러 채널의 효과는 이 실험 하나로 분리할 수 없습니다. 채널별 실험 파일을 따로 올려야 하며, 현재 prior에는 적용하지 않았습니다.",
              messageEn: "One experiment cannot separate effects from multiple channels treated at the same time. Upload a separate experiment file per channel; no prior was applied.",
            });
          } else if (identifiedSpends.length === 0) {
            experimentPriorDiagnostics.push({
              unidentified: true,
              channel: matchedSpends.map((item) => item.channel.label).join(" + ") || mmmTargetDisplay(t, locale),
              experimentType: experimentType.type,
              experimentTypeSource: experimentType.source,
              normalizationMode,
              messageKo: "실험 처리와 함께 충분히 변한 단일 spend 채널을 찾지 못했습니다. 처리 채널별 파일로 나누거나 상태·처리군·기간 컬럼을 확인하세요.",
              messageEn: "No single spend channel showed a clear treatment contrast. Split the source by treated channel or verify the state, arm, and period columns.",
            });
          } else if (identifiedSpends.length === 1) {
            const { spendHeader, key, channel } = identifiedSpends[0];
            const priorResult = channel && buildExperimentMediaPriorDetailed(experimentRows, {
              targetHeader,
              spendHeader,
              stateHeader,
              armHeader,
              periodHeader,
              timeHeader,
              geoHeader,
              targetSpend: panel.ch[key],
              targetTimes: panel.weekLabel || panel.week,
              targetValues: panel.targets[t],
              params: channel.params,
            });
            const prior = priorResult?.prior;
            if (prior) {
              mergeMediaPrior(mediaPriors, key, { ...prior, source: "experiment" });
              experimentPriorDiagnostics.push({ channel: channel.label, key, experimentType: experimentType.type, experimentTypeSource: experimentType.source, normalizationMode, transformParams: channel.params, targetWeeklySpend: channel.recentMean, ...prior, ...(priorResult?.diagnostic || {}) });
            } else {
              const diagnostic = priorResult?.diagnostic || {};
              experimentPriorDiagnostics.push({
                unidentified: true,
                channel: channel.label,
                experimentType: experimentType.type,
                experimentTypeSource: experimentType.source,
                normalizationMode,
                ...diagnostic,
                messageKo: diagnostic.messageKo || "실험의 처리 강도 또는 KPI 효과를 안정적으로 식별하지 못해 prior를 적용하지 않았습니다. 표본 수·주차 연속성·처리 대비를 확인하세요.",
                messageEn: diagnostic.messageEn || "No prior was applied because treatment intensity or KPI lift was not identified reliably. Check sample size, weekly continuity, and treatment contrast.",
              });
            }
          }
        } else if (targetHeader && !spends.length) {
          experimentPriorDiagnostics.push({
            unidentified: true,
            experimentType: experimentType.type,
            experimentTypeSource: experimentType.source,
            normalizationMode,
            channel: mmmTargetDisplay(t, locale),
            reason: longNormalized.error || geoNormalized.error || "missing-mapped-spend",
            messageKo: "실험 spend를 메인 MMM의 채널에 연결하지 못했습니다. wide는 같은 채널 헤더를, long은 channel 값과 spend 열을 확인하세요.",
            messageEn: "Experiment spend could not be mapped to a main MMM channel. Verify matching wide headers or long-format channel values plus the spend column.",
          });
        }
      }
      const source = selectedEvidence.country ? priorEvidence.country : null;
      if (source?.raw?.length && source.headers?.length) {
        const countryHeader = source.headers.find((h) => MMM_COUNTRY_HEADER_PATTERN.test(String(h)));
        const mappedTimeHeader = built.roles.date || built.roles.week[0]?.header || null;
        const sourceTimeHeader = mmmFindEvidenceTimeHeader(source.headers, mappedTimeHeader);
        const targetCountry = mmmDetectTargetCountry(csvData.headers, csvData.raw);
        // 타깃 국가를 단일값으로 확정하지 못하면 참고 파일 안의 자기 국가 행을
        // 제거할 수 없다. 경고만 띄운 채 적용하면 self-reference가 생기므로 prior를
        // 만들지 않고, 메인 CSV의 COUNTRY 매핑을 고치도록 명시적으로 보류한다.
        if (!countryHeader || targetCountry.status !== "single") {
          const visiblePlan = planCountryReferenceFits(source.raw, {
            countryHeader,
            timeHeader: sourceTimeHeader,
            targetTimes: panel.weekLabel || panel.week,
          });
          countryPlan = {
            ...visiblePlan,
            countries: [],
            blocked: true,
            blockReason: countryHeader ? "target-country" : "reference-country",
            targetCountryDetection: targetCountry.status,
            targetCountryBlankRows: targetCountry.blankRows || 0,
            targetCountry: null,
            excludedTargetCountry: null,
            targetCountryConfirmationRequired: true,
          };
        } else {
        const excludedTargetCountry = targetCountry.status === "single" && countryHeader
          ? source.raw.some((row) => String(row?.[countryHeader] ?? "").trim().toLowerCase() === targetCountry.normalized)
          : false;
        const referenceRows = excludedTargetCountry
          ? source.raw.filter((row) => String(row?.[countryHeader] ?? "").trim().toLowerCase() !== targetCountry.normalized)
          : source.raw;
        countryPlan = planCountryReferenceFits(referenceRows, {
          countryHeader,
          timeHeader: sourceTimeHeader,
          targetTimes: panel.weekLabel || panel.week,
        });
        countryPlan = {
          ...countryPlan,
          targetCountryDetection: targetCountry.status,
          targetCountryBlankRows: targetCountry.blankRows || 0,
          targetCountry: targetCountry.value,
          excludedTargetCountry: excludedTargetCountry ? targetCountry.value : null,
          targetCountryConfirmationRequired: targetCountry.status !== "single",
        };
        countryIndividualCandidates = [
          ...(countryPlan.ineligibleCountries || []).map((item) => ({ ...item, status: "held", reason: item.reason || "minimum-rows" })),
          ...(countryPlan.omittedCountryDetails || []).map((item) => ({ ...item, status: "held", reason: item.reason || "browser-fit-cap" })),
        ];
        // 후보 선택에는 가장 이른 학습 cutoff 당시 이용 가능했던 타깃·참고국
        // 정보만 사용한다. 같은 고정 transform/prior를 모든 rolling fold에 적용해
        // 뒤 시점 참고국 데이터가 앞 holdout으로 새는 일을 막는다.
        countryValidationMode = "as-of-earliest-fold";
        const slicePanel = (input, end) => ({ ...input, week: input.week.slice(0, end), weekLabel: input.weekLabel?.slice(0, end), dateLabel: input.dateLabel?.slice(0, end), dates: input.dates?.slice(0, end), ch: Object.fromEntries(Object.entries(input.ch).map(([key, values]) => [key, values.slice(0, end)])), dummy: Object.fromEntries(Object.entries(input.dummy || {}).map(([key, values]) => [key, values.slice(0, end)])), steps: Object.fromEntries(Object.entries(input.steps || {}).map(([key, values]) => [key, values.slice(0, end)])), targets: Object.fromEntries(Object.entries(input.targets).map(([key, values]) => [key, values.slice(0, end)])) });
        // 최대 12개 적격 참고국을 같은 비중복 rolling-origin folds에서 검증해
        // 상위 4개만 조합한다. 같은 folds를 shortlist·조합 선택에 재사용하므로
        // 단일 holdout보다 안정적일 뿐 독립 OOS나 선택편향 제거로 부르지 않는다.
        const validationFolds = mmmRollingOrigins(panel.week.length, { holdout: 12, minTrain: 24, stride: 12, maxFolds: 3 });
        const evalCache = new Map();
        const meanFinite = (values) => {
          const usable = (values || []).map(Number).filter(Number.isFinite);
          return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
        };
        // Validation priors use only the earliest training window's target scale.
        // Reusing the full-target mean here would leak held-out Y into every fold.
        const validationScaleEnd = validationFolds.length ? Math.min(...validationFolds.map((fold) => fold.cut)) : panel.week.length;
        const validationTargetMean = meanFinite(panel.targets[t].slice(0, validationScaleEnd));
        const validationTargetPanel = slicePanel(panel, validationScaleEnd);
        // alpha/ec/slope도 holdout Y를 보지 않은 가장 이른 train에서 한 번만 고른다.
        // 참고국과 모든 fold를 이 단위에 고정해 후보마다 변환을 다시 골라 생기는
        // validation 이점을 차단한다.
        const validationTransformRun = mmmBayesianRun(validationTargetPanel, cfg, t, false, { skipTransformUncertainty: true });
        const validationTransformParams = validationTransformRun?.params || {};
        // 후보 선택이 끝난 뒤 최종 전체기간 prior를 만들 때만 전체 타깃 transform을
        // 별도로 적합한다. 이 최종 refit 수치는 독립 OOS 점수로 표시하지 않는다.
        const finalTransformRun = mmmBayesianRun(panel, cfg, t, false, { skipTransformUncertainty: true });
        const finalTransformParams = finalTransformRun?.params || {};
        const hasCompleteTransform = (params, inputPanel) => Object.keys(inputPanel.ch || {}).every((key) => {
          const value = params?.[key];
          return value && Number.isFinite(value.alpha) && Number.isFinite(value.ec) && value.ec > 0 && Number.isFinite(value.slope) && value.slope > 0;
        });
        const canAlignCountryTransforms = hasCompleteTransform(validationTransformParams, validationTargetPanel)
          && hasCompleteTransform(finalTransformParams, panel);
        if (!canAlignCountryTransforms) {
          countryPlan = { ...countryPlan, blocked: true, blockReason: "target-transform-alignment-failed", countries: countryPlan.countries || [] };
          countryIndividualCandidates.push(...(countryPlan.countries || []).map((item) => ({ ...item, status: "held", reason: "target-transform-alignment-failed" })));
        }
        // 실험 prior는 전체 패널의 대표 transform 단위이므로 train-only fold에
        // 재사용하지 않는다. 국가 후보는 base 대비 country-only로 검증하고, 선택
        // 이후 최종 all-history fit에서만 별도 추정한 실험 prior와 precision 결합한다.
        const fixedPriors = {};
        const priorSignature = (prior) => Object.entries(prior || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}:${Number(value.mean).toPrecision(9)}:${Number(value.precision).toPrecision(9)}`).join("|");
        const evaluatePrior = (countryPrior, complexity = 1, folds = validationFolds) => {
          const prior = {};
          Object.entries(fixedPriors).forEach(([key, value]) => mergeMediaPrior(prior, key, value));
          Object.entries(countryPrior || {}).forEach(([key, value]) => mergeMediaPrior(prior, key, value));
          const key = `${priorSignature(prior)}|${folds.map((fold) => fold.cut).join(",")}`;
          let result = evalCache.get(key);
          if (!result) {
            const outcomes = folds.map(({ cut, holdout }) => {
              const train = slicePanel(panel, cut);
              const futureSpend = Object.fromEntries(Object.entries(panel.ch).map(([channel, values]) => [channel, values.slice(cut, cut + holdout)]));
              const futureDummy = Object.fromEntries(Object.entries(panel.dummy || {}).map(([key, values]) => [key, values.slice(cut, cut + holdout)]));
              const futureSteps = Object.fromEntries(Object.entries(panel.steps || {}).map(([key, values]) => [key, values.slice(cut, cut + holdout)]));
              const fit = mmmBayesianRun(train, cfg, t, false, {
                mediaPriors: prior,
                skipTransformUncertainty: true,
                // 가장 이른 학습구간에서 선택한 변환을 base/prior 모든 fold에 고정.
                channelParams: validationTransformParams,
              });
              const forecast = fit && mmmBayesianForecast(fit, train, futureSpend, holdout, { futureDummy, futureSteps });
              const actual = panel.targets[t].slice(cut, cut + holdout);
              const rmse = forecast?.predFut?.length === actual.length
                ? Math.sqrt(actual.reduce((sum, value, index) => sum + (value - forecast.predFut[index]) ** 2, 0) / actual.length)
                : Infinity;
              return {
                cut,
                holdout,
                rmse,
                labels: (panel.weekLabel || panel.week).slice(cut, cut + holdout),
                actual,
                predicted: forecast?.predFut || [],
              };
            });
            // 일부 fold만 성공한 후보는 쉬운 구간만으로 순위에 오를 수 있다.
            // 모든 동일 fold가 유한할 때만 shortlist와 조합 평가에 진입시킨다.
            const isComplete = outcomes.length === folds.length && outcomes.every((outcome) => Number.isFinite(outcome.rmse));
            result = { outcomes, summary: isComplete ? summarizeRollingErrors(outcomes.map((outcome) => outcome.rmse), 1) : null };
            evalCache.set(key, result);
          }
          const summary = result.summary && summarizeRollingErrors(result.outcomes.map((outcome) => outcome.rmse), complexity);
          const latest = result.outcomes[0] || null;
          return summary ? { ...summary, rmse: latest?.rmse ?? Infinity, backtest: latest, foldRmses: result.outcomes.map((outcome) => outcome.rmse) } : null;
        };
        const medianPositive = (values) => {
          const sorted = (values || []).map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
          if (!sorted.length) return null;
          const middle = Math.floor(sorted.length / 2);
          return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
        };
        const fitReferenceEvidence = (referenceRowsForFit, transformParams, targetScalePanel) => {
          const ref = buildPanelFromColMap(source.headers, referenceRowsForFit, mmmColMap, effPlatformFilter, locale, null, { weekStart: mmmWeekStart });
          if (ref.missing.length) return { error: "mapping-mismatch", detail: ref.missing.join(", ") };
          const refPanel = trimToActive(ref.panel);
          if (!Object.prototype.hasOwnProperty.call(refPanel.targets, t)) return { error: "missing-target", detail: t };
          if (refPanel.week.length < 24) return { error: "insufficient-as-of-weeks", detail: `${refPanel.week.length}/24` };
          const refValidation = mmmValidate(refPanel, locale, t);
          if (refValidation.issues?.length) return { error: "validation-failed", detail: refValidation.issues.join(" | ") };
          const spendScaleFactors = {};
          for (const key of Object.keys(refPanel.ch || {})) {
            const transform = transformParams?.[key];
            if (!transform || !Object.prototype.hasOwnProperty.call(targetScalePanel.ch || {}, key)) {
              return { error: "transform-unit-mismatch", detail: key };
            }
            const sourceAdstockScale = medianPositive(mmmAdstock(refPanel.ch[key], transform.alpha));
            const targetAdstockScale = medianPositive(mmmAdstock(targetScalePanel.ch[key], transform.alpha));
            if (!(sourceAdstockScale > 0) || !(targetAdstockScale > 0)) return { error: "spend-scale-alignment-failed", detail: key };
            const factor = targetAdstockScale / sourceAdstockScale;
            if (!(factor > 0) || !Number.isFinite(factor)) return { error: "spend-scale-alignment-failed", detail: key };
            refPanel.ch[key] = refPanel.ch[key].map((value) => Number.isFinite(Number(value)) ? Number(value) * factor : NaN);
            spendScaleFactors[key] = factor;
          }
          const refRun = mmmBayesianRun(refPanel, { ...cfg, absorbed: new Set(cfg.absorbed || []) }, t, false, {
            ...countryPlan.fitOptions,
            channelParams: transformParams,
          });
          if (!refRun) return { error: "fit-failed", detail: "" };
          const rawPrior = {};
          Object.values(refRun?.saturationByChannel || {}).forEach((s) => {
            const spend = (refPanel.ch?.[s.key] || []).map(Number).filter(Number.isFinite);
            const nonzero = spend.filter((value) => Math.abs(value) > 1e-12).length;
            const minimumNonzero = MMM_METH_CONFIG.sparseMinWeeks || 20;
            const lower = spend.length ? Math.min(...spend) : 0;
            const upper = spend.length ? Math.max(...spend) : 0;
            const scale = spend.length ? spend.reduce((sum, value) => sum + Math.abs(value), 0) / spend.length : 0;
            // 0/blank 위주이거나 사실상 상수인 채널의 ridge β≈0을 전이 prior로
            // 만들면 타깃 효과를 근거 없이 0으로 당긴다.
            if (nonzero < minimumNonzero || !(upper - lower > Math.max(1e-8, scale * 1e-6))) return;
            const se = (s.ci?.[1] - s.ci?.[0]) / (2 * 1.645);
            if (isFinite(s.ln_coef) && isFinite(se) && se > 0) rawPrior[s.key] = {
              mean: s.ln_coef,
              precision: 1 / (se ** 2),
              variance: se ** 2,
              source: "country",
              referenceSpendScaleFactor: spendScaleFactors[s.key],
              referenceSpendScaleMethod: "positive-adstock-median-to-target",
              targetLockedTransform: transformParams[s.key] ? {
                alpha: transformParams[s.key].alpha,
                ec: transformParams[s.key].ec,
                slope: transformParams[s.key].slope,
              } : null,
            };
          });
          if (!Object.keys(rawPrior).length) return { error: "insufficient-channel-evidence", detail: "" };
          return { rawPrior, sourceTargetMean: meanFinite(refPanel.targets[t]), refPanel, spendScaleFactors };
        };
        const preliminary = [];
        (canAlignCountryTransforms ? countryPlan?.countries || [] : []).forEach(({ country, rows }) => {
          const holdIndividual = (reason, detail = "") => countryIndividualCandidates.push({ country, status: "held", reason, detail });
          const asOf = mmmCountryRowsAsOfFold(rows, {
            timeHeader: sourceTimeHeader,
            targetTimes: panel.weekLabel || panel.week,
            cut: validationScaleEnd,
          });
          if (!asOf.isStrictHistorical || asOf.unparseableRows > 0 || !asOf.rows.length) {
            return holdIndividual("historical-alignment-failed", asOf.reason || `${asOf.unparseableRows || 0} unparseable time row(s)`);
          }
          // 타깃이 Android/iOS/임의 세그먼트라면 참고국도 같은 grain으로 적합한다.
          // earliest cutoff 이후의 참고국 행은 후보 선택에 절대 사용하지 않는다.
          const validationEvidence = fitReferenceEvidence(asOf.rows, validationTransformParams, validationTargetPanel);
          if (validationEvidence.error) return holdIndividual(validationEvidence.error, validationEvidence.detail);
          const validationPrior = rescaleCountryPriorToTarget(validationEvidence.rawPrior, validationEvidence.sourceTargetMean, validationTargetMean);
          if (!validationPrior) return holdIndividual("target-scale-alignment-failed");
          const transfer = buildCountryTransferPrior([{ country, prior: validationPrior }], { requireTransformAlignment: true });
          const prior = transfer.prior;
          if (!Object.keys(prior).length) return holdIndividual("insufficient-channel-evidence");
          // 모든 참고국과 조합을 같은 반복 folds에서 비교해 단일 holdout 운은
          // 줄이지만, 이 folds는 shortlist와 최종 후보 선택에 재사용된다. 따라서
          // 아래 점수는 명시적인 tuning 근거이지 독립 최종 OOS가 아니다.
          const rolling = evaluatePrior(prior, 1);
          const referenceEvidence = {
            country,
            validationRawPrior: validationEvidence.rawPrior,
            validationSourceTargetMean: validationEvidence.sourceTargetMean,
            fullRows: rows,
            asOfCutoff: asOf.cutoff,
            excludedFutureRows: asOf.excludedFutureRows,
          };
          if (rolling) preliminary.push({ country, prior, referenceEvidence, members: [referenceEvidence], countryCount: 1, transfer, ...rolling });
          else holdIndividual("rolling-fit-failed");
        });
        preliminary.sort((a, b) => a.score - b.score);
        const candidatePriors = preliminary.slice(0, 4);
        candidatePriors.sort((a, b) => a.score - b.score);
        const top = candidatePriors;
        const scoreSet = (members) => {
          const evidenceMembers = members.map((member) => member.referenceEvidence);
          const validationMembers = evidenceMembers.map((member) => ({
            country: member.country,
            prior: rescaleCountryPriorToTarget(member.validationRawPrior, member.validationSourceTargetMean, validationTargetMean),
          }));
          const transfer = buildCountryTransferPrior(validationMembers, { maxCombinationSize: 3, requireTransformAlignment: true });
          const prior = transfer.prior;
          const rolling = evaluatePrior(prior, members.length);
          return rolling ? { country: transfer.countries.join(" + "), prior, transfer, members: evidenceMembers, countryCount: transfer.countryCount, complexity: transfer.countryCount, validationMode: countryValidationMode, ...rolling } : null;
        };
        const sets = buildCountryCombinations(top, { maxCombinationSize: 3 }).map(scoreSet).filter(Boolean);
        const baseline = evaluatePrior({}, 1);
        const selection = selectCountryPriorCandidate(baseline, sets, { maxCombinationSize: 3 });
        countryIndividualCandidates = [
          ...preliminary.map((candidate) => {
            const evaluated = selection.evaluated.find((item) => item.complexity === 1 && item.country === candidate.country);
            return {
              country: candidate.country,
              status: evaluated?.eligible ? "eligible" : "held",
              reason: evaluated?.eligible ? null : (evaluated?.ineligibleReasons || ["outside-combination-shortlist"]).join(" | "),
              folds: candidate.folds,
              meanRmse: candidate.meanRmse,
              sdRmse: candidate.sdRmse,
              score: candidate.score,
              relativeImprovement: evaluated?.relativeImprovement ?? (baseline?.meanRmse > 0 ? (baseline.meanRmse - candidate.meanRmse) / baseline.meanRmse : null),
              foldWinRate: evaluated?.foldWinRate ?? null,
              pairedImprovementLowerOneSe: evaluated?.pairedImprovementLowerOneSe ?? null,
            };
          }),
          ...countryIndividualCandidates,
        ];
        countryPlan = {
          ...countryPlan,
          validationReason: selection.reason,
          validationFolds: selection.baseline?.folds || 0,
          minimumValidationFolds: 2,
        };
        let selectedCountrySet = selection.selected;
        const baseCandidate = selection.baseline ? { country: tx("기본 MMM", "Base MMM"), prior: {}, isBaseline: true, ...selection.baseline } : null;
        const remaining = selection.evaluated.filter((candidate) => !selectedCountrySet || candidate.country !== selectedCountrySet.country || candidate.score !== selectedCountrySet.score).sort((a, b) => a.score - b.score);
        countryCandidates = selectedCountrySet
          ? [{ ...selectedCountrySet, isRecommended: true }, ...(baseCandidate ? [baseCandidate] : []), ...remaining]
          : [...(baseCandidate ? [baseCandidate] : []), ...remaining];
        if (baseline?.backtest && selectedCountrySet?.backtest) {
          countryBacktests = {
            labels: baseline.backtest.labels,
            actual: baseline.backtest.actual,
            variants: [
              { label: tx("기본 모델(국가 미적용)", "Base model (no market prior)"), predicted: baseline.backtest.predicted, color: "#94a3b8", dash: [2, 3] },
              ...candidatePriors.filter((candidate) => candidate.backtest).map((candidate) => ({ label: candidate.country, predicted: candidate.backtest.predicted })),
              { label: tx(`추천 세트: ${selectedCountrySet.country}`, `Recommended: ${selectedCountrySet.country}`), predicted: selectedCountrySet.backtest.predicted, color: "#2563eb", dash: [], recommended: true },
            ],
          };
        }
        if (selectedCountrySet) {
          // Validation stayed locked to the earliest training scale. Only after a
          // candidate is selected do we refit only those reference countries on
          // full history/full-target transforms. This final refit has no separate
          // independent OOS score and is labeled accordingly.
          const finalTargetMean = meanFinite(panel.targets[t]);
          const finalMembers = (selectedCountrySet.members || []).map((member) => {
            const finalAsOf = mmmCountryRowsAsOfFold(member.fullRows, {
              timeHeader: sourceTimeHeader,
              targetTimes: panel.weekLabel || panel.week,
              cut: panel.week.length,
            });
            if (!finalAsOf.isStrictHistorical || finalAsOf.unparseableRows > 0 || !finalAsOf.rows.length) {
              return { country: member.country, error: "final-reference-time-alignment-failed", detail: finalAsOf.reason };
            }
            const evidence = fitReferenceEvidence(finalAsOf.rows, finalTransformParams, panel);
            if (evidence.error) return { country: member.country, error: evidence.error, detail: evidence.detail };
            const prior = rescaleCountryPriorToTarget(evidence.rawPrior, evidence.sourceTargetMean, finalTargetMean);
            return prior ? { country: member.country, prior } : { country: member.country, error: "target-scale-alignment-failed" };
          });
          const failedFinalMembers = finalMembers.filter((member) => member.error);
          if (failedFinalMembers.length) {
            countryPlan = {
              ...countryPlan,
              finalRefitReason: "final-reference-refit-failed",
              finalRefitFailures: failedFinalMembers,
            };
            countryCandidates = [...(baseCandidate ? [{ ...baseCandidate, isBaseline: true }] : []), ...selection.evaluated.map((candidate) => ({ ...candidate, isRecommended: false, finalRefitFailed: true }))];
            countryBacktests = null;
            const failedByCountry = new Map(failedFinalMembers.map((member) => [member.country, member.error || "final-reference-refit-failed"]));
            countryIndividualCandidates = countryIndividualCandidates.map((candidate) => failedByCountry.has(candidate.country)
              ? { ...candidate, status: "held", reason: failedByCountry.get(candidate.country) }
              : candidate);
            selectedCountrySet = null;
          } else {
            const finalTransfer = buildCountryTransferPrior(finalMembers, { maxCombinationSize: 3, requireTransformAlignment: true });
            if (!Object.keys(finalTransfer.prior).length) {
              countryPlan = { ...countryPlan, finalRefitReason: "final-reference-refit-failed", finalRefitFailures: [{ country: finalTransfer.countries.join(" + "), error: "transform-unit-mismatch" }] };
              countryCandidates = [...(baseCandidate ? [{ ...baseCandidate, isBaseline: true }] : []), ...selection.evaluated.map((candidate) => ({ ...candidate, isRecommended: false, finalRefitFailed: true }))];
              countryBacktests = null;
              selectedCountrySet = null;
            } else {
              isCountryPriorTuned = true;
              Object.entries(finalTransfer.prior).forEach(([key, prior]) => mergeMediaPrior(mediaPriors, key, prior));
              countryPlan = { ...countryPlan, finalRefitReason: "selected-full-history-refit", finalRefitCountries: finalTransfer.countries };
            }
          }
        }
        }
      }
      // A selected country prior was tuned against the target rolling folds, so
      // the run's internal split would no longer be an untouched OOS estimate.
      const hasExternalPrior = Object.keys(mediaPriors).length > 0;
      const run = mmmBayesianRun(panel, cfg, t, !isCountryPriorTuned && !hasExternalPrior, { mediaPriors, enableBaselineSelection: true });
      if (!run) throw new Error("Bayesian posterior estimate failed");
      const health = mmmBayesianHealth(run);
      const effects = [];
      return mmmStoreCachedResult(csvData.raw, resultCacheKey, { empty: false, panel, cfg, derived, target: t, validate, run, health, effects, absorb, mediaPriors, experimentPriorDiagnostics, countryCandidates, countryIndividualCandidates, countryBacktests, countryValidationMode, countryPlan, isCountryPriorTuned });
    } catch (e) {
      // null-fit(특이행렬)은 대개 채널 공선성(예산이 함께 움직임)·기간 부족 → 정직한 도메인 메시지 (§8)
      const msg = String(e && e.message || "");
      if (/reading '?(beta|coef|params)'?|null|singular|is not a function/i.test(msg)) {
        return {
          empty: true,
          reason: tx(
            "회귀 추정 불가 — 채널 지출이 서로 강하게 연동(공선성)되어 있거나 유효 기간(주)이 부족합니다. 채널별로 독립적인 지출 변동이 있는 데이터가 필요합니다.",
            "Regression estimate not possible — channel spends are strongly linked (collinear), or the valid period (weeks) is too short. Data with independent spend variation per channel is needed.",
          ),
        };
      }
      return { empty: true, reason: tx("분석 오류: ", "Analysis error: ") + msg };
    }
  }, [hasData, csvData, target, mmmColMap, mmmAnalyzed, mmmAnalyzedSig, colMapSig, mmmWeekStart, effPlatformFilter, locale, tx, selectedEvidence, priorEvidence]);

  useEffect(() => {
    if (!mmmAnalyzed) return;
    const signature = `${mmmAnalyzedSig}|${target}|${effPlatformFilter}`;
    if (analysisEventRef.current === signature) return;
    analysisEventRef.current = signature;
    trackProductEvent("analysis_completed", {
      tool_id: "5-18",
      source: isDemo ? "demo" : "csv",
      row_count: csvData?.raw?.length || 0,
      analysis_type: "mmm",
      result_state: mmm?.empty ? "insufficient" : "ready",
    });
  }, [mmmAnalyzed, mmmAnalyzedSig, target, effPlatformFilter, mmm?.empty, isDemo, csvData?.raw?.length]);

  const decomp = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "mmm") return null;
    try {
      return mmmBayesianWeeklyDecomp(mmm.run);
    } catch (e) {
      return null;
    }
  }, [mmm, stage]);

  // 해당 기간의 실제 주별 지출을 모델 곡선에 대입한 채널별 평균 성과.
  // 전체 타깃을 채널마다 복제하지 않고, 채널별 예측 기여만 보여준다.
  const weeklyChannelPerformance = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "mmm") return [];
    return buildMmmWeeklyPerformance(mmm.panel, mmm.run.saturationByChannel);
  }, [mmm, stage]);

  // 미래예측은 MMM 기여 분석과 별도 적합한다. 전체 기간 MMM은 장기 기여 해석에
  // 남기고, 예측 회귀만 최근 window·계절성 후보를 rolling holdout으로 선택한다.
  const forecastModel = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "lab") return null;
    try {
      // Total은 별도 회귀를 금지한다. Android/iOS를 각각 적합하고 모든 예측값을 합산한다.
      if (effPlatformFilter === "all") {
        const mappedPlatforms = [
          ...mmmPlatformTags(csvData.headers, mmmColMap),
          ...(segmentSel?.values || []).map((value) => value.value),
        ].map((value) => String(value).trim().toLowerCase());
        if (!mappedPlatforms.includes("android") || !mappedPlatforms.includes("ios")) {
          return { isAdditiveTotal: true, components: [], reason: "Android와 iOS가 각각 매핑되어야 Total 합산 예측을 만들 수 있습니다." };
        }
        const components = ["android", "ios"].map((platform) =>
          buildOsForecastComponent(csvData.headers, csvData.raw, mmmColMap, platform, target, locale, mmmWeekStart),
        );
        if (components.some((component) => !component.run || !component.panel)) {
          return { isAdditiveTotal: true, components, reason: components.find((component) => !component.run || !component.panel)?.reason || "OS forecast model unavailable" };
        }
        return { isAdditiveTotal: true, components };
      }
      return buildForecastOnlyModel(mmm);
    } catch {
      return null;
    }
  }, [mmm, stage, effPlatformFilter, csvData, mmmColMap, target, locale, segmentSel, mmmWeekStart]);

  // 이 판정은 Stage ④ 예측 회귀에만 적용한다. MMM 기여 분해·이벤트/step(P0)와
  // 분리해, 기본 예측은 유지하고 식별되지 않은 Cost 변경 입력만 막는다.
  const forecastScenario = useMemo(() => {
    if (!forecastModel) return { eligible: false, reasons: ["missing-model"] };
    return mmmForecastScenarioEligibility(
      forecastModel.isAdditiveTotal ? forecastModel.components : [forecastModel],
    );
  }, [forecastModel]);

  const forecast = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "lab" || !forecastModel) return null;
    try {
      if (forecastModel.isAdditiveTotal) {
        const scenarioBudget = forecastScenario.eligible ? fcBudget : {};
        const components = forecastModel.components.map((model) => runForecastScenario(model, fcHorizon, scenarioBudget, fcStepOff));
        return mmmSumOsForecasts(components);
      }
      if (!forecastModel.run || !forecastModel.panel) return null;
      // fcBudget: 채널별 주 평균 예산(명시 채널만 H개로 채움) → 미입력은 mmmForecast가 최근평균 사용.
      const chans = _mmmChans(forecastModel.panel).filter((ch) => forecastModel.panel.ch[ch.key]);
      const futureSpend = {};
      const scenarioBudget = forecastScenario.eligible ? fcBudget : {};
      chans.forEach((ch) => {
        const b = scenarioBudget[ch.key];
        if (b != null && isFinite(b)) futureSpend[ch.key] = Array(fcHorizon).fill(b);
      });
      const hasBudget = Object.keys(futureSpend).length > 0;
      const futureSteps = {};
      Object.entries(fcStepOff).forEach(([key, keepWeeks]) => {
        const rawIndex = forecastModel.run.names.indexOf(key);
        if (rawIndex < 0 || !Number.isFinite(keepWeeks)) return;
        const lastValue = forecastModel.run.rawFeatureHistory?.at(-1)?.[rawIndex] || 0;
        futureSteps[key] = Array.from({ length: fcHorizon }, (_, index) => index < keepWeeks ? lastValue : 0);
      });
      const result = mmmBayesianForecast(
        forecastModel.run,
        forecastModel.panel,
        hasBudget ? futureSpend : null,
        fcHorizon,
        { futureSteps },
      );
      const restored = mmmForecastRestoreSeasonality(result, forecastModel.panel, forecastModel.seasonalModel);
      const excelModel = restored && buildForecastExcelModel(forecastModel, result, restored);
      return restored && { ...restored, rollingSelection: forecastModel.selection, modelWindow: forecastModel.panel.week.length, excelModels: excelModel ? [excelModel] : [] };
    } catch (e) {
      return null;
    }
  }, [mmm, stage, forecastModel, forecastScenario.eligible, fcHorizon, fcBudget, fcStepOff]);

  const recentBacktest = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "lab" || !forecastModel) return null;
    try {
      if (forecastModel.isAdditiveTotal) {
        const components = forecastModel.components.map((model) => buildForecastRecentBacktest(model));
        return mmmSumOsBacktests(components);
      }
      if (!forecastModel.run || !forecastModel.panel) return null;
      return buildForecastRecentBacktest(forecastModel);
    } catch {
      return null;
    }
  }, [mmm, stage, forecastModel]);

  const trend = useMemo(() => {
    if (!mmm || mmm.empty || !["trend", "diagnose"].includes(stage)) return null;
    try {
      return mmmTrendExistence(mmm.panel, mmm.cfg, mmm.target, locale);
    } catch (e) {
      return null;
    }
  }, [mmm, stage, locale]);

  // 채널별 카니발 + §4.5 랭킹/전역 종합 (index buildMmmMethCache byTarget 오케스트레이션 포트)
  const cannib = useMemo(() => {
    // 분석 패키지는 어느 단계에서 받아도 4검증을 모두 포함해야 한다. 화면은
    // diagnose 단계에서만 렌더하지만 결과 캐시는 분석 완료 뒤 유지한다.
    if (!mmm || mmm.empty) return null;
    try {
      const { panel, cfg, target: t } = mmm;
      const elas = mmmElasticities(panel, cfg, t, cfg.defaultLam);
      const chans = _mmmChans(panel).filter((c) => panel.ch[c.key]);
      const cannibByChannel = {};
      const cannChannels = [];
      const rows = chans.map((c) => {
        const e = elas.find((x) => x.var === "ln_" + c.key);
        const net = e
          ? { coef: e.coef, ci_lo: e.ci_lo, ci_hi: e.ci_hi, p: e.p }
          : { coef: 0, ci_lo: -1, ci_hi: 1, p: 1 };
        const cn = mmmCannibalization(panel, cfg, t, net, c.key, locale);
        cannibByChannel[c.key] = cn;
        cannChannels.push(c.key);
        return { channel: c, verdict: cn };
      });
      // 데이터 충분성(적격) 게이트 — index isIdentified: 집행주·지출변동CV·df (공선은 제외 안 함)
      const cov = mmmChannelCoverage(panel, cfg);
      const rcfg = mmmRankCfg();
      const isIdentified = (k) =>
        CANNIBAL_RANK.eligibility(panel.ch[k] || [], (cov[k] || { nonzero: 0 }).nonzero, rcfg)
          .eligible;
      const identifiedChannels = cannChannels.filter(isIdentified);
      const globalCannib = mmmGlobalCannib(cannibByChannel, identifiedChannels);
      const cannibRank = mmmBuildCannibRank(panel, t, cannibByChannel, cov, cannChannels);
      return { rows, cannibByChannel, cannChannels, cov, identifiedChannels, globalCannib, cannibRank };
    } catch (e) {
      return null;
    }
  }, [mmm, locale]);

  // ── §1 매크로 사실 + 자동 흡수(공선) + §2 naive-model audit (모델 독립) ──
  const diag = useMemo(() => {
    if (!mmm || mmm.empty || stage !== "diagnose") return null;
    try {
      const { panel, cfg } = mmm;
      // 주별 Date 배열 — weekLabel이 ISO(YYYY-MM-DD)면 그것을, 아니면 macro는 빈 객체.
      const dates = (panel.weekLabel || []).map((s) => {
        const t = new Date(String(s) + "T00:00:00Z").getTime();
        return isNaN(t) ? null : new Date(t);
      });
      const validDates = dates.every(Boolean) && dates.length === panel.week.length;
      const macro = validDates ? mmmMacroFacts(panel, cfg, dates, locale) : {};
      // 명시적으로 선택된 흡수만 cfg에 반영되며, 미선택 공선쌍은 노티스·예산 보류에 쓴다.
      const absorb = mmm.absorb || { absorbed: new Set(), notices: [] };
      // naive-model audit (RR 필요 — Regs+React 둘 다 있어야 의미). throw 가드.
      let audit = null;
      try {
        audit = mmmAudit(panel, cfg);
      } catch (e) {
        audit = null;
      }
      return { macro, absorb, audit, validDates };
    } catch (e) {
      return null;
    }
  }, [mmm, stage, locale]);

  // target 사용 가능 목록 (setState-in-effect 회피: 선택은 파생값으로 클램프, mmm.target이 실제 사용 타깃)
  const availTargets = mmm?.derived?.availableTargets
    || MMM_USER_TARGETS.filter((candidate) => Object.prototype.hasOwnProperty.call(mmm?.panel?.targets || {}, candidate));
  const isRevenueTarget = mmm?.target === "Revenue";
  const targetValueLabel = useCallback((value, { decimals = 0, sign = false, perWeek = false } = {}) => {
    if (!Number.isFinite(Number(value))) return "—";
    const displayValue = isRevenueTarget
      ? convertCurrency(Number(value), sourceCurrency, displayCurrency)
      : Number(value);
    const prefix = displayValue < 0 ? "-" : sign && displayValue > 0 ? "+" : "";
    const number = Math.abs(displayValue).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    if (isRevenueTarget) return `${prefix}${currencySym}${number}${perWeek ? tx("/주", "/wk") : ""}`;
    return `${prefix}${number}${perWeek ? tx("명/주", "/wk") : tx("명", "")}`;
  }, [isRevenueTarget, sourceCurrency, displayCurrency, currencySym, tx]);
  const spendValueLabel = useCallback((value, { perWeek = false } = {}) => {
    if (!Number.isFinite(Number(value))) return "—";
    const displayValue = convertCurrency(Number(value), sourceCurrency, displayCurrency);
    return `${currencySym}${Math.round(displayValue).toLocaleString()}${perWeek ? tx("/주", "/wk") : ""}`;
  }, [sourceCurrency, displayCurrency, currencySym, tx]);

  const cannibChannels = cannib ? cannib.rows.map((r) => r.channel.key) : [];
  const activeCannibCh =
    cannibChannel && cannibChannels.includes(cannibChannel)
      ? cannibChannel
      : cannibChannels[0] || null;
  // 활성 채널의 카니발 검정 결과(§4 상세용)
  const activeCn =
    cannib && activeCannibCh ? cannib.cannibByChannel[activeCannibCh] : null;

  /* ------------------------------ CHARTS ------------------------------ */
  // Stage ② charts: CV, RMS contribution share, saturation, fit, decomp
  useEffect(() => {
    const inst = [];
    if (stage === "mmm" && mmm && !mmm.empty) {
      const run = mmm.run;
      // Bayesian engine selects a carryover parameter per channel; the legacy
      // single-λ CV chart is only meaningful for the old point-estimate engine.
      if (cvRef.current && run.cv_rmse && Object.keys(run.cv_rmse).length) {
        const grid = mmm.cfg.adstockGrid.filter((l) => run.cv_rmse[l] != null);
        inst.push(
          new Chart(cvRef.current.getContext("2d"), {
            type: "line",
            data: {
              labels: grid.map((l) => l.toFixed(1)),
              datasets: [
                {
                  label: "OOS RMSE",
                  data: grid.map((l) => run.cv_rmse[l]),
                  borderColor: "#7aa2f7",
                  pointBackgroundColor: grid.map((l) => (l === run.best_lambda ? NEG : "#7aa2f7")),
                  pointRadius: grid.map((l) => (l === run.best_lambda ? 6 : 3)),
                  tension: 0.2,
                },
              ],
            },
            options: chartBase(),
          }),
        );
      }
      // RMS contribution-magnitude share (horizontal bar). The engine keeps the
      // legacy `shapley` key for compatibility, but this is not Shapley/R² allocation.
      if (shapleyRef.current && run.shapley?.rows?.length) {
        const sourceRows = includeBaseDemandInShare
          ? run.shapley.rows
          : run.shapley.rows.filter((row) => !["Trend", "기본 수요", "baseline"].includes(row.driver));
        const total = sourceRows.reduce((sum, row) => sum + (row.r2_share || 0), 0);
        const rows = sourceRows
          .map((row) => ({ ...row, r2_share: total > 0 ? row.r2_share / total : 0, pct: total > 0 ? row.r2_share / total * 100 : 0 }))
          .sort((a, b) => b.r2_share - a.r2_share);
        inst.push(
          new Chart(shapleyRef.current.getContext("2d"), {
            type: "bar",
            data: {
              labels: rows.map((r) => r.driver),
              datasets: [
                {
                  label: tx("RMS 기여 크기 비중", "RMS contribution-magnitude share"),
                  data: rows.map((r) => +r.r2_share.toFixed(4)),
                  backgroundColor: "#7aa2f7",
                  borderRadius: 3,
                },
              ],
            },
            options: {
              ...chartBase(),
              indexAxis: "y",
              plugins: {
                ...chartBase().plugins,
                tooltip: {
                  callbacks: { label: (c) => `${(rows[c.dataIndex]?.pct || 0).toFixed(1)}%` },
                },
              },
            },
          }),
        );
      }
      // 반응 곡선 (per channel, y = 비음수 절대 기여 = 그 지출에서의 예상 기여).
      // 기존 한계응답(ln_coef/(1+x)) 곡선은 x→0에서 발산(1,000,000)해 판독 불가(§유저) →
      // 누적 반응 곡선으로 교체(단조·발산 없음, 평평해질수록 수확체감). 현재 지출 위치 점으로 표시.
      if (satRef.current && run.saturationByChannel) {
        const themeVarS = (n) => (typeof document !== "undefined" ? getComputedStyle(document.body).getPropertyValue(n).trim() : "") || "";
        const mutedColS = themeVarS("--text-muted") || CHART_THEME.muted;
        const textColS = themeVarS("--text-1") || CHART_THEME.text;
        const chs = Object.entries(run.saturationByChannel);
        if (chs.length) {
          const maxSpend = Math.max(...chs.map(([, s]) => s.recentMean || 0)) * 1.6 || 40000;
          const grid = Array.from({ length: 41 }, (_, i) => (i / 40) * maxSpend);
          const respAt = (s, x) => s.responseAt(x);
          // 현재 지출 위치(●)는 각 채널 선 위 데이터점으로 → 선을 숨기면 점도 같이 숨겨짐(별도 scatter 제거).
          const lineDs = chs.map(([key, s], i) => {
            const col = MMM_MEDIA_PALETTE[i % MMM_MEDIA_PALETTE.length];
            let curIdx = -1;
            if (s.recentMean > 0) {
              let best = Infinity;
              grid.forEach((x, gi) => { const d = Math.abs(x - s.recentMean); if (d < best) { best = d; curIdx = gi; } });
            }
            return {
              type: "line",
              label: s.label,
              data: grid.map((x) => ({ x, y: respAt(s, x) })),
              borderColor: col,
              borderDash: s.posteriorPositive < 0.8 ? [5, 4] : [],
              borderWidth: 1.75,
              tension: 0.3,
              pointRadius: grid.map((_, gi) => (gi === curIdx ? 4.5 : 0)),
              pointBackgroundColor: col,
              pointBorderColor: textColS,
              pointBorderWidth: 1.5,
              hidden: !!satHidden[key],
            };
          });
          const satOpts = chartBase();
          satOpts.plugins.legend = { display: false }; // 커스텀 HTML 범례(채널 토글) 사용
          satOpts.plugins.tooltip = { ...satOpts.plugins.tooltip, callbacks: { label: (c) => `${c.dataset.label}: ${targetValueLabel(c.parsed.y, { decimals: 1 })} @ ${currencySym}${fmtOne(convAmt(c.parsed.x))}` } };
          satOpts.scales.x = { type: "linear", ticks: { color: mutedColS, font: { size: 10 }, callback: (v) => currencySym + fmtOne(convAmt(v)) }, grid: { display: false } };
          satOpts.scales.y = { ticks: { color: mutedColS, font: { size: 10 }, callback: (v) => targetValueLabel(v, { decimals: 1 }) }, grid: { color: CHART_THEME.grid } };
          inst.push(
            new Chart(satRef.current.getContext("2d"), {
              data: { datasets: lineDs },
              options: satOpts,
            }),
          );
        }
      }
      // 목표가 전환이면 CPA, 매출이면 ROAS. 수확체감 반응곡선을 비용 효율 언어로
      // 다시 읽어 예산을 늘릴수록 왜 CPR이 오르고 ROAS가 내려가는지 보여준다.
      if (efficiencyRef.current && run.saturationByChannel) {
        const themeVarE = (n) => (typeof document !== "undefined" ? getComputedStyle(document.body).getPropertyValue(n).trim() : "") || "";
        const mutedColE = themeVarE("--text-muted") || CHART_THEME.muted;
        const chs = Object.entries(run.saturationByChannel);
        if (chs.length) {
          const isRoas = mmm.target === "Revenue";
          const maxSpend = Math.max(...chs.map(([, s]) => s.recentMean || 0)) * 1.6 || 40000;
          const grid = Array.from({ length: 41 }, (_, i) => (i / 40) * maxSpend);
          const metricAt = (s, spend) => {
            const result = s.responseAt(spend);
            if (!(spend > 0) || !(result > 0)) return null;
            return isRoas ? result / spend : convAmt(spend / result);
          };
          const datasets = chs.map(([key, s], i) => {
            const col = MMM_MEDIA_PALETTE[i % MMM_MEDIA_PALETTE.length];
            let curIdx = -1;
            if (s.recentMean > 0) {
              let best = Infinity;
              grid.forEach((x, gi) => { const d = Math.abs(x - s.recentMean); if (d < best) { best = d; curIdx = gi; } });
            }
            return {
              type: "line",
              label: s.label,
              data: grid.map((x) => ({ x, y: metricAt(s, x) })),
              borderColor: col,
              borderDash: s.posteriorPositive < 0.8 ? [5, 4] : [],
              borderWidth: 1.75,
              tension: 0.3,
              pointRadius: grid.map((_, gi) => (gi === curIdx ? 4.5 : 0)),
              pointBackgroundColor: col,
              pointBorderColor: mutedColE,
              pointBorderWidth: 1.5,
              hidden: !!satHidden[key],
              spanGaps: false,
            };
          });
          const opts = chartBase();
          opts.plugins.legend = { display: false };
          opts.plugins.tooltip = { ...opts.plugins.tooltip, callbacks: { label: (c) => `${c.dataset.label}: ${isRoas ? "" : currencySym}${fmtOne(c.parsed.y)}${isRoas ? "x" : ""}` } };
          opts.scales.x = { type: "linear", ticks: { color: mutedColE, font: { size: 10 }, callback: (v) => currencySym + fmtOne(convAmt(v)) }, grid: { display: false } };
          opts.scales.y = { ticks: { color: mutedColE, font: { size: 10 }, callback: (v) => `${isRoas ? "" : currencySym}${fmtOne(v)}${isRoas ? "x" : ""}` }, grid: { color: CHART_THEME.grid } };
          inst.push(new Chart(efficiencyRef.current.getContext("2d"), { data: { datasets }, options: opts }));
        }
      }
      // "baseline" 필드는 회귀절편(전체 기간 평균) 단일 상수라 원래 평평함 — 시즌·추세는 그 위에
      // 별도 contrib로 얹힘. 그래서 이 필드만 그리면 "왜 안 움직이나" 혼란(§ 실사용 피드백) →
      // 두 차트 모두 baseline+비매체(시즌·추세·휴일·구조변화) 합산 시계열을 같이 씀.
      const nonMediaGroupsAll = decomp ? decomp.groupNames.filter((g) => MMM_NONMEDIA_GROUPS.includes(g)) : [];
      const nonMediaSeries = decomp
        ? decomp.weeks.map((w) => w.baseline + nonMediaGroupsAll.reduce((s, g) => s + (w.contrib[g] || 0), 0))
        : [];
      // Fit chart (actual vs fitted vs 시즌·추세 등)
      if (fitRef.current && decomp) {
        const labels = decomp.weeks.map((w, i) => mmm.panel.weekLabel?.[i] || w.week);
        inst.push(
          new Chart(fitRef.current.getContext("2d"), {
            type: "line",
            data: {
              labels,
              datasets: [
                { label: tx("실제", "Actual"), data: decomp.weeks.map((w) => w.actual), borderColor: CHART_THEME.muted, pointRadius: 0, tension: 0.2 },
                { label: tx("모델", "Model"), data: decomp.weeks.map((w) => w.fitted), borderColor: "#7aa2f7", pointRadius: 0, tension: 0.2 },
                { label: tx("시즌·추세 등(비매체)", "Season/trend etc. (non-media)"), data: nonMediaSeries, borderColor: "#e0af68", borderDash: [5, 4], pointRadius: 0, tension: 0.2 },
              ],
            },
            options: (() => {
              const options = chartBase();
              options.plugins.tooltip = { ...options.plugins.tooltip, callbacks: { label: (context) => `${context.dataset.label}: ${targetValueLabel(context.parsed.y, { decimals: 1 })}` } };
              options.scales.y.ticks.callback = (value) => targetValueLabel(value, { decimals: 0 });
              return options;
            })(),
          }),
        );
      }
      // Decomp stacked area — 기준선(기본 수요) 위에 버킷/채널을 누적. 맨 위 누적선 = 모델(fitted).
      // 그룹모드: 4버킷(기본·시즌추세·이벤트·광고). 개별모드: 비매체 버킷 + 광고를 채널별로 각각 누적.
      // 어느 모드든 모든 밴드를 기준선 위로 쌓아 최상단이 모델선과 일치(=아래 텍스트의 "모델"과 sum 일치).
      if (decompRef.current && decomp) {
        const labels = decomp.weeks.map((w, i) => mmm.panel.weekLabel?.[i] || w.week);
        // 테마 토큰은 body.light-mode에 재정의됨 → documentElement가 아니라 body에서 읽어야 라이트 반영.
        const themeVar = (n) => (typeof document !== "undefined" ? getComputedStyle(document.body).getPropertyValue(n).trim() : "") || "";
        const textCol = themeVar("--text-1") || CHART_THEME.text;
        const mutedCol = themeVar("--text-muted") || CHART_THEME.muted;
        // 버킷별 주간 합 시계열
        const bucketSeries = (bucket) =>
          decomp.weeks.map((w) =>
            decomp.groupNames.reduce((s, g) => (decompBucketOf(g) === bucket ? s + (w.contrib[g] || 0) : s), 0),
          );
        // area+누적선 방식은 밴드가 음수일 때 선이 역행해 다른 밴드를 침범(§유저 피드백: "쭉 꺼지는 게 카니발?").
        // stacked bar로 전환 — Chart.js는 양/음수를 0선 기준 위/아래로 각자 독립 누적해 절대 안 꼬임.
        // 기본 수요 = baseline(상수) + 계절(Seasonality) 흡수.
        const bars = [];
        bars.push({ label: bucketMeta.base.label, data: decomp.weeks.map((w, t) => w.baseline + bucketSeries("base")[t]), tone: bucketMeta.base.tone });
        bars.push({ label: bucketMeta.trend.label, data: bucketSeries("trend"), tone: bucketMeta.trend.tone });
        bars.push({ label: bucketMeta.event.label, data: bucketSeries("event"), tone: bucketMeta.event.tone });
        const industrySeries = bucketSeries("industry");
        if (industrySeries.some((value) => Math.abs(value) > 1e-8)) bars.push({ label: bucketMeta.industry.label, data: industrySeries, tone: bucketMeta.industry.tone });
        if (decompGrouped) {
          bars.push({ label: bucketMeta.media.label, data: bucketSeries("media"), tone: bucketMeta.media.tone });
        } else {
          const mediaGroups = decomp.groupNames.filter((g) => decompBucketOf(g) === "media");
          mediaGroups.forEach((g, i) => {
            bars.push({ label: g, data: decomp.weeks.map((w) => w.contrib[g] || 0), tone: MMM_MEDIA_PALETTE[i % MMM_MEDIA_PALETTE.length] });
          });
        }
        const datasets = bars.map((b) => ({
          type: "bar",
          label: b.label,
          data: b.data,
          backgroundColor: b.tone,
          stack: "decomp",
          borderRadius: 2,
          order: 2,
        }));
        // 실제(점선 오버레이) — 막대 스택 합과 얼마나 가까운지 눈으로 확인.
        datasets.push({
          type: "line",
          label: tx("실제", "Actual"),
          data: decomp.weeks.map((w) => w.actual),
          borderColor: textCol,
          backgroundColor: "transparent",
          borderDash: [4, 3],
          fill: false,
          pointRadius: 0,
          borderWidth: 1.5,
          order: 0,
        });
        const decompOpts = chartBase();
        decompOpts.plugins.legend = {
          position: "bottom",
          labels: { color: textCol, font: { size: 11 }, boxWidth: 12, boxHeight: 12, padding: 10, usePointStyle: true },
        };
        decompOpts.plugins.tooltip = {
          ...decompOpts.plugins.tooltip,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${targetValueLabel(ctx.parsed.y, { sign: true })}`,
          },
        };
        decompOpts.scales.x = { ...decompOpts.scales.x, stacked: true, ticks: { ...decompOpts.scales.x.ticks, color: mutedCol, autoSkip: true, maxTicksLimit: 12, maxRotation: 0 } };
        decompOpts.scales.y = { ...decompOpts.scales.y, stacked: true, ticks: { ...decompOpts.scales.y.ticks, color: mutedCol, callback: (v) => targetValueLabel(v) } };
        // 메모 남긴 튀는 주 → 세로 점선 + 번호 뱃지(글씨 겹침 방지, 실제 메모는 아래 표에 동일 번호로).
        const notedSpikes = (decomp.spikes || []).filter((s) => (spikeNotes[`${mmm.target}|${s.week}`] || "").trim());
        const numOf = (s) => notedSpikes.findIndex((n) => n.week === s.week) + 1;
        const spikeLinePlugin = {
          id: "spikeLines",
          afterDraw(chart) {
            if (!notedSpikes.length) return;
            const { ctx, chartArea, scales } = chart;
            ctx.save();
            notedSpikes.forEach((s) => {
              const idx = s.i != null ? s.i : s.week - 1;
              const x = scales.x.getPixelForValue(idx);
              if (x < chartArea.left || x > chartArea.right) return;
              ctx.strokeStyle = "#f59e0b";
              ctx.setLineDash([4, 3]);
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(x, chartArea.top + 12);
              ctx.lineTo(x, chartArea.bottom);
              ctx.stroke();
              ctx.setLineDash([]);
              // 번호 뱃지(원)
              ctx.fillStyle = "#f59e0b";
              ctx.beginPath();
              ctx.arc(x, chartArea.top + 7, 8, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#fff";
              ctx.font = "bold 10px sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(String(numOf(s)), x, chartArea.top + 7);
            });
            ctx.restore();
          },
        };
        inst.push(
          new Chart(decompRef.current.getContext("2d"), {
            data: { labels, datasets },
            options: decompOpts,
            plugins: [spikeLinePlugin],
          }),
        );
      }
    }
    return () => inst.forEach((c) => c && c.destroy());
    // convAmt는 sourceCurrency/displayCurrency로만 결정되는 순수 파생 함수라 그
    // 둘을 deps에 넣는 것으로 충분(함수 레퍼런스 자체는 deps에 안 넣음, §매 렌더 재생성).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, mmm, decomp, spikeNotes, decompGrouped, includeBaseDemandInShare, satHidden, currencySym, sourceCurrency, displayCurrency, tx]);

  // Stage ③ forecast chart
  useEffect(() => {
    const inst = [];
    if (stage === "lab" && forecast && forecastRef.current) {
      const fc = forecast;
      const nHist = fc.splitAt;
      const labels = fc.labels;
      // actual: hist만; model: hist fitted + future pred (n-1 지점 연결)
      const actual = [...fc.actual, ...Array(fc.horizon).fill(null)];
      const model = [
        ...fc.fittedHist,
        ...Array(fc.horizon).fill(null),
      ];
      const future = [
        ...Array(nHist - 1).fill(null),
        fc.fittedHist[nHist - 1],
        ...fc.predFut,
      ];
      const bandLo = [...Array(nHist).fill(null), ...fc.lo];
      const bandHi = [...Array(nHist).fill(null), ...fc.hi];
      inst.push(
        new Chart(forecastRef.current.getContext("2d"), {
          type: "line",
          data: {
            labels,
            datasets: [
              { label: tx("실제", "Actual"), data: actual, borderColor: CHART_THEME.muted, pointRadius: 0, tension: 0.2 },
              { label: tx("모델(과거)", "Model (past)"), data: model, borderColor: "#7aa2f7", pointRadius: 0, tension: 0.2 },
              { label: tx("예측(미래)", "Forecast (future)"), data: future, borderColor: "#7aa2f7", borderDash: [6, 4], pointRadius: 0, tension: 0.2 },
              { label: tx("상한", "Upper bound"), data: bandHi, borderColor: "transparent", backgroundColor: "rgba(122,162,247,0.12)", fill: "+1", pointRadius: 0 },
              { label: tx("하한", "Lower bound"), data: bandLo, borderColor: "transparent", backgroundColor: "rgba(122,162,247,0.12)", fill: false, pointRadius: 0 },
            ],
          },
          options: {
            ...chartBase(),
            plugins: {
              ...chartBase().plugins,
              tooltip: {
                ...chartBase().plugins.tooltip,
                callbacks: { label: (context) => `${context.dataset.label}: ${targetValueLabel(context.parsed.y)}` },
              },
            },
            scales: {
              ...chartBase().scales,
              y: {
                ...chartBase().scales.y,
                ticks: { ...chartBase().scales.y.ticks, callback: (value) => targetValueLabel(value) },
              },
            },
          },
        }),
      );
    }
    return () => inst.forEach((c) => c && c.destroy());
  }, [stage, forecast, tx, targetValueLabel]);

  // Stage ① trend chart (STL trend + actual)
  useEffect(() => {
    const inst = [];
    if (["trend", "diagnose"].includes(stage) && trend && trendRef.current && mmm && !mmm.empty) {
      const y = mmm.panel.targets[mmm.target];
      const labels = mmm.panel.weekLabel || y.map((_, i) => i + 1);
      inst.push(
        new Chart(trendRef.current.getContext("2d"), {
          type: "line",
          data: {
            labels,
            datasets: [
              { label: tx("실제", "Actual"), data: y, borderColor: CHART_THEME.muted, pointRadius: 0, tension: 0.15 },
              { label: tx("STL 추세", "STL trend"), data: trend.stl?.trend || [], borderColor: "#7aa2f7", pointRadius: 0, borderWidth: 2 },
            ],
          },
          options: {
            ...chartBase(),
            plugins: {
              ...chartBase().plugins,
              tooltip: {
                ...chartBase().plugins.tooltip,
                callbacks: { label: (context) => `${context.dataset.label}: ${targetValueLabel(context.parsed.y)}` },
              },
            },
            scales: {
              ...chartBase().scales,
              y: {
                ...chartBase().scales.y,
                ticks: { ...chartBase().scales.y.ticks, callback: (value) => targetValueLabel(value) },
              },
            },
          },
        }),
      );
    }
    return () => inst.forEach((c) => c && c.destroy());
  }, [stage, trend, mmm, tx, targetValueLabel]);

  // Stage ① 카니발 4검증 — 선택한 질문 하나의 근거 차트만 렌더.
  useEffect(() => {
    const inst = [];
    if (
      stage === "diagnose" &&
      mmm &&
      !mmm.empty &&
      irfRef.current &&
      cannib &&
      activeCannibCh
    ) {
      try {
        const y = mmm.panel.targets[mmm.target] || [];
        const spend = mmm.panel.ch[activeCannibCh] || [];
        const labels = mmm.panel.weekLabel || y.map((_, i) => i + 1);
        const cn = activeCn;
        if (cannibQuestion === "precedence") {
          const p25 = cn?.precedence?.p25 ?? 0;
          inst.push(
            new Chart(irfRef.current.getContext("2d"), {
              type: "line",
              data: {
                labels,
                datasets: [
                  {
                    label: tx("성과", "Outcome"), data: y, borderColor: "#7aa2f7", pointRadius: spend.map((v) => v <= p25 ? 3 : 0), pointBackgroundColor: "#f59e0b", tension: 0.2,
                  },
                  {
                    label: tx("지출", "Spend"), data: spend, borderColor: "#94a3b8", borderDash: [5, 4], pointRadius: 0, tension: 0.2, yAxisID: "spend",
                  },
                ],
              },
              options: {
                ...chartBase(),
                plugins: {
                  ...chartBase().plugins,
                  tooltip: {
                    ...chartBase().plugins.tooltip,
                    callbacks: { label: (context) => `${context.dataset.label}: ${context.dataset.yAxisID === "spend" ? spendValueLabel(context.parsed.y) : targetValueLabel(context.parsed.y)}` },
                  },
                },
                scales: {
                  ...chartBase().scales,
                  y: { ...chartBase().scales.y, ticks: { ...chartBase().scales.y.ticks, callback: (value) => targetValueLabel(value) } },
                  spend: { position: "right", ticks: { color: CHART_THEME.muted, callback: (value) => spendValueLabel(value) }, grid: { drawOnChartArea: false } },
                },
              },
            }),
          );
        } else if (cannibQuestion === "detrend") {
          const residual = (a) => {
            const n = a.length, xm = (n - 1) / 2, ym = a.reduce((s, v) => s + v, 0) / Math.max(1, n);
            let num = 0, den = 0;
            a.forEach((v, i) => { num += (i - xm) * (v - ym); den += (i - xm) ** 2; });
            const slope = den ? num / den : 0;
            return a.map((v, i) => v - (ym + slope * (i - xm)));
          };
          const logSpend = spend.map((v) => Math.log1p(v));
          const rs = residual(logSpend), ry = residual(y);
          const ds = logSpend.slice(1).map((v, i) => v - logSpend[i]);
          const dy = y.slice(1).map((v, i) => v - y[i]);
          inst.push(new Chart(irfRef.current.getContext("2d"), {
            type: "scatter",
            data: { datasets: [
              { label: tx("추세 제거 후", "Detrended"), data: rs.map((x, i) => ({ x, y: ry[i] })), backgroundColor: "#7aa2f7", pointRadius: 3 },
              { label: tx("전주 대비 변화", "Weekly change"), data: ds.map((x, i) => ({ x, y: dy[i] })), backgroundColor: "#e0af68", pointRadius: 3 },
            ] },
            options: {
              ...chartBase(),
              plugins: { ...chartBase().plugins, tooltip: { ...chartBase().plugins.tooltip, callbacks: { label: (context) => `${context.dataset.label}: ${targetValueLabel(context.parsed.y)}` } } },
              scales: { x: { type: "linear", ticks: { color: CHART_THEME.muted }, grid: { color: CHART_THEME.grid } }, y: { ticks: { color: CHART_THEME.muted, callback: (value) => targetValueLabel(value) }, grid: { color: CHART_THEME.grid } } },
            },
          }));
        } else if (cannibQuestion === "net") {
          // JSX NetEffectEvidence가 0 기준·신뢰구간·판정을 더 명확하게 표시한다.
        } else {
          const irf = mmmIRF(y, spend, { horizon: 12 });
          if (irf) inst.push(new Chart(irfRef.current.getContext("2d"), {
            type: "line", data: { labels: irf.irf.map((_, i) => (i === 0 ? tx("충격", "Shock") : tx(`+${i}주`, `+${i}wk`))), datasets: [
              { label: tx("주별 반응", "Weekly response"), data: irf.irf, borderColor: "#7aa2f7", pointRadius: 0, tension: 0.25 },
              { label: tx("누적 반응", "Cumulative response"), data: irf.cum, borderColor: "#e0af68", borderDash: [5, 4], pointRadius: 0, tension: 0.2 },
            ] }, options: {
              ...chartBase(),
              plugins: { ...chartBase().plugins, tooltip: { ...chartBase().plugins.tooltip, callbacks: { label: (context) => `${context.dataset.label}: ${targetValueLabel(context.parsed.y)}` } } },
              scales: { ...chartBase().scales, y: { ...chartBase().scales.y, ticks: { ...chartBase().scales.y.ticks, callback: (value) => targetValueLabel(value) } } },
            },
          }));
        }
      } catch (e) {
        /* 데이터 부족 시 근거 차트 생략 */
      }
    }
    return () => inst.forEach((c) => c && c.destroy());
  }, [stage, mmm, cannib, activeCannibCh, activeCn, cannibQuestion, tx, targetValueLabel, spendValueLabel]);

  // Stage ① simple-cannib chart 없음 (통계 카드만) — 잔차 산점도는 디퍼

  // Lab chart (actual vs predicted)
  // ③ LAB(회귀·미래예측)은 mmmForecast(위 forecast useMemo) 기반으로 렌더 — ②와 같은 MMM 모델 계수를
  // 그대로 써서 과거 적합 + 미래 외삽. buildPanelFromColMap이 타깃을 플랫폼 합산하므로 토글도 자동 반영.

  /* ------------------------------ RENDER ------------------------------ */
  // 아코디언 안 차트는 접힘 상태에서 폭 0으로 마운트됨(§7 함정) → 펼칠 때 resize 이벤트로 재측정.
  const onAccordionToggle = (e) => {
    if (e.currentTarget.open) requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };

  // index.html MMM_STAGE_DEFS(3단계) + renderMmmStageTabs 카드형 탭 이식. 구 "시뮬레이션"(TF)은
  // §12.15대로 회귀·미래예측(lab)에 흡수. 카드: no·아이콘·제목·설명 + active 하이라이트.
  const renderTabs = () => (
    <section className="block" style={{ padding: 0, border: "none", background: "none", marginBottom: "20px" }}>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {mmmStageDefs(locale).map((d) => {
          const on = stage === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setStage(d.id)}
              style={{
                flex: 1, minWidth: "170px", textAlign: "left", color: "var(--text-1)",
                background: on ? "linear-gradient(135deg,rgba(122,162,247,0.16),rgba(122,162,247,0.04))" : "var(--bg-2)",
                border: `1px solid ${on ? "rgba(122,162,247,0.55)" : "var(--border)"}`,
                borderRadius: "12px", padding: "11px 14px", cursor: "pointer", transition: "all .15s",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".04em", color: on ? "#adc6ff" : "var(--text-2)" }}>{d.no}</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)", marginTop: "1px" }}>{d.icon} {d.title}</div>
              <div style={{ fontSize: "10.5px", color: "var(--text-2)", marginTop: "2px", lineHeight: 1.35 }}>{d.desc}</div>
            </button>
          );
        })}
      </div>
    </section>
  );

  // 5-18 전용 템플릿 — colMap 방식이라 표준필드 경로(효율 template)와 무관, 자체 헤더+예시.
  const downloadMmmTemplate = () => {
    const blob = new Blob([MMM_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "template_5-18.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // 5-18 전용 dropzone (표준 CsvUploader/DataFeatureMatrix 미사용 — 단일 generic CSV → colMap).
  const mmmDropzone = (
    <>
      <CsvGuide toolId="5-18" onDownloadTemplate={downloadMmmTemplate} locale={locale} />
      <MmmManualDownload locale={locale} placement="upload" />
      <div
        className="csv-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleMmmFile(e.dataTransfer.files[0]); }}
        onClick={() => mmmFileRef.current?.click()}
        style={{ cursor: "pointer" }}
      >
        <div className="csv-drop-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <div className="csv-drop-text">{tx("CSV 파일 드래그 & 드롭", "Drag & drop a CSV file")}</div>
        <div className="csv-drop-sub">{tx("일별 또는 주별 패널 CSV. 일별은 자동으로 주간 집계됩니다. 날짜/주차 · 총유입/가입/재유입/구매자/매출 중 1개 이상 · 채널 spend 1개 이상이 필요합니다. 국가 prior를 쓰려면 모든 행에 같은 COUNTRY 값을 넣으세요.", "Daily or weekly panel CSV. Daily rows are aggregated to weeks automatically. Requires date/week · at least one of traffic/registrations/reactivations/purchasers/revenue · at least one channel spend. To use market priors, put the same COUNTRY value on every row.")}</div>
        <input type="file" accept=".csv,text/csv" style={{ display: "none" }} ref={mmmFileRef}
          onChange={(e) => { if (e.target.files?.[0]) handleMmmFile(e.target.files[0]); e.target.value = null; }} />
      </div>
      <DemoLoadButton onLoad={handleLoadDemo} locale={locale} />
    </>
  );

  // colMap 매퍼 + 분석 게이트 섹션 (CSV 로드 후 · 분석 전). index.html §0 데이터·매핑 이식.
  const mmmMapperSection = () => {
    // 매핑 중에는 헤더 역할만 확인한다. 전체 일→주 집계는 `분석하기` 뒤 mmm
    // useMemo에서 한 번만 수행해 대용량 CSV 드래그가 매 렌더마다 멈추지 않게 한다.
    const missing = mmmColMap ? colMapMissing(csvData.headers, mmmColMap, locale) : [tx("매핑", "mapping")];
    // 지출 단위를 모르는데 분석을 허용하면 숫자가 다른 통화로 오해될 수 있다. 원본
    // 통화는 매핑 단계에서 한 번만 선택하고, 선택 후 표시 통화 토글로 환산한다.
    const currencyMissing = !isDemo && !selectedSourceCurrency;
    const mappingReady = !!mmmColMap && missing.length === 0;
    const canAnalyze = mappingReady && !currencyMissing;
    return (
      <section className="block" id="s-prep">
        <div className="file-state">
          <div className="meta-text">
            <span className="dot" style={{ background: isDemo ? "#f59e0b" : "#22c55e" }}></span>
            {isDemo ? <strong>{tx("샘플 데이터로 미리보기 중", "Previewing with sample data")}</strong> : <strong>{csvData.fileName}</strong>}
            <span className="csv-loaded-stats tnum">{csvData.raw.length.toLocaleString()}{tx("행", " rows")} · {csvData.headers.length}{tx("컬럼", " columns")}{isDemo ? tx(" · 실제 데이터 아님", " · not real data") : ""}</span>
          </div>
          <button className="ab-pill csv-change-btn" title={tx("CSV 제거 후 다른 파일 업로드", "Remove this CSV and upload another file")}
            onClick={() => setCsvData({ raw: [], headers: [], mapping: {}, fileName: "" })}>{isDemo ? tx("📁 내 CSV 업로드", "📁 Upload my CSV") : tx("⟳ CSV 변경", "⟳ Change CSV")}</button>
        </div>
        {!isDemo && (
          <div className="analysis-local-controls" style={{ marginTop: "8px" }}>
            <div className="analysis-local-controls__inner">
              <span className="analysis-local-controls__label">{tx("원본 CSV 통화", "Source CSV currency")}</span>
              <span className="muted" style={{ fontSize: "11px" }}>{selectedSourceCurrency
                ? tx("원본 단위입니다. 선택하면 화면 표시도 같은 통화로 맞춥니다.", "This is the source unit. Selecting it also aligns the display currency.")
                : tx("⚠ 숫자만으로 통화를 알 수 없어 환산하지 않습니다. 반드시 선택하세요.", "⚠ Currency cannot be inferred from bare numbers, so no conversion is applied. Select it first.")}</span>
              <div className="ab-pillgroup" style={{ margin: 0 }}>
                <button className={`ab-pill ${selectedSourceCurrency === "KRW" ? "active" : ""}`} onClick={() => setMmmSourceCurrency("KRW")}>{tx("원 ₩", "KRW ₩")}</button>
                <button className={`ab-pill ${selectedSourceCurrency === "USD" ? "active" : ""}`} onClick={() => setMmmSourceCurrency("USD")}>{tx("달러 $", "USD $")}</button>
              </div>
            </div>
          </div>
        )}
        <div className="analysis-local-controls" style={{ marginTop: "8px" }}>
          <div className="analysis-local-controls__inner">
            <span className="analysis-local-controls__label">{tx("일별 데이터 주 묶음", "Daily-data week grouping")}</span>
            <span className="muted" style={{ fontSize: "11px" }}>{tx("날짜 컬럼을 매핑한 일별 CSV에만 적용됩니다. 기존 주별 CSV는 바뀌지 않습니다.", "Applies only to daily CSVs with a mapped date column; already-weekly CSVs are unchanged.")}</span>
            <div className="ab-pillgroup" style={{ margin: 0 }}>
              <button className={`ab-pill ${mmmWeekStart === "sunday" ? "active" : ""}`} onClick={() => changeMmmWeekStart("sunday")}>{tx("일요일 시작 (일~토)", "Sunday start (Sun–Sat)")}</button>
              <button className={`ab-pill ${mmmWeekStart === "monday" ? "active" : ""}`} onClick={() => changeMmmWeekStart("monday")}>{tx("월요일 시작 (월~일)", "Monday start (Mon–Sun)")}</button>
            </div>
          </div>
        </div>
        <h3 style={{ fontSize: "14px", margin: "12px 0 8px", color: "var(--primary, #adc6ff)" }}>{tx("🗂 컬럼 역할 매핑 (드래그로 지정)", "🗂 Map column roles (assign by dragging)")}</h3>
        <MmmColumnMapper
          headers={csvData.headers}
          rows={csvData.raw}
          colMap={mmmColMap || autoGuessColMap(csvData.headers, csvData.raw)}
          onChange={setMmmColMap}
          locale={locale}
        />
        {mappingReady && (
          <div data-mmm-analysis-gate style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", background: canAnalyze ? "linear-gradient(135deg,rgba(122,162,247,0.12),rgba(122,162,247,0.03))" : "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.03))", border: `1px solid ${canAnalyze ? "rgba(122,162,247,0.3)" : "rgba(245,158,11,0.4)"}`, borderRadius: "10px", padding: "14px 16px" }}>
            <span style={{ fontSize: "12.5px", color: "var(--text-1)" }}>
              {canAnalyze
                ? <>{tx("✅ 필수 역할 매핑 완료.", "✅ Required roles mapped.")} <strong>{tx("매핑이 맞는지 확인한 뒤 분석을 실행하세요.", "Check that the mapping is correct, then run the analysis.")}</strong> <span style={{ color: "var(--text-muted)" }}>{tx("(매핑만으로 자동 분석하지 않습니다.)", "(Mapping alone doesn't auto-run the analysis.)")}</span></>
                : <>{tx("⚠ 필수 역할 매핑 완료. 원본 CSV 통화만 선택하면 분석할 수 있습니다.", "⚠ Required roles mapped. Select the source CSV currency to run the analysis.")} <strong>{tx("위에서 원 ₩ 또는 달러 $를 선택하세요.", "Choose KRW ₩ or USD $ above.")}</strong></>}
            </span>
            <button className="ab-button" style={{ marginLeft: "auto" }} disabled={!canAnalyze}
              title={canAnalyze ? undefined : tx("원본 CSV 통화를 선택하면 분석할 수 있습니다.", "Select the source CSV currency to run the analysis.")}
              onClick={() => requestAd(() => runMmmAnalyze(mmmAnalysisSig))}>{tx("▶ 분석하기", "▶ Analyze")}</button>
          </div>
        )}
      </section>
    );
  };

  const effectiveTarget = mmm && !mmm.empty ? mmm.target : target;
  // 태그(_android/_ios) 있는 컬럼이 매핑돼 있을 때만 플랫폼 토글 노출(단일 플랫폼 컬럼 없는 wide 데이터용).
  const platformTags = hasData && mmmColMap ? mmmPlatformTags(csvData.headers, mmmColMap) : [];

  // 브레드크럼 = 현재 위치 + 타깃/플랫폼 토글을 한 바(bar)에 좌측 정렬로 병합(토글이 곧 breadcrumb).
  const stageKo = stage === "trend" ? tx("시계열 점검", "Time series") : stage === "mmm" ? tx("기여 분해", "Contribution") : stage === "lab" ? tx("회귀·미래예측", "Regression · Forecast") : tx("잠식 진단", "Cannibalization");
  const demoBanner = isDemo && (
    <div className="required-banner" style={{ borderLeftColor: "#f7b955", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
      <div>
        <strong>{tx("🧪 지금 보고 있는 화면은 샘플(예시) 데이터입니다", "🧪 You're viewing sample (example) data")}</strong>
        <p style={{ margin: "0.25rem 0 0" }}>{tx("실제 내 데이터가 아니며, 서버로 전송되지 않습니다. 내 CSV를 업로드하면 바로 교체됩니다.", "This isn't your real data, and nothing is sent to a server. Upload your own CSV to replace it instantly.")}</p>
      </div>
      <button className="ab-button" onClick={() => setCsvData({ raw: [], headers: [], mapping: {}, fileName: "" })}>{tx("📁 내 CSV 업로드하기", "📁 Upload my CSV")}</button>
    </div>
  );
  const controlBar = () => (
    <div className="analysis-local-controls__inner">
      <span className="analysis-local-controls__label">
        {tx("마케팅 반응 분석", "Marketing Response Analysis")} <span style={{ margin: "0 4px" }}>·</span> <strong style={{ color: "var(--text-1)" }}>{stageKo}</strong>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {availTargets.length > 1 && (
          <div className="ab-pillgroup" style={{ margin: 0 }}>
            <span className="ab-pillgroup-label">{tx("타깃", "Target")}</span>
            {availTargets.map((t) => (
              <button key={t} className={`ab-pill ${effectiveTarget === t ? "active" : ""}`} onClick={() => {
                if (effectiveTarget !== t) deferMmmUpdate(() => setTarget(t));
              }}>
                {t === "Traffic" ? tx("총유입", "Traffic") : t === "Regs" ? tx("가입", "Signups") : t === "React" ? tx("재유입", "Reactivation") : t === "Purchasers" ? tx("구매자", "Purchasers") : t === "Revenue" ? tx("매출", "Revenue") : tx("가입+재유입", "Signups + Reactivation")}
              </button>
            ))}
          </div>
        )}
        {platformTags.length > 0 && (
          <div className="ab-pillgroup" style={{ margin: 0 }}>
            <span className="ab-pillgroup-label">{tx("플랫폼", "Platform")}</span>
            <button className={`ab-pill ${effPlatformFilter === "all" ? "active" : ""}`} onClick={() => {
              if (effPlatformFilter !== "all") deferMmmUpdate(() => setPlatformFilter("all"));
            }}>Total</button>
            {platformTags.includes("android") && (
              <button className={`ab-pill ${effPlatformFilter === "android" ? "active" : ""}`} onClick={() => {
                if (effPlatformFilter !== "android") deferMmmUpdate(() => setPlatformFilter("android"));
              }}>Android</button>
            )}
            {platformTags.includes("ios") && (
              <button className={`ab-pill ${effPlatformFilter === "ios" ? "active" : ""}`} onClick={() => {
                if (effPlatformFilter !== "ios") deferMmmUpdate(() => setPlatformFilter("ios"));
              }}>iOS</button>
            )}
          </div>
        )}
        {segmentSel && segmentSel.values.length > 0 && (
          <div className="ab-pillgroup" style={{ margin: 0 }}>
            <span className="ab-pillgroup-label" title={tx(`나눠보기: ${segmentSel.col}`, `Break down by: ${segmentSel.col}`)}>🔀 {segmentSel.col}</span>
            <button className={`ab-pill ${effPlatformFilter === "all" ? "active" : ""}`} onClick={() => {
              if (effPlatformFilter !== "all") deferMmmUpdate(() => setPlatformFilter("all"));
            }}>{tx("전체", "All")}</button>
            {segmentSel.values.map((v) => (
              <button key={v.value} className={`ab-pill ${effPlatformFilter === v.value ? "active" : ""}`} onClick={() => {
                if (effPlatformFilter !== v.value) deferMmmUpdate(() => setPlatformFilter(v.value));
              }} title={tx(`${v.count.toLocaleString()}행`, `${v.count.toLocaleString()} rows`)}>
                {v.value}
              </button>
            ))}
            {segmentSel.truncated && <span style={{ fontSize: "10.5px", color: "#f59e0b" }}>{tx("⚠ 상위 20개만", "⚠ Top 20 only")}</span>}
          </div>
        )}
        {mmm && !mmm.empty && (
          <button className="ab-pill" onClick={() => {
            const packageDecomp = mmmBayesianWeeklyDecomp(mmm.run);
            const packageTrend = trend || mmmTrendExistence(mmm.panel, mmm.cfg, mmm.target, locale);
            const packageForecast = mmmBayesianForecast(mmm.run, mmm.panel, null, 13);
            downloadMmmWorkbook({ mmm, cannib, decomp: packageDecomp, trend: packageTrend, forecast: packageForecast, csvData, colMap: mmmColMap, locale, currency: displayCurrency });
          }}>{tx("⬇ 분석 패키지", "⬇ Analysis package")}</button>
        )}
      </div>
    </div>
  );

  // ── LAB stage ──
  // ③ 회귀·미래예측(lab)은 이제 ①②와 동일하게 no-data→shared 게이트→분석완료 흐름을 타므로
  // 여기서 early-return하지 않는다(별도 업로드·샘플·매핑 제거). 실제 렌더는 아래 analyzed return에서.

  // ── no-data ──
  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-response">
        {renderTabs()}
        <section className="block" id="s-prep">
          <h2 className="section-title">{tx("데이터 준비", "Data preparation")}</h2>
          <p className="muted" style={{ fontSize: "12px", marginBottom: "12px" }}>{tx("일별 또는 주별 패널 CSV 하나로 카니발 진단 → 기여 분해(MMM) → 회귀·미래예측을 모두 분석합니다. 일별 데이터는 주간으로 자동 정리되고, 매핑한 5개 목표를 언제든 바꿔 볼 수 있습니다. 데이터는 브라우저 메모리에만 — 서버 전송 없음.", "One daily or weekly panel CSV powers cannibalization diagnosis → contribution breakdown (MMM) → regression/forecast. Daily data is normalized to weeks automatically, and you can switch among the five mapped targets at any time. Data stays in browser memory only — never sent to a server.")}</p>
          {mmmDropzone}
        </section>
      </div>
    );
  }

  // ── data present ── colMap 미완성 or 분석 전이면 매퍼+게이트만 노출(PRIMARY 매핑).
  if (!mmmAnalyzed) {
    return (
      <div className="tab-pane active" id="tab-response">
        <AnalyzingOverlay show={isAnalyzing} title={tx("분석 중…", "Analyzing…")} sub={tx(`${(csvData?.raw?.length || 0).toLocaleString()}행 계산 중`, `Computing ${(csvData?.raw?.length || 0).toLocaleString()} rows`)} />
        {renderTabs()}
        {mmmMapperSection()}
      </div>
    );
  }

  // ── analyzed: 매핑 완료 후에도 패널이 비면(엔진 오류·공선) 사유 표시 ──
  const panelEmpty = mmm && mmm.empty;

  return (
    <div className="tab-pane active" id="tab-response">
      <AnalyzingOverlay show={isAnalyzing} title={tx("분석 중…", "Analyzing…")} sub={tx(`${(csvData?.raw?.length || 0).toLocaleString()}행 계산 중`, `Computing ${(csvData?.raw?.length || 0).toLocaleString()} rows`)} />
      {/* 브레드크럼(타깃·플랫폼 토글)+통화 토글 — 페이지 맨 위 sticky(스테이지 카드보다
          위, top:48px 고정)로 이동. 예전엔 스테이지 카드·데모 배너 아래 본문에 있어
          "제일 위로 가야 한다"는 요청 반영(§유저 리포트, 스크롤 시 안 가려짐도 겸함). */}
      {(!panelEmpty || availTargets.length > 0) && (
        <div className="page-sticky-bar">
          <div className="page-sticky-row1">{controlBar()}</div>
          {(isDemo || selectedSourceCurrency) && <AnalysisControlBar title={tx("표시 기준", "Display settings")} hint={tx("공유 CSV 도구에 적용", "Applies to shared CSV tools")}><BasisCurrencyToggleBar locale={locale} /></AnalysisControlBar>}
        </div>
      )}
      {renderTabs()}

      {panelEmpty ? (
        <section className="block">
          {demoBanner}
          <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{mmm.issues?.length
            ? tx(`분석 차단 이슈 ${mmm.issues.length}건`, `${mmm.issues.length} blocking data issue(s)`)
            : tx("MMM 패널을 만들 수 없습니다", "Can't build the MMM panel")}</strong>{mmm.issues?.length
            ? <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>{mmm.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
            : <p>{mmm.reason}</p>}</div></div>
          <div style={{ marginTop: "12px" }}>{mmmMapperSection()}</div>
        </section>
      ) : (
        <>
          {demoBanner}

          {/* ③ LAB(회귀·미래예측)은 아래 §7 forecast 블록에서 렌더(mmmForecast 기반, stage==="lab"). */}

          {/* ── STAGE ① DIAGNOSE (MMM panel) ── */}
          {stage === "trend" && (
            <section className="block" id="s-trend">
              <h2 className="section-title">{tx("광고 전에: 자연 추세·계절성을 먼저 분리합니다", "Before ads: separate natural trend and seasonality")}</h2>
              <p className="muted" style={{ fontSize: "12px", marginBottom: "10px" }}>{tx("STL은 성과를 추세·계절성·불규칙 요인으로 나눕니다. 여기서 보인 추세는 카니발과 MMM이 광고 효과를 과대해석하지 않도록 하는 사전 점검입니다.", "STL separates outcome into trend, seasonality, and irregular movement. It is a pre-check so cannibalization and MMM do not over-credit ads.")}</p>
              {trend ? <>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
                  <div className="stat-card"><div className="lbl">STL</div><div className="val">{trend.stl_pct >= 0 ? "+" : ""}{fmtOne(trend.stl_pct)}%</div></div>
                  <div className="stat-card"><div className="lbl">Mann-Kendall</div><div className="val">p={fmtOne(trend.mk_deseason?.[1])}</div></div>
                  <div className="stat-card"><div className="lbl">{tx("판정", "Verdict")}</div><div className="val" style={{ fontSize: "13px" }}>{trend.verdict}</div></div>
                </div>
                <div className="chart-container" style={{ height: "280px" }}><canvas ref={trendRef}></canvas></div>
                <Card style={{ marginTop: "12px", fontSize: "12px", lineHeight: 1.55 }}>
                  {tx("다음 단계에서 카니발 4검증을 보세요. 그중 ②는 이 시간 추세를 다시 걷어낸 뒤 광고와 성과의 관계를 확인합니다.", "Continue to the four cannibalization checks. Check ② removes this time trend again before comparing spend and outcome.")}
                  <button className="ab-pill active" style={{ marginLeft: "10px" }} onClick={() => setStage("diagnose")}>{tx("카니발 진단으로", "Open cannibalization")}</button>
                </Card>
              </> : <p className="muted">{tx("추세 분석을 계산할 수 없습니다.", "Trend analysis is unavailable.")}</p>}
            </section>
          )}

          {stage === "diagnose" && (
            <>
              {/* ── 메인: 판정별 3버킷 칸반(그룹핑) + 짧은 평어 헤드라인 ── 통계는 아래 아코디언 ── */}
              {cannib && cannib.cannibRank && cannib.cannibRank.length ? (() => {
                const rk = cannib.cannibRank;
                // 엔진 5단계(lv) → 마케터용 3버킷: 잠식의심 / 애매함(데이터부족·공선) / 문제없음.
                const bucketOf = (r) => {
                  const L = mmmCannibLevel(r);
                  if (!r.eligible || L.lv === 1) return "unclear";
                  if (L.lv >= 4) return "danger"; // 카니발 + 신호 조금 → 점검 대상
                  return "ok"; // 신호 없음 / 거의 없음
                };
                const buckets = { danger: [], unclear: [], ok: [] };
                rk.forEach((r) => buckets[bucketOf(r)].push(r));
                const nD = buckets.danger.length;
                const headTone = nD > 0 ? "danger" : buckets.ok.length > 0 ? "ok" : "warn";
                const headBadge = nD > 0 ? tx("잠식 의심", "Cannibalization suspected") : buckets.ok.length > 0 ? tx("방어 양호", "Well defended") : tx("판단 보류", "Verdict withheld");
                const headline = nD > 0
                  ? tx(`${rk.length}개 채널 중 ${nD}개에서 잠식이 의심돼요 — 빨간 칸부터 점검하세요.`, `${nD} of ${rk.length} channels show suspected cannibalization — check the red bucket first.`)
                  : buckets.ok.length > 0
                    ? tx(`${rk.length}개 채널 대체로 방어 양호 — 지금 뚜렷한 잠식 신호는 없어요.`, `${rk.length} channels are mostly well defended — no clear cannibalization signal right now.`)
                    : tx(`판정할 만큼 데이터가 충분한 채널이 적어요 — 애매함 칸을 확인하세요.`, `Too few channels have enough data to judge — check the unclear bucket.`);
                const col = (key, title, icon, tone) => {
                  const list = buckets[key];
                  const c = BADGE_TONE[tone];
                  return (
                    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", padding: "10px 12px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: c.color, marginBottom: "8px" }}>{icon} {title} · {list.length}</div>
                      {list.length ? list.map((r) => (
                        <div key={r.key} onClick={() => setCannibChannel(r.key)}
                          style={{ background: "var(--bg-2)", border: `1px solid ${r.key === activeCannibCh ? "rgba(122,162,247,0.55)" : "var(--border)"}`, borderRadius: "8px", padding: "8px 10px", marginBottom: "6px", cursor: "pointer" }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>{r.label}{r.brand ? " 🏷" : ""}</span>
                            <span style={{ fontSize: "11px", color: MUTED }}>›</span>
                          </div>
                          <div style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>
                            {key === "unclear"
                              ? (r.eligible ? tx("채널끼리 지출이 겹침(공선)", "Channels' spend overlaps (collinear)") : tx(`데이터 부족 (${r.nActive}/${r.total}주)`, `Insufficient data (${r.nActive}/${r.total} wk)`))
                              : mmmCannibActionShort(r)}
                          </div>
                        </div>
                      )) : <div style={{ fontSize: "11px", color: MUTED }}>{tx("없음", "None")}</div>}
                    </div>
                  );
                };
                return (
                  <>
                    <Card style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <Badge tone={headTone}>{headBadge}</Badge>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-1)" }}>{headline}</span>
                    </Card>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "10px" }}>
                      {col("danger", tx("잠식 의심", "Suspected"), "⚠", "danger")}
                      {col("unclear", tx("애매함", "Unclear"), "?", "neutral")}
                      {col("ok", tx("문제 없음", "No issue"), "✓", "ok")}
                    </div>
                    <p style={{ fontSize: "11px", color: MUTED, marginBottom: "14px" }}>
                      {tx("채널을 클릭하면 아래에 왜 그렇게 판정했는지(근거)가 열려요.", "Click a channel to see why it was judged that way, below.")}{rk.mde12 != null ? tx(` · 12주 실험 최소검출력 ≈ ${rk.mde12}%`, ` · 12-week experiment MDE ≈ ${rk.mde12}%`) : ""}
                    </p>
                  </>
                );
              })() : (
                <Card style={{ marginBottom: "14px" }}>
                  <span style={{ fontSize: "13px", color: MUTED }}>{tx("카니발 판정을 계산할 수 없습니다 (데이터·매핑 확인).", "Can't compute a cannibalization verdict (check data/mapping).")}</span>
                </Card>
              )}

              {/* ── 채널 드릴다운: 4가지를 평어 질문으로, ①②③ 3열 균등, 헤드라인은 버킷과 일치 ── */}
              {activeCn && (() => {
                const cn = activeCn;
                const p = cn.precedence, d = cn.detrend_corr, ni = cn.net_incrementality;
                const chLabel = (cannib.rows.find((r) => r.channel.key === activeCannibCh) || {}).channel?.label || activeCannibCh;
                const g = cn.granger;
                const gate = cn.power_gate || { blocked: false, reasons: [] };
                // 헤드라인을 칸반 버킷과 동일 규칙으로 계산 → "문제없다는데 왜 잠식의심" 모순 제거.
                const rr = (cannib.cannibRank || []).find((x) => x.key === activeCannibCh);
                const lv = rr ? mmmCannibLevel(rr).lv : null;
                const bucket = !rr || !rr.eligible || lv === 1 ? "unclear" : lv >= 4 ? "danger" : "ok";
                const votes = [p.vote, d.vote, ni.vote];
                const nFor = votes.filter((v) => v === "FOR").length;
                const nAg = votes.filter((v) => v === "AGAINST").length;
                const nAb = votes.filter((v) => v === "ABSTAIN").length;
                const headTone = bucket === "danger" ? "danger" : bucket === "ok" ? "ok" : "warn";
                const headBadge = bucket === "danger" ? tx("잠식 의심", "Cannibalization suspected") : bucket === "ok" ? tx("방어 양호", "Well defended") : tx("판단 보류", "Verdict withheld");
                const headWhy = bucket === "danger"
                  ? (cn.granger_cannibal
                      ? tx("같은 주 지표(①②③)는 대체로 괜찮은데, 몇 주 시차를 두고 광고비가 오가닉을 끌어내리는 신호(④)가 나왔어요. 그래서 의심으로 올렸습니다.", "Same-week metrics (①②③) mostly look fine, but a lagged signal (④) showed spend pulling organic down a few weeks later — so we flagged it as suspected.")
                      : tx("광고가 늘 때 오가닉이 줄어드는 신호가 나왔어요.", "A signal showed organic falling as ad spend rose."))
                  : bucket === "ok"
                    ? tx("네 방향으로 따져봐도 뚜렷한 잠식 신호가 없어요.", "Checking all four angles, there's no clear cannibalization signal.")
                    : tx("데이터가 부족하거나 채널끼리 지출이 겹쳐(공선) 판정하기 어려워요.", "Data is insufficient, or channels' spend overlaps (collinear), making a verdict hard.");
                const voteView = (v) => v === "FOR" ? { t: tx("괜찮음", "OK"), c: "#22c55e" } : v === "AGAINST" ? { t: tx("잠식 신호", "Cannibalization signal"), c: "#f87171" } : { t: tx("판단 보류", "Withheld"), c: MUTED };
                const signal = (key, num, q, help, v, tech) => {
                  const vv = voteView(v);
                  return (
                    <button onClick={() => setCannibQuestion(key)} style={{ background: cannibQuestion === key ? "rgba(122,162,247,0.10)" : "var(--bg-2)", border: `1px solid ${cannibQuestion === key ? "rgba(122,162,247,0.65)" : "var(--border)"}`, borderRadius: "10px", padding: "12px 14px", textAlign: "left", color: "inherit", cursor: "pointer", minHeight: "142px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-1)", lineHeight: 1.4, minHeight: "34px" }}>{num} {q}</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: vv.c, margin: "8px 0 4px" }}>{vv.t}</div>
                      <div style={{ fontSize: "11px", color: MUTED, lineHeight: 1.5 }}>{help}</div>
                      <div style={{ fontSize: "10px", color: MUTED, marginTop: "6px", opacity: 0.8 }} title={tx("통계 원값(전문가용)", "Raw statistics (for specialists)")}>{tech}</div>
                    </button>
                  );
                };
                return (
                  <section className="block" id="s-cannib-detail">
                    <h2 className="section-title">{tx("이 채널은 왜 이렇게 판정됐나?", "Why was this channel judged this way?")} — {chLabel}</h2>
                    <Card style={{ marginBottom: "12px", display: "flex", gap: "10px", alignItems: "flex-start", flexWrap: "wrap" }}>
                      <Badge tone={headTone}>{headBadge}</Badge>
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div style={{ fontSize: "13px", color: "var(--text-1)", lineHeight: 1.6 }}>{headWhy}</div>
                        <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>{tx(`아래 4가지를 각각 따져본 결과예요 · 괜찮음 ${nFor} / 잠식 신호 ${nAg} / 판단 보류 ${nAb} · 확정은 holdout 실험(5-4)에서만.`, `Result of checking the 4 signals below · OK ${nFor} / cannibalization signal ${nAg} / withheld ${nAb} · confirmation only via a holdout experiment (5-4).`)}</div>
                      </div>
                    </Card>
                    {gate.blocked && (
                      <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: "8px", padding: "9px 12px", fontSize: "11.5px", color: "var(--text-1)", marginBottom: "10px" }}>
                        {tx('ⓘ 데이터가 적거나 지출 변동이 작아 ③을 신뢰하기 어려워요 — 이럴 땐 "문제 없음"으로 단정하지 않고 보류합니다.', 'ⓘ Data is limited or spend barely varies, so ③ can\'t be trusted — in that case we withhold rather than assert "no issue."')}
                      </div>
                    )}
                    <div className="cannib-reading-guide" aria-label={tx("카니발 차트 읽는 법", "How to read the cannibalization chart")}>
                      <div className="cannib-reading-guide__title">{tx("산점도는 이렇게 읽어요", "How to read the scatter plot")}</div>
                      <div className="cannib-reading-guide__cards">
                        <div className="cannib-reading-guide__card is-danger">
                          <strong>{tx("잠식 의심", "Suspected cannibalization")}</strong>
                          <span>{tx("오른쪽 아래로 기울면: 광고 지출↑ · 오가닉 성과↓", "Downward slope: spend ↑ · organic outcome ↓")}</span>
                        </div>
                        <div className="cannib-reading-guide__card is-ok">
                          <strong>{tx("증분 신호", "Incremental signal")}</strong>
                          <span>{tx("오른쪽 위로 기울면: 광고 지출↑ · 성과도↑", "Upward slope: spend ↑ · outcome ↑")}</span>
                        </div>
                        <div className="cannib-reading-guide__card is-neutral">
                          <strong>{tx("판단 보류", "Withhold verdict")}</strong>
                          <span>{tx("점이 흩어지면: 방향이 불분명해 추가 검증 필요", "Scattered points: direction unclear, more evidence needed")}</span>
                        </div>
                      </div>
                      <p>{tx("② 차트는 추세·계절을 걷어낸 뒤의 관계입니다. 기울기 하나만으로 확정하지 않고, 아래 4가지 신호를 함께 봅니다.", "Chart ② removes trend and seasonality first. One slope never decides the verdict; we combine all four signals below.")}</p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "10px" }}>
                      {signal("precedence", "①", tx("광고를 늘리기 전에 성과가 이미 줄고 있었나?", "Was outcome already declining before ad spend rose?"), tx("저지출 주의 시간 흐름을 봅니다. 이미 줄었다면 광고 탓으로 단정 못 해요.", "Checks the time path in low-spend weeks. A prior decline cannot be blamed on ads."), p.vote, tx(`저지출 기울기 ${p.kpi_slope_per_wk}/주 · ${p.kpi_change_over_window_pct}%`, `Low-spend slope ${p.kpi_slope_per_wk}/wk · ${p.kpi_change_over_window_pct}%`))}
                      {signal("detrend", "②", tx("추세·계절을 걷어내도 광고와 성과가 반대로 움직이나?", "After removing trend, do spend and outcome still move opposite?"), tx("시간 착시를 제거한 잔차와 전주 대비 변화를 함께 봅니다.", "Compares detrended residuals and week-over-week changes."), d.vote, tx(`잔차 상관 ${d.detrended} · 차분 상관 ${d.first_diff}`, `Residual corr ${d.detrended} · diff corr ${d.first_diff}`))}
                      {signal("net", "③", tx("광고를 늘리면 전체 성과는 순증가하나?", "Does more spend net-increase total outcome?"), tx("점추정과 신뢰구간이 0보다 어느 쪽에 있는지 봅니다.", "Checks point estimate and confidence interval against zero."), ni.vote, tx(`순증분 ${isFinite(ni.net_elasticity) ? ni.net_elasticity : "—"} · CI[${ni.ci_lo ?? "—"}, ${ni.ci_hi ?? "—"}]`, `Net effect ${isFinite(ni.net_elasticity) ? ni.net_elasticity : "—"} · CI[${ni.ci_lo ?? "—"}, ${ni.ci_hi ?? "—"}]`))}
                      {signal("lag", "④", tx("광고비가 몇 주 뒤 성과를 끌어내리나?", "Does spend pull outcome down weeks later?"), tx("광고 충격 뒤의 주별·누적 반응을 봅니다.", "Shows weekly and cumulative response after a spend shock."), cn.granger_cannibal ? "AGAINST" : cn.granger_help ? "FOR" : "ABSTAIN", g ? tx(`시차 ${g.spend_to_organic.lag}주 · p=${g.spend_to_organic.p}`, `Lag ${g.spend_to_organic.lag}wk · p=${g.spend_to_organic.p}`) : tx("데이터 부족", "Insufficient data"))}
                    </div>
                    <div style={{ marginTop: "12px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-1)", marginBottom: "3px" }}>
                        {cannibQuestion === "precedence" ? tx("① 저지출 주의 성과·지출 흐름", "① Outcome and spend in low-spend weeks") : cannibQuestion === "detrend" ? tx("② 추세 제거·전주 대비 관계", "② Detrended and week-over-week relationship") : cannibQuestion === "net" ? tx("③ 순증분 효과와 신뢰구간", "③ Net incremental effect and interval") : tx("④ 지출 충격 뒤 시차 반응", "④ Lagged response after a spend shock")}
                      </div>
                      <p className="muted" style={{ fontSize: "11px", margin: "0 0 5px" }}>{cannibQuestion === "net" ? tx("초록 막대가 아니라 순증분 탄력성의 점추정과 신뢰구간입니다. 0을 포함하면 결론은 보류합니다.", "This is a net-elasticity estimate and interval, not a green success bar. If it includes 0, verdict is withheld.") : cannibQuestion === "lag" ? tx("아래면 시차 잠식, 위면 시차 증분 신호입니다.", "Below zero suggests lagged cannibalization; above zero suggests incremental response.") : cannibQuestion === "detrend" ? tx("가로축은 광고 지출 변화, 세로축은 성과 변화입니다. 오른쪽 아래로 모이면 잠식 신호, 오른쪽 위로 모이면 증분 신호예요. 점이 흩어지면 보류합니다.", "Horizontal = spend change; vertical = outcome change. Down-right clustering signals cannibalization, up-right signals incrementality; scattered points mean withhold.") : tx("선택한 검증의 원자료를 직접 확인하세요. 단일 차트가 최종 인과 증명은 아닙니다.", "Inspect source evidence for the selected test. One chart is not causal proof.")}</p>
                      {cannibQuestion === "net" ? <NetEffectEvidence net={ni} locale={locale} /> : <div className="chart-container" style={{ height: "250px" }}><canvas ref={irfRef}></canvas></div>}
                    </div>
                  </section>
                );
              })()}

              {/* ── 통계 근거·방법론 전부 여기로 격리(기본 접힘) — 비전문 유저는 위 칸반·평어만 보면 됨 ── */}
              <details className="block" style={{ marginBottom: "14px" }} onToggle={onAccordionToggle}>
                <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--primary, #adc6ff)", padding: "4px 0" }}>
                  {tx("카니발이 뭐고, 이 판정은 어떻게 나온 건가요? — 추세·데이터 위생·단순모델 점검 (통계 상세)", "What is cannibalization, and how was this verdict reached? — trend, data hygiene, naive-model check (statistics detail)")}
                </summary>
                <div style={{ marginTop: "12px" }}>
                  <p className="muted" style={{ fontSize: "12px", lineHeight: 1.7, marginBottom: "10px" }}>
                    <strong>{tx("카니발리제이션(잠식)", "Cannibalization")}</strong>{tx("이란 유료 광고가 원래 공짜로 들어올 오가닉 유입을 빼앗는 현상입니다. 이 도구는 4가지 독립 신호(①시간 선행성 ②탈추세·차분 상관 ③순증분 탄력성 ④그랜저 인과)를 투표로 종합해 채널별로 판정합니다. 관측 검정은 용의자를 좁힐 뿐이며, 확정은 홀드아웃 실험(5-4)에서만 가능합니다.", " is when paid ads take away organic traffic that would have come for free. This tool combines 4 independent signals (① temporal precedence ② detrended/diff correlation ③ net-incremental elasticity ④ Granger causality) by vote to judge each channel. Observational tests only narrow down suspects — confirmation is only possible via a holdout experiment (5-4).")}
                  </p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                    <button className="ab-pill" title={tx("채널 × 3-state 투표 + 게이트·탄력성·커버리지·그랜저 → CSV", "Channel × 3-state vote + gate/elasticity/coverage/Granger → CSV")}
                      onClick={() => cannib && csvDownload(`mmm_cannib_${mmm.target}_${_today()}.csv`, buildCannibCsv(cannib, mmm.effects, mmm.target))}>
                      {tx("⬇ 채널별 카니발 CSV", "⬇ Per-channel cannibalization CSV")}
                    </button>
                    <button className="ab-pill" title={tx("주별 타깃·채널별 ln(1+지출)·탈추세 잔차·1차차분 원자료", "Weekly target/channel ln(1+spend), detrended residuals, first-difference raw data")}
                      onClick={() => csvDownload(`mmm_cannib_series_${mmm.target}_${_today()}.csv`, buildCannibSeriesCsv(mmm.panel, mmm.target))}>
                      {tx("⬇ 검정 원자료 CSV", "⬇ Test raw-data CSV")}
                    </button>
                  </div>

              <section className="block" id="s-trend">
                <h2 className="section-title">{tx("성과에 광고와 무관한 '추세'가 있나요?", "Is there a 'trend' in performance unrelated to ads?")}</h2>
                <p className="muted" style={{ fontSize: "12px", marginBottom: "8px" }}>{tx("시간이 흐르며 성과가 저절로 오르내리는 흐름(추세)이 있는지 봐요. 추세가 크면, 광고 효과와 헷갈리지 않게 따로 떼어내야 해요.", "Checks whether performance rises/falls on its own over time (a trend). If the trend is large, it needs to be separated so it isn't confused with ad effect.")}</p>
                {trend ? (
                  <>
                    {(() => {
                      const isNo = trend.verdict.startsWith("NO");
                      const isYes = trend.verdict.startsWith("trend EXISTS");
                      const plain = isNo
                        ? tx("뚜렷한 추세는 없어요 — 성과 등락은 대부분 광고·계절 영향입니다.", "No clear trend — performance swings are mostly due to ads/season.")
                        : isYes
                          ? tx("추세가 있어요 — 광고를 걷어내도 시간 흐름 자체의 상승/하락이 남습니다.", "There's a trend — a rise/fall from time itself remains even after removing ads.")
                          : tx("추세가 조금 있지만 광고·계절과 얽혀 있어요.", "There's some trend, but it's entangled with ads/season.");
                      return (
                        <div className={`callout ${isNo ? "ok" : "warn"}`}>
                          <div className="ico">{isNo ? "✓" : "!"}</div>
                          <div className="body">
                            <strong>{plain}</strong>
                            <p style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }} title={trend.verdict}>{tx(`전 구간 추세 변화 ${trend.stl_pct}% · 판정 근거: ${trend.verdict}`, `Full-period trend change ${trend.stl_pct}% · basis: ${trend.verdict}`)}</p>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="chart-container" style={{ height: "240px", marginTop: "12px" }}>
                      <canvas ref={trendRef}></canvas>
                    </div>
                    <div className="table-wrap" style={{ marginTop: "12px" }}>
                      <table className="data" style={{ fontSize: "11.5px" }}>
                        <thead><tr><th>{tx("검정", "Test")}</th><th>{tx("결과", "Result")}</th><th>p</th></tr></thead>
                        <tbody>
                          <tr><td>Mann-Kendall (raw)</td><td>{trend.mk_raw[0]}</td><td className="tnum">{trend.mk_raw[1]}</td></tr>
                          <tr><td>{tx("MK (자기상관 보정)", "MK (autocorrelation-corrected)")}</td><td>{trend.mk_ac_robust[0]}</td><td className="tnum">{trend.mk_ac_robust[1]}</td></tr>
                          <tr><td>{tx("MK (계절 제거)", "MK (deseasonalized)")}</td><td>{trend.mk_deseason[0]}</td><td className="tnum">{trend.mk_deseason[1]}</td></tr>
                          <tr><td>{tx("ADF (추세정상성)", "ADF (trend stationarity)")}</td><td>—</td><td className="tnum">{trend.adf_ct_p}</td></tr>
                          <tr><td>KPSS</td><td>—</td><td className="tnum">{trend.kpss_ct_p}</td></tr>
                          <tr><td>{tx("media 제거 후 잔차 MK", "Residual MK after removing media")}</td><td>{trend.resid_after_media_mk[0]}</td><td className="tnum">{trend.resid_after_media_mk[1]}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="muted" style={{ fontSize: "12px" }}>{tx("추세 검정을 계산할 수 없습니다.", "Can't compute the trend test.")}</p>
                )}
              </section>

              {/* ── §1 데이터 위생 + 매크로 사실 (모델 독립) ── */}
              <section className="block" id="s-macro">
                <h2 className="section-title">{tx("데이터가 분석하기에 깨끗한가요?", "Is the data clean enough to analyze?")}</h2>
                <p className="muted" style={{ fontSize: "12px" }}>
                  {tx("분석 전에 데이터에 빠진 주·이상한 값이 없는지 점검하고, 작년 대비 지출·성과가 얼마나 변했는지(가장 단순하고 확실한 비교)를 봐요.", "Before analysis, checks for missing weeks/odd values in the data, and shows how much spend/performance changed vs. last year (the simplest, most certain comparison).")}
                </p>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", margin: "8px 0" }}>
                  <div className="stat-card"><div className="lbl">{tx("주 수(n)", "Weeks (n)")}</div><div className="val">{mmm.derived.n}</div></div>
                  <div className="stat-card"><div className="lbl">{tx("위생 경고", "Hygiene warnings")}</div><div className="val" style={{ color: mmm.validate?.warnings?.length ? "#f87171" : "#22c55e" }}>{mmm.validate?.warnings?.length || "OK"}</div></div>
                  <div className="stat-card"><div className="lbl">{tx("분석 차단 이슈", "Blocking issues")}</div><div className="val" style={{ color: mmm.validate?.issues?.length ? "#f87171" : "#22c55e" }}>{mmm.validate?.issues?.length || "OK"}</div></div>
                </div>
                {diag && Object.keys(diag.macro).length ? (
                  <div className="table-wrap" style={{ maxWidth: "420px", marginTop: "8px" }}>
                    <table className="data" style={{ fontSize: "11.5px" }}>
                      <thead><tr><th>{tx("매크로 사실", "Macro fact")}</th><th>{tx("값", "Value")}</th></tr></thead>
                      <tbody>
                        {Object.entries(diag.macro).map(([k, v]) => (
                          <tr key={k}><td>{k}</td><td className="tnum" style={{ color: v < 0 ? POS : NEG }}>{v > 0 ? "+" : ""}{v}%</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: "11px", marginTop: "6px" }}>
                    {tx(`ⓘ 매크로 YoY(2024 vs 2025)는 날짜가 매핑된 데이터에서만 계산됩니다${diag && !diag.validDates ? " — 현재 데이터엔 유효 날짜 라벨이 없습니다." : " — 2024·2025 두 해가 모두 있어야 표시됩니다."}`, `ⓘ Macro YoY (2024 vs 2025) is only computed for data with a mapped date${diag && !diag.validDates ? " — the current data has no valid date labels." : " — both 2024 and 2025 must be present."}`)}
                  </p>
                )}
                {mmm.validate?.warnings?.length ? (
                  <details style={{ marginTop: "8px" }}>
                    <summary style={{ cursor: "pointer", fontSize: "11px", color: "#fbbf24" }}>{tx(`⚠ 데이터 위생 경고 ${mmm.validate.warnings.length}건 (펼치기)`, `⚠ ${mmm.validate.warnings.length} data hygiene warnings (expand)`)}</summary>
                    <ul style={{ fontSize: "11px", color: "#e0af68", marginTop: "4px" }}>
                      {mmm.validate.warnings.map((w, i) => (<li key={i}>{w}</li>))}
                    </ul>
                  </details>
                ) : null}
                {diag && diag.absorb && diag.absorb.notices.length > 0 && (
                  <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: "8px", padding: "9px 12px", fontSize: "11.5px", color: "var(--text-1)", marginTop: "10px" }}>
                    🔗 <strong>{diag.absorb.notices.some((notice) => !notice.dropped) ? tx("식별 불가 — 자동 제거 안 함", "Not identified — no variable auto-removed") : tx("사용자 지정 흡수(공선)", "User-specified absorption (collinear)")}</strong> — {diag.absorb.notices.some((notice) => !notice.dropped)
                      ? tx("채널 지출과 구조변화가 거의 같이 움직여(|r|≥0.9) 어느 쪽 효과인지 구분할 수 없습니다. 앱은 임의로 한 변수를 지우지 않으며 예산 추천을 보류합니다.", "Channel spend and a regime-change variable move almost identically (|r|≥0.9), so their effects cannot be separated. The app does not remove either variable automatically, and budget recommendations are paused.")
                      : tx("사용자가 제거할 변수를 명시한 공선쌍만 모델에서 흡수했습니다.", "Only collinear pairs with an explicitly chosen variable to remove were absorbed.")}
                    <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
                      {diag.absorb.notices.map((nt) => (
                        <li key={nt.key}>{nt.channelLabel} ~ {nt.step} (r={nt.corr}) → {nt.dropped
                          ? <><strong>{nt.dropped}</strong> {tx(`흡수(유지: ${nt.kept})`, `absorbed (kept: ${nt.kept})`)}</>
                          : <strong>{tx("식별 불가 · 자동 제거 안 함 · 예산 추천 보류", "not identified · no auto-removal · budget recommendation paused")}</strong>}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* ── §2 "단순 모델" audit — 흔한 함정 점검 (naive lumped 모델) ── */}
              {diag && diag.audit && (() => {
                const a = diag.audit;
                const f = (v, d = 2) => (v == null || !isFinite(v) ? "—" : (+v).toFixed(d));
                return (
                  <section className="block" id="s-audit">
                    <h2 className="section-title">{tx("'대충 뭉친 모델'은 왜 못 믿나요?", "Why can't you trust a 'crudely lumped model'?")}</h2>
                    <p className="muted" style={{ fontSize: "12px" }}>
                      {tx("모든 채널 지출을", "It shows common pitfalls of")} <strong>{tx("하나로 뭉쳐 대충 만든 모델", "a model crudely lumping all channel spend together")}</strong>{tx("이 흔히 빠지는 함정(자기상관을 무시해 과신하거나, 채널끼리 겹쳐 계수가 출렁이는 것)을 보여줘요 — 그래서 채널을 나누고 광고 잔효·수확체감을 반영한 제대로 된 MMM(② 기여 분해)이 필요합니다.", " (overconfidence from ignoring autocorrelation, or coefficients swinging because channels overlap) — which is why a proper MMM (② Contribution) that separates channels and models carryover/saturation is needed.")}
                    </p>
                    <p style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>
                      target=RR · n={a.n} · R²={f(a.r2, 4)} · adjR²={f(a.adj_r2, 4)} · HAC maxlags={a.hac_maxlags}
                    </p>
                    <div className="table-wrap" style={{ marginTop: "6px" }}>
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead><tr><th>{tx("변수", "Variable")}</th><th>coef</th><th title={tx("일반 최소제곱 p — 독립·등분산 가정", "Plain OLS p — assumes independent, homoskedastic errors")}>OLS p</th><th title={tx("자기상관·이분산에 견고한 HAC p — OLS보다 크거나 작을 수 있음", "HAC p robust to autocorrelation/heteroskedasticity — may be larger or smaller than OLS")}>HAC p</th></tr></thead>
                        <tbody>
                          {a.coefficients.map((r) => (
                            <tr key={r.var}>
                              <td>{r.var}</td>
                              <td className="tnum">{f(r.coef)}</td>
                              <td className="tnum" style={{ color: MUTED }}>{f(r.ols_p, 4)}</td>
                              <td className="tnum">{f(r.hac_p, 4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: "12px", margin: "12px 0 2px", color: "var(--text-1)" }}>
                      {tx('① 브랜드 추가 시 R²가 내려가는가?', "① Does R² fall when brand is added?")} <span style={{ color: MUTED, fontSize: "11px" }}>{tx('(회귀변수 추가는 R²를 못 낮춤 → "브랜드 빼자" 논리 반박)', '(adding a regressor can\'t lower R² → this rebuts the "drop brand" argument)')}</span>
                    </p>
                    <div className="table-wrap">
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead><tr><th>target</th><th>{tx("R²(브랜드 X)", "R² (no brand)")}</th><th>{tx("R²(브랜드 O)", "R² (with brand)")}</th><th>brand p</th></tr></thead>
                        <tbody>
                          {a.brand_test.map((r) => (
                            <tr key={r.target}>
                              <td>{r.target}</td>
                              <td className="tnum">{f(r.R2_no_brand, 4)}</td>
                              <td className="tnum" style={{ color: NEG }}>{f(r.R2_with_brand, 4)}</td>
                              <td className="tnum">{f(r.brand_p, 4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: "12px", margin: "12px 0 2px", color: "var(--text-1)" }}>
                      {tx('② 같은 스펙인데 target만 바꿔도 "총지출 계수"가 출렁인다 = 공선 신호', '② Same spec, but the "total-spend coefficient" swings just by changing target = a collinearity signal')}
                    </p>
                    <div className="table-wrap">
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead><tr><th>target</th><th>{tx("총지출 coef", "Total-spend coef")}</th><th>HAC p</th><th>trend coef</th></tr></thead>
                        <tbody>
                          {a.channel_swing.map((r) => (
                            <tr key={r.target}>
                              <td>{r.target}</td>
                              <td className="tnum">{f(r.ln_G_coef)}</td>
                              <td className="tnum">{f(r.hac_p, 4)}</td>
                              <td className="tnum" style={{ color: POS }}>{f(r.trend_coef)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="muted" style={{ fontSize: "11px", marginTop: "6px" }}>
                      {tx(`RR mean=${a.composite.mean_RR} = 구성요소 합 ${a.composite.components_mean_sum} (RR 정의 확인). ⚠ spend↔trend 공선 + 상쇄 계수 → 단순 모델 계수는 식별 불안정 → §5(채널분리·adstock·HAC)에서 제대로.`, `RR mean=${a.composite.mean_RR} = sum of components ${a.composite.components_mean_sum} (checks the RR definition). ⚠ spend↔trend collinearity + offsetting coefficients → naive-model coefficients are unstable to identify → done properly in §5 (channel separation, adstock, HAC).`)}
                    </p>
                  </section>
                );
              })()}
                </div>
              </details>

              {/* ── 맨 밑: 전 과정 상세 설명 문서 다운로드 ── */}
              <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                <button className="ab-button"
                  onClick={() => textDownload(`${tx("카니발_진단_설명", "cannibalization_diagnosis_explained")}_${mmm.target}_${_today()}.md`, buildCannibGuideDoc(cannib, mmmTargetDisplay(mmm.target, locale), locale))}>
                  {tx("📄 이 과정에 대한 자세한 설명이 듣고 싶으신가요? — 상세 문서 받기", "📄 Want a detailed explanation of this process? — Get the detailed document")}
                </button>
              </div>
            </>
          )}

          {/* ── STAGE ② MMM ── */}
          {stage === "mmm" && (() => {
            const isBaseDemandDriver = (driver) => ["Trend", "기본 수요", "baseline"].includes(driver);
            const rawShRows = mmm.run.shapley?.rows || [];
            const visibleShRows = includeBaseDemandInShare ? rawShRows : rawShRows.filter((row) => !isBaseDemandDriver(row.driver));
            const visibleShTotal = visibleShRows.reduce((sum, row) => sum + (row.r2_share || 0), 0);
            const shRows = visibleShRows
              .map((row) => ({ ...row, pct: visibleShTotal > 0 ? row.r2_share / visibleShTotal * 100 : 0 }))
              .sort((a, b) => b.r2_share - a.r2_share);
            const PLAIN_DRV = locale === "en"
              ? { "기본 수요": "Base demand", Trend: "Base demand · trend", Seasonality: "Season", Holidays: "Holidays/events", "Holidays & Events": "Holidays/events", "Regime(steps)": "Regime change", "Regime change": "Regime change", "Industry Trend": "Industry trend", Performance: "Performance marketing", Brand: "Brand", Regime: "Regime change", baseline: "Baseline" }
              : { Trend: "기본 수요·추세", Seasonality: "시즌·계절", Holidays: "휴일·이벤트", "Holidays & Events": "휴일·이벤트", "Regime(steps)": "구조 변화", "Regime change": "구조 변화", "Industry Trend": "업계 현황", Performance: "마케팅", Brand: "브랜딩", Regime: "구조 변화", baseline: "기본값" };
            const plainDrv = (nm) => PLAIN_DRV[nm] || nm;
            const isMediaDrv = (nm) => !MMM_NONMEDIA_GROUPS.includes(nm) && nm !== "baseline";
            const tgtKo = mmmTargetDisplay(mmm.target, locale);
            const topDrv = shRows[0];
            const topMedia = shRows.find((r) => isMediaDrv(r.driver));
            const headline = shRows.length
              ? tx(
                  `${tgtKo} 성과를 움직인 건 대부분 ${plainDrv(topDrv.driver)}(${(topDrv.pct || 0).toFixed(0)}%)였고${topMedia ? `, 광고 중엔 ${topMedia.driver}가 가장 컸어요` : "예요"}.`,
                  `Most of the ${tgtKo} performance was driven by ${plainDrv(topDrv.driver)} (${(topDrv.pct || 0).toFixed(0)}%)${topMedia ? `, and among ads, ${topMedia.driver} was the largest` : ""}.`,
                )
              : tx("기여 분해 결과를 계산할 수 없어요.", "Can't compute the contribution breakdown.");
            const maxPct = Math.max(0.0001, ...shRows.map((r) => r.pct || 0));
            const barColor = (nm) => isMediaDrv(nm) ? "#7F77DD" : nm === "Seasonality" ? "#5DCAA5" : nm === "Industry Trend" ? "#a78bfa" : nm === "baseline" ? "var(--border-strong)" : "#85B7EB";
            const sat = mmm.run.saturationByChannel || {};
            const spendLabel = (amount) => {
              const displayAmount = convAmt(amount);
              if (displayCurrency === "KRW") return `${fmtCompact(Math.round(displayAmount))}원`;
              return Math.abs(displayAmount) >= 1000
                ? `$${(displayAmount / 1000).toFixed(1)}k`
                : `$${displayAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
            };
            // 의사결정 step은 원본 통화 기준(KRW +₩1M, USD +$1k)으로 고정한다.
            // 화면 통화 토글은 라벨·표시값만 바꾸며 순위·구간 자체를 바꾸지 않는다.
            const marginalStepSource = sourceCurrency === "KRW" ? 1_000_000 : 1_000;
            const marginalStepLabel = spendLabel(marginalStepSource);
            const ranked = Object.values(sat)
              .map((s) => ({
                ...s,
                marginalDecision: s.incrementalAt(s.recentMean, marginalStepSource),
                incrementInObservedRange: s.isIncrementInObservedRange(s.recentMean, marginalStepSource),
              }))
              .map((s) => ({ ...s, curMarg: s.marginalDecision.mean, marginalCi: s.marginalDecision.ci }))
              .filter((s) => s.budgetEligible && s.incrementInObservedRange && s.curMarg > 0 && s.marginalCi?.[0] > 0)
              .sort((a, b) => b.curMarg - a.curMarg);
            const decisionCandidates = ranked.length ? [ranked[0], ...ranked.slice(1).filter((candidate) => (
              ranked[0].marginalCi[0] <= candidate.marginalCi[1]
              && candidate.marginalCi[0] <= ranked[0].marginalCi[1]
            ))] : [];
            const isRankingAmbiguous = decisionCandidates.length > 1;
            const budgetGateLabel = (reasons = []) => reasons.map((reason) => ({
              "high-collinearity": tx("매체 관련 공선", "media-linked collinearity"),
              "low-information": tx("전체 기간 정보 부족", "limited overall history"),
              "prior-scale-nonconvergence": tx("잔차분산-prior penalty 반복 미수렴", "residual-scale/prior-penalty iteration not converged"),
              "low-positive-probability": tx("양수 확률 80% 미만", "P(positive) below 80%"),
              "sparse-active-weeks": tx("집행 20주 미만", "fewer than 20 active weeks"),
              "constant-spend": tx("지출 변동 부족", "insufficient spend variation"),
              "recently-inactive": tx("최근 8주 미집행", "inactive in the last 8 weeks"),
              "outside-observed-spend-range": tx("증액 후 지속 주간 노출이 관측 adstock 범위 밖", "sustained post-increment exposure exceeds observed adstock range"),
            }[reason] || reason)).join(" · ");
            const health = mmm.health || mmmBayesianHealth(mmm.run);
            const identification = mmm.run.identification || {};
            const unresolvedCollinearity = (mmm.absorb?.notices || []).some((notice) => !notice.dropped);
            const budgetEligible = identification.budgetEligible !== false && !unresolvedCollinearity;
            const collinearPairKey = (pair) => `${pair.a}|${pair.b}`;
            const highCollinearPairs = (mmm.run.collinear_pairs || [])
              .filter((pair) => pair.a?.startsWith("media_") && pair.b?.startsWith("media_") && Math.abs(pair.corr) >= 0.9);
            const collinearPairDetail = (pair) => {
              if (!pair) return null;
              const channelKey = (featureName) => featureName.replace(/^media_/, "");
              const keys = [channelKey(pair.a), channelKey(pair.b)];
              const series = keys.map((key) => ({
                key,
                label: mmm.panel.channels?.find((channel) => channel.key === key)?.label || key,
                values: mmm.panel.ch?.[key] || [],
              }));
              const isImpression = keys.every((key) => /impressions?$/i.test(key));
              return { ...pair, key: collinearPairKey(pair), series, unitLabel: isImpression ? tx("노출수", "impressions") : tx("소진액", "spend") };
            };
            const selectedCollinearPair = collinearPairDetail(highCollinearPairs.find((pair) => collinearPairKey(pair) === selectedCollinearPairKey));
            const maxPriorShift = health?.priorShifts?.length
              ? Math.max(...health.priorShifts.map((item) => Math.abs(item.shiftZ || 0)))
              : null;
            // 음(−) 기여 알림 — 어떤 버킷이 특정 주에 성과를 크게 끌어내렸나. baseline(기본 수요)은 상수라 제외.
            const negAlert = (() => {
              if (!decomp || !decomp.weeks?.length) return null;
              let worst = null;
              decomp.weeks.forEach((w, i) => {
                const byB = {};
                decomp.groupNames.forEach((g) => { const b = decompBucketOf(g); byB[b] = (byB[b] || 0) + (w.contrib[g] || 0); });
                Object.entries(byB).forEach(([b, v]) => { if (v < 0 && (!worst || v < worst.val)) worst = { bucket: b, val: v, i }; });
              });
              const thr = -0.08 * Math.abs(decomp.baseline || 1);
              if (!worst || worst.val > thr) return null;
              const w = decomp.weeks[worst.i];
              let domG = null, domV = 0;
              decomp.groupNames.forEach((g) => { if (decompBucketOf(g) !== worst.bucket) return; const v = w.contrib[g] || 0; if (v < domV) { domV = v; domG = g; } });
              return { ...worst, domG, domV, lbl: mmm.panel.weekLabel?.[worst.i] || `주차 ${worst.i + 1}`, bLabel: bucketMeta[worst.bucket]?.label || worst.bucket };
            })();
            const groupPanelPalette = {
              "기본 수요": "#94a3b8",
              Trend: "#c9c2c0",
              Seasonality: "#f4d877",
              "Holidays & Events": "#f4b366",
              "Regime change": "#bda593",
              "Industry Trend": "#a78bfa",
              Performance: "#df8392",
              Brand: "#d5df8e",
            };
            const groupPanels = decomp
              ? [
                  { key: "기본 수요", values: decomp.weeks.map((w) => w.baseline) },
                  ...decomp.groupNames.map((key) => ({ key, values: decomp.weeks.map((w) => w.contrib[key] || 0) })),
                ].filter((g) => g.values.some((v) => Math.abs(v) > 1e-8)).map((g) => ({ ...g, label: plainDrv(g.key) }))
              : [];
            return (
            <>
              <MmmEvidenceLedger
                locale={locale}
                selectedEvidence={selectedEvidence}
                onToggleEvidence={(kind) => deferMmmUpdate(() => setSelectedEvidence((current) => ({ ...current, [kind]: !current[kind] })))}
                evidence={priorEvidence}
                onEvidence={(update) => deferMmmUpdate(() => setPriorEvidence(update))}
                onLoadDemo={handleLoadPriorDemo}
                appliedPriorCount={Object.keys(mmm.mediaPriors || {}).length}
                experimentPriorDiagnostics={mmm.experimentPriorDiagnostics || []}
                countryCandidates={mmm.countryCandidates || []}
                countryIndividualCandidates={mmm.countryIndividualCandidates || []}
                countryBacktests={mmm.countryBacktests}
                countryPlan={mmm.countryPlan}
                formatValue={targetValueLabel}
              />
              {(selectedEvidence.experiment || selectedEvidence.country) && (
                <div className="callout" style={{ marginBottom: "12px" }}>
                  <div className="ico">i</div><div className="body"><strong>{Object.keys(mmm.mediaPriors || {}).length ? tx(`${tgtKo}에는 ${Object.keys(mmm.mediaPriors).length}개 채널 prior 적용`, `${Object.keys(mmm.mediaPriors).length} channel priors applied to ${tgtKo}`) : tx(`${tgtKo}에 일치하는 prior 없음`, `No matching prior for ${tgtKo}`)}</strong><p>{Object.keys(mmm.mediaPriors || {}).length ? tx("헤더·목표 역할이 연결된 근거입니다. KPI 정의·집계 창·단위가 실제로 같은지는 사용자가 확인해야 합니다.", "The evidence matches by header and target role. You must confirm equivalent KPI definitions, aggregation windows, and units.") : tx("이 목표에는 기본 MMM만 사용합니다.", "This target continues to use the base MMM.")}</p></div>
                </div>
              )}
              {health && (
                <section className="block" aria-label={tx("모델 건강 진단", "Model health diagnostics")}>
                  <h2 className="section-title">{tx("모델 건강 진단", "Model health diagnostics")} <span style={{ fontSize: "12px", color: MUTED, fontWeight: 400 }}>{tx("· 적합도만이 아니라 오차·잔차·식별을 함께 확인", "· check error, residuals, and identification—not fit alone")}</span></h2>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <div className="stat-card"><div className="lbl">{tx("전체 wMAPE", "In-sample wMAPE")}</div><div className="val">{Number.isFinite(health.wmape) ? `${health.wmape.toFixed(1)}%` : "—"}</div></div>
                    <div className="stat-card"><div className="lbl">{tx("시간순 OOS wMAPE", "Time-ordered OOS wMAPE")}</div><div className="val">{Number.isFinite(health.oos?.wmape) ? `${health.oos.wmape.toFixed(1)}%` : "—"}</div></div>
                    <div className="stat-card"><div className="lbl">{tx("90% 범위 포함률", "90% interval coverage")}</div><div className="val">{Number.isFinite(health.coverage90) ? `${(health.coverage90 * 100).toFixed(0)}%` : "—"}</div></div>
                    <div className="stat-card"><div className="lbl">{tx("잔차 ACF(1주)", "Residual ACF (lag 1)")}</div><div className="val">{Number.isFinite(health.residualAcf1) ? health.residualAcf1.toFixed(2) : "—"}</div></div>
                    <div className="stat-card"><div className="lbl">{tx("음수 자연수요 주", "Negative natural-demand weeks")}</div><div className="val">{Number.isFinite(health.negativeBaselineShare) ? `${(health.negativeBaselineShare * 100).toFixed(0)}%` : "—"}</div></div>
                    <div className="stat-card"><div className="lbl">{tx("최대 prior 이동", "Largest prior shift")}</div><div className="val">{Number.isFinite(maxPriorShift) ? `${maxPriorShift.toFixed(1)} SD` : tx("prior 없음", "No prior")}</div></div>
                    {Number.isFinite(identification.weeksPerParameter) && <div className="stat-card"><div className="lbl">{tx("파라미터당 주", "Weeks per parameter")}</div><div className="val">{identification.weeksPerParameter.toFixed(1)}</div></div>}
                    {Number.isFinite(identification.maxMediaVif) && <div className="stat-card"><div className="lbl">{tx("최대 매체 VIF", "Max media VIF")}</div><div className="val">{identification.maxMediaVif.toFixed(2)}</div></div>}
                    {Number.isFinite(identification.maxMediaCorrelation) && <div className="stat-card"><div className="lbl">{tx("검출된 공선쌍 최대 상관", "Max detected collinear-pair corr.")}</div><div className="val">{identification.maxMediaCorrelation > 0 ? identification.maxMediaCorrelation.toFixed(2) : tx("검출 없음", "None")}</div></div>}
                    {mmm.run.baselineSelection?.enabled && <div className="stat-card"><div className="lbl">{tx("Baseline 후보", "Baseline candidates")}</div><div className="val">{mmm.run.baselineSelection.selected ? tx("Knot 적용", "Knot selected") : tx("기본 유지", "Base retained")}</div></div>}
                    {Array.isArray(mmm.run.seasonalityPeriods) && <div className="stat-card"><div className="lbl">{tx("계절성", "Seasonality")}</div><div className="val">{mmm.run.seasonalityPeriods.length
                      ? (mmm.run.seasonalitySelection?.enabled ? mmm.run.seasonalitySelection.selected.id : tx(`연간 ${mmm.run.seasonalityPeriods.length}차`, `Annual ${mmm.run.seasonalityPeriods.length}`))
                      : tx("미사용", "Off")}</div></div>}
                    {mmm.run.mediaPenaltySelection?.enabled && <div className="stat-card"><div className="lbl">{tx("매체 규제 자동선택", "Media regularization")}</div><div className="val">{mmm.run.mediaPenaltySelection.selected.mediaPenalty.toFixed(2)}</div></div>}
                    {mmm.run.jointTransform?.enabled && <div className="stat-card"><div className="lbl">{tx("제한적 joint 점검", "Limited joint check")}</div><div className="val">{mmm.run.jointTransform.evaluatedCount}/{mmm.run.jointTransform.candidateCount}</div></div>}
                  </div>
                  {highCollinearPairs.length > 0 && (
                    <div style={{ marginTop: "10px" }}>
                      <button
                        className="ab-pill"
                        style={{ color: "#b45309", borderColor: "rgba(245,158,11,.65)", background: "rgba(245,158,11,.10)" }}
                        title={tx("강하게 함께 움직이는 채널 쌍의 주별 입력값을 확인합니다.", "Inspect weekly inputs for channel pairs that move strongly together.")}
                        onClick={() => setSelectedCollinearPairKey((current) => current ? null : collinearPairKey(highCollinearPairs[0]))}
                      >
                        ⚠ {tx(`채널 쌍 상관 경고 ${highCollinearPairs.length}건 보기`, `View ${highCollinearPairs.length} correlated channel pair${highCollinearPairs.length > 1 ? "s" : ""}`)}
                      </button>
                    </div>
                  )}
                  {selectedCollinearPair && (
                    <Card style={{ marginTop: "10px", borderColor: "rgba(245,158,11,.45)", background: "rgba(245,158,11,.045)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)" }}>⚠ {tx("함께 움직이는 채널 입력값", "Channel inputs moving together")}</div>
                          <p className="muted" style={{ fontSize: "11.5px", margin: "4px 0 0", lineHeight: 1.5 }}>
                            {tx(`${selectedCollinearPair.series[0].label} · ${selectedCollinearPair.series[1].label}의 상관은 ${selectedCollinearPair.corr.toFixed(2)}입니다. 두 값을 따로 나눠 기여를 정하기 어려울 수 있습니다.`, `${selectedCollinearPair.series[0].label} · ${selectedCollinearPair.series[1].label} have correlation ${selectedCollinearPair.corr.toFixed(2)}. Separating their contributions can be difficult.`)}
                          </p>
                        </div>
                        <button className="ab-pill" onClick={() => setSelectedCollinearPairKey(null)}>{tx("닫기", "Close")}</button>
                      </div>
                      {highCollinearPairs.length > 1 && (
                        <div className="ab-pillgroup" style={{ marginTop: "10px" }}>
                          {highCollinearPairs.map((pair) => {
                            const detail = collinearPairDetail(pair);
                            return <button key={detail.key} className={`ab-pill ${detail.key === selectedCollinearPair.key ? "active" : ""}`} onClick={() => setSelectedCollinearPairKey(detail.key)}>{detail.series[0].label} · {detail.series[1].label}</button>;
                          })}
                        </div>
                      )}
                      <p className="muted" style={{ fontSize: "11px", margin: "10px 0 0" }}>
                        {selectedCollinearPair.unitLabel === tx("노출수", "impressions")
                          ? tx("이 CSV에서 두 채널은 소진액이 아닌 노출수로 매핑되어 있습니다. 따라서 아래에는 실제 모델 입력값인 노출수를 표시합니다.", "These channels are mapped as impressions, not spend, in this CSV. The chart shows the actual model input: impressions.")
                          : tx("아래는 두 채널에 매핑된 주별 소진액입니다.", "The chart below shows the weekly spend mapped to the two channels.")}
                      </p>
                      <CollinearPairInputChart labels={mmm.panel.weekLabel || mmm.panel.week} pair={selectedCollinearPair} locale={locale} />
                    </Card>
                  )}
                  {(mmm.run.baselineSelection?.enabled || Array.isArray(mmm.run.seasonalityPeriods) || mmm.run.mediaPenaltySelection?.enabled || mmm.run.jointTransform?.enabled) && <p className="muted" style={{ fontSize: "11px", lineHeight: 1.5, margin: "8px 0 0" }}>
                    {mmm.run.baselineSelection?.enabled ? tx(`Baseline은 78주 이상 데이터에서 0·1·2개 knot 후보를 비교했으며, BIC가 ${mmm.run.baselineSelection.selected ? "충분히 개선되어 적용" : "충분히 개선되지 않아 기본 추세 유지"}되었습니다.`, `With at least 78 weeks, baseline compared 0/1/2-knot candidates; the base trend was ${mmm.run.baselineSelection.selected ? "replaced because BIC improved materially" : "retained because improvement was not material"}.`) : ""}
                    {mmm.run.seasonalitySelection?.enabled ? ` ${mmm.run.seasonalitySelection.evidence?.detected
                      ? tx(`계절성은 최근 12주 예측과 분리했습니다. 전체 ${mmm.run.seasonalitySelection.evidence.observedWeeks}주에서 Brand/Performance 집계 매체·이벤트·추세를 통제한 뒤, 연간 파형 후보의 BIC가 ${Number(mmm.run.seasonalitySelection.evidence.bicImprovement).toFixed(1)} 개선되고 52주 간 파형 상관이 ${Number(mmm.run.seasonalitySelection.evidence.seasonalLagCorrelation).toFixed(2)}로 유지됐습니다. ${mmm.run.seasonalitySelection.evidence.regularizationSelection?.enabled ? `규제 강도 4개를 자동 비교했고, rolling 개선 ${Number(mmm.run.seasonalitySelection.evidence.regularizationSelection.meanImprovement).toFixed(3)}%p가 채택 기준 ${Number(mmm.run.seasonalitySelection.evidence.regularizationSelection.requiredImprovement).toFixed(3)}%p를 ${mmm.run.seasonalitySelection.evidence.regularizationSelection.accepted ? "넘어 규제형을 채택" : "넘지 못해 기존 annual-4를 유지"}했습니다.` : `실제 연도 반복성은 ${Number(mmm.run.seasonalitySelection.evidence.observedRecurrenceScale).toFixed(2)}배 강도로 보수 조정했습니다.`}`, `Seasonality is separated from recent 12-week forecasting. Across all ${mmm.run.seasonalitySelection.evidence.observedWeeks} weeks, after controlling for aggregated Brand/Performance media, events, and trend, the annual-shape candidate improved BIC by ${Number(mmm.run.seasonalitySelection.evidence.bicImprovement).toFixed(1)} and retained ${Number(mmm.run.seasonalitySelection.evidence.seasonalLagCorrelation).toFixed(2)} 52-week shape correlation. ${mmm.run.seasonalitySelection.evidence.regularizationSelection?.enabled ? `Four fixed regularization strengths were compared automatically; the ${Number(mmm.run.seasonalitySelection.evidence.regularizationSelection.meanImprovement).toFixed(3)}pp rolling improvement ${mmm.run.seasonalitySelection.evidence.regularizationSelection.accepted ? "cleared" : "did not clear"} the ${Number(mmm.run.seasonalitySelection.evidence.regularizationSelection.requiredImprovement).toFixed(3)}pp acceptance threshold.` : `Observed recurrence conservatively adjusted strength to ${Number(mmm.run.seasonalitySelection.evidence.observedRecurrenceScale).toFixed(2)}.`}`)
                      : tx(`실제 연도별 RR 흐름의 반복성이 충분하지 않아 계절성을 미사용으로 판정했습니다. 두 해의 실제 잔여 흐름 상관은 ${Number(mmm.run.seasonalitySelection.evidence?.observedRecurrence?.observedYearCorrelation ?? NaN).toFixed(2)}, 부호 일치율은 ${(Number(mmm.run.seasonalitySelection.evidence?.observedRecurrence?.signAgreement ?? NaN) * 100).toFixed(0)}%, 최저점 시기 차이는 ${Number(mmm.run.seasonalitySelection.evidence?.observedRecurrence?.troughShiftWeeks ?? NaN).toFixed(0)}주였습니다. 모델이 만든 52주 반복 곡선은 이 판정에 사용하지 않았습니다.`, `Seasonality was not used because the observed year-to-year RR pattern was not stable enough. The correlation between the two years of residual RR was ${Number(mmm.run.seasonalitySelection.evidence?.observedRecurrence?.observedYearCorrelation ?? NaN).toFixed(2)}, sign agreement was ${(Number(mmm.run.seasonalitySelection.evidence?.observedRecurrence?.signAgreement ?? NaN) * 100).toFixed(0)}%, and the trough timing differed by ${Number(mmm.run.seasonalitySelection.evidence?.observedRecurrence?.troughShiftWeeks ?? NaN).toFixed(0)} weeks. The model-generated 52-week curve was not used for this decision.`)}` : mmm.run.seasonalityPeriods?.length ? ` ${tx(`현재 ${mmm.panel.week.length}주 이력은 계절성 자동 판정 최소 96주에 못 미쳐, 연간 ${mmm.run.seasonalityPeriods.length}차 계절성을 기본값으로 유지했습니다. 최근 12주 오차로 계절성을 제거하지 않습니다.`, `The current ${mmm.panel.week.length}-week history is shorter than the 96-week minimum for automatic seasonality selection, so the annual ${mmm.run.seasonalityPeriods.length}-harmonic baseline remains active. Recent 12-week error does not remove seasonality.`)}` : ` ${tx("계절성 자동 판정이 비활성화되어 현재 설정을 유지했습니다.", "Automatic seasonality assessment is disabled, so the current configuration was retained.")}`}
                    {mmm.run.mediaPenaltySelection?.enabled ? ` ${tx(`매체 계수 규제는 최근 ${mmm.run.mediaPenaltySelection.selected.folds}개 12주 구간을 당시 실제 지출로 순방향 검증해 ${mmm.run.mediaPenaltySelection.selected.mediaPenalty.toFixed(2)}를 선택했습니다. 최저 오차와 사실상 동률이면 더 보수적인 값을 유지하므로, 기여를 크게 보이게 하려고 낮춘 값이 아닙니다.`, `Media regularization was selected as ${mmm.run.mediaPenaltySelection.selected.mediaPenalty.toFixed(2)} using forward validation across ${mmm.run.mediaPenaltySelection.selected.folds} recent 12-week windows with actual spend. Near ties retain the more conservative value, so this is not tuned to inflate contribution.`)}` : ""}
                    {mmm.run.jointTransform?.enabled ? ` ${tx(`변환 불확실성이 큰 ${mmm.run.jointTransform.channels.length}개 채널만 최대 ${mmm.run.jointTransform.candidateCount}개 조합을 점검했습니다. 이 결과는 계수를 자동 교체하지 않고 변환 상호작용 진단으로만 사용합니다.`, `Only ${mmm.run.jointTransform.channels.length} channels with the most transform uncertainty were checked across at most ${mmm.run.jointTransform.candidateCount} combinations. This is a diagnostic and does not automatically replace coefficients.`)}` : ""}
                  </p>}
                  {health.flags?.length > 0 ? (
                    <div className="callout warn" style={{ margin: "10px 0 0" }}>
                      <div className="ico">!</div><div className="body"><strong>{tx(`모델 경고 ${health.flags.length}건`, `${health.flags.length} model warnings`)}</strong>
                        <ul style={{ margin: "6px 0 0", paddingLeft: "18px", fontSize: "11.5px", lineHeight: 1.55 }}>
                          {health.flags.map((flag) => <li key={`${flag.key}-${flag.severity}`}><b>{flag.severity === "fail" ? tx("주의", "High") : tx("점검", "Check")}</b> · {mmmHealthFlagMessage(flag.key, locale)}</li>)}
                        </ul>
                      </div>
                    </div>
                  ) : <p style={{ margin: "10px 0 0", color: "#22c55e", fontSize: "11.5px" }}>{tx("현재 자동 건강 진단에서 추가 경고가 발견되지 않았습니다.", "No additional warnings were found by the automated health checks.")}</p>}
                  <p className="muted" style={{ fontSize: "11px", lineHeight: 1.55, margin: "10px 0 0" }}>
                    {tx("이 모델은 Gaussian posterior를 행렬식으로 계산하고 MCMC chain을 샘플링하지 않으므로 R-hat·ESS는 적용되지 않습니다. 이는 Meridian의 NUTS 샘플링 진단과 같은 검사가 아닙니다.", "This model computes a Gaussian posterior analytically and does not sample MCMC chains, so R-hat and ESS do not apply. This is not the same diagnostic as Meridian's NUTS sampling checks.")}
                    {mmm.countryValidationMode === "as-of-earliest-fold" ? ` ${tx("국가 prior 후보 검증은 가장 이른 학습 cutoff의 타깃 변환·Y 스케일·참고국 근거를 모든 fold에 고정합니다. 이후 정보 누수는 막지만, 같은 folds로 후보를 골랐으므로 최종 독립 OOS는 아닙니다.", "Country-prior candidate checks lock target transforms, Y scale, and reference evidence from the earliest training cutoff across every fold. This prevents later-information leakage, but the folds also select the candidate and are therefore not a final independent OOS score.")}` : ""}
                    {mmm.countryPlan?.capped ? ` ${tx(`브라우저 안정성을 위해 ${mmm.countryPlan.totalCountries}개 중 최대 ${mmm.countryPlan.maxReferenceFits}개 참고 국가만 1차 적합했습니다.`, `For browser stability, first-stage fits were capped at ${mmm.countryPlan.maxReferenceFits} of ${mmm.countryPlan.totalCountries} reference markets.`)}` : ""}
                  </p>
                </section>
              )}
              {/* ── 메인: 평어 헤드라인 ── */}
              <Card style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <Badge color="#7aa2f7">{tx("기여 분해", "Contribution")}</Badge>
                <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-1)" }}>{headline}</span>
              </Card>
              {(mmm.panel.externalDefs || []).length > 0 && (
                <p className="muted" style={{ margin: "-5px 0 12px", fontSize: "11.5px", lineHeight: 1.5 }}>
                  {tx("업계 현황은 원시 설치·매출 수가 아니라, 해당 지수의 평소 대비 상대 변화(log index)를 기준으로 우리 KPI에 미친 추정 변화만 표시합니다. 따라서 시장 전체 설치 수를 그대로 우리 성과로 더하지 않습니다.", "Industry controls use only relative change from their normal level (log index), not raw market installs or revenue. The chart shows the estimated change in this KPI, not the market total added directly to your result.")}
                </p>
              )}

              {/* ── 메인: 무엇이 성과를 움직였나 — RMS 기여 크기 비중 ── */}
              <section className="block">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                  <h2 className="section-title" style={{ margin: 0 }}>{tx("무엇이 성과를 움직였나", "What moved performance")} <span style={{ fontSize: "12px", color: MUTED, fontWeight: 400 }}>{tx("· RMS 기여 크기 비중", "· RMS contribution-magnitude share")}</span></h2>
                  <div className="ab-pillgroup" style={{ margin: 0 }} aria-label={tx("기본 수요·추세 포함 여부", "Include base demand and trend")}>
                    <span className="ab-pillgroup-label">{tx("기본 수요·추세", "Base demand · trend")}</span>
                    <button type="button" className={`ab-pill ${includeBaseDemandInShare ? "active" : ""}`} onClick={() => setIncludeBaseDemandInShare(true)}>{tx("포함", "Include")}</button>
                    <button type="button" className={`ab-pill ${!includeBaseDemandInShare ? "active" : ""}`} onClick={() => setIncludeBaseDemandInShare(false)}>{tx("제외", "Exclude")}</button>
                  </div>
                </div>
                {shRows.length ? (
                  // 단일 grid — 라벨 열 폭을 전 행 공유(max-content)해 가장 긴 변수명에 맞춰 정렬, 막대 시작점 일치.
                  <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr 44px", alignItems: "center", columnGap: "10px", rowGap: "8px", marginTop: "6px" }}>
                    {shRows.map((r) => (
                      <React.Fragment key={r.driver}>
                        <span style={{ fontSize: "12.5px", textAlign: "left", color: "var(--text-1)", whiteSpace: "nowrap" }} title={r.driver}>{plainDrv(r.driver)}</span>
                        <div style={{ background: "var(--bg-1)", borderRadius: "6px", height: "20px", minWidth: 0 }}>
                          <div style={{ width: `${Math.round((r.pct || 0) / maxPct * 100)}%`, minWidth: "2px", background: barColor(r.driver), height: "100%", borderRadius: "6px" }}></div>
                        </div>
                        <span style={{ fontSize: "12.5px", fontWeight: 600, textAlign: "right" }}>{(r.pct || 0).toFixed(0)}%</span>
                      </React.Fragment>
                    ))}
                  </div>
                ) : <p className="muted" style={{ fontSize: "12px" }}>{tx("계산할 수 없어요.", "Can't compute this.")}</p>}
                    <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{includeBaseDemandInShare
                      ? tx("각 드라이버의 주별 기여값 제곱평균을 전체 합으로 나눈 크기 비중입니다. 인과 기여율이나 Shapley R²가 아니며, 진한 보라 = 광고 채널입니다.", "Each share is the driver's mean squared weekly contribution divided by the total. It is not causal attribution or Shapley R². Dark purple = ad channels.")
                      : tx("기본 수요·추세를 분모와 표시에서 제외하고, 남은 드라이버만 다시 100%로 정규화했습니다. 모델과 원본 기여값은 바뀌지 않습니다.", "Base demand · trend is removed from both the display and denominator; remaining drivers are re-normalized to 100%. The model and raw contributions do not change.")}</p>
              </section>

              {/* ── 메인: 다음 예산은 여기로 (액션 카드) ── */}
              {!budgetEligible ? (
                <div className="callout warn" style={{ marginBottom: "12px" }}>
                  <div className="ico">!</div><div className="body"><strong>{identification.priorScaleConverged === false
                    ? tx("예산 추천 보류 — 잔차분산·prior penalty 반복이 수렴하지 않았습니다", "Budget recommendation paused — residual-scale/prior-penalty iteration did not converge")
                    : tx("예산 추천 보류 — 채널 효과가 식별되지 않았습니다", "Budget recommendation paused — channel effects are not identified")}</strong><p>{unresolvedCollinearity
                    ? tx("채널 지출과 구조변화가 거의 같이 움직이지만 어느 변수를 제거할지 지정되지 않았습니다. 앱은 임의로 제거하지 않으며, 독립적인 지출 변동 또는 실험 근거가 필요합니다.", "Channel spend and a regime-change variable move almost identically, but no variable was chosen for removal. The app does not remove one arbitrarily; independent spend variation or experimental evidence is needed.")
                    : identification.priorScaleConverged === false
                      ? tx("잔차분산과 외부 prior penalty가 서로 의존해 고정점으로 반복 계산했지만 안정값에 도달하지 못했습니다. 아래 효과·반응곡선은 진단용으로만 보고 예산 순위에는 쓰지 마세요.", "The fixed-point iteration between residual variance and external-prior penalty did not reach a stable value. Treat the effects and response curves below as diagnostic only, not as a budget ranking.")
                      : tx("기간 대비 파라미터가 많거나 채널 간 상관이 높아 예산 순위를 신뢰하기 어렵습니다. 아래 반응곡선은 진단용으로만 보세요.", "There are too many parameters for the time span or media correlation is too high to trust a budget ranking. Treat the response curves below as diagnostic only.")}</p></div>
                </div>
              ) : ranked.length > 0 ? (
                <section className="block" style={{ border: "2px solid var(--primary, #adc6ff)" }}>
                  <h2 className="section-title">{isRankingAmbiguous
                    ? tx("🎯 증액 후보군 — 우열 불명확", "🎯 Increase candidates — no clear winner")
                    : tx("🎯 다음 예산 우선 후보", "🎯 First candidate for the next budget")} <span style={{ fontSize: "12px", color: MUTED, fontWeight: 400 }}>{tx(`· 지금 지출에서 +${marginalStepLabel}당 늘어나는 ${tgtKo}와 90% 구간`, `· extra ${tgtKo} and 90% interval per +${marginalStepLabel} at current spend`)}</span></h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {decisionCandidates.map((s, i) => (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: !isRankingAmbiguous && i === 0 ? "rgba(122,162,247,0.1)" : "transparent", borderRadius: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: !isRankingAmbiguous && i === 0 ? "#7aa2f7" : MUTED, minWidth: "20px" }}>{isRankingAmbiguous ? "•" : i + 1}</span>
                        <span style={{ flex: 1, fontSize: "14px", fontWeight: !isRankingAmbiguous && i === 0 ? 700 : 400 }}>{s.label}</span>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "#22c55e" }}>{targetValueLabel(s.curMarg, { sign: true })} <small style={{ color: MUTED, fontWeight: 400 }}>[{targetValueLabel(s.marginalCi[0])} ~ {targetValueLabel(s.marginalCi[1])}]</small></span>
                        <span style={{ fontSize: "12px", color: MUTED }}>{tx(`현 ${spendLabel(s.recentMean || 0)}/주`, `now ${spendLabel(s.recentMean || 0)}/wk`)}</span>
                      </div>
                    ))}
                  </div>
                  {ranked.length > decisionCandidates.length && <p className="muted" style={{ fontSize: "10.5px", margin: "6px 0 0" }}>{tx(`그 외 gate 통과 채널 ${ranked.length - decisionCandidates.length}개는 상위 후보와 구간이 겹치지 않아 우선 후보군에서 제외했습니다.`, `${ranked.length - decisionCandidates.length} other gate-passing channel(s) do not overlap the top interval and are excluded from the first-priority candidate set.`)}</p>}
                  <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{isRankingAmbiguous
                    ? tx("상위 후보들의 90% 한계효과 구간이 겹쳐 단일 1위를 정하지 않았습니다. 후보군을 유지하고 추가 실험으로 구분하세요.", "Top candidates have overlapping 90% marginal-effect intervals, so no single winner is declared. Keep the candidate set and distinguish it with an additional experiment.")
                    : tx("양수 확률·채널별 데이터 충분성·식별 gate를 통과하고 90% 한계효과 구간도 0보다 큰 후보입니다. 관측 회귀 기반 가설이므로 점진적으로 변경하고 홀드아웃으로 확인하세요.", "This candidate passes positive-probability, channel-data, and identification gates, and its 90% marginal-effect interval stays above zero. It remains an observational hypothesis; change gradually and confirm with a holdout.")}</p>
                </section>
              ) : (
                <div className="callout warn" style={{ marginBottom: "12px" }}>
                  <div className="ico">!</div><div className="body"><strong>{tx("예산 추천 보류 — 채널별 근거가 부족합니다", "Budget recommendation paused — channel-level evidence is insufficient")}</strong><p>{tx("효과 양수 확률, 최근 20주 이상 집행, 지출 변동, 최근 활동, 변환된 관측 노출 범위, 90% 한계효과 구간을 모두 통과한 채널이 없습니다. 점추정 순위를 액션으로 사용하지 마세요.", "No channel passes all gates for positive probability, at least 20 active weeks, spend variation, recent activity, transformed observed-exposure range, and a 90% marginal-effect interval above zero. Do not turn point-estimate rankings into action.")}</p></div>
                </div>
              )}

              {/* 기간 전체에서 실제로 집행된 주만 평균낸 채널별 모델 성과 — 상세 아코디언 밖에 고정. */}
              {weeklyChannelPerformance.length > 0 && (
                <section className="block mmm-weekly-performance" id="s-mmm-weekly-performance">
                  <div className="mmm-weekly-performance__head">
                    <div>
                      <h2 className="section-title">{tx("채널별 주 평균 성과", "Average weekly channel performance")}</h2>
                      <p>{tx(
                        "해당 기간 실제 집행액을 MMM 곡선에 넣어 계산한 채널별 평균입니다. 지출이 없던 채널은 제외합니다.",
                        "Each row applies the period's actual spend to the MMM curve. Channels without spend are excluded.",
                      )}</p>
                    </div>
                    <span className="mmm-weekly-performance__note">{tx("모델 예측치", "Model estimate")}</span>
                  </div>
                  <div className="table-wrap">
                    <table className="data mmm-data-table">
                      <thead>
                        <tr>
                          <th>{tx("채널", "Channel")}</th>
                          <th>{tx("집행 주", "Active weeks")}</th>
                          <th>{tx("평균 지출/주", "Avg. spend/wk")}</th>
                          <th>{tx(`예측 ${tgtKo}/주`, `Predicted ${tgtKo}/wk`)}</th>
                          <th>{mmm.target === "Revenue" ? tx("예측 ROAS", "Predicted ROAS") : tx("예측 CPR", "Predicted CPR")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyChannelPerformance.map((row) => {
                          const efficiency = mmm.target === "Revenue"
                            ? row.avgWeeklySpend > 0 && row.avgWeeklyPredicted > 0 ? row.avgWeeklyPredicted / row.avgWeeklySpend : null
                            : row.predictedCpr;
                          return (
                            <tr key={row.key} style={row.posteriorPositive != null && row.posteriorPositive < 0.8 ? { opacity: 0.62 } : undefined}>
                              <td><strong>{row.label}</strong></td>
                              <td className="tnum">{row.activeWeeks}{tx("주", " wk")}</td>
                              <td className="tnum">{spendLabel(row.avgWeeklySpend)}</td>
                              <td className="tnum">{row.avgWeeklyPredicted > 0 ? targetValueLabel(row.avgWeeklyPredicted) : "—"}</td>
                              <td className="tnum mmm-data-table__metric">
                                {efficiency == null ? "—" : mmm.target === "Revenue" ? `${fmtOne(efficiency)}x` : spendLabel(efficiency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mmm-weekly-performance__foot">{tx(
                    "예측 가입은 전체 가입을 채널마다 나눈 값이 아니라, 각 채널 지출이 모델에서 만든 기여도입니다. 관측 기반 추정이므로 증분 확정은 홀드아웃으로 확인하세요.",
                    "Predicted results are channel contributions, not the total outcome copied into every row. This is observational; confirm incrementality with a holdout.",
                  )}</p>
                </section>
              )}

              {/* ── 아코디언 A: 실제 vs 모델 (fit + 드라이버 분해 + 튀는 주) ── */}
              <details className="block" onToggle={onAccordionToggle}>
                <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--primary, #adc6ff)", padding: "4px 0" }}>{tx("실제 성과와 모델이 얼마나 맞나? — 실제 vs 모델 그래프 · 드라이버 분해 · 튀는 주", "How well does the model match actual performance? — actual vs. model graph · driver breakdown · spikes")}</summary>
                <div style={{ marginTop: "12px" }}>
                  <div className="ab-pillgroup" style={{ marginBottom: "10px" }}>
                    <span className="ab-pillgroup-label">{tx("모델", "Model")}</span>
                    <span className="ab-pill active">Empirical-Bayes MMM</span>
                  </div>
                  {decomp ? (
                    <>
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "10px" }}>
                        <div className="stat-card"><div className="lbl">{tx("평균 오차(RMSE)", "Average error (RMSE)")}</div><div className="val">±{targetValueLabel(decomp.rmse)}</div></div>
                        <div className="stat-card"><div className="lbl">{tx("평균 오차율(MAPE)", "Average error rate (MAPE)")}</div><div className="val">{decomp.mape}%</div></div>
                        {mmm.run.backtest && <div className="stat-card"><div className="lbl">{tx("시간순 OOS MAPE", "Time-ordered OOS MAPE")}</div><div className="val">{mmm.run.backtest.mape.toFixed(1)}%</div></div>}
                        <div className="stat-card"><div className="lbl">{tx("전체 기간 평균", "Full-period average")}</div><div className="val">{targetValueLabel(decomp.baseline)}</div></div>
                      </div>
                      <p className="muted" style={{ fontSize: "11px", marginBottom: "6px" }}>{tx('실제(회색)와 모델(파랑)이 가까울수록 잘 맞은 거예요. 점선(시즌·추세 등)은 광고와 무관한 부분만 뽑아낸 흐름이라 시간에 따라 움직여요 — "전체 기간 평균"(고정값)과는 다른 선입니다.', 'The closer actual (gray) and model (blue) are, the better the fit. The dashed line (season/trend etc.) is the ad-unrelated portion only and moves over time — different from the fixed "full-period average" line.')}</p>
                      <div className="chart-container" style={{ height: "240px", marginBottom: "12px" }}><canvas ref={fitRef}></canvas></div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
                        <h3 className="section-title" style={{ fontSize: "13.5px", margin: 0 }}>{tx("매주 성과는 무엇으로 이뤄졌나", "What made up each week's performance")} <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>{tx("· 자동 분류한 그룹별 기여", "· automatically classified contribution groups")}</span></h3>
                        <button
                          className="ab-pill"
                          title={tx("차트와 같은 주별 그룹 기여값을 내려받아 Excel에서 차트를 만들 수 있습니다.", "Download the weekly group values behind this chart for Excel.")}
                          onClick={() => {
                            csvDownload(`mmm_weekly_group_contribution_${mmm.target}_${_today()}.csv`, buildContributionGroupCsv(decomp, mmm.panel.weekLabel, groupPanels));
                            trackProductEvent("result_downloaded", { tool_id: "5-18", source: "weekly_group_contribution", download_type: "csv", locale });
                          }}
                        >
                          {tx("⬇ 차트 데이터 CSV", "⬇ Chart data CSV")}
                        </button>
                      </div>
                      <p className="muted" style={{ fontSize: "11px", marginBottom: "6px", lineHeight: 1.5 }}>
                        {tx("채널은 직접 노출하지 않고", "Channels are not shown directly. Instead,")} <b>{tx("마케팅·브랜딩", "Performance and Brand")}</b>{tx("으로 자동 묶습니다. 기본 수요·추세는 양수 레벨이 오르내리는 값이고, 휴일·이벤트·시즌·계절·구조 변화는 기준선 대비 음수도 표시합니다.", ", Performance and Brand. Base demand · trend is a positive level that rises or falls; Holidays & Events, Seasonality, and Regime change can be negative versus that level.")}
                      </p>
                      {negAlert && (
                        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "9px 12px", marginBottom: "8px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: "8px" }}>
                          <span style={{ fontSize: "15px" }}>⚠️</span>
                          <span style={{ fontSize: "12px", color: "var(--text-1)", lineHeight: 1.5 }}>
                            {tx("주", "In week")} <b>{String(negAlert.lbl)}</b>{tx(`에 `, ", ")}<b style={{ color: bucketMeta[negAlert.bucket]?.tone }}>{negAlert.bLabel}</b>{tx("가 성과를 크게 끌어내렸어요 (약 ", " pulled performance down significantly (about ")}{targetValueLabel(negAlert.val)}{tx(").", ").")}
                            {negAlert.domG && negAlert.domV < 0 ? <> {tx("주 원인은", "The main cause was")} <b>{plainDrv(negAlert.domG)}</b> ({targetValueLabel(negAlert.domV)}){tx("예요.", ".")}</> : null}
                            {negAlert.bucket === "media" ? tx(" 광고가 오히려 마이너스로 잡히면 노이즈·공선일 수 있으니 아래 상세를 확인하세요.", " If ads register as negative, it could be noise or collinearity — check the detail below.") : ""}
                          </span>
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {groupPanels.map((group) => (
                          <section key={group.key} style={{ borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                            <h4 style={{ margin: "0 0 3px", fontSize: "12px", color: "var(--text-1)" }}>{group.label}</h4>
                            <ContributionGroupPanel
                              label={group.label}
                              values={group.values}
                              labels={decomp.weeks.map((w, i) => mmm.panel.weekLabel?.[i] || w.week)}
                              color={groupPanelPalette[group.key] || "#85B7EB"}
                              locale={locale}
                              formatValue={targetValueLabel}
                            />
                          </section>
                        ))}
                      </div>
                      <div className="table-wrap" style={{ marginTop: "12px" }}>
                        <table className="data mmm-data-table">
                          <thead><tr><th>{tx("성장 요인", "Driver")}</th><th>{decomp.level ? tx("평균 기여", "Average contribution") : tx("주별 변동", "Weekly swing")}</th><th>{tx("광고 변수", "Ad variable")}</th></tr></thead>
                          <tbody>
                            {decomp.driverStats.map((d) => (
                              <tr key={d.name}>
                                <td><strong>{plainDrv(d.name)}</strong></td>
                                <td className="tnum mmm-data-table__metric">{decomp.level ? targetValueLabel(d.avg, { sign: true }) : `±${targetValueLabel(d.swing, { perWeek: true })}`}</td>
                                <td><span className={`mmm-data-table__tag ${d.media ? "is-media" : ""}`}>{d.media ? tx("광고", "Ad") : tx("비광고", "Non-ad")}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {decomp.spikes && decomp.spikes.length > 0 && (
                        <>
                          <h3 className="section-title" style={{ fontSize: "13.5px", marginTop: "16px" }}>{tx("🔎 튀는 구간", "🔎 Spikes")} <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>{tx("· 평소와 다르게 크게 벗어난 주 (메모 남기면 위 그래프에 번호로 표시)", "· weeks that deviate unusually far from normal (add a note to number them on the chart above)")}</span></h3>
                          <div className="table-wrap">
                            <table className="data" style={{ fontSize: "11.5px" }}>
                              <thead><tr><th>{tx("기간", "Period")}</th><th>{tx("기준선 대비", "vs. baseline")}</th><th>{tx("자동 진단", "Auto diagnosis")}</th><th>{tx("메모 (원인 기록)", "Note (record cause)")}</th></tr></thead>
                              <tbody>
                                {decomp.spikes.map((s) => {
                                  const lbl = mmm.panel.weekLabel && s.i != null ? mmm.panel.weekLabel[s.i] : null;
                                  const noteKey = `${mmm.target}|${s.week}`;
                                  const noteNum = decomp.spikes.filter((n) => (spikeNotes[`${mmm.target}|${n.week}`] || "").trim()).findIndex((n) => n.week === s.week) + 1;
                                  const clsLabel = s.cls === "channel"
                                    ? { txt: tx("채널 스파크", "Channel spike"), color: "#7aa2f7" }
                                    : s.cls === "baseline"
                                      ? { txt: tx("기준선·계절 변동", "Baseline/seasonal swing"), color: "#22c55e" }
                                      : { txt: tx("모델 밖(원인 입력 권장)", "Outside the model (please record a cause)"), color: "#fbbf24" };
                                  const driverTxt = s.cls === "unexplained"
                                    ? `${tx("잔차", "Residual")} ${targetValueLabel(s.residual, { sign: true })}`
                                    : `${s.domDriver} ${targetValueLabel(s.domVal, { sign: true })}`;
                                  return (
                                    <tr key={s.week}>
                                      <td>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                          {noteNum > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "16px", height: "16px", borderRadius: "50%", background: "#f59e0b", color: "#fff", fontSize: "9px", fontWeight: 700, flexShrink: 0 }}>{noteNum}</span>}
                                          <b style={{ fontSize: "12px" }}>{lbl != null ? String(lbl) : tx(`주차 ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`, `Week ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`)}</b>
                                        </span>
                                        {lbl != null && <span style={{ fontSize: "9px", color: MUTED, display: "block" }}>{tx(`주차 ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`, `Week ${mmm.panel.week?.[s.i] ?? (s.i != null ? s.i + 1 : s.week)}`)}</span>}
                                      </td>
                                      <td className="tnum" style={{ color: s.dev >= 0 ? POS : NEG }}>{targetValueLabel(s.dev, { sign: true })}</td>
                                      <td>
                                        <span style={{ color: clsLabel.color, fontWeight: 600 }}>{clsLabel.txt}</span>
                                        <span style={{ fontSize: "10px", color: MUTED }}><br />{tx("주 원인:", "Main cause:")} {driverTxt}</span>
                                      </td>
                                      <td>
                                        <input
                                          value={spikeNotes[noteKey] || ""}
                                          onChange={(e) => setSpikeNotes((n) => ({ ...n, [noteKey]: e.target.value }))}
                                          placeholder={tx("이 주에 무슨 일? (예: 앱스토어 피처드, 경쟁사 이슈)", "What happened this week? (e.g. App Store feature, competitor issue)")}
                                          style={{ width: "100%", background: "var(--bg-2)", color: "var(--text-1)", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 7px", fontSize: "11px" }}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="muted" style={{ fontSize: "12px" }}>{tx("분해를 계산할 수 없습니다(ridge 특이·데이터 부족).", "Can't compute the decomposition (ridge singularity/insufficient data).")}</p>
                  )}
                </div>
              </details>

              {/* ── 아코디언 B: 계산 상세(adstock·RMS 기여 크기·수확체감·채널효과) ── */}
              <details className="block" onToggle={onAccordionToggle}>
                <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--primary, #adc6ff)", padding: "4px 0" }}>{tx("이 숫자들은 어떻게 나왔나요? — 계산 과정 자세히 보기", "How were these numbers computed? — see the calculation in detail")}</summary>
                <div style={{ marginTop: "12px" }}>
                  <StatHead title={tx("① 채널별 광고 여운·포화", "① Per-channel carryover and saturation")} hint={tx("한 번에 한 채널씩 α × 반포화점 × Hill 기울기 profile 후보를 비교합니다. 이 표는 기본 기여·예측에 쓰는 대표 후보를 보여 주고, 아래 효과 신뢰도는 profile 후보 차이를 BIC 가중 평균합니다.", "Profile candidates compare α × half-saturation × Hill slope one channel at a time. This table shows the representative candidate used for base contribution and forecast; effect confidence below BIC-averages variation across profile candidates.")} />
                  <div className="table-wrap" style={{ marginBottom: "12px" }}>
                    <table className="data" style={{ fontSize: "11.5px" }}>
                      <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx("잔효 α", "Carryover α")}</th><th>{tx("반포화 지출점", "Half-saturation")}</th><th>{tx("포화 곡선", "Hill slope")}</th><th>{tx("변환 탐색", "Transform search")}</th><th>{tx("효과가 양수일 확률", "P(effect > 0)")}</th></tr></thead>
                      <tbody>{Object.values(mmm.run.saturationByChannel || {}).map((s) => (
                        <tr key={s.key}><td>{s.label}</td><td className="tnum">{s.params.alpha.toFixed(1)}</td><td className="tnum">{spendLabel(s.params.ec)}</td><td className="tnum">{s.params.slope.toFixed(1)}</td><td>{s.transformUncertainty?.priorLockedTransform
                          ? tx("외부 근거가 타깃 대표 변환 단위로 정렬되어 고정", "Fixed because external evidence is aligned to the target representative-transform units")
                          : tx(`${s.transformUncertainty?.candidateCount || 1}개 후보 평가`, `${s.transformUncertainty?.candidateCount || 1} candidates evaluated`)}</td><td className="tnum" style={{ color: s.posteriorPositive >= 0.8 ? NEG : MUTED }}>{(s.posteriorPositive * 100).toFixed(0)}%</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <StatHead title={tx("② Empirical-Bayes 효과 신뢰도", "② Empirical-Bayes effect confidence")} hint={tx("잔차 분산은 plug-in 추정한 조건부 Gaussian 근사입니다. 한 번에 한 채널의 adstock α·반포화점·Hill 기울기만 바꾼 profile 후보를 다시 적합하고 BIC로 가중 평균합니다. 후보마다 결론이 다르면 확률은 낮아지고 구간은 넓어집니다. 모든 채널·분산을 함께 샘플링한 joint MCMC posterior는 아니며, 80% 이상도 holdout 전 인과·증분 확정이 아닙니다.", "This is a conditional Gaussian empirical-Bayes approximation with plug-in residual variance. Profile candidates change one channel's adstock α, half-saturation, and Hill slope at a time, refit the model, and receive BIC weights. Disagreement lowers probability and widens the interval. This is not a jointly sampled all-channel and variance MCMC posterior, and even ≥80% is not causal or incremental proof before holdout validation.")} />
                  <div className="table-wrap" style={{ marginBottom: "12px" }}>
                    <table className="data" style={{ fontSize: "11.5px" }}>
                      <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx("효과 양수 확률", "P(effect > 0)")}</th><th>{tx("효과 크기", "Effect size")}</th><th>{tx("90% profile 혼합 구간", "90% profile-mixture interval")}</th><th>{tx("예산 추천", "Budget use")}</th></tr></thead>
                      <tbody>{Object.values(mmm.run.saturationByChannel || {}).map((s) => {
                        const marginal = s.incrementalAt(s.recentMean, marginalStepSource);
                        const inObservedRange = s.isIncrementInObservedRange(s.recentMean, marginalStepSource);
                        const useBudget = budgetEligible && s.budgetEligible && inObservedRange && marginal.ci?.[0] > 0;
                        return <tr key={s.key}>
                          <td title={s.transformUncertainty ? (s.transformUncertainty.priorLockedTransform
                            ? tx("실험 prior는 타깃 대표 변환으로 처리강도를 계산하고, 국가 prior는 참고국을 같은 변환으로 재적합했습니다. 따라서 이 채널의 adstock·포화 변환을 타깃 대표값에 고정하며 후보 검색 실패가 아닙니다.", "Experiment intensity is computed on the target representative transform, and reference markets are refitted on that same transform. This channel is therefore fixed to the target representative adstock/saturation values; it is not a failed candidate search.")
                            : tx(`평가 후보 ${s.transformUncertainty.candidateCount}/${s.transformUncertainty.totalCandidateCount || s.transformUncertainty.candidateCount}개${s.transformUncertainty.candidateSearchCapped ? "(브라우저 상한 적용)" : ""} · 가중 유효 후보 ${s.transformUncertainty.effectiveCandidateCount.toFixed(1)}개`, `${s.transformUncertainty.candidateCount}/${s.transformUncertainty.totalCandidateCount || s.transformUncertainty.candidateCount} candidates evaluated${s.transformUncertainty.candidateSearchCapped ? " (browser cap applied)" : ""} · ${s.transformUncertainty.effectiveCandidateCount.toFixed(1)} effective candidates`)) : undefined}><strong>{s.label}</strong>{s.transformUncertainty?.priorLockedTransform && <small style={{ display: "block", color: MUTED, fontWeight: 400 }}>{tx("타깃 변환 고정", "target transform fixed")}</small>}</td>
                          <td className="tnum" style={{ color: useBudget ? NEG : MUTED }}>{fmtOne(s.posteriorPositive * 100)}%</td>
                          <td className="tnum">{targetValueLabel(s.ln_coef, { decimals: 1 })}<small style={{ display: "block", color: MUTED }}>{tx("/변환 노출 1단위", "/ transformed-exposure unit")}</small></td>
                          <td className="tnum">[{targetValueLabel(s.ci?.[0], { decimals: 1 })}, {targetValueLabel(s.ci?.[1], { decimals: 1 })}]</td>
                          <td style={{ color: useBudget ? NEG : MUTED, fontWeight: 600 }}>{useBudget ? tx("포함", "Included") : tx("보류", "Hold")}{!useBudget && <small style={{ display: "block", fontWeight: 400 }}>{budgetGateLabel([...(s.budgetGateReasons || []), ...(!inObservedRange ? ["outside-observed-spend-range"] : []), ...(marginal.ci?.[0] <= 0 ? [tx("한계효과 구간 0 포함", "marginal interval crosses 0")] : [])])}</small>}</td>
                        </tr>;
                      })}</tbody>
                    </table>
                  </div>
                  <StatHead title={tx("③ RMS 기여 크기 비중", "③ RMS contribution-magnitude share")} hint={tx("각 드라이버의 주별 기여값 제곱평균을 전체 합으로 나눕니다. 인과 확정·설명된 R² 배분·Shapley 값이 아닙니다.", "Divides each driver's mean squared weekly contribution by the total. It is not causal attribution, allocated explained R², or a Shapley value.")} />
                  <div className="chart-container" style={{ height: "200px", marginBottom: "8px" }}><canvas ref={shapleyRef}></canvas></div>
                  <StatHead title={tx("④ 수확체감 — 더 쓰면 효과가 얼마나 꺾이나", "④ Diminishing returns — how much does effect fall as you spend more")} hint={tx("곡선이 평평해질수록 1달러당 효과가 줄어요(수확체감). ● = 지금 지출 위치. 이미 꺾인 뒤에 있으면 증액 효율이 낮다는 뜻. 점선 = 양수 효과의 확신이 낮아 예산 추천에서 보류한 채널입니다.", "The flatter the curve, the less each dollar returns (diminishing returns). ● = current spend point. If it's already past the bend, added spend is less efficient. Dashed = lower confidence in a positive effect, so the channel is held from budget recommendations.")} />
                  {/* 커스텀 채널 토글 범례 — 클릭으로 곡선+현재지출점 함께 표시/숨김(§유저: 켠 채널 점만) */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                    {Object.entries(mmm.run.saturationByChannel || {}).map(([key, s], i) => {
                      const col = MMM_MEDIA_PALETTE[i % MMM_MEDIA_PALETTE.length];
                      const off = !!satHidden[key];
                      return (
                        <button key={key} onClick={() => setSatHidden((h) => ({ ...h, [key]: !h[key] }))}
                          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 9px", borderRadius: "6px", border: "1px solid var(--border)", background: off ? "transparent" : "var(--bg-1)", color: off ? MUTED : "var(--text-1)", fontSize: "10.5px", cursor: "pointer", opacity: off ? 0.5 : 1, textDecoration: off ? "line-through" : "none" }}>
                          <span style={{ width: "9px", height: "9px", borderRadius: "2px", background: s.posteriorPositive < 0.8 ? "transparent" : col, outline: s.posteriorPositive < 0.8 ? `1px dashed ${col}` : "none", display: "inline-block" }}></span>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <div className="chart-container" style={{ height: "340px", minHeight: "340px", marginBottom: "12px" }}><canvas ref={satRef}></canvas></div>
                    <div>
                      <div className="table-wrap">
                        <table className="data mmm-data-table mmm-marginal-table">
                          <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx("최근 지출의 0.5배", "0.5× recent spend")}<small>{tx(`추가 ${marginalStepLabel}당`, `per +${marginalStepLabel}`)}</small></th><th>{tx("현재 지출", "Current spend")}<small>{tx(`추가 ${marginalStepLabel}당`, `per +${marginalStepLabel}`)}</small></th><th>{tx("최근 지출의 1.5배", "1.5× recent spend")}<small>{tx(`추가 ${marginalStepLabel}당`, `per +${marginalStepLabel}`)}</small></th></tr></thead>
                          <tbody>
                            {(() => {
                              const sbc = mmm.run.saturationByChannel || {};
                              const keys = Object.keys(sbc);
                              if (!keys.length) return <tr><td colSpan="4" style={{ color: MUTED }}>—</td></tr>;
                              const cell = (v) => (v == null ? "—" : targetValueLabel(v, { decimals: 1, sign: true }));
                              return keys.map((k) => {
                                const s = sbc[k];
                                const levels = [0.5, 1, 1.5].map((multiplier) => {
                                  const spend = (s.recentMean || 0) * multiplier;
                                  return { spend, result: s.recentMean > 0 ? s.incrementalAt(spend, marginalStepSource) : null, inObservedRange: s.isIncrementInObservedRange(spend, marginalStepSource) };
                                });
                                const neg = !s.budgetEligible || !levels[1].inObservedRange;
                                return (
                                  <tr key={k} style={neg ? { opacity: 0.55 } : undefined}>
                                    <td><strong>{s.label}</strong>{neg ? <span style={{ fontSize: "9px", color: "#fbbf24" }}> {tx("예산 보류", "budget hold")}</span> : ""}</td>
                                    {levels.map(({ spend, result, inObservedRange }, index) => <td key={index} className="tnum" style={index === 1 ? { color: "#adc6ff" } : undefined}>{result == null ? "—" : <>{cell(result.mean)}<span style={{ fontSize: "9px", color: inObservedRange ? MUTED : "#fbbf24" }}><br />[{cell(result.ci[0])} ~ {cell(result.ci[1])}]<br />@{spendLabel(spend)}{!inObservedRange ? tx(" · 외삽", " · extrapolation") : ""}</span></>}</td>)}
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                      <StatHead title={mmm.target === "Revenue" ? tx("⑤ ROAS 곡선", "⑤ ROAS curve") : tx("⑤ CPA 곡선", "⑤ CPA curve")} hint={mmm.target === "Revenue" ? tx("지출이 늘수록 같은 광고비가 만드는 매출 비율(ROAS)이 어떻게 변하는지 봅니다. 양수 효과 채널만 해석하세요.", "Shows how revenue return per spend changes as spend grows. Interpret positive-effect channels only.") : tx("지출이 늘수록 결과 1건을 만드는 비용(CPA)이 어떻게 변하는지 봅니다. 양수 효과 채널만 해석하세요.", "Shows how cost per result changes as spend grows. Interpret positive-effect channels only.")} />
                      <div className="chart-container" style={{ height: "280px", minHeight: "280px", marginBottom: "12px" }}><canvas ref={efficiencyRef}></canvas></div>
                      <p className="muted" style={{ fontSize: "10.5px", marginTop: "4px" }}>
                        <strong>{isRevenueTarget ? tx('"추가 지출당 매출"', '"incremental revenue per added spend"') : tx(`"+${marginalStepLabel}당 추가 인원"`, `"additional people per +${marginalStepLabel}"`)}</strong> = {tx("그 지출 수준에서 예산을 실무 증액 단위만큼 더할 때 늘어나는 선택 KPI와 90% profile 혼합 구간입니다(지출↑일수록 작아짐).", "the selected KPI added by one practical budget increment at that spend level, with its 90% profile-mixture interval (shrinks as spend rises).")} {isRevenueTarget ? tx("매출은 표시 통화로 환산하고 ROAS는 비율로 따로 봅니다.", "Revenue is converted to the display currency; ROAS is shown separately as a ratio.") : tx("절대 인원은 holdout, 효율(CPR)은 비용 대비 따로 봅니다.", "Absolute count needs a holdout; efficiency (CPR) is shown separately relative to cost.")}
                      </p>
                    </div>
                  </div>
                  {/* 채널별 empirical-Bayes 효과 요약 */}
                  <p style={{ fontSize: "12px", margin: "14px 0 4px" }}>{tx("채널별 효과 요약", "Per-channel effect summary")}</p>
                  <div className="table-wrap">
                    <table className="data" style={{ fontSize: "11.5px" }}>
                      <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx("현재 지출", "Current spend")}</th><th>{tx("추가 지출 효과", "Marginal effect")}</th><th>{tx("양수 확률", "P(positive)")}</th><th>{tx("판정", "Verdict")}</th></tr></thead>
                      <tbody>
                        {Object.values(mmm.run.saturationByChannel || {}).map((s) => {
                          const marginal = s.incrementalAt(s.recentMean, marginalStepSource);
                          const inObservedRange = s.isIncrementInObservedRange(s.recentMean, marginalStepSource);
                          const useBudget = budgetEligible && s.budgetEligible && inObservedRange && marginal.ci?.[0] > 0;
                          return (
                            <tr key={s.key} style={useBudget ? undefined : { opacity: 0.6 }}>
                              <td><strong>{s.label}</strong></td>
                              <td className="tnum">{spendLabel(s.recentMean)}</td>
                              <td className="tnum">{marginal == null ? "—" : <>{targetValueLabel(marginal.mean, { decimals: 1, sign: true })}/{marginalStepLabel}<small style={{ display: "block", color: MUTED }}>[{targetValueLabel(marginal.ci[0], { decimals: 1 })} ~ {targetValueLabel(marginal.ci[1], { decimals: 1 })}]</small></>}</td>
                              <td className="tnum">{fmtOne(s.posteriorPositive * 100)}%</td>
                              <td style={{ color: useBudget ? NEG : MUTED, fontWeight: 600 }}>{useBudget ? tx("예산 추천", "Recommended") : !inObservedRange ? tx("외삽 · 보류", "Extrapolation · hold") : tx("보류", "Hold")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>

              {/* ── 맨 밑: 상세 설명 문서 다운로드 ── */}
              <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                <button className="ab-button"
                  onClick={() => textDownload(`${tx("MMM_기여분해_설명", "mmm_contribution_explained")}_${mmm.target}_${_today()}.md`, buildMmmGuideDoc(mmm, tgtKo, locale))}>
                  {tx("📄 이 과정에 대한 자세한 설명이 듣고 싶으신가요? — 상세 문서 받기", "📄 Want a detailed explanation of this process? — Get the detailed document")}
                </button>
              </div>
            </>
            );
          })()}

          {/* ── STAGE ③ LAB — 회귀·미래예측(②와 같은 MMM 모델 계수로 과거 적합 + 미래 외삽) ── */}
          {stage === "lab" && (
            <section className="block" id="s-forecast">
              <h2 className="section-title">{tx("📈 예측 전용 회귀 · 미래 예측", "📈 Forecast regression · future prediction")} <span style={{ fontSize: "12px", color: MUTED, fontWeight: 400 }}>{tx("· MMM 기여 분석과 별도 모델", "· separate from MMM contribution model")}</span></h2>
              <p style={{ fontSize: "12px", color: MUTED, marginBottom: "12px", lineHeight: 1.55 }}>
                {tx("같은 CSV·매핑을 쓰되, MMM은 전체 기간 기여도를 유지하고 예측 회귀만 Cost 학습 window·추세·계절성을 12주 rolling 검증으로 고릅니다. ", "Uses the same CSV/mapping, but keeps MMM on full-history contribution analysis and selects only the forecast regression's Cost window, trend, and seasonality with rolling 12-week validation. ")}{effPlatformFilter === "all" && tx("Total은 별도 회귀하지 않고 Android·iOS 예측을 주별로 합산합니다. ", "Total is not separately regressed; it is the weekly sum of Android and iOS forecasts. ")}{tx(`아래 채널별 예산을 미래로 연장하면 선택한 목표(${mmmTargetDisplay(mmm.target, locale)})를 예측합니다 — 회색=실측·파란선=모델/예측·음영=모수·잔차 불확실성을 반영한 참고 범위(인과 보장 아님).`, `Extend the channel budgets below to forecast the selected target (${mmmTargetDisplay(mmm.target, locale)}) — gray=actual · blue=model/forecast · shading=reference range reflecting parameter and residual uncertainty, not a causal guarantee.`)}
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
                <div className="ab-pillgroup">
                  <span className="ab-pillgroup-label">{tx("모델", "Model")}</span>
                  <span className="ab-pill active">Empirical-Bayes MMM</span>
                </div>
                <div className="ab-pillgroup">
                  <span className="ab-pillgroup-label">{tx("범위", "Range")}</span>
                  <span className="ab-pill active">{tx("모수+잔차 참고 범위", "Parameter + residual reference")}</span>
                </div>
                <label style={{ fontSize: "12px", color: MUTED }}>
                  {tx("예측 기간(주):", "Forecast horizon (wk):")}{" "}
                  <input type="number" min="1" max="52" value={fcHorizon} onChange={(e) => setFcHorizon(Math.max(1, Math.min(52, parseInt(e.target.value, 10) || 1)))} style={{ width: "60px" }} />
                </label>
              </div>
              {forecast ? (
                <>
                  {forecast.isAdditiveTotal && (
                    <Card style={{ marginBottom: "12px", padding: "12px 16px" }}>
                      <strong>{tx("Total 예측 = Android 예측 + iOS 예측", "Total forecast = Android forecast + iOS forecast")}</strong>
                      <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: MUTED, lineHeight: 1.5 }}>
                        {tx("Total에 별도 Cost 회귀를 적합하지 않습니다. 아래 검증·기준선·미래 예측은 각 OS 결과를 같은 주차끼리 더한 값입니다.", "No separate Cost regression is fit for Total. Validation, baseline, and forecasts below are same-week sums of the two OS results.")}
                      </p>
                      {(forecast.components || []).map((component) => component.rollingSelection?.selected && (
                        <p key={component.platform} style={{ margin: "5px 0 0", fontSize: "11.5px", color: MUTED }}>
                          <strong>{component.platform}</strong>{` · Cost 최근 ${component.rollingSelection.selected.window}주 · rolling wMAPE ${component.rollingSelection.selected.wmape.toFixed(1)}% (기준선 ${component.rollingSelection.selected.persistenceWmape.toFixed(1)}%)`}
                        </p>
                      ))}
                    </Card>
                  )}
                  {forecast.rollingSelection?.selected && (() => {
                    const selected = forecast.rollingSelection.selected;
                    const seasonLabel = selected.spec === "cost-trend"
                      ? tx("Cost + 추세", "Cost + trend")
                      : selected.seasonalityScope === "global" && selected.seasonalityPeriods.length === 1
                        ? tx("Cost + 추세 + 전체 이력 분기 계절성", "Cost + trend + full-history quarterly seasonality")
                        : selected.seasonalityScope === "global"
                          ? tx("Cost + 추세 + 전체 이력 연간·분기 계절성", "Cost + trend + full-history annual/quarterly seasonality")
                      : selected.spec === "cost-trend-quarter"
                        ? tx("Cost + 추세 + 분기 계절성", "Cost + trend + quarterly seasonality")
                        : tx("Cost + 추세 + 연간·분기 계절성", "Cost + trend + annual/quarterly seasonality");
                    const trendLabel = selected.trendScope === "global"
                      ? selected.trendWindow === "all"
                        ? tx("전체 이력 추세", "full-history trend")
                        : tx(`최근 ${selected.trendWindow}주 추세`, `recent ${selected.trendWindow}-week trend`)
                      : tx("Cost 학습창 내 추세", "trend within Cost window");
                    const eventAdjustedLabel = selected.trendEventControls > 0
                      ? tx(`이벤트·step ${selected.trendEventControls}개 효과 제거 후`, `after controlling ${selected.trendEventControls} event/step effect(s)`)
                      : null;
                    return (
                      <Card style={{ marginBottom: "12px", padding: "12px 16px" }}>
                        <strong>{tx("자동 선택된 예측 회귀", "Auto-selected forecast regression")}</strong>
                        <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: MUTED, lineHeight: 1.5 }}>
                          {tx(`Cost 최근 ${selected.window}주 · ${seasonLabel} · ${trendLabel}${eventAdjustedLabel ? ` · ${eventAdjustedLabel}` : ""} · 12주 holdout ${selected.folds}회 · rolling wMAPE ${selected.wmape.toFixed(1)}% (기준선 ${selected.persistenceWmape.toFixed(1)}%) · 기준선 승리 ${selected.foldWins}/${selected.folds}회`, `Cost recent ${selected.window} weeks · ${seasonLabel} · ${trendLabel}${eventAdjustedLabel ? ` · ${eventAdjustedLabel}` : ""} · ${selected.folds} rolling 12-week holdouts · rolling wMAPE ${selected.wmape.toFixed(1)}% (baseline ${selected.persistenceWmape.toFixed(1)}%) · beats baseline ${selected.foldWins}/${selected.folds} times`)}
                        </p>
                        {!forecast.rollingSelection.decisionEligible && <p style={{ margin: "6px 0 0", color: "#b45309", fontSize: "11.5px" }}>{tx(`Cost 변경 판정 보류: ${(forecast.rollingSelection.decisionReasons || []).map((reason) => forecastScenarioReasonLabel(reason, tx)).join(" · ") || "rolling 검증 적격성 미충족"}`, `Cost scenario decision paused: ${(forecast.rollingSelection.decisionReasons || []).map((reason) => forecastScenarioReasonLabel(reason, tx)).join(" · ") || "rolling validation is not eligible"}`)}</p>}
                      </Card>
                    );
                  })()}
                  {!forecastScenario.eligible && (
                    <div className="callout warn" style={{ marginBottom: "12px" }}>
                      <div className="ico">!</div><div className="body">
                        <strong>{tx("기본 12주 예측은 제공하지만, 채널별 Cost 변경은 잠금", "Base 12-week forecast is available; channel Cost changes are locked")}</strong>
                        <p>{tx(`현재 예산표의 변경값은 예측에 반영하지 않습니다. ${forecastScenario.reasons.map((reason) => forecastScenarioReasonLabel(reason, tx)).join(" · ")} — 이 상태에서 광고 OFF·증액을 인과효과로 해석할 수 없습니다.`, `Budget-table edits are not applied to the forecast. ${forecastScenario.reasons.map((reason) => forecastScenarioReasonLabel(reason, tx)).join(" · ")} — do not interpret ad-off or spend increases as causal in this state.`)}</p>
                      </div>
                    </div>
                  )}
                  {forecast.scenarioWarnings?.length > 0 && (
                    <div className="callout warn" style={{ marginBottom: "12px" }}>
                      <div className="ico">!</div><div className="body">
                        <strong>{forecast.scenarioWarnings.some((w) => w.type === "negative-media-effect")
                          ? tx("음의 광고효과 또는 관측 범위 밖 예산 — OFF 시나리오를 인과효과로 해석하지 마세요", "Negative media effect or out-of-range budget — do not interpret OFF as causal")
                          : tx("관측 범위 밖 예산 — 범위 내로 제한해 계산했습니다", "Budget outside observed range — constrained to the observed range")}</strong>
                        <p>{forecast.scenarioWarnings.map((w) => w.type === "negative-media-effect"
                          ? `${String(w.key).replace("::", " · ")}: 음의 광고효과 계수(${Number(w.coefficient).toFixed(3)}) — OFF 증분효과 추정 불가`
                          : `${String(w.key).replace("::", " · ")}: ${spendValueLabel(w.requested)} (관측 ${spendValueLabel(w.min)}–${spendValueLabel(w.max)})`).join(" · ")}</p>
                      </div>
                    </div>
                  )}
                  {forecast.baselineFut?.length > 0 && (
                    <Card style={{ marginBottom: "12px", padding: "12px 16px" }}>
                      <strong>{forecastScenario.eligible
                        ? tx("광고비 0 기준선(비매체 기준 수요)", "Zero-media baseline (non-media demand)")
                        : tx("비매체 기준 수요(참고값)", "Non-media demand (reference only)")}</strong>
                      <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: MUTED, lineHeight: 1.5 }}>
                        {forecastScenario.eligible
                          ? tx("광고비를 0으로 놓았을 때 모델이 남기는 추정치입니다. 이 값은 증분 효과의 증명이 아니며, 기준선이 최근 실측보다 지나치게 낮으면 광고 OFF 효과를 식별할 수 없다는 뜻입니다.", "The model estimate left after setting media features to zero. It is not proof of incrementality; a baseline far below recent actuals means the ad-off effect is not identified from this data.")
                          : tx("기준선은 표시하지만, 현재 데이터로 광고 OFF 효과는 추정 불가입니다. 음의 기준선이 생기는 경우에는 0으로만 제한해 비현실적인 organic 수치를 만들지 않습니다.", "The baseline is shown, but ad-off impact is not estimable from the current data. A negative restored baseline is only floored at zero to avoid an impossible organic value.")}
                      </p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                        <span className="ab-pill">{tx("기준선 평균", "Baseline avg")} {targetValueLabel(forecast.baselineFut.reduce((s, v) => s + v, 0) / forecast.baselineFut.length, { perWeek: true })}</span>
                        <span className="ab-pill">{tx("현재 시나리오 평균", "Scenario avg")} {targetValueLabel(forecast.predFut.reduce((s, v) => s + v, 0) / forecast.predFut.length, { perWeek: true })}</span>
                        {forecast.baselineFloorApplied > 0 && <span className="ab-pill" style={{ borderColor: "#f59e0b", color: "#b45309" }}>{tx(`기준선 0 하한 ${forecast.baselineFloorApplied}주 적용`, `0 floor applied for ${forecast.baselineFloorApplied} week(s)`)}</span>}
                      </div>
                    </Card>
                  )}
                  {recentBacktest && (
                    <Card style={{ marginBottom: "12px", padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "baseline" }}>
                        <div><strong>{tx("미래 예측 전 최근 24주 검증", "Last-24-week check before forecasting")}</strong><p style={{ margin: "4px 0 0", fontSize: "11.5px", color: MUTED }}>{tx("앞 12주는 모델이 학습 구간을 얼마나 따라갔는지, 뒤 12주는 학습에서 제외한 뒤 당시 실제 지출로 예측한 값입니다.", "The first 12 weeks show training fit; the last 12 were excluded from training and predicted using their actual spend.")}</p></div>
                        <span className="ab-pill" style={!recentBacktest.reliable ? { borderColor: "#ef4444", color: "#b91c1c" } : undefined}>RMSE {targetValueLabel(recentBacktest.rmse)} · MAE {targetValueLabel(recentBacktest.mae)} · wMAPE {Number.isFinite(recentBacktest.wmape) ? `${recentBacktest.wmape.toFixed(1)}%` : "—"}</span>
                      </div>
                      {!recentBacktest.reliable && <div className="callout warn" style={{ marginTop: "10px" }}><div className="ico">!</div><div className="body"><strong>{tx("현재 데이터에서는 12주 예측을 신뢰할 수 없습니다", "The 12-week forecast is not reliable for this data")}</strong><p>{tx("검증 구간 wMAPE가 30%를 초과했습니다. 아래 예산 변경 시나리오는 의사결정에 사용하지 말고, 먼저 캠페인 OFF/증액 홀드아웃으로 확인하세요.", "Holdout wMAPE exceeds 30%. Do not use the budget-change scenarios for decisions until a campaign OFF/incrementality holdout confirms them.")}</p></div></div>}
                      <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}><span className="ab-pill">{tx("앞 12주: 학습 구간 적합", "First 12: training fit")}</span><span className="ab-pill" style={{ borderColor: "#f59e0b", color: "#b45309" }}>{tx("뒤 12주: 학습 제외 검증", "Last 12: held-out validation")}</span></div>
                      <MmmBacktestChart locale={locale} labels={recentBacktest.labels} actual={recentBacktest.actual} validationStartIndex={recentBacktest.validationStartIndex} variants={[{ label: tx("모델 적합·예측", "Model fit · prediction"), predicted: recentBacktest.predicted, color: "#2563eb", dash: [] }]} formatValue={targetValueLabel} />
                    </Card>
                  )}
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
                    {(() => {
                      const futAvg = forecast.predFut.reduce((a, b) => a + b, 0) / forecast.predFut.length;
                      const recentN = Math.min(8, forecast.actual.length);
                      const histAvg = forecast.actual.slice(-recentN).reduce((a, b) => a + b, 0) / recentN;
                      const chg = histAvg ? (futAvg / histAvg - 1) * 100 : 0;
                      return (
                        <>
                          <div className="stat-card"><div className="lbl">{tx("예측 평균/주", "Forecast avg/wk")}</div><div className="val">{targetValueLabel(futAvg, { perWeek: true })}</div></div>
                          <div className="stat-card"><div className="lbl">{tx(`최근 ${recentN}주 평균`, `Recent ${recentN}wk avg`)}</div><div className="val">{targetValueLabel(histAvg, { perWeek: true })}</div></div>
                          <div className="stat-card"><div className="lbl">{tx("변화", "Change")}</div><div className="val" style={{ color: chg >= 0 ? NEG : POS }}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</div></div>
                          <div className="stat-card"><div className="lbl">{forecast.isAdditiveTotal ? tx("합산 적합 R²", "Additive fit R²") : tx("모델 적합 R²", "Model fit R²")}</div><div className="val">{forecast.r2 ?? "—"}</div></div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="chart-container" style={{ height: "300px", marginBottom: "12px" }}><canvas ref={forecastRef}></canvas></div>
                  <p style={{ fontSize: "11px", color: MUTED, marginBottom: "10px" }}>
                    {tx("posterior 모수 불확실성과 잔차를 함께 반영한 근사 90% 예측 범위", "Approximate 90% predictive range combining posterior parameter uncertainty and residual noise")} · {tx("채널별 미래 예산을 수정하면 그 시나리오로 즉시 재예측됩니다(주 평균). 실제 배분·시나리오는 5-3 예산 배분 시뮬레이터를 사용하세요.", "Editing per-channel future budgets instantly re-forecasts that scenario (weekly average). For actual allocation/scenarios, use the Budget Allocation simulator (5-3).")}
                  </p>

                  {/* ── 채널별 미래 예산 편집 (수정 시 즉시 재예측) ── */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                    <button className="ab-pill" onClick={() => { setFcBudget({}); setFcStepOff({}); }}>{tx("↺ 최근 평균으로 초기화", "↺ Reset to recent average")}</button>
                    <button
                      className="ab-pill"
                      style={{ background: "#7aa2f7", color: "#0b0d12", fontWeight: 700, borderColor: "#7aa2f7" }}
                      title={tx("채널 spend를 수정하면 adstock·Hill 변환·예측이 연쇄 재계산되는 엑셀 수식 CSV", "Excel-formula CSV: editing channel spend recalculates adstock, Hill transforms, and forecasts")}
                      onClick={() => csvDownload(`mmm_forecast_${mmm.target}_${forecast.model}_${_today()}.csv`, buildForecastCsv(forecast, mmm.target, locale, sourceCurrency, displayCurrency))}
                    >
                      {tx("⬇ 살아있는 예측 CSV (수식·실측·예측)", "⬇ Live forecast CSV (formulas/actual/forecast)")}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", alignItems: "start" }}>
                    {/* 좌: 채널별 미래 예산 */}
                    <div>
                      <h3 style={{ fontSize: "13px", margin: "10px 0 6px" }}>
                        {tx("채널별 미래 예산 (주 평균)", "Future budget per channel (weekly average)")}{" "}
                        <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>{forecastScenario.eligible
                          ? tx("— 기본값 = 최근 8주 평균. 수정하면 즉시 재예측.", "— default = recent 8-week average. Edit to re-forecast instantly.")
                          : tx("— rolling 검증/식별성 미충족으로 입력 잠김. 기본 예측만 표시합니다.", "— locked because rolling validation/identification is not met. Showing base forecast only.")}</span>
                      </h3>
                      <div className="table-wrap">
                        <table className="data" style={{ fontSize: "12px" }}>
                          <thead><tr><th>{tx("채널", "Channel")}</th><th>{tx(`최근평균/주 (${displayCurrency})`, `Recent avg/wk (${displayCurrency})`)}</th><th>{tx(`미래 예산/주 (${displayCurrency})`, `Future budget/wk (${displayCurrency})`)}</th></tr></thead>
                          <tbody>
                            {forecast.chans.map((ch) => {
                              const rec = forecast.recentMean[ch.key] || 0;
                              // 잠긴 상태에서는 저장된 과거 입력값도 표시·계산에 쓰지 않는다.
                              // 표의 숫자와 실제 기본 예측이 어긋나는 것을 막는다.
                              const cur = forecastScenario.eligible ? fcBudget[ch.key] : null;
                              const sourceValue = cur != null && isFinite(cur) ? cur : rec;
                              const val = Math.round(convertCurrency(sourceValue, sourceCurrency, displayCurrency));
                              return (
                                <tr key={ch.key}>
                                  <td>{ch.label}</td>
                                  <td className="tnum" style={{ color: MUTED }}>{spendValueLabel(rec, { perWeek: true })}</td>
                                  <td>
                                    <CommaNumberInput
                                      value={val}
                                      disabled={!forecastScenario.eligible}
                                      onCommit={(n) => setFcBudget((prev) => {
                                        const next = { ...prev };
                                        if (n == null) delete next[ch.key];
                                        else next[ch.key] = Math.max(0, convertCurrency(n, displayCurrency, sourceCurrency));
                                        return next;
                                      })}
                                      style={{ width: "120px", textAlign: "right" }}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 우: 구조변화 미래 처리. 휴일·이벤트 더미는 미래 기본값 0. */}
                    <div>
                      <h3 style={{ fontSize: "13px", margin: "10px 0 6px" }}>
                        {tx("구조변화 미래 처리", "Future handling of regime changes")}{" "}
                        <span style={{ fontSize: "11px", color: MUTED, fontWeight: 400 }}>{tx("— 비우면 ", "— leave empty to ")}<strong>{tx("지속", "persist")}</strong>{tx(", N주 뒤 끔(0=즉시)", ", or turn off N weeks later (0=immediately)")}</span>
                      </h3>
                      {forecast.steps && forecast.steps.length ? (
                        <>
                          <div className="table-wrap">
                            <table className="data" style={{ fontSize: "12px" }}>
                              <thead><tr><th>{tx("항목", "Item")}</th><th>{tx("종류", "Type")}</th><th>{tx("현재", "Current")}</th><th>{tx("켜둘 미래 주", "Weeks to keep on")}</th></tr></thead>
                              <tbody>
                                {forecast.steps.map((s) => {
                                  const cur = fcStepOff[s.key];
                                  return (
                                    <tr key={s.key}>
                                      <td>{s.label}</td>
                                      <td style={{ fontSize: "11px", color: MUTED }}>{tx("구조변화", "Regime change")}</td>
                                      <td style={{ color: s.lastOn ? "#22c55e" : MUTED, fontSize: "11px" }}>{s.lastOn ? "ON" : "OFF"}</td>
                                      <td>
                                        <input
                                          type="number"
                                          min="0"
                                          placeholder={tx("지속", "persist")}
                                          value={cur != null && isFinite(cur) ? cur : ""}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setFcStepOff((prev) => {
                                              const next = { ...prev };
                                              if (v === "") delete next[s.key];
                                              else next[s.key] = Math.max(0, parseInt(v, 10) || 0);
                                              return next;
                                            });
                                          }}
                                          style={{ width: "100px", textAlign: "right" }}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <p className="muted" style={{ fontSize: "11px", marginTop: "4px" }}>
                            {tx("구조변화는 마지막 상태가 지속되며 종료는 N주로 지정합니다(예: 12). 영구 변화는 비워두세요. 날짜가 정해지지 않은 미래 휴일·이벤트 더미는 기본 0으로 둡니다.", "Regime changes persist from their last state; specify an end in N weeks (for example, 12). Leave permanent changes blank. Future holiday/event dummies without a supplied calendar default to 0.")}
                          </p>
                        </>
                      ) : (
                        <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{tx("매핑된 구조변화가 없습니다. 미래 휴일·이벤트 더미는 기본 0입니다.", "No mapped regime changes. Future holiday/event dummies default to 0.")}</p>
                      )}
                    </div>
                  </div>

                  <details style={{ marginTop: "12px" }}>
                    <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>{tx("미래 예측 상세 (기간별)", "Forecast detail (by period)")}</summary>
                    <div className="table-wrap" style={{ marginTop: "8px" }}>
                      <table className="data" style={{ fontSize: "11px" }}>
                        <thead>
                          <tr><th>{tx("기간", "Period")}</th><th>{tx("예측", "Forecast")}</th><th>{tx("하한", "Lower")}</th><th>{tx("상한", "Upper")}</th>{forecast.chans.map((c) => (<th key={c.key}>{c.label} ({displayCurrency})</th>))}</tr>
                        </thead>
                        <tbody>
                          {forecast.futLabels.map((lb, i) => (
                            <tr key={lb + i}>
                              <td>{lb}</td>
                              <td className="tnum">{targetValueLabel(forecast.predFut[i])}</td>
                              <td className="tnum">{targetValueLabel(forecast.lo[i])}</td>
                              <td className="tnum">{targetValueLabel(forecast.hi[i])}</td>
                              {forecast.chans.map((c) => (<td key={c.key} className="tnum">{spendValueLabel(forecast.futSpendByKey[c.key]?.[i])}</td>))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              ) : (
                <div className="callout warn"><div className="ico">!</div><div className="body">
                  <strong>{tx("예측 불가", "Can't forecast")}</strong>
                  <p>{forecastModel?.reason || tx("MMM 모델이 적합되지 않았거나 데이터가 변수 수보다 적습니다. 기간을 늘리거나 채널을 줄이세요.", "The MMM model didn't fit, or the data has fewer rows than variables. Extend the period or reduce channels.")}</p>
                </div></div>
              )}
            </section>
          )}
        </>
      )}
      <MmmManualDownload locale={locale} placement="footer" />
    </div>
  );
}
