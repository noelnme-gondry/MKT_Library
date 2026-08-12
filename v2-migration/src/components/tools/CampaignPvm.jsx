"use client";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Chart from "@/utils/chartGlobals";
import { useAppStore } from "@/store/useDataStore";
import { PVM_MATH } from "@/utils/pvmMath";
import { pvmGenerateDiagnosis, buildPvmResultCsv } from "@/utils/pvmExport";
import { resolvePvmCopy } from "@/utils/contentDomain";
import { getMonFilteredRows, effectiveDenomBasis } from "@/utils/dashboardAggregator";
import { checkAdditiveIdentity } from "@/utils/identityChecks";
import AnalysisDetails from "@/components/ds/AnalysisDetails";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DownloadHub from "@/components/ds/DownloadHub";
import { buildResultManifest } from "@/lib/analysis-results/resultManifest";
import CsvUploader from "@/components/CsvUploader";
import DashboardFilterBar from "@/components/dashboard/DashboardFilterBar";
import { buildComparisonRange } from "@/components/ds/DateRangePicker";
import ToolPageShell from "@/components/ToolPageShell";

// 우측 TOC — 현재 결과의 질문 순서만 노출하고 내부 섹션 번호는 숨긴다.
function buildPvmToc(C, locale) {
  return [
    { id: "s-pvm-result", title: locale === "en" ? "Overview" : "한눈에 보기" },
    { id: "s-pvm-scorecard", title: locale === "en" ? "Performance change" : "성과 변화" },
    { id: "s-pvm-channels", title: String(C.tocChannels).replace(/^§\d+\s*/, "") },
    { id: "s-pvm-campaigns", title: String(C.tocCampaigns).replace(/^§\d+\s*/, "") },
    { id: "s-pvm-creatives", title: String(C.tocCreatives).replace(/^§\d+\s*/, "") },
  ];
}

// EN 번역팩 — domain(performance/content)별 PVM_COPY(ko)를 locale="en"일 때만 오버레이.
// contentDomain.js(SSOT, 다른 컴포넌트도 참조)는 절대 불변 — 여기서 로컬 병합만 수행.
const PVM_COPY_EN = {
  performance: {
    metricLabel: null,
    levelChannel: "Channel",
    levelCampaign: "Campaign",
    levelCreative: "Creative",
    tocChannels: "By Channel",
    tocCampaigns: "By Channel · Campaign",
    tocCreatives: "By Creative",
    secChannels: "By Channel",
    secCampaigns: "By Channel · Campaign",
    secCreatives: "By Creative",
    title: "Campaign Performance Variance",
    chipMain: "Tool · Campaign Variance Detection",
    noDataSummary:
      "Uses the same creative daily CSV as Creative Analysis (5-6) — if you've already uploaded it there, it carries over automatically.",
    noDataCalloutBody: "Upload campaign efficiency data (at least 2 weeks) to analyze the causes of variance.",
    summaryLead: (ml) =>
      `Price-Volume-Mix (PVM) bridge decomposition splits the total ${ml} change exactly into channel, campaign, and creative levels (no residual).`,
    summaryLimitBody:
      "This decomposition is arithmetically exact but does not prove causation (association only). Because it's decomposed once at the finest unit (channel × campaign × creative) and rolled up, the channel, campaign, and creative views always nest exactly (sums match).",
    causationCallout:
      "This shows association, not causation. Channel, campaign, and creative are all decomposed once at the finest unit (channel × campaign × creative) and summed, so the three views always nest exactly.",
    explainerMix: "The change from budget mix shifting toward channels that are cheaper/more expensive than average.",
    explainerRate: (ml) => `The change from the channel's own ${ml} changing.`,
    shareHeader: "Result Share (P1→P2)",
    shareHeaderTitle: "The share of total results (conversions) this item accounts for — not a cost share.",
    lockCampaign: "🔒 Map the campaign_id column to see the campaign level",
    lockCreative: "🔒 Map the creative_id column to see the creative level",
    newBadgeTitle: "New creative (0 in prior period → 1+ in current period)",
    showNewLabel: "🆕 Show new creatives only (0 in prior period → 1+ in current period)",
    creativeLinkTitle: "Open creative link",
    insufficientFallback: "Map channel, cost, result (installs/actions), and date columns, and upload at least 2 weeks of data.",
    emptyCreativeRows: "No creatives to display",
  },
  content: {
    metricLabel: "Cost per Visit",
    levelChannel: "Traffic Source",
    levelCampaign: "Category",
    levelCreative: "Content",
    tocChannels: "By Traffic Source",
    tocCampaigns: "By Traffic Source · Category",
    tocCreatives: "By Content",
    secChannels: "By Traffic Source",
    secCampaigns: "By Traffic Source · Category",
    secCreatives: "By Content",
    title: "Content Traffic Variance",
    chipMain: "Tool · Content Traffic Variance Detection",
    noDataSummary:
      "Uses a content performance CSV with traffic source, date, production/distribution cost, and traffic (PV·visits) — at least 2 weeks. Category and content columns let it break down further.",
    noDataCalloutBody:
      "Upload content traffic data (at least 2 weeks) to analyze which traffic source, category, or content drove the traffic change.",
    summaryLead: (ml) =>
      `Price-Volume-Mix (PVM) bridge decomposition splits the total ${ml} change exactly into traffic source, category, and content levels (no residual).`,
    summaryLimitBody:
      "This decomposition is arithmetically exact but does not prove causation (association only). Because it's decomposed once at the finest unit (traffic source × category × content) and rolled up, the traffic-source, category, and content views always nest exactly (sums match).",
    causationCallout:
      "This shows association, not causation. Traffic source, category, and content are all decomposed once at the finest unit (traffic source × category × content) and summed, so the three views always nest exactly.",
    explainerMix: "The change from publishing/exposure mix shifting toward traffic sources that are cheaper/more expensive than average.",
    explainerRate: (ml) => `The change from the traffic source's own ${ml} changing.`,
    shareHeader: "Traffic Share (P1→P2)",
    shareHeaderTitle: "The share of total traffic (visits/PV) this item accounts for — not a cost share.",
    lockCampaign: "🔒 Map the campaign_id column to see the category level",
    lockCreative: "🔒 Map the creative_id column to see the content level",
    newBadgeTitle: "New content (0 in prior period → 1+ in current period)",
    showNewLabel: "🆕 Show new content only (0 in prior period → 1+ in current period)",
    creativeLinkTitle: "Open content link",
    insufficientFallback: "Map traffic source, cost, traffic (visits/PV), and date columns, and upload at least 2 weeks of data.",
    emptyCreativeRows: "No content to display",
  },
};

function localizePvmCopy(domain, locale) {
  const ko = resolvePvmCopy(domain);
  if (locale !== "en") return ko;
  const en = PVM_COPY_EN[domain] || PVM_COPY_EN.performance;
  return { ...ko, ...en };
}

const DAY = 86400000;

// 통화 표시 헬퍼 — index.html pvmFmtMoney 이식 (값 변환 없이 단위 기호만 전환)
// decimals: usd일 때 소수 자리 강제(CPA/CPI처럼 단가 지표는 1자리 — 예: $19.1).
// 미지정 시 기존 동작(최대 2자리) 유지.
function formatPvmMoney(v, cur, decimals, locale = "ko") {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (cur === "usd") {
    const opts = decimals != null
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : { maximumFractionDigits: 2 };
    return `${sign}$${abs.toLocaleString(undefined, opts)}`;
  }
  return `${sign}${locale === "en" ? "₩" : ""}${Math.round(abs).toLocaleString()}${locale === "en" ? "" : "원"}`;
}

// 월요일(UTC 고정) — 마감주(calendar weekBasis) 계산 기준
function getMonday(d) {
  const day = d.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  return new Date(d.getTime() - offset * DAY);
}

// 유의성 판정 규칙(§6) — index.html PVM_SIG_RULES 이식
const PVM_SIG_RULES = {
  overallFlatPct: 0.02,
  entityShareMin: 0.15,
  entityAbsFloorPct: 0.01,
};

function pvmIsOverallFlat(deltaMetric, metric1) {
  if (!metric1) return Math.abs(deltaMetric) < 1e-9;
  return Math.abs(deltaMetric) < PVM_SIG_RULES.overallFlatPct * Math.abs(metric1);
}

function pvmIsEntitySignificant(contribution, deltaMetricTotal, metric2) {
  const passShare =
    Math.abs(contribution) >= PVM_SIG_RULES.entityShareMin * Math.abs(deltaMetricTotal);
  const passFloor =
    Math.abs(contribution) >= PVM_SIG_RULES.entityAbsFloorPct * Math.abs(metric2);
  return passShare && passFloor;
}

function pvmColor(v) {
  return v >= 0 ? "#f87171" : "#22c55e";
}

