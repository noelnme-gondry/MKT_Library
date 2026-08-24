"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import CsvUploader from "@/components/CsvUploader";
import ToolPageShell from "@/components/ToolPageShell";
import DataTable from "@/components/ds/DataTable";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DownloadHub from "@/components/ds/DownloadHub";
import { downloadCsv } from "@/utils/download";
import { useAppStore } from "@/store/useDataStore";
import { getMappedRows } from "@/utils/dashboardAggregator";
import Chart from "@/utils/chartGlobals";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import { classifyStoreShift, dailyConversionSeries, decomposeStoreConversion, storeFunnel } from "@/utils/asoStoreMath";
import { alignEventsToAxis, eventsFromRows, mergeEvents } from "@/utils/storeEvents";
import { comparePeriodLengths, describePeriod, formatCountDelta, formatPeriod, formatRateDelta } from "@/utils/periodCompare";
import { eventMarkersPlugin } from "@/utils/chartEventMarkers";
import StoreEventLog from "@/components/tools/StoreEventLog";
import { fmtPct } from "@/utils/format";

const TOOL_ID = "5-27";

// 매핑된 행 → 엔진 입력. 값은 문자열로 들어오므로 엔진 쪽에서 Number 변환한다(§7).
const toEngineRows = (rows) => rows.map((row) => ({
  date: row.date,
  source: row.store_source,
  impressions: row.impressions,
  views: row.product_page_views,
  installs: row.installs,
}));

// 기간을 반으로 갈라 앞뒤를 비교한다. 날짜가 홀수면 뒤 기간이 하루 길어지는데,
// 비율 비교라 길이 차이가 결과를 바꾸지 않는다(합이 아니라 전환율을 본다).
function splitByDate(rows) {
  const dates = [...new Set(rows.map((row) => String(row.date || "")).filter(Boolean))].sort();
  if (dates.length < 4) return null;
  const cut = dates[Math.floor(dates.length / 2)];
  return {
    cut,
    before: rows.filter((row) => String(row.date) < cut),
    after: rows.filter((row) => String(row.date) >= cut),
  };
}

function analyze(rows) {
  const engineRows = toEngineRows(rows);
  const overall = storeFunnel(engineRows);
  const series = dailyConversionSeries(engineRows);
  const split = splitByDate(engineRows);
  if (!split) return { overall, series, split: null, decomposed: null, verdict: { verdict: "unknown", reason: "기간 부족" } };
  const decomposed = decomposeStoreConversion(split.before, split.after);
  // 두 기간을 실제 날짜·일수로 말해야 사용자가 비교의 공정성을 스스로 검증한다.
  const periods = {
    before: describePeriod(split.before.map((row) => row.date)),
    after: describePeriod(split.after.map((row) => row.date)),
  };
  periods.balance = comparePeriodLengths(periods.before, periods.after);
  return { overall, series, split, periods, decomposed, verdict: classifyStoreShift(decomposed) };
}