// index.html buildPvmCache 이식 — 순수 계산(사이드이펙트 없음), PVM_MATH 엔진 재사용
export function buildPvmCache(csvData, state) {
  const locale = state.locale;
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const isContentDomain = state.domain === "content";
  // 대시보드 공유 CSV는 비용 표준키가 cost, PVM 전용 업로드는 spend일 수 있다.
  // 동일한 통화량을 뜻하는 이 경로에서만 spend 보조값을 만들며 원본·매핑은 건드리지 않는다.
  const rowFilter = state.periodOverride
    ? { ...state.dashboardFilter, dateStart: null, dateEnd: null }
    : state.dashboardFilter;
  const rows = getMonFilteredRows(csvData, rowFilter).map((row) => ({
    ...row,
    // PVM 엔진이 천단위 콤마/공백을 같은 계약으로 파싱하고 비정상 값은
    // NOT_IDENTIFIED로 차단한다. 여기서 Number(...)||0으로 조용히 지우지 않는다.
    spend: row.spend ?? row.cost ?? 0,
    // 대시보드의 사람이 읽는 campaign_name도 PVM 계층 키로 안전하게 쓴다.
    // 캠페인 ID가 있으면 ID가 우선이며, 소재가 없는 CSV는 여기서 캠페인 단계까지 끝난다.
    campaign_id: row.campaign_id ?? row.campaign_name,
  }));
  const mapped = new Set(
    Object.values(csvData?.mapping || {}).filter((v) => v && v !== "__ignore__"),
  );
  const hasInstalls = mapped.has("installs");
  const hasActions = mapped.has("actions");
  const bothMetricsMapped = hasInstalls && hasActions;
  // 전역 분모 기준(설치/가입) SSOT — 가입(actions)=CPA, 설치(installs)=CPI(§12.18).
  // 로컬 metric 토글은 둘 다 매핑됐을 때의 수동 오버라이드; 미매핑이면 매핑된 쪽으로 강제.
  const effBasis = effectiveDenomBasis(csvData, state.denomBasis);
  let metric = state.metric === "cpi" ? "cpi" : state.metric === "cpa" ? "cpa" : effBasis === "installs" ? "cpi" : "cpa";
  if (!bothMetricsMapped) metric = hasInstalls ? "cpi" : "cpa";
  const resultField = metric === "cpi" ? "installs" : "actions";
  const campaignMapped = mapped.has("campaign_id") || mapped.has("campaign_name");
  const creativeMapped = mapped.has("creative_id");
  const ctrMapped = mapped.has("impressions") && mapped.has("clicks");
  const weekBasis = state.weekBasis === "rolling7" ? "rolling7" : "calendar";
  const baseFields = {
    metric,
    resultField,
    bothMetricsMapped,
    ctrMapped,
    campaignMapped,
    creativeMapped,
    weekBasis,
    currency: state.currency,
  };

  const withT = rows
    .map((r) => ({
      ...r,
      _t: new Date(String(r.date) + "T00:00:00Z").getTime(),
    }))
    .filter((r) => !isNaN(r._t));
  if (!withT.length)
    return { insufficientData: true, message: tr("날짜 데이터가 없습니다.", "No date data found."), ...baseFields };

  const maxT = Math.max(...withT.map((r) => r._t));
  const minT = Math.min(...withT.map((r) => r._t));

  let thisMon = getMonday(new Date(maxT)).getTime();
  if (thisMon + 6 * DAY > maxT) thisMon -= 7 * DAY;
  const earliestMon = getMonday(new Date(minT)).getTime();

  function rangesFor(lb) {
    if (state.periodOverride?.periodA?.start && state.periodOverride?.periodB?.end) {
      return {
        p1: [
          new Date(`${state.periodOverride.periodA.start}T00:00:00Z`).getTime(),
          new Date(`${state.periodOverride.periodA.end}T00:00:00Z`).getTime(),
        ],
        p2: [
          new Date(`${state.periodOverride.periodB.start}T00:00:00Z`).getTime(),
          new Date(`${state.periodOverride.periodB.end}T00:00:00Z`).getTime(),
        ],
      };
    }
    if (weekBasis === "calendar") {
      const p2 = [thisMon, thisMon + 6 * DAY];
      const p1start = thisMon - 7 * lb * DAY;
      return { p1: [p1start, p1start + 6 * DAY], p2 };
    }
    const p2 = [maxT - 6 * DAY, maxT];
    const p1 = [p2[0] - 7 * lb * DAY, p2[1] - 7 * lb * DAY];
    return { p1, p2 };
  }

  function isLocked(lb) {
    if (state.periodOverride) return false;
    if (weekBasis === "calendar") {
      const p1start = thisMon - 7 * lb * DAY;
      return p1start < earliestMon;
    }
    const needed = maxT - 7 * (lb + 1) * DAY + DAY;
    return needed < minT;
  }

  const lockState = { 1: isLocked(1), 2: isLocked(2), 3: isLocked(3) };
  let lookback = state.lookback;
  if (lockState[lookback]) {
    const fallback = [3, 2, 1].find((lb) => !lockState[lb]);
    if (!fallback)
      return {
        insufficientData: true,
        message: tr("최소 2주치 데이터 필요", "At least 2 weeks of data required"),
        lockState,
        ...baseFields,
        lookback: state.lookback,
      };
    lookback = fallback;
  }

  const { p1, p2 } = rangesFor(lookback);
  const inRange = (t, r) => t >= r[0] && t <= r[1];
  const rowsP1 = withT.filter((r) => inRange(r._t, p1));
  const rowsP2 = withT.filter((r) => inRange(r._t, p2));
  if (!rowsP1.length || !rowsP2.length) {
    return {
      insufficientData: true,
      message: tr("선택한 기간에 데이터가 없습니다.", "No data in the selected period."),
      lockState,
      ...baseFields,
      lookback,
    };
  }

  const keys = {
    ch: "channel",
    cmp: campaignMapped ? "campaign_id" : null,
    cr: creativeMapped ? "creative_id" : null,
    resultField,
  };
  const inputContract = PVM_MATH.inspectFinestInputs(rowsP1, rowsP2, keys);
  if (!inputContract.ok) {
    const isInvalidNumeric = inputContract.code === "INVALID_NUMERIC_VALUE";
    return {
      insufficientData: true,
      analysisStatus: inputContract.status,
      reasonCode: inputContract.code,
      invalidCells: inputContract.invalidCells,
      message: isInvalidNumeric
        ? tr(
          `분해 불가: 숫자로 읽을 수 없는 비용·${isContentDomain ? "트래픽" : "전환"} 값이 비교 기간에 ${inputContract.invalidCells.length}개 있습니다. 천단위 콤마와 공백은 허용되며, 원본 값을 수정한 뒤 다시 분석하세요.`,
          `Not identified: ${inputContract.invalidCells.length} comparison cell(s) contain an invalid cost or ${isContentDomain ? "traffic" : "result"} value. Thousands separators and spaces are accepted; correct the source values and run again.`,
        )
        : tr(
          `분해 불가: 비용은 있지만 ${isContentDomain ? "트래픽" : "전환"}이 0인 항목이 비교 기간에 ${inputContract.invalidCells.length}개 있습니다. 해당 항목의 단가는 정의할 수 없어 Mix·Rate 분해를 계산하지 않았습니다.`,
          `Not identified: ${inputContract.invalidCells.length} comparison cell(s) have positive cost but zero ${isContentDomain ? "traffic" : "results"}. Their unit cost is undefined, so the Mix·Rate decomposition was not calculated.`,
        ),
      lockState,
      ...baseFields,
      lookback,
    };
  }
  const fin = PVM_MATH.decomposeFinest(rowsP1, rowsP2, keys);
  if (!fin) {
    return {
      insufficientData: true,
      message: tr(`해당 기간 전환(${resultField === "installs" ? "설치" : "액션"})이 0입니다.`, `Conversions (${resultField === "installs" ? "installs" : "actions"}) are 0 for this period.`),
      lockState,
      ...baseFields,
      lookback,
    };
  }

  // Bennet 분해는 최소 grain(채널×캠페인×소재)에서 단 한 번만 계산한다.
  // 레이어별로 다시 분해하면 각 레이어의 전체 합은 맞아도 드릴다운의 "상위 = 하위합"
  // 항등식이 깨진다. UI 레이어는 finest 셀의 단순 롤업으로만 만든다.
  const rollupLayer = (keyFn, metaOf) => PVM_MATH.rollup(
    fin.finest,
    keyFn,
    fin.Result1,
    fin.Result2,
  ).map((group) => ({ ...group, ...metaOf(group.children[0]) }));
  const layer1 = rollupLayer(
    (f) => f.chKey,
    (f) => ({ key: f.chKey, chKey: f.chKey, cmpKey: null, crKey: null }),
  );
  const layer2 = keys.cmp
    ? rollupLayer(
      (f) => `${f.chKey}\u001f${f.cmpKey}`,
      (f) => ({ key: f.cmpKey, chKey: f.chKey, cmpKey: f.cmpKey, crKey: null }),
    )
    : [];
  const layer3 = keys.cr
    ? rollupLayer(
      (f) => `${f.chKey}\u001f${f.cmpKey}\u001f${f.crKey}`,
      (f) => ({ key: f.crKey, chKey: f.chKey, cmpKey: f.cmpKey, crKey: f.crKey }),
    )
    : [];

  // Layer 2 하위합(withinMix) — 소재 합 대비 캠페인 계산 믹스
  if (keys.cmp && keys.cr) {
    for (const cmp of layer2) {
      const related = layer3.filter((cr) => cr.chKey === cmp.chKey && cr.cmpKey === cmp.cmpKey);
      const creativeSumMix = related.reduce((s, cr) => s + cr.mix, 0);
      const creativeSumRate = related.reduce((s, cr) => s + cr.rate, 0);
      cmp.creativeSumMix = creativeSumMix;
      cmp.creativeSumRate = creativeSumRate;
      cmp.withinMix = creativeSumMix - cmp.mix;
    }
  } else if (keys.cmp) {
    for (const cmp of layer2) {
      cmp.creativeSumMix = 0;
      cmp.creativeSumRate = 0;
      cmp.withinMix = 0;
    }
  }

  // Layer 1 하위합(캠페인 합)
  if (keys.cmp) {
    for (const ch of layer1) {
      const related = layer2.filter((cmp) => cmp.chKey === ch.key);
      ch.cmpSumMix = related.reduce((s, cmp) => s + cmp.mix, 0);
      ch.cmpSumRate = related.reduce((s, cmp) => s + cmp.rate, 0);
      ch.cmpSumContribution = related.reduce((s, cmp) => s + cmp.contribution, 0);
    }
  } else {
    for (const ch of layer1) {
      ch.cmpSumMix = 0;
      ch.cmpSumRate = 0;
      ch.cmpSumContribution = 0;
    }
  }

  const identity = checkAdditiveIdentity(
    fin.deltaCpa,
    layer1.map((row) => row.contribution),
  );

  // 소재 URL 맵 — 비용 최대 변형의 URL 채택
  const urlMapped = mapped.has("creative_url") && creativeMapped;
  let crUrlMap = null;
  if (urlMapped) {
    const acc = new Map();
    [...rowsP1, ...rowsP2].forEach((r) => {
      const cr = String(r.creative_id ?? "");
      const url = String(r.creative_url ?? "").trim();
      if (!cr || !url) return;
      if (!acc.has(cr)) acc.set(cr, new Map());
      const byUrl = acc.get(cr);
      const spend = PVM_MATH.parseNumericValue(r.spend);
      byUrl.set(url, (byUrl.get(url) || 0) + (Number.isFinite(spend) ? spend : 0));
    });
    crUrlMap = new Map();
    for (const [cr, byUrl] of acc) {
      let best = null,
        bestCost = -Infinity;
      for (const [url, cost] of byUrl) {
        if (cost > bestCost) {
          bestCost = cost;
          best = url;
        }
      }
      if (best) crUrlMap.set(cr, best);
    }
  }

  const ymd = (t) => new Date(t).toISOString().slice(0, 10);
  return {
    insufficientData: !identity.ok,
    analysisStatus: identity.ok ? "COMPLETE" : "NOT_IDENTIFIED",
    reasonCode: identity.ok ? null : "ADDITIVE_IDENTITY_FAILED",
    message: identity.ok
      ? null
      : tr(
        "분해 불가: Mix·Rate 합과 전체 단가 변화의 항등식이 일치하지 않아 결과를 공개하지 않았습니다.",
        "Not identified: the Mix·Rate sum did not match the total unit-cost change, so the result was withheld.",
      ),
    ...baseFields,
    urlMapped,
    lookback,
    requestedLookback: state.lookback,
    lockState,
    p1Range: [ymd(p1[0]), ymd(p1[1])],
    p2Range: [ymd(p2[0]), ymd(p2[1])],
    p2DaysCovered: rowsP2.length ? new Set(rowsP2.map((r) => r.date)).size : 0,
    finest: fin.finest,
    crUrlMap,
    rowsP1,
    rowsP2,
    CPA1: fin.CPA1,
    CPA2: fin.CPA2,
    deltaCpa: fin.deltaCpa,
    Cost1: fin.Cost1,
    Cost2: fin.Cost2,
    Result1: fin.Result1,
    Result2: fin.Result2,
    layer1,
    layer2,
    layer3,
    identity,
  };
}

// 지표 라벨 — 도메인 오버라이드(C.metricLabel)가 있으면 우선(예 content="방문당 비용"),
// 없으면(performance) 기존 CPI/CPA 반환(byte-동일).
function pvmMetricLabel(c, C) {
  if (C && C.metricLabel) return C.metricLabel;
  return c.resultField === "installs" ? "CPI" : "CPA";
}

// http/https만 허용(XSS 차단)
function pvmSafeUrl(u) {
  if (!u) return null;
  const s = String(u).trim();
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}

export default function CampaignPvm({ domain = "performance", locale = "ko" } = {}) {
  // 도메인 카피팩(라벨만) — performance=기존 문자열 byte-동일, content=콘텐츠 번역.
  // locale="en"일 때만 PVM_COPY_EN으로 오버레이(별도 축, domain 로직과 독립).
  const C = localizePvmCopy(domain, locale);
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  const pvmFmtMoney = useCallback((value, cur, decimals) => formatPvmMoney(value, cur, decimals, locale), [locale]);
  const csvData = useAppStore((state) => state.csvData);
  const denomBasis = useAppStore((state) => state.denomBasis);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  // 전역 통화(₩/$) SSOT 구독 — 토글 UI는 Header(브레드크럼 옆) 하나뿐(디자인시스템,
  // 도구별 중복 토글 금지). 여기선 표시 포맷에만 사용.
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const analysisHandoff = useAppStore((state) => state.analysisHandoff);
  const clearAnalysisHandoff = useAppStore((state) => state.clearAnalysisHandoff);
  // 전역 분모 기준(설치/가입) → 지표(가입=CPA, 설치=CPI). §12.18 SSOT 구독.
  const effBasis = effectiveDenomBasis(csvData, denomBasis);
  const basisMetric = effBasis === "installs" ? "cpi" : "cpa";
  // 지표는 전역 기준을 기본값으로 파생 — 사용자 pill은 수동 오버라이드(null=전역 따름).
  // 전역 기준이 flip되면 오버라이드를 렌더 중 리셋(React sanctioned reset-on-change 패턴, 이펙트 불필요).
  const [metricOverride, setMetricOverride] = useState(null);
  const [lastBasisMetric, setLastBasisMetric] = useState(basisMetric);
  if (basisMetric !== lastBasisMetric) {
    setLastBasisMetric(basisMetric);
    setMetricOverride(null);
  }
  const metric = metricOverride ?? basisMetric;
  const setMetric = setMetricOverride;
  const [weekBasis, setWeekBasis] = useState("calendar");
  const [lookback, setLookback] = useState(1);
  const [periodOverride, setPeriodOverride] = useState(null);
  const dashboardPeriodOverride = useMemo(() => {
    if (!dashboardFilter.dateStart || !dashboardFilter.dateEnd) return null;
    const comparison = dashboardFilter.compareEnabled && dashboardFilter.comparisonStart && dashboardFilter.comparisonEnd
      ? { start: dashboardFilter.comparisonStart, end: dashboardFilter.comparisonEnd }
      : buildComparisonRange(dashboardFilter.dateStart, dashboardFilter.dateEnd, "previous");
    return {
      periodA: comparison,
      periodB: { start: dashboardFilter.dateStart, end: dashboardFilter.dateEnd },
    };
  }, [dashboardFilter.compareEnabled, dashboardFilter.comparisonEnd, dashboardFilter.comparisonStart, dashboardFilter.dateEnd, dashboardFilter.dateStart]);
  const effectivePeriodOverride = periodOverride || dashboardPeriodOverride;
  const currency = displayCurrency === "USD" ? "usd" : "krw";

  const [drillChannel, setDrillChannel] = useState("__all__");
  const [crChannel, setCrChannel] = useState("__all__");
  const [crCampaign, setCrCampaign] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [crPage, setCrPage] = useState(1);
  // §2/§3/§4 표 헤더 클릭 정렬 — 표마다 독립 상태(col=null이면 기존 기본 정렬(|영향| desc) 유지).
  const [pvmSortChannel, setPvmSortChannel] = useState({ col: null, dir: "desc" });
  const [pvmSortCampaign, setPvmSortCampaign] = useState({ col: null, dir: "desc" });
  const [pvmSortCreative, setPvmSortCreative] = useState({ col: null, dir: "desc" });
  const [downloadError, setDownloadError] = useState("");

  const hasData = csvData?.raw?.length > 0;

  const chartPvmWaterfall = useRef(null);
  const chartPvmTrend = useRef(null);

  // 실제 엔진 출력 계산 (캐시) — metric/weekBasis/lookback/denomBasis 변경 시 재계산
  const cache = useMemo(() => {
    if (!hasData) return null;
    try {
      return buildPvmCache(csvData, { metric, weekBasis, lookback, currency, denomBasis, dashboardFilter, locale, periodOverride: effectivePeriodOverride, domain });
    } catch (e) {
      return { insufficientData: true, message: tr("분석 중 오류: ", "Analysis error: ") + e.message };
    }
  }, [hasData, csvData, metric, weekBasis, lookback, currency, denomBasis, dashboardFilter, locale, effectivePeriodOverride, domain, tr]);

  const ready = cache && !cache.insufficientData && cache.identity?.ok === true;

  // PVM 결과 식별자. ResultActionCard가 이 비식별 로컬 키로 완료·실제 노출을 각각
  // 정확히 한 번 기록하며 파일명·채널명 같은 사용자 데이터는 전송하지 않는다.
  const analysisKey = ready
    ? `${csvData?.raw?.length || 0}|${metric}|${weekBasis}|${lookback}|${denomBasis}|${cache.p1Range.join(":")}|${cache.p2Range.join(":")}`
    : null;

  // §2 차트용 채널 배열 (top7 + 기타 축약) — index.html renderPvmCharts 이식
  const byChannelChart = useMemo(() => {
    if (!ready) return [];
    let arr = [...cache.layer1].sort(
      (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
    );
    if (arr.length > 8) {
      const top = arr.slice(0, 7);
      const merged = { key: tr("기타", "Other"), mix: 0, rate: 0, contribution: 0 };
      arr.slice(7).forEach((e) => {
        merged.mix += e.mix;
        merged.rate += e.rate;
        merged.contribution += e.contribution;
      });
      arr = [...top, merged];
    }
    return arr;
  }, [ready, cache, tr]);

  useEffect(() => {
    if (!ready || !byChannelChart.length) return;

    const cur = currency;
    const ml = pvmMetricLabel(cache, C);
    const c = { CPA1: cache.CPA1, CPA2: cache.CPA2 };
    const byChannel = byChannelChart;

    const CHART_THEME = { text: "#334155", muted: "#64748b", grid: "#e2e8f0" };
    const chartCommonOpts = () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      scales: {
        x: {
          ticks: { color: CHART_THEME.muted, font: { family: "JetBrains Mono", size: 11 } },
          grid: { display: false },
        },
        y: {
          ticks: { color: CHART_THEME.muted, font: { family: "JetBrains Mono", size: 11 } },
          grid: { color: CHART_THEME.grid, drawBorder: false },
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: "rgba(15,23,42,0.9)",
          titleFont: { size: 12 },
          bodyFont: { size: 12, family: "JetBrains Mono" },
          padding: 10,
          cornerRadius: 6,
        },
      },
    });

    let waterfallChart = null;
    let trendChart = null;
    const base = chartCommonOpts();
    // Mix·Rate 막대는 0을 양쪽에 두므로, 기본 그리드보다 강한 기준선을 별도로
    // 그린다. 기준 라벨은 축의 0원 눈금과 중복되므로 선만 표시한다.
    const zeroBaselinePlugin = {
      id: "pvmMixRateZeroBaseline",
      afterDraw(chart) {
        const scale = chart.scales.x;
        const area = chart.chartArea;
        if (!scale || !area) return;
        const zeroX = scale.getPixelForValue(0);
        if (!Number.isFinite(zeroX) || zeroX < area.left || zeroX > area.right) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(zeroX, area.top);
        ctx.lineTo(zeroX, area.bottom);
        ctx.stroke();
        ctx.restore();
      },
    };

    // 1. Waterfall Chart — 지난주 전체 CPA / 채널 기여(±) / 이번주 전체 CPA
    if (chartPvmWaterfall.current) {
      const NEUTRAL = "#64748b", RED = "#ff8a8a", GREEN = "#5ad19a";
      const labels = [tr("지난주 전체", "Prior week total"), ...byChannel.map((e) => e.key), tr("이번주 전체", "This week total")];
      const values = [c.CPA1, ...byChannel.map((e) => e.contribution), c.CPA2];
      const isCpaIdx = (i) => i === 0 || i === values.length - 1;
      const colors = values.map((v, i) => (isCpaIdx(i) ? NEUTRAL : v >= 0 ? RED : GREEN));

      const lo = Math.min(0, ...values);
      const hi = Math.max(0, ...values);
      const niceStep = (raw) =>
        [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 25000, 50000].find(
          (s) => s >= raw,
        ) || raw;
      const step = niceStep((hi - lo) / 7) || 1;
      const yMin = Math.floor(lo / step) * step;
      const yMax = Math.ceil(hi / step) * step;

      const labelPlugin = {
        id: "pvmWfLabels",
        afterDatasetsDraw(chart) {
          const ctx = chart.ctx;
          const meta = chart.getDatasetMeta(0);
          ctx.save();
          ctx.font = "10px JetBrains Mono";
          ctx.textAlign = "center";
          meta.data.forEach((bar, i) => {
            const v = values[i];
            const txt = isCpaIdx(i) ? pvmFmtMoney(v, cur, cur === "usd" ? 1 : undefined) : (v >= 0 ? "+" : "") + pvmFmtMoney(v, cur);
            ctx.fillStyle = isCpaIdx(i) ? CHART_THEME.text : v >= 0 ? RED : GREEN;
            ctx.fillText(txt, bar.x, v >= 0 ? bar.y - 4 : bar.y + 13);
          });
          ctx.restore();
        },
      };

      waterfallChart = new Chart(chartPvmWaterfall.current.getContext("2d"), {
        type: "bar",
        data: {
          labels,
          datasets: [
            { data: values, backgroundColor: colors, borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.82 },
          ],
        },
        options: {
          ...base,
          scales: {
            x: { ...base.scales.x, grid: { display: false }, ticks: { ...base.scales.x.ticks, maxRotation: 0, autoSkip: false } },
            y: { ...base.scales.y, beginAtZero: false, min: yMin, max: yMax, ticks: { ...base.scales.y.ticks, stepSize: step, callback: (v) => pvmFmtMoney(v, cur) } },
          },
          plugins: {
            ...base.plugins,
            legend: { display: false },
            tooltip: {
              ...base.plugins.tooltip,
              callbacks: {
                label: (ctx) => {
                  const i = ctx.dataIndex;
                  const v = values[i];
                  return isCpaIdx(i) ? `${ml} ${pvmFmtMoney(v, cur)}` : `${ctx.label}: ${v >= 0 ? "+" : ""}${pvmFmtMoney(v, cur)} (${v >= 0 ? tr("악화", "worse") : tr("개선", "better")})`;
                },
              },
            },
          },
        },
        plugins: [labelPlugin],
      });
    }

    // 2. Channel Mix·Rate Stack Chart
    if (chartPvmTrend.current) {
      const arr = [...byChannel].sort((a, b) => Math.abs(a.contribution) - Math.abs(b.contribution));
      const labels = arr.map((e) => e.key);
      const MIX_POS = "#4d8eff", MIX_NEG = "#adc6ff", RATE_POS = "#d97706", RATE_NEG = "#ffd98a";
      const legendTextColor = CHART_THEME.text;

      trendChart = new Chart(chartPvmTrend.current.getContext("2d"), {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: tr("Mix(비중)", "Mix (share)"), data: arr.map((e) => e.mix), backgroundColor: arr.map((e) => (e.mix >= 0 ? MIX_POS : MIX_NEG)), borderRadius: 3, barThickness: 15 },
            { label: tr("Rate(효율)", "Rate (efficiency)"), data: arr.map((e) => e.rate), backgroundColor: arr.map((e) => (e.rate >= 0 ? RATE_POS : RATE_NEG)), borderRadius: 3, barThickness: 15 },
          ],
        },
        options: {
          ...base,
          indexAxis: "y",
          scales: {
            x: {
              ...base.scales.x,
              stacked: true,
              ticks: {
                ...base.scales.x.ticks,
                callback: (v) => pvmFmtMoney(v, cur),
                font: (context) => ({
                  family: "JetBrains Mono",
                  size: 11,
                  weight: Number(context.tick?.value) === 0 ? "700" : "400",
                }),
              },
              title: { display: true, text: tr(`${ml} 영향(${cur === "usd" ? "$" : "원"})`, `${ml} impact (${cur === "usd" ? "$" : "KRW"})`), color: CHART_THEME.muted, font: { size: 10 } },
            },
            y: { ...base.scales.y, stacked: true, beginAtZero: true, grid: { display: false } },
          },
          plugins: {
            ...base.plugins,
            legend: {
              onClick: () => {},
              labels: {
                color: legendTextColor,
                generateLabels: () => [
                  { text: tr("Mix +(악화)", "Mix + (worse)"), fillStyle: MIX_POS, strokeStyle: MIX_POS, fontColor: legendTextColor, pointStyle: "circle" },
                  { text: tr("Mix −(개선)", "Mix − (better)"), fillStyle: MIX_NEG, strokeStyle: MIX_NEG, fontColor: legendTextColor, pointStyle: "circle" },
                  { text: tr("Rate +(악화)", "Rate + (worse)"), fillStyle: RATE_POS, strokeStyle: RATE_POS, fontColor: legendTextColor, pointStyle: "circle" },
                  { text: tr("Rate −(개선)", "Rate − (better)"), fillStyle: RATE_NEG, strokeStyle: RATE_NEG, fontColor: legendTextColor, pointStyle: "circle" },
                ],
              },
            },
            tooltip: {
              ...base.plugins.tooltip,
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x >= 0 ? "+" : ""}${pvmFmtMoney(ctx.parsed.x, cur)}`,
              },
            },
          },
        },
        plugins: [zeroBaselinePlugin],
      });
    }

    return () => {
      if (waterfallChart) waterfallChart.destroy();
      if (trendChart) trendChart.destroy();
    };
  }, [ready, cache, byChannelChart, currency, C, locale, tr, pvmFmtMoney]);

  // 진단(💡) 플로팅 툴팁 — index.html #pvm-float-tip 이식(document 위임, 스크롤 시 숨김)
  useEffect(() => {
    let tip = document.getElementById("pvm-float-tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "pvm-float-tip";
      document.body.appendChild(tip);
    }
    let hideTimer = null;
    const showTip = (icon) => {
      clearTimeout(hideTimer);
      const text = icon.getAttribute("data-tip");
      if (!text) return;
      tip.textContent = text;
      tip.classList.add("visible");
      const rect = icon.getBoundingClientRect();
      const tipW = 340;
      let left = rect.left + rect.width / 2 - tipW / 2;
      if (left < 8) left = 8;
      if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
      tip.style.left = left + "px";
      const tipH = tip.offsetHeight;
      const above = rect.top - tipH - 12;
      if (above > 4) tip.style.top = above + "px";
      else tip.style.top = rect.bottom + 10 + "px";
    };
    const hideTip = () => {
      hideTimer = setTimeout(() => tip.classList.remove("visible"), 80);
    };
    const onOver = (ev) => {
      const icon = ev.target.closest?.(".pvm-diag-icon");
      if (icon) showTip(icon);
    };
    const onOut = (ev) => {
      const icon = ev.target.closest?.(".pvm-diag-icon");
      if (icon) hideTip();
    };
    const onScroll = () => hideTip();
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("focusin", onOver);
    document.addEventListener("focusout", onOut);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      clearTimeout(hideTimer);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("focusin", onOver);
      document.removeEventListener("focusout", onOut);
      document.removeEventListener("scroll", onScroll, true);
      tip.classList.remove("visible");
    };
  }, []);

  // 차트 PNG 다운로드 — 다크 배경 합성 후 export(§7). ref 기반(v2엔 전역 핸들러 없음)
  const downloadChartPng = (canvasRef, nameSuffix) => {
    if (!ready) {
      setDownloadError(tr("항등식이 확인된 분석 결과가 없습니다. 분석 결과를 먼저 확인하세요.", "No identity-verified result is available. Review the analysis result first."));
      return;
    }
    const canvas = canvasRef?.current;
    if (!canvas) return;
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const ctx = tmp.getContext("2d");
    const rootStyle = getComputedStyle(document.documentElement);
    const bg =
      rootStyle.getPropertyValue("--bg-1").trim() ||
      rootStyle.getPropertyValue("--surface-base").trim() ||
      "#0f0f1e";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, 0);
    const ts = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = tmp.toDataURL("image/png");
    a.download = `${nameSuffix}_${ts}.png`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 0);
    setDownloadError("");
  };

  // 결과 CSV 다운로드 — 살아있는 스프레드시트 수식(§7 CRLF+BOM). buildPvmResultCsv 재사용
  const downloadPvmCsv = () => {
    if (!ready) {
      setDownloadError(tr("분석 데이터가 없습니다. 먼저 데이터를 매핑하세요.", "No analysis data is available. Map the data first."));
      return;
    }
    try {
      const ml2 = pvmMetricLabel(cache, C);
      const content = buildPvmResultCsv(cache, ml2, locale);
      const fname = `pvm_result_${ml2}_${cache.p2Range[1]}.csv`;
      const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
      setDownloadError("");
    } catch (e) {
      console.warn("PVM CSV download failed:", e.message);
      setDownloadError(tr("CSV를 만들지 못했습니다. 데이터 매핑을 확인한 뒤 다시 시도하세요.", "The CSV could not be created. Check the data mapping and try again."));
    }
  };

  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-pvm">
        <ToolPageShell
          locale={locale}
          title={C.title}
          chips={<span className="chip warning"><span className="dot"></span>{tr("CSV 업로드 대기", "Waiting for CSV upload")}</span>}
          summary={
            <p>{C.noDataSummary}</p>
          }
          toc={[{ id: "s-prep", title: tr("데이터 준비", "Data Preparation") }]}
        >
          <section className="block" id="s-prep">
            <h2 className="section-title">{tr("데이터 준비", "Data Preparation")}</h2>
            <div className="callout warning">
              <div className="ico">!</div>
              <div className="body">
                <strong>{tr("CSV 업로드 대기", "Waiting for CSV upload")}</strong>
                <p>{C.noDataCalloutBody}</p>
                <div style={{ marginTop: "1rem" }}>
                  <CsvUploader toolId={C.uploaderToolId} locale={locale} />
                </div>
              </div>
            </div>
          </section>
        </ToolPageShell>
      </div>
    );
  }

  const cur = currency;
  const ml = ready ? pvmMetricLabel(cache, C) : (C.metricLabel || metric.toUpperCase());
  const bothMetricsMapped = cache?.bothMetricsMapped;
  const unspec = tr("(미지정)", "(unspecified)");

  // §0 헤드라인 chip 헬퍼 + pvmImpactChip 이식
  const chipCls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "flat");
  const chipArr = (v) => (v > 0 ? "▲" : v < 0 ? "▼" : "—");
  const chipWord = (v) => (v > 0 ? tr("악화", "worse") : v < 0 ? tr("개선", "better") : tr("변화 없음", "no change"));
  const impactChip = (v, opts = {}) => (
    <span className={`pvm-chip ${chipCls(v)}`}>
      {chipArr(v)} {opts.prefix ? opts.prefix + " " : ""}
      {v >= 0 ? "+" : ""}
      {pvmFmtMoney(v, cur)}
      {opts.hideWord ? "" : " " + chipWord(v)}
    </span>
  );

  // §0 Top-mover 카드 + 헤드라인 라인 (실제 값) — index.html pvmComputeRollups + pvmHeadlineSection 이식
  const headlineLines = [];
  let upMover = null;
  let downMover = null;
  if (ready) {
    const flat = pvmIsOverallFlat(cache.deltaCpa, cache.CPA1);
    const sortedCh = [...cache.layer1].sort(
      (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
    );
    const topChannel = sortedCh[0] || null;

    // 드릴 체인 top 캠페인·소재 (top 채널 하위)
    let topCampaign = null;
    if (cache.campaignMapped && topChannel) {
      topCampaign = cache.layer2
        .filter((f) => f.chKey === topChannel.key)
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0] || null;
    }
    let topCreative = null;
    if (cache.creativeMapped && topChannel) {
      topCreative = cache.layer3
        .filter(
          (f) =>
            f.chKey === topChannel.key &&
            (topCampaign ? f.cmpKey === topCampaign.cmpKey : true),
        )
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0] || null;
    }

    // Top-mover — 가장 올린/내린 채널(있을 때만)
    upMover =
      [...sortedCh].filter((e) => e.contribution > 0).sort((a, b) => b.contribution - a.contribution)[0] || null;
    downMover =
      [...sortedCh].filter((e) => e.contribution < 0).sort((a, b) => a.contribution - b.contribution)[0] || null;

    headlineLines.push(
      flat ? (
        <li key="head" style={{ marginBottom: "7px", fontSize: "13px", lineHeight: 1.7 }}>
          {tr(
            <>전체 {ml}는 {pvmFmtMoney(cache.CPA1, cur, cur === "usd" ? 1 : undefined)} → {pvmFmtMoney(cache.CPA2, cur, cur === "usd" ? 1 : undefined)}로 큰 변화 없음(±
            {(PVM_SIG_RULES.overallFlatPct * 100).toFixed(0)}% 이내)</>,
            <>Overall {ml} shows no major change ({pvmFmtMoney(cache.CPA1, cur, cur === "usd" ? 1 : undefined)} → {pvmFmtMoney(cache.CPA2, cur, cur === "usd" ? 1 : undefined)}, within ±
            {(PVM_SIG_RULES.overallFlatPct * 100).toFixed(0)}%)</>,
          )}
        </li>
      ) : (
        <li key="head" style={{ marginBottom: "7px", fontSize: "13px", lineHeight: 1.7 }}>
          {tr("전체", "Overall")} {ml} <strong>{pvmFmtMoney(cache.CPA1, cur, cur === "usd" ? 1 : undefined)} → {pvmFmtMoney(cache.CPA2, cur, cur === "usd" ? 1 : undefined)}</strong>{" "}
          {impactChip(cache.deltaCpa)}
        </li>
      ),
    );
    if (topChannel && pvmIsEntitySignificant(topChannel.contribution, cache.deltaCpa, cache.CPA2)) {
      headlineLines.push(
        <li key="ch" style={{ marginBottom: "7px", fontSize: "13px", lineHeight: 1.7 }}>
          <span style={{ color: "var(--text-muted)" }}>{C.levelChannel}</span>{" "}
          <strong>{topChannel.key || unspec}</strong> {impactChip(topChannel.contribution, { prefix: ml })}
        </li>,
      );
    }
    if (topCampaign && pvmIsEntitySignificant(topCampaign.contribution, cache.deltaCpa, cache.CPA2)) {
      headlineLines.push(
        <li key="cmp" style={{ marginBottom: "7px", fontSize: "13px", lineHeight: 1.7 }}>
          <span style={{ color: "var(--text-muted)" }}>{C.levelCampaign}</span> {topChannel.key} ›{" "}
          <strong>{topCampaign.key || topCampaign.cmpKey || unspec}</strong>{" "}
          {impactChip(topCampaign.contribution, { prefix: ml })}
        </li>,
      );
    }
    if (topCreative && pvmIsEntitySignificant(topCreative.contribution, cache.deltaCpa, cache.CPA2)) {
      headlineLines.push(
        <li key="cr" style={{ marginBottom: "7px", fontSize: "13px", lineHeight: 1.7 }}>
          <span style={{ color: "var(--text-muted)" }}>{C.levelCreative}</span>{" "}
          <strong>{topCreative.crKey || unspec}</strong>{" "}
          {impactChip(topCreative.contribution, { prefix: ml })}
        </li>,
      );
    }
  }

  // Top-mover 카드 노드
  const moverCard = (e, kind) => (
    <div className={`pvm-mover ${kind}`} key={kind}>
      <span className="ar">{kind === "up" ? "▲" : "▼"}</span>
      <div>
        <div className="mt">{kind === "up" ? tr(`${ml} 가장 올린 요인`, `Biggest driver up (${ml})`) : tr(`${ml} 가장 내린 요인`, `Biggest driver down (${ml})`)}</div>
        <div className="mn">{e.key || unspec}</div>
      </div>
      <span className="mv">
        {e.contribution >= 0 ? "+" : ""}
        {pvmFmtMoney(e.contribution, cur)}
      </span>
    </div>
  );

  // 정렬 가능 헤더용 — 클릭 시 그 컬럼 기준 desc, 다시 클릭하면 asc 토글. 값은 P2(현재
  // 기간) 기준(정렬 의도가 "지금 뭐가 큰가"이므로). subMix/subRate는 레벨별로 다른
  // 필드(채널=cmpSum*, 캠페인=creativeSum*, 소재=최하위라 null=미해당).
  const PVM_SORT_ACCESSORS = {
    name: (e, level) => String(level === "creative" ? e.crKey : (e.key ?? e.cmpKey ?? "")).toLowerCase(),
    cost: (e) => e.cost2,
    cpa: (e) => (e.result2 > 0 ? e.cost2 / e.result2 : null),
    share: (e) => e.s2,
    mix: (e) => e.mix,
    rate: (e) => e.rate,
    subMix: (e, level) => (level === "channel" ? e.cmpSumMix || 0 : level === "campaign" ? e.creativeSumMix || 0 : null),
    subRate: (e, level) => (level === "channel" ? e.cmpSumRate || 0 : level === "campaign" ? e.creativeSumRate || 0 : null),
    impact: (e) => e.contribution,
  };
  const pvmSortRows = (rows, level, sort) => {
    if (!sort || !sort.col) return rows; // 미클릭 상태 — 호출부의 기본(|영향| desc) 유지
    const acc = PVM_SORT_ACCESSORS[sort.col];
    if (!acc) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = acc(a, level), vb = acc(b, level);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // null(해당없음)은 항상 뒤로
      if (vb == null) return -1;
      if (typeof va === "string") return dir * va.localeCompare(vb);
      return dir * (va - vb);
    });
  };

  // §2 표 행 렌더 (실제 layer1)
  const channelRows = ready
    ? pvmSortRows([...cache.layer1].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)), "channel", pvmSortChannel)
    : [];
  // 결론의 상위 원인은 표 정렬 UI와 무관하게 절대 기여도가 큰 순서로 고정한다.
  const pvmTopCauses = ready
    ? [...cache.layer1].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3)
    : [];
  const decisionCause = pvmTopCauses[0] || null;
  const decisionCauseKind = decisionCause && Math.abs(decisionCause.mix || 0) >= Math.abs(decisionCause.rate || 0)
    ? tr("믹스 이동", "mix shift")
    : tr("단가 변화", "rate change");
  const isDecisionCauseAdverse = (decisionCause?.contribution || 0) > 0;
  const pvmDeltaPct = ready && cache.CPA1
    ? (cache.deltaCpa / cache.CPA1) * 100
    : null;
  const channelSigma = channelRows.reduce((a, e) => a + e.contribution, 0);
  const channelIdentity = ready ? cache.identity : null;
  const pvmManifest = buildResultManifest({
    toolId: C.uploaderToolId,
    mode: "pvm",
    source: csvData?.fileName?.startsWith("demo_") ? "demo" : "csv",
    inputSignature: `${csvData?.fileName || "dataset"}|${csvData?.raw?.length || 0}`,
    filter: { lookback, weekBasis, metric },
    grain: "channel-campaign-creative",
    metricDefinitions: [{ key: metric, label: ml, aggregation: "ratio", timeBasis: weekBasis }],
    engineVersion: "pvm-identity-checked",
    status: ready ? "COMPLETE" : (cache?.analysisStatus || "BLOCKED"),
    warnings: ready
      ? []
      : [cache?.message || tr("채널 합산 항등식을 확인해야 합니다.", "Channel additive identity needs review.")],
  });

  // §3 캠페인 드릴 — 채널 선택
  const channelKeys = ready ? channelRows.map((e) => e.key) : [];
  const drillSel =
    drillChannel !== "__all__" && channelKeys.includes(drillChannel)
      ? drillChannel
      : channelKeys[0];
  const campaignRows =
    ready && cache.campaignMapped && drillSel != null
      ? pvmSortRows(
          cache.layer2.filter((f) => f.chKey === drillSel).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
          "campaign", pvmSortCampaign,
        )
      : [];
  // §3 Σ 검증 — 캠페인 기여합 = 선택 채널 기여
  const campaignSigma = campaignRows.reduce((a, e) => a + e.contribution, 0);
  const drillChContribution =
    ready && cache.campaignMapped && drillSel != null
      ? (channelRows.find((ch) => ch.key === drillSel)?.contribution ?? 0)
      : 0;

  // §4 소재 드릴 — index.html pvmCreativeDrilldownSection 이식
  const crIsAll = crChannel === "__all__";
  const crSelCh = crIsAll
    ? "__all__"
    : channelKeys.includes(crChannel)
      ? crChannel
      : channelKeys[0];

  // 캠페인 하위 셀렉터(cmpSelector) — 채널 선택 시에만 노출, layer3의 cmpKey 유니크로 목록 구성
  let campaignsInCh = [];
  let crSelCmp = null;
  if (ready && cache.creativeMapped && cache.campaignMapped && !crIsAll) {
    campaignsInCh = [
      ...new Set(cache.layer3.filter((f) => f.chKey === crSelCh).map((f) => f.cmpKey ?? "")),
    ];
    // crCampaign 이 현 채널의 캠페인 목록에 있을 때만 유효, 아니면 전체(null)
    crSelCmp = crCampaign != null && campaignsInCh.includes(crCampaign) ? crCampaign : null;
  }

  let creativeRows = [];
  if (ready && cache.creativeMapped) {
    if (crIsAll) {
      creativeRows = cache.layer3;
    } else if (crSelCmp == null && cache.campaignMapped) {
      creativeRows = cache.layer3.filter((f) => f.chKey === crSelCh);
    } else {
      creativeRows = cache.layer3.filter(
        (f) => f.chKey === crSelCh && (crSelCmp != null ? f.cmpKey === crSelCmp : true),
      );
    }
    creativeRows = [...creativeRows].sort(
      (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
    );
    if (showNew) {
      creativeRows = creativeRows.filter((e) => e.result1 === 0 && e.result2 > 0);
    }
    creativeRows = pvmSortRows(creativeRows, "creative", pvmSortCreative);
  }

  // §4 Σ 검증 — 표시 소재 기여합 = 상위(전체/채널/캠페인) 기여
  const creativeSigma = creativeRows.reduce((a, e) => a + e.contribution, 0);
  const creativeParentContribution = !ready
    ? 0
    : crIsAll
      ? cache.deltaCpa
      : crSelCmp != null
        ? (cache.layer2.find((f) => f.chKey === crSelCh && f.cmpKey === crSelCmp)?.contribution ?? 0)
        : (cache.layer1.find((ch) => ch.key === crSelCh)?.contribution ?? 0);
  const creativeSigmaLabel = crIsAll
    ? tr("전체", "All")
    : crSelCmp != null
      ? `${crSelCh} · ${crSelCmp || unspec}`
      : `${crSelCh} ${C.levelChannel}`;

  // §4 페이지네이션 (20행/페이지) — index.html pvmPager 이식
  const CR_PER = 20;
  const crTotal = creativeRows.length;
  const crMaxPage = Math.max(1, Math.ceil(crTotal / CR_PER));
  const crCurPage = Math.min(Math.max(1, crPage), crMaxPage);
  const crStart = (crCurPage - 1) * CR_PER;
  const creativeRowsPage = creativeRows.slice(crStart, crStart + CR_PER);

  // 공유 표 행 렌더러 — index.html pvmTableRow 이식
  const renderRow = (e, level, keyId) => {
    const cost1 = e.cost1,
      cost2 = e.cost2;
    const result1 = e.result1,
      result2 = e.result2;
    const userCpa1 = result1 > 0 ? cost1 / result1 : null;
    const userCpa2 = result2 > 0 ? cost2 / result2 : null;
    const cpa1Str = userCpa1 !== null ? pvmFmtMoney(userCpa1, cur, cur === "usd" ? 1 : undefined) : "—";
    const cpa2Str = userCpa2 !== null ? pvmFmtMoney(userCpa2, cur, cur === "usd" ? 1 : undefined) : "—";
    const share1Str = (e.s1 * 100).toFixed(1) + "%";
    const share2Str = (e.s2 * 100).toFixed(1) + "%";
    const mixStr = (e.mix >= 0 ? "+" : "") + pvmFmtMoney(e.mix, cur);
    const rateStr = (e.rate >= 0 ? "+" : "") + pvmFmtMoney(e.rate, cur);

    let subMixVal = 0,
      subRateVal = 0;
    let subMixNode, subRateNode;
    if (level === "channel") {
      subMixVal = e.cmpSumMix || 0;
      subRateVal = e.cmpSumRate || 0;
    } else if (level === "campaign") {
      subMixVal = e.creativeSumMix || 0;
      subRateVal = e.creativeSumRate || 0;
    }
    if (level === "creative") {
      subMixNode = <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{tr("— (최하위 레벨)", "— (lowest level)")}</span>;
      subRateNode = <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{tr("— (최하위 레벨)", "— (lowest level)")}</span>;
    } else {
      subMixNode = (subMixVal >= 0 ? "+" : "") + pvmFmtMoney(subMixVal, cur);
      subRateNode = (subRateVal >= 0 ? "+" : "") + pvmFmtMoney(subRateVal, cur);
    }

    const impactStr = (e.contribution >= 0 ? "+" : "") + pvmFmtMoney(e.contribution, cur);
    const diagText = pvmGenerateDiagnosis(e, level, (v) => pvmFmtMoney(v, cur), locale);

    let nameNode;
    let isNew = false;
    if (level === "creative") {
      const safeUrl = cache.crUrlMap ? pvmSafeUrl(cache.crUrlMap.get(String(e.crKey ?? ""))) : null;
      isNew = e.result1 === 0 && e.result2 > 0;
      const breadcrumb = cache.campaignMapped
        ? `${e.chKey} › ${e.cmpKey || unspec}`
        : `${e.chKey}`;
      // "New" 배지는 이름 옆이 아니라 테이블 맨 앞 전용 컬럼으로 분리(#3) — 이름 문자열
      // 자체(e.crKey)는 이모지 없이 그대로 유지되므로 정렬 시 항상 깨끗한 값 기준.
      nameNode = (
        <>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>{breadcrumb}</span>
          <strong style={{ verticalAlign: "middle" }}>{e.crKey || unspec}</strong>
          {safeUrl && (
            <a href={safeUrl} target="_blank" rel="noopener noreferrer" title={C.creativeLinkTitle} style={{ textDecoration: "none", fontSize: "11px", marginLeft: "4px", verticalAlign: "middle" }}>🔗</a>
          )}
        </>
      );
    } else if (level === "campaign") {
      nameNode = e.key || e.cmpKey || unspec;
    } else {
      nameNode = e.key || unspec;
    }

    return (
      <tr key={keyId}>
        {level === "creative" && (
          <td className="tnum" style={{ whiteSpace: "nowrap", textAlign: "center" }} title={isNew ? C.newBadgeTitle : ""}>
            {isNew ? "🆕" : ""}
          </td>
        )}
        <td style={{ whiteSpace: "nowrap" }}>{nameNode}</td>
        <td className="tnum" style={{ whiteSpace: "nowrap" }}>{pvmFmtMoney(cost1, cur)} → {pvmFmtMoney(cost2, cur)}</td>
        <td className="tnum" style={{ whiteSpace: "nowrap" }}>{cpa1Str} → {cpa2Str}</td>
        <td className="tnum" style={{ whiteSpace: "nowrap" }}>{share1Str} → {share2Str}</td>
        <td className="tnum" style={{ whiteSpace: "nowrap", color: pvmColor(e.mix) }}>{mixStr}</td>
        <td className="tnum" style={{ whiteSpace: "nowrap", color: pvmColor(e.rate) }}>{rateStr}</td>
        <td className="tnum" style={{ whiteSpace: "nowrap", color: pvmColor(subMixVal) }}>{subMixNode}</td>
        <td className="tnum" style={{ whiteSpace: "nowrap", color: pvmColor(subRateVal) }}>{subRateNode}</td>
        <td style={{ textAlign: "center", whiteSpace: "nowrap", position: "relative" }}>
          <span className="pvm-diag-icon" tabIndex={0} style={{ cursor: "help", fontSize: "14px", opacity: 0.7 }} data-tip={diagText}>💡</span>
        </td>
        <td className="tnum" style={{ whiteSpace: "nowrap" }}>
          <strong style={{ color: pvmColor(e.contribution) }}>{impactStr}</strong>
        </td>
      </tr>
    );
  };

  const headerWithName = (name, withNewCol, level, sort, setSort) => {
    const th = (label, col, titleAttr) => {
      const active = sort.col === col;
      const arrow = active ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
      return (
        <th
          title={titleAttr}
          style={{ cursor: "pointer", userSelect: "none" }}
          onClick={() => setSort((prev) => (prev.col === col ? { col, dir: prev.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" }))}
        >
          {label}{arrow}
        </th>
      );
    };
    return (
      <tr>
        {withNewCol && <th className="tnum" title={C.newBadgeTitle}>New</th>}
        {th(name, "name")}
        {th("COST (P1→P2)", "cost")}
        {th(`${ml} (P1→P2)`, "cpa")}
        {th(C.shareHeader, "share", C.shareHeaderTitle)}
        {th(tr("MIX (비중 이동)", "MIX (share shift)"), "mix", tr("예산 비중 이동(믹스) 효과 — 이 단계 값은 하위 셀 믹스의 합과 동일(롤업)", "Budget-share (mix) shift effect — at this level it equals the sum of sub-cell mix effects (rollup)"))}
        {th(tr("RATE (순수 단가)", "RATE (pure unit price)"), "rate", tr("순수 단가 변동 (Rate)", "Pure unit-price change (Rate)"))}
        {th(tr("MIX (하위합)", "MIX (sub-total)"), "subMix", tr("하위 세그먼트 합산 믹스 효과", "Sum of mix effects across sub-segments"))}
        {th(tr("RATE (하위합)", "RATE (sub-total)"), "subRate", tr("하위 세그먼트 합산 레이트 효과", "Sum of rate effects across sub-segments"))}
        <th>{tr("진단", "Diagnosis")}</th>
        {th(tr(`${ml} 영향`, `${ml} impact`), "impact")}
      </tr>
    );
  };

  // 기간 캡션
  const periodCaption = ready
    ? tr(
        `기준 ${cache.p1Range[0]}~${cache.p1Range[1]} (P1) vs 현재 ${cache.p2Range[0]}~${cache.p2Range[1]} (P2)${
          cache.p2DaysCovered < 7 ? ` · ⚠ 현재 기간 ${cache.p2DaysCovered}일만 집계됨(미완결 주)` : ""
        }`,
        `Baseline ${cache.p1Range[0]}~${cache.p1Range[1]} (P1) vs current ${cache.p2Range[0]}~${cache.p2Range[1]} (P2)${
          cache.p2DaysCovered < 7 ? ` · ⚠ Current period has only ${cache.p2DaysCovered} day(s) of data (incomplete week)` : ""
        }`,
      )
    : "";

  // 스코어카드 브릿지 값
  const bridge = (v1, v2, colored) => {
    const d = v2 - v1;
    const pct = v1 ? (d / v1) * 100 : 0;
    const arr = d > 0 ? "▲" : d < 0 ? "▼" : "—";
    const sign = d >= 0 ? "+" : "";
    const cls = !colored ? "flat" : d > 0 ? "up" : d < 0 ? "down" : "flat";
    return { d, pct, arr, sign, cls };
  };

  return (
    <div className="tab-pane active" id="tab-pvm">
      <ToolPageShell
        locale={locale}
        title={C.title}
        chips={<span className="chip"><span className="dot"></span>{C.chipMain}</span>}
        toc={buildPvmToc(C, locale)}
        stickyFilter={<DashboardFilterBar locale={locale} />}
      >
      {analysisHandoff?.targetToolId === "5-21" && analysisHandoff?.dataGroup === "efficiency" && (
        <div className="callout info" style={{ marginBottom: "12px" }}>
          <div className="body">
            <strong>{tr("이상탐지에서 비교 맥락을 가져왔습니다.", "Comparison context received from Anomaly Detection.")}</strong>
            <p>
              {analysisHandoff.periodA?.start} ~ {analysisHandoff.periodA?.end}
              {" → "}
              {analysisHandoff.periodB?.start} ~ {analysisHandoff.periodB?.end}
              {" · "}
              {String(analysisHandoff.metric || "").toUpperCase()}
            </p>
            <p className="muted">{tr(
              "현재 PVM 비교 조건을 확인한 뒤 직접 실행하세요. 자동 분석하지 않습니다.",
              "Confirm the PVM comparison settings and run it yourself. The analysis is not started automatically.",
            )}</p>
            {!periodOverride && (
              <button className="btn primary" type="button" onClick={() => {
                setMetric(analysisHandoff.metric);
                setPeriodOverride({ periodA: analysisHandoff.periodA, periodB: analysisHandoff.periodB });
              }}>{tr("이 기간을 비교 조건에 적용", "Apply these comparison periods")}</button>
            )}
            <button className="btn ghost" type="button" onClick={() => {
              setPeriodOverride(null);
              clearAnalysisHandoff();
            }}>{tr("맥락 닫기", "Dismiss context")}</button>
          </div>
        </div>
      )}
      {/* §0 한눈에 보기 */}
      <section
        className="block"
        id="s-pvm-result"
        style={{ background: "linear-gradient(135deg,rgba(122,162,247,0.12),rgba(192,132,252,0.05))", border: "1px solid rgba(122,162,247,0.25)", borderRadius: "14px", padding: "18px 20px" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <h2 className="section-title" style={{ margin: 0 }}>{tr("한눈에 보기", "Overview")}</h2>
        </div>

        <div className="analysis-local-controls" aria-label={tr("비교 조건", "Comparison settings")} style={{ marginTop: "1rem" }}>
        <div className="analysis-local-controls__inner">
          <span className="analysis-local-controls__label">{tr("비교 조건", "Comparison settings")}</span>
          {bothMetricsMapped !== false && (
            <div className="ab-pillgroup">
              <span className="ab-pillgroup-label">{tr("지표", "Metric")}</span>
              <button className={`ab-pill ${metric === "cpa" ? "active" : ""}`} onClick={() => setMetric("cpa")}>CPA</button>
              <button className={`ab-pill ${metric === "cpi" ? "active" : ""}`} onClick={() => setMetric("cpi")}>CPI</button>
            </div>
          )}
          {effectivePeriodOverride ? (
            <span className="analysis-control-group__label">{tr("날짜 필터의 비교 기간 적용 중", "Using the date filter comparison")}</span>
          ) : <>
            <div className="ab-pillgroup">
              <span className="ab-pillgroup-label">{tr("기준 주", "Week basis")}</span>
              <button className={`ab-pill ${weekBasis === "calendar" ? "active" : ""}`} onClick={() => setWeekBasis("calendar")}>{tr("마감주(월~일)", "Calendar week (Mon–Sun)")}</button>
              <button className={`ab-pill ${weekBasis === "rolling7" ? "active" : ""}`} onClick={() => setWeekBasis("rolling7")}>{tr("최근 7일", "Last 7 days")}</button>
            </div>
            <div className="ab-pillgroup">
              <span className="ab-pillgroup-label">{tr("비교 기준", "Comparison basis")}</span>
              {[1, 2, 3].map((lb) => {
                const locked = cache?.lockState?.[lb];
                return (
                  <button
                    key={lb}
                    className={`ab-pill ${lookback === lb && !locked ? "active" : ""}`}
                    disabled={!!locked}
                    title={locked ? tr("데이터가 더 필요합니다", "More data required") : ""}
                    style={{ opacity: locked ? 0.5 : 1, cursor: locked ? "default" : "pointer" }}
                    onClick={() => !locked && setLookback(lb)}
                  >
                    {locked ? "🔒 " : ""}{lb === 1 ? tr("직전주", "Prior week") : lb === 2 ? tr("2주전", "2 weeks ago") : tr("3주전", "3 weeks ago")}
                  </button>
                );
              })}
            </div>
          </>}
        </div>
        </div>

        {periodCaption && (
          <p style={{ margin: "8px 0 0", fontSize: "11.5px", color: "var(--text-muted)" }}>{periodCaption}</p>
        )}

        {ready ? <>
          <ResultActionCard
            toolId={pvmManifest.toolId}
            analysisKey={analysisKey}
            analysisType="pvm"
            resultState="ready"
            locale={locale}
            tone={cache.deltaCpa > 0 ? "bad" : cache.deltaCpa < 0 ? "good" : "neutral"}
            title={tr("변동 원인 결론", "Variance conclusion")}
            headline={tr(
              `${ml} ${pvmFmtMoney(cache.CPA1, cur, cur === "usd" ? 1 : undefined)} → ${pvmFmtMoney(cache.CPA2, cur, cur === "usd" ? 1 : undefined)}`,
              `${ml} ${pvmFmtMoney(cache.CPA1, cur, cur === "usd" ? 1 : undefined)} → ${pvmFmtMoney(cache.CPA2, cur, cur === "usd" ? 1 : undefined)}`,
            )}
            decisionPrefill={{
              conclusion: tr(
                `${ml} ${pvmFmtMoney(cache.CPA1, cur, cur === "usd" ? 1 : undefined)} → ${pvmFmtMoney(cache.CPA2, cur, cur === "usd" ? 1 : undefined)}${decisionCause ? ` · 최대 관측 기여 ${decisionCause.key || unspec}` : ""}`,
                `${ml} ${pvmFmtMoney(cache.CPA1, cur, cur === "usd" ? 1 : undefined)} → ${pvmFmtMoney(cache.CPA2, cur, cur === "usd" ? 1 : undefined)}${decisionCause ? ` · largest observed contribution: ${decisionCause.key || unspec}` : ""}`,
              ),
              action: decisionCause
                ? isDecisionCauseAdverse
                  ? tr(
                    `${decisionCause.key || unspec}의 ${decisionCauseKind} 구성요소를 점검하고 한 가지 교정만 시험한다`,
                    `Inspect the ${decisionCauseKind} component for ${decisionCause.key || unspec} and test one corrective change`,
                  )
                  : tr(
                    `${decisionCause.key || unspec}의 유리한 관측 기여와 함께 있었던 운영 조건을 기록하고 다음 기간에 재현되는지 확인한다`,
                    `Record the operating conditions observed alongside ${decisionCause.key || unspec}'s favorable contribution and check whether it repeats next period`,
                  )
                : tr("다음 비교기간에도 같은 기준으로 변동을 다시 분해한다", "Run the same decomposition again for the next comparison window"),
              metric: ml,
              baseline: pvmFmtMoney(cache.CPA2, cur, cur === "usd" ? 1 : undefined),
              sourcePeriod: periodCaption,
              reviewQuestion: !decisionCause
                ? tr(
                  `다음 비교기간에도 같은 기준으로 전체 ${ml} 변화를 설명할 수 있었는가?`,
                  `In the next comparison window, could the same definition still explain the overall ${ml} change?`,
                )
                : isDecisionCauseAdverse
                  ? tr(
                    `다음 비교기간에 전체 ${ml}와 불리한 상위 관측 기여가 줄었는가?`,
                    `In the next comparison window, did overall ${ml} and the largest adverse observed contribution decrease?`,
                  )
                  : tr(
                    `다음 비교기간에도 상위 유리 기여가 유지되고 전체 ${ml}가 현재 기준보다 개선됐는가?`,
                    `In the next comparison window, did the favorable contribution persist and overall ${ml} improve from the current baseline?`,
                  ),
            }}
            stats={[
              { label: tr("전체 변화", "Overall change"), value: `${cache.deltaCpa >= 0 ? "+" : ""}${pvmFmtMoney(cache.deltaCpa, cur)}`, detail: pvmDeltaPct == null ? "—" : `${pvmDeltaPct >= 0 ? "+" : ""}${pvmDeltaPct.toFixed(1)}%` },
              { label: tr("가장 큰 원인", "Top cause"), value: pvmTopCauses[0]?.key || unspec, detail: pvmTopCauses[0] ? `${pvmTopCauses[0].contribution >= 0 ? "+" : ""}${pvmFmtMoney(pvmTopCauses[0].contribution, cur)}` : "—" },
              { label: tr("분석 채널", "Channels"), value: channelRows.length },
            ]}
            points={pvmTopCauses.map((cause, index) => ({
              text: tr(
                `${index + 1}위 ${cause.key || unspec} · ${ml} ${cause.contribution >= 0 ? "+" : ""}${pvmFmtMoney(cause.contribution, cur)}`,
                `#${index + 1} ${cause.key || unspec} · ${ml} ${cause.contribution >= 0 ? "+" : ""}${pvmFmtMoney(cause.contribution, cur)}`,
              ),
              cls: cause.contribution > 0 ? "bad" : cause.contribution < 0 ? "good" : "muted",
            }))}
            download={(
              <DownloadHub
                toolId={pvmManifest.toolId}
                locale={locale}
                label={tr("결과 받기", "Download")}
                align="right"
                manifest={pvmManifest}
                items={[
                  { icon: "📄", label: tr("분해 결과 CSV", "Decomposition CSV"), desc: tr("채널·캠페인·소재 표", "Channel, campaign, and creative tables"), onSelect: downloadPvmCsv },
                  { icon: "🖼", label: tr("워터폴 PNG", "Waterfall PNG"), desc: tr("현재 분해 차트", "Current decomposition chart"), onSelect: () => downloadChartPng(chartPvmWaterfall, "pvm_waterfall") },
                ]}
              />
            )}
            analysisDetails={(
              <AnalysisDetails
                locale={locale}
                statusLabel={tr("계산 완료", "Complete")}
                statusTone="good"
                metric={ml}
                unit={tr("통화 단위 CPA/CPI", "Currency per CPA/CPI")}
                meaning={tr("관측 PVM 연관 분해이며 인과 효과가 아닙니다.", "Observed PVM association decomposition; not causal attribution.")}
                sampleSize={{ value: `${cache.rowsP1.length + cache.rowsP2.length} rows`, detail: `${cache.p1Range[0]}–${cache.p2Range[1]}` }}
                scope={`${cache.p1Range[0]} → ${cache.p2Range[1]}`}
                method="PVM finest-grain rollup"
                version="pvm-identity-checked"
                filterSummary={JSON.stringify({ lookback, weekBasis, metric })}
                metricDefinition={pvmManifest.metricDefinitions[0]?.key}
                warnings={pvmManifest.warnings}
              />
            )}
          >
            <details className="result-action-card__details">
              <summary>{tr("추가 변동 근거 보기", "View additional variance evidence")}</summary>
              {(upMover || downMover) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", margin: "12px 0 4px" }}>
                  {upMover && moverCard(upMover, "up")}
                  {downMover && moverCard(downMover, "down")}
                </div>
              )}
              <ul style={{ margin: "12px 0 10px", padding: 0, listStyle: "none" }}>{headlineLines}</ul>
              <div className="callout warn" style={{ marginTop: "6px" }}>
                <div className="ico">!</div>
                <div className="body" style={{ fontSize: "11.5px" }}>{C.causationCallout}</div>
              </div>
            </details>
          </ResultActionCard>
          {downloadError && <div className="required-banner" role="alert"><p>{downloadError}</p></div>}
        </> : (
          <div className="callout warn" style={{ marginTop: "12px" }}>
            <div className="ico">!</div>
            <div className="body">
              <strong>{cache?.analysisStatus === "NOT_IDENTIFIED"
                ? tr("분해 불가", "Not identified")
                : tr("데이터 부족", "Not enough data")}</strong>
              <p>{cache?.message || C.insufficientFallback}</p>
            </div>
          </div>
        )}
      </section>

      {/* §1 스코어카드 */}
      <section className="block" id="s-pvm-scorecard">
        <h2 className="section-title">{tr("성과는 얼마나 변했나?", "How much did performance change?")}</h2>
        {ready ? (
          <>
            {(() => {
              const b = bridge(cache.Cost1, cache.Cost2, false);
              return (
                <div className="pvm-bridge">
                  <span className="bl">COST</span>
                  <div className="flow"><span className="p1">{pvmFmtMoney(cache.Cost1, cur)}</span><span className="arr">→</span><span>{pvmFmtMoney(cache.Cost2, cur)}</span></div>
                  <span className={`pvm-chip ${b.cls}`} style={{ marginLeft: "auto" }}>{b.arr} {b.sign}{pvmFmtMoney(b.d, cur)} ({b.sign}{Math.abs(b.pct) < 0.05 ? "0" : b.pct.toFixed(1)}%)</span>
                </div>
              );
            })()}
            {(() => {
              const b = bridge(cache.CPA1, cache.CPA2, true);
              return (
                <div className="pvm-bridge">
                  <span className="bl">{ml}</span>
                  <div className="flow"><span className="p1">{pvmFmtMoney(cache.CPA1, cur, cur === "usd" ? 1 : undefined)}</span><span className="arr">→</span><span>{pvmFmtMoney(cache.CPA2, cur, cur === "usd" ? 1 : undefined)}</span></div>
                  <span className={`pvm-chip ${b.cls}`} style={{ marginLeft: "auto" }}>{b.arr} {b.sign}{pvmFmtMoney(b.d, cur)} ({b.sign}{Math.abs(b.pct) < 0.05 ? "0" : b.pct.toFixed(1)}%)</span>
                </div>
              );
            })()}
            <p style={{ marginTop: "8px", fontSize: "11.5px", color: "var(--text-muted)" }}>{periodCaption}</p>
          </>
        ) : (
          <p className="muted" style={{ fontSize: "12px" }}>{tr("분석 가능한 데이터가 없습니다.", "No analyzable data.")}</p>
        )}
      </section>

      {/* §2 채널별 결과 */}
      <section className="block" id="s-pvm-channels">
        <h2 className="section-title">{C.secChannels}</h2>

        <details className="block" style={{ padding: "11px 14px", marginBottom: "10px", background: "var(--bg-2)", borderRadius: "10px" }}>
          <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--text-2)", outline: "none" }}>{tr(`❓ Mix · Rate · ${ml} 영향이 뭔가요? (펼치기)`, `❓ What are Mix, Rate, and ${ml} impact? (expand)`)}</summary>
          <div style={{ marginTop: "10px", fontSize: "12px", lineHeight: 1.7, color: "var(--text-muted)" }}>
            {ready
              ? tr(`전체 ${ml} 변동을 잔차 없이 두 원인으로 쪼갠 값입니다.`, `The total ${ml} change, split with no residual into two causes.`)
              : tr("항등식 검증을 통과한 경우에만 Mix·Rate 원인 분해를 표시합니다.", "Mix·Rate drivers are shown only after the additive identity passes.")}
            <ul style={{ margin: "8px 0 4px", paddingLeft: "18px" }}>
              <li><strong>{tr("Mix(비중 효과)", "Mix (share effect)")}</strong> — {C.explainerMix}</li>
              <li><strong>{tr("Rate(효율 효과)", "Rate (efficiency effect)")}</strong> — {C.explainerRate(ml)}</li>
              <li><strong>{tr(`${ml} 영향 = Mix + Rate`, `${ml} impact = Mix + Rate`)}</strong> — {tr(`그 항목이 전체 ${ml}를 실제로 몇 원 움직였나.`, `How much this item actually moved the total ${ml}.`)}</li>
            </ul>
          </div>
        </details>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)" }}>{tr(`${ml} 브릿지 — 지난주 전체 → ${C.levelChannel} 기여(±) → 이번주 전체`, `${ml} bridge — prior week total → ${C.levelChannel} contribution (±) → this week total`)}</span>
              <button className="ab-pill" disabled={!ready} title={tr("PNG 다운로드", "Download PNG")} onClick={() => downloadChartPng(chartPvmWaterfall, "pvm_waterfall")}>⬇ PNG</button>
            </div>
            <div className="chart-container" style={{ height: "260px" }}><canvas id="pvm-waterfall" ref={chartPvmWaterfall}></canvas></div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)" }}>{tr(`${C.levelChannel}별 Mix·Rate 분해`, `Mix·Rate breakdown by ${C.levelChannel}`)}</span>
              <button className="ab-pill" disabled={!ready} title={tr("PNG 다운로드", "Download PNG")} onClick={() => downloadChartPng(chartPvmTrend, "pvm_channel_stack")}>⬇ PNG</button>
            </div>
            <div className="chart-container" style={{ height: "260px" }}><canvas id="pvm-channel-stack" ref={chartPvmTrend}></canvas></div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data" style={{ fontSize: "11.5px" }}>
            <thead>{headerWithName(C.levelChannel, false, "channel", pvmSortChannel, setPvmSortChannel)}</thead>
            <tbody>
              {channelRows.length ? (
                channelRows.map((e) => renderRow(e, "channel", e.key))
              ) : (
                <tr><td colSpan="10" style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)" }}>{tr("데이터가 없습니다", "No data")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {ready && channelRows.length > 0 && (
          <div className={`callout ${channelIdentity?.ok ? "ok" : "warn"}`} style={{ marginTop: "10px" }}>
            <div className="ico">{channelIdentity?.ok ? "✓" : "!"}</div>
            <div className="body">
              <strong>{tr(`Σ ${ml} 영향 = 전체 Δ${ml}`, `Σ ${ml} impact = total Δ${ml}`)}</strong>
              <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                {pvmFmtMoney(channelSigma, cur)} = {pvmFmtMoney(cache.deltaCpa, cur)} {channelIdentity?.ok
                  ? tr("(구성상 항등식 확인)", "(identity checked by construction)")
                  : tr("(항등식 검증 필요)", "(identity check required)")}
              </p>
              {!channelIdentity?.ok && (
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                  {tr(`잔차 ${pvmFmtMoney(channelIdentity?.error || 0, cur)} — 데이터 또는 분해 계층을 확인하세요.`, `Residual ${pvmFmtMoney(channelIdentity?.error || 0, cur)} — inspect the data or decomposition layers.`)}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* §3 채널·캠페인별 결과 */}
      <section className="block" id="s-pvm-campaigns">
        <h2 className="section-title">{C.secCampaigns}</h2>
        {!ready ? (
          <p className="muted" style={{ fontSize: "12px" }}>{tr("분석 가능한 데이터가 없습니다.", "No analyzable data.")}</p>
        ) : !cache.campaignMapped ? (
          <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{C.lockCampaign}</strong></div></div>
        ) : (
          <>
            <div className="ab-pillgroup" style={{ marginBottom: "10px" }}>
              <span className="ab-pillgroup-label">{C.levelChannel}</span>
              {channelRows.map((ch) => (
                <button key={ch.key} className={`ab-pill ${ch.key === drillSel ? "active" : ""}`} onClick={() => setDrillChannel(ch.key)}>{ch.key || unspec}</button>
              ))}
            </div>
            <div className="table-wrap">
              <table className="data" style={{ fontSize: "11.5px" }}>
                <thead>{headerWithName(C.levelCampaign, false, "campaign", pvmSortCampaign, setPvmSortCampaign)}</thead>
                <tbody>
                  {campaignRows.length ? (
                    campaignRows.map((e) => renderRow(e, "campaign", `${e.chKey}|${e.key}`))
                  ) : (
                    <tr><td colSpan="10" style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)" }}>{tr("데이터가 없습니다", "No data")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {campaignRows.length > 0 && (
              <div className="callout ok" style={{ marginTop: "10px" }}>
                <div className="ico">✓</div>
                <div className="body">
                  <strong>{tr(`Σ = ${drillSel || unspec} ${C.levelChannel} ${ml} 영향`, `Σ = ${drillSel || unspec} ${C.levelChannel} ${ml} impact`)}</strong>
                  <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>{pvmFmtMoney(campaignSigma, cur)} = {pvmFmtMoney(drillChContribution, cur)}</p>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* §4 소재별 결과 */}
      <section className="block" id="s-pvm-creatives">
        <h2 className="section-title">{C.secCreatives}</h2>
        {!ready ? (
          <p className="muted" style={{ fontSize: "12px" }}>{tr("분석 가능한 데이터가 없습니다.", "No analyzable data.")}</p>
        ) : !cache.creativeMapped ? (
          <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{C.lockCreative}</strong></div></div>
        ) : (
          <>
            <div className="ab-pillgroup" style={{ marginBottom: "8px" }}>
              <span className="ab-pillgroup-label">{C.levelChannel}</span>
              <button className={`ab-pill ${crIsAll ? "active" : ""}`} onClick={() => { setCrChannel("__all__"); setCrCampaign(null); setCrPage(1); }}>{tr("전체", "All")}</button>
              {channelRows.map((ch) => (
                <button key={ch.key} className={`ab-pill ${!crIsAll && ch.key === crSelCh ? "active" : ""}`} onClick={() => { setCrChannel(ch.key); setCrCampaign(null); setCrPage(1); }}>{ch.key || unspec}</button>
              ))}
            </div>
            {cache.campaignMapped && !crIsAll && (
              <div className="ab-pillgroup" style={{ marginBottom: "10px" }}>
                <span className="ab-pillgroup-label">{C.levelCampaign}</span>
                <button className={`ab-pill ${crSelCmp === null ? "active" : ""}`} onClick={() => { setCrCampaign(null); setCrPage(1); }}>{tr("전체", "All")}</button>
                {campaignsInCh.map((cmp) => (
                  <button key={cmp} className={`ab-pill ${cmp === crSelCmp ? "active" : ""}`} onClick={() => { setCrCampaign(cmp || null); setCrPage(1); }}>{cmp || unspec}</button>
                ))}
              </div>
            )}
            <div className="table-wrap">
              <table className="data" style={{ fontSize: "11.5px" }}>
                <thead>{headerWithName(C.levelCreative, true, "creative", pvmSortCreative, setPvmSortCreative)}</thead>
                <tbody>
                  {creativeRowsPage.length ? (
                    creativeRowsPage.map((e, i) => renderRow(e, "creative", `${e.chKey}|${e.cmpKey}|${e.crKey}|${crStart + i}`))
                  ) : (
                    <tr><td colSpan="11" style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)" }}>{C.emptyCreativeRows}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {crTotal > CR_PER && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "flex-end", marginTop: "8px", fontSize: "11.5px", color: "var(--text-muted)" }}>
                <span>{crStart + 1}–{Math.min(crCurPage * CR_PER, crTotal)} / {crTotal.toLocaleString()}{tr("행", " rows")}</span>
                <button className="ab-pill" disabled={crCurPage <= 1} style={{ opacity: crCurPage <= 1 ? 0.4 : 1, cursor: crCurPage <= 1 ? "default" : "pointer" }} onClick={() => setCrPage((p) => Math.max(1, p - 1))}>{tr("← 이전", "← Prev")}</button>
                <button className="ab-pill" disabled={crCurPage >= crMaxPage} style={{ opacity: crCurPage >= crMaxPage ? 0.4 : 1, cursor: crCurPage >= crMaxPage ? "default" : "pointer" }} onClick={() => setCrPage((p) => Math.min(crMaxPage, p + 1))}>{tr("다음 →", "Next →")}</button>
              </div>
            )}
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "10px", cursor: "pointer", marginTop: "10px" }}>
              <input type="checkbox" checked={showNew} onChange={(e) => { setShowNew(e.target.checked); setCrPage(1); }} /> {C.showNewLabel}
            </label>
            <div className="callout ok" style={{ marginTop: "6px" }}>
              <div className="ico">✓</div>
              <div className="body">
                <strong>{tr(`Σ = ${creativeSigmaLabel} ${ml} 영향`, `Σ = ${creativeSigmaLabel} ${ml} impact`)}</strong>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>{pvmFmtMoney(creativeSigma, cur)} = {pvmFmtMoney(creativeParentContribution, cur)}</p>
              </div>
            </div>
          </>
        )}
      </section>
      </ToolPageShell>
    </div>
  );
}