export default function AsoStoreConversion({ locale = "ko" } = {}) {
  // useCallback 없이 두면 매 렌더마다 새 함수가 되어 차트 useEffect가 다시 돌고,
  // 그때마다 캔버스를 destroy → 재생성한다(깜빡임 + 낭비).
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  const csvData = useAppStore((state) => state.csvData);
  const analyzed = useAppStore((state) => state.isGroupAnalyzed(TOOL_ID));
  const result = useMemo(() => (analyzed ? analyze(getMappedRows(csvData)) : null), [analyzed, csvData]);

  // 세 경로(본 CSV 컬럼 · 별도 CSV · 직접 추가)를 하나로 모은다. 스토어에는
  // 직접 추가분만 있고, CSV 컬럼 이벤트는 원본이 소유한다(중복 소유 금지).
  const manualEvents = useAppStore((state) => state.storeEventsManual);
  const csvEvents = useMemo(() => (analyzed ? eventsFromRows(getMappedRows(csvData)) : []), [analyzed, csvData]);
  const allEvents = useMemo(() => mergeEvents(csvEvents, manualEvents), [csvEvents, manualEvents]);

  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const isDarkMode = useAppStore((state) => state.isDarkMode);

  const series = result?.series;
  const cutDate = result?.split?.cut;
  const axisEvents = useMemo(() => alignEventsToAxis(allEvents, series?.dates), [allEvents, series]);

  useEffect(() => {
    if (!chartRef.current || !series || series.dates.length === 0) return undefined;
    if (chartInstance.current) chartInstance.current.destroy();

    const palette = CHART_THEME.colors;
    const base = chartCommonOpts();
    const instance = new Chart(chartRef.current.getContext("2d"), {
      type: "line",
      // 전역 register 대신 이 차트에만 붙인다 — 세로 이벤트 선은 5-27만 쓴다.
      plugins: [eventMarkersPlugin],
      data: {
        labels: series.dates,
        datasets: [
          {
            label: tr("전체", "Overall"),
            data: series.total.map((value) => (value == null ? null : value * 100)),
            borderColor: CHART_THEME.textPrimary,
            backgroundColor: "transparent",
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.25,
            spanGaps: false,
          },
          ...series.sources.map((entry, index) => ({
            label: entry.source,
            data: entry.values.map((value) => (value == null ? null : value * 100)),
            borderColor: palette[index % palette.length],
            backgroundColor: "transparent",
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 0,
            tension: 0.25,
            spanGaps: false,
          })),
        ],
      },
      options: {
        ...base,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { ...(base.plugins || {}), eventMarkers: { events: axisEvents.onAxis } },
        scales: {
          ...base.scales,
          y: {
            ...(base.scales?.y || {}),
            title: { display: true, text: tr("조회→설치 전환율 (%)", "View-to-install rate (%)"), color: CHART_THEME.text },
            ticks: { ...(base.scales?.y?.ticks || {}), color: CHART_THEME.text },
          },
          x: {
            ...(base.scales?.x || {}),
            ticks: { ...(base.scales?.x?.ticks || {}), color: CHART_THEME.text, maxTicksLimit: 10 },
          },
        },
      },
    });
    chartInstance.current = instance;
    // 조건부 마운트(분석 게이트 뒤) 캔버스는 최초 폭이 0이라 한 번 강제 리사이즈(§7).
    requestAnimationFrame(() => instance.resize());

    return () => {
      instance.destroy();
      chartInstance.current = null;
    };
  }, [series, cutDate, axisEvents, isDarkMode, locale, tr]);

  const verdict = result?.verdict?.verdict;
  const decomposed = result?.decomposed;
  // fmtPct는 **비율**(0~1)을 받아 자기가 ×100 한다. 여기서 value*100을 넘기면
  // 두 번 곱해져 14.6%가 1464%로 나간다 — 실제로 그렇게 배포됐다.
  const pct = (value) => (value == null ? tr("계산 불가", "Not computable") : fmtPct(value, 2));

  const rateDelta = formatRateDelta(decomposed?.funnelBefore?.viewToInstall, decomposed?.funnelAfter?.viewToInstall);
  const installDelta = formatCountDelta(decomposed?.funnelBefore?.installs, decomposed?.funnelAfter?.installs);

  const headline =
    verdict === "mix"
      ? tr("트래픽 구성 변화가 주도 — 페이지가 아니라 유입 믹스", "Traffic mix drove it — not the page")
      : verdict === "efficiency"
        ? tr("소스별 전환율 변화가 주도 — 페이지·스토어 요소 점검", "Per-source conversion drove it — check the page")
        : verdict === "mixed"
          ? tr("구성과 효율이 함께 움직임", "Mix and efficiency moved together")
          : verdict === "flat"
            ? tr("의미 있는 변화 없음", "No meaningful change")
            : tr("판단 보류 — 기간 또는 설치가 부족", "Withheld — not enough periods or installs");

  const copy =
    verdict === "mix"
      ? tr(
          "소스별 전환율은 크게 안 변했는데 전환이 낮은 소스의 비중이 늘어 전체 전환율이 내려갔습니다. 이때 스크린샷·아이콘을 바꿔도 잘 안 풀립니다. 유입 구성이 왜 바뀌었는지(광고 증액·피처링·시즌)를 먼저 보세요.",
          "Per-source conversion barely moved; the blended rate fell because low-converting sources grew as a share. Changing screenshots rarely fixes this — start with why the traffic mix shifted (paid scaling, featuring, season).",
        )
      : verdict === "efficiency"
        ? tr(
            "트래픽 구성은 그대로인데 소스별 전환율 자체가 움직였습니다. 제품 페이지 요소(아이콘·스크린샷·평점)나 스토어 정책 변화를 보세요.",
            "The traffic mix held while per-source conversion itself moved. Look at product page elements (icon, screenshots, rating) or store policy changes.",
          )
        : verdict === "flat"
          ? tr("두 기간의 전환 구조가 사실상 같습니다. 지금 데이터로는 개선·악화 신호가 없습니다.", "The two periods are effectively identical. There is no improvement or decline signal in this data.")
          : tr(
              "분해하려면 앞뒤 기간 각각에 설치가 있어야 하고 날짜가 최소 4일 필요합니다. 기간을 늘려 다시 확인하세요.",
              "Decomposition needs installs in both halves and at least four distinct dates. Extend the period and re-check.",
            );

  const decisionPrefill = decomposed && ["mix", "efficiency", "mixed", "flat"].includes(verdict)
    ? {
        conclusion: headline,
        action: verdict === "mix"
          ? tr("유입 소스별 집행·피처링 변화를 확인하고 저전환 소스 비중을 조정한다", "Inspect source-level media or featuring changes and adjust the share of low-converting sources")
          : verdict === "efficiency"
            ? tr("제품 페이지 요소 한 가지를 바꾼 뒤 같은 기간 정의로 전환율을 다시 비교한다", "Change one product-page element, then compare conversion again using the same period definition")
            : verdict === "mixed"
              ? tr("유입 구성과 제품 페이지 변화의 가설을 각각 한 가지씩 분리해 검증한다", "Test one traffic-mix hypothesis and one product-page hypothesis separately")
              : tr("다음 비교 기간에 같은 소스·퍼널 기준으로 전환 변화를 다시 확인한다", "Recheck conversion in the next comparison window using the same source and funnel definition"),
        hypothesis: copy,
        metric: tr("조회→설치 전환율", "View-to-install conversion"),
        baseline: pct(result?.overall?.viewToInstall),
        sourcePeriod: tr("앞·뒤 비교 기간", "Earlier vs later comparison periods"),
        reviewQuestion: tr("다음 비교 기간에도 전체 전환율 변화의 주된 원인이 같은가?", "In the next comparison window, is the same factor still the main driver of total conversion change?"),
      }
    : null;

  const sourceRows = (decomposed?.entities || []).map((entity) => ({
    source: entity.key,
    // PVM의 cost/result는 여기서 조회/설치다. CPA는 "설치 1건당 조회 수"라 역수가 전환율.
    cvrBefore: entity.cost1 > 0 ? entity.result1 / entity.cost1 : null,
    cvrAfter: entity.cost2 > 0 ? entity.result2 / entity.cost2 : null,
    shareBefore: entity.s1,
    shareAfter: entity.s2,
    mix: entity.mix,
    rate: entity.rate,
  }));

  const downloadSourceCsv = () => {
    const cell = (value) => {
      const text = value == null ? "" : String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = ["source", "cvr_before", "cvr_after", "share_before", "share_after", "mix_effect", "efficiency_effect"];
    const lines = [header, ...sourceRows.map((row) => [
      row.source,
      row.cvrBefore ?? "",
      row.cvrAfter ?? "",
      row.shareBefore ?? "",
      row.shareAfter ?? "",
      row.mix ?? "",
      row.rate ?? "",
    ])].map((line) => line.map(cell).join(","));
    downloadCsv(`﻿${lines.join("\r\n")}\r\n`, "aso-store-conversion");
  };

  return (
    <ToolPageShell
      toolId={TOOL_ID}
      locale={locale}
      titleLevel={0}
      title={tr("ASO 스토어 전환 분석", "ASO Store Conversion Analysis")}
      summary={<p>{tr(
        "스토어 콘솔 CSV로 노출→제품페이지→설치 퍼널을 세우고, 전환율 변화가 트래픽 구성 탓인지 소스별 효율 탓인지 나눠 봅니다.",
        "Build the store funnel from a console CSV and split conversion change into traffic mix and per-source efficiency.",
      )}</p>}
    >
      <section className="block diagnostic-tool__rules" id="aso-setup">
        <h2 className="section-title">{tr("무엇을 가르나", "What it separates")}</h2>
        <p>{tr(
          "전체 스토어 전환율이 떨어졌을 때 원인은 둘입니다. 제품 페이지가 나빠졌거나(효율), 전환이 낮은 소스의 비중이 늘었거나(구성). 처방이 정반대라 섞인 채로는 어느 쪽도 못 고칩니다.",
          "A falling store conversion rate has two possible causes: the product page got worse (efficiency), or low-converting sources grew as a share (mix). The fixes are opposite, so neither can be addressed while they are blended.",
        )}</p>
      </section>

      <CsvUploader toolId={TOOL_ID} locale={locale} />

      {analyzed && result && <>
        <div id="aso-result"><ResultActionCard
          tone={verdict === "efficiency" ? "bad" : verdict === "mix" ? "neutral" : verdict === "flat" ? "good" : "neutral"}
          title={tr("판정", "Verdict")}
          headline={headline}
          points={[{ text: copy }]}
          stats={[
            { label: tr("전체 조회→설치", "Overall view-to-install"), value: pct(result.overall.viewToInstall) },
            { label: tr("앞 기간", "Earlier half"), value: pct(decomposed?.funnelBefore?.viewToInstall) },
            { label: tr("뒤 기간", "Later half"), value: pct(decomposed?.funnelAfter?.viewToInstall) },
          ]}
          toolId={TOOL_ID}
          analysisType="aso_store_conversion"
          analysisKey={`${verdict || "unknown"}:${result.overall.installs}`}
          resultState={decomposed ? "ready" : "blocked"}
          locale={locale}
          decisionReview={Boolean(decisionPrefill)}
          decisionPrefill={decisionPrefill}
          download={decomposed ? <DownloadHub toolId={TOOL_ID} locale={locale} label={tr("결과 받기", "Download results")} items={[
            { icon: "⬇", analyticsType: "csv", label: tr("소스별 분해 (CSV)", "Per-source decomposition (CSV)"), desc: tr("소스별 전환율·비중과 믹스·효율 기여", "Per-source conversion, share, and mix/efficiency contribution"), onSelect: downloadSourceCsv },
          ]} /> : null}
        /></div>

        {result.periods?.before && result.periods?.after && <section className="block" id="aso-periods">
          <h2 className="section-title">{tr("비교한 두 기간", "The two periods compared")}</h2>
          <dl className="period-compare">
            <div className="period-compare__cell">
              <dt>{tr("앞 기간", "Earlier")}</dt>
              <dd>{formatPeriod(result.periods.before, locale)}</dd>
            </div>
            <div className="period-compare__cell">
              <dt>{tr("뒤 기간", "Later")}</dt>
              <dd>{formatPeriod(result.periods.after, locale)}</dd>
            </div>
            <div className="period-compare__cell">
              <dt>{tr("조회→설치 변화", "View-to-install change")}</dt>
              <dd className={`period-compare__delta is-${rateDelta?.tone || "flat"}`}>{rateDelta?.text || "—"}</dd>
            </div>
            <div className="period-compare__cell">
              <dt>{tr("설치 변화", "Install change")}</dt>
              <dd className={`period-compare__delta is-${installDelta?.tone || "flat"}`}>{installDelta?.text || "—"}</dd>
            </div>
          </dl>
          <p className="muted">{result.periods.balance?.balanced
            ? tr(
                "두 기간의 데이터 일수가 같아 비율 비교가 공정합니다.",
                "Both periods cover the same number of days, so the rate comparison is like-for-like.",
              )
            : tr(
                `데이터가 있는 날이 앞 ${result.periods.balance?.beforeDays}일 · 뒤 ${result.periods.balance?.afterDays}일로 다릅니다. 비율은 그대로 비교할 수 있지만 합계(설치 수)는 길이 차이를 감안해 읽으세요.`,
                `Day counts differ (${result.periods.balance?.beforeDays} vs ${result.periods.balance?.afterDays}). Rates remain comparable, but read totals with that gap in mind.`,
              )}</p>
          <p className="muted">{tr(
            "%p는 절대 차이, 괄호 안 %는 상대 차이입니다. 전환율 30%가 40%가 되면 +10%p이자 +33.3%예요.",
            "%p is the absolute gap and the bracketed % is the relative change. 30% to 40% is +10pp and +33.3%.",
          )}</p>
        </section>}

        <section className="block" id="aso-funnel">
          <h2 className="section-title">{tr("스토어 퍼널", "Store funnel")}</h2>
          <DataTable
            columns={[
              { key: "stage", label: tr("단계", "Stage") },
              { key: "value", label: tr("값", "Value"), align: "right" },
            ]}
            rows={[
              { stage: tr("노출", "Impressions"), value: result.overall.impressions.toLocaleString() },
              { stage: tr("제품 페이지 조회", "Product page views"), value: result.overall.views.toLocaleString() },
              { stage: tr("설치", "Installs"), value: result.overall.installs.toLocaleString() },
              { stage: tr("노출→조회 (탭률)", "Impression to view (tap-through)"), value: pct(result.overall.tapThrough) },
              { stage: tr("조회→설치", "View to install"), value: pct(result.overall.viewToInstall) },
            ]}
          />
          {result.overall.tapThrough == null && <p className="muted">{tr(
            "노출 열이 없어 탭률은 계산하지 않았습니다. 조회→설치 전환은 그대로 유효합니다.",
            "No impressions column, so tap-through was not computed. View-to-install remains valid.",
          )}</p>}
        </section>

        {series && series.dates.length > 1 && <section className="block" id="aso-trend">
          <h2 className="section-title">{tr("전환율 추이", "Conversion trend")}</h2>
          <p className="muted">{tr(
            "굵은 선이 전체 전환율, 점선이 소스별 전환율입니다. 소스별 선은 그대로인데 전체만 내려갔다면 구성이 바뀐 것이고, 소스별 선이 같이 내려갔다면 페이지 쪽입니다.",
            "The solid line is the blended rate and the dashed lines are per-source rates. Per-source lines holding while the blended line falls means the mix moved; per-source lines falling together points at the page.",
          )}</p>
          <div className="chart-container" style={{ height: 320 }}><canvas ref={chartRef} /></div>
          {cutDate && <p className="muted">{tr(
            `앞뒤 비교 기준일은 ${cutDate}입니다. 이 날짜 이전이 앞 기간, 이후가 뒤 기간입니다.`,
            `The two halves split at ${cutDate} — earlier dates form the first period, later ones the second.`,
          )}</p>}
        </section>}

        <StoreEventLog locale={locale} csvEvents={csvEvents} mergedEvents={allEvents} offAxis={axisEvents.offAxis} />

        {sourceRows.length > 0 && <section className="block" id="aso-sources">
          <h2 className="section-title">{tr("소스별 분해", "Per-source breakdown")}</h2>
          <DataTable
            columns={[
              { key: "source", label: tr("유입 소스", "Source") },
              { key: "cvrBefore", label: tr("전환율(앞)", "CVR (earlier)"), align: "right" },
              { key: "cvrAfter", label: tr("전환율(뒤)", "CVR (later)"), align: "right" },
              { key: "shareBefore", label: tr("설치 비중(앞)", "Install share (earlier)"), align: "right" },
              { key: "shareAfter", label: tr("설치 비중(뒤)", "Install share (later)"), align: "right" },
            ]}
            rows={sourceRows.map((row) => ({
              source: row.source,
              cvrBefore: pct(row.cvrBefore),
              cvrAfter: pct(row.cvrAfter),
              shareBefore: pct(row.shareBefore),
              shareAfter: pct(row.shareAfter),
            }))}
          />
          <p className="muted">{tr(
            "비중은 설치 수 기준입니다(§PVM — shift-share의 비중은 결과량 share).",
            "Share is measured on installs, following the shift-share definition.",
          )}</p>
        </section>}

        <section className="block" id="aso-honesty">
          <h2 className="section-title">{tr("정직하게", "Let's be honest")}</h2>
          <p>{tr(
            "이 분해는 관측 데이터에서 '어디를 볼지'를 좁혀줄 뿐 인과를 증명하지 않습니다. 같은 기간에 광고 증액·피처링·시즌이 함께 움직였다면 믹스 변화의 원인까지는 이 표로 알 수 없습니다.",
            "This decomposition narrows where to look; it does not establish cause. If paid scaling, featuring, or seasonality moved in the same window, this table cannot tell you why the mix shifted.",
          )}</p>
          <p>{tr(
            "유료 유입이 오가닉을 잠식하는지가 궁금하면 증분 분석으로, 스크린샷·아이콘 변경 효과를 확정하려면 스토어 실험(App Store PPO·Play 스토어 등록정보 실험)으로 가야 합니다.",
            "To test whether paid traffic is displacing organic, use incrementality analysis; to confirm a screenshot or icon change, use a store experiment (App Store PPO or Play store listing experiments).",
          )}</p>
        </section>
      </>}
    </ToolPageShell>
  );
}
