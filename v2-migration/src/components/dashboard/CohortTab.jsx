"use client";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import PillGroup from "@/components/ds/PillGroup";
import Chart from "@/utils/chartGlobals";
import { useAppStore } from "@/store/useDataStore";
import CustomChartsSection from "./CustomChartsSection";
import { getMonFilteredRows, effectiveDenomBasis, computeWeightedRetention } from "@/utils/dashboardAggregator";
import { CHART_THEME, chartCommonOpts, getCssVar } from "@/utils/chartUtils";
import { fitPowerCurve, filterMaturedCohorts, retentionDays } from "@/utils/cohortMath";
import { maturityCutoffDate, parseSnapshotDate, resolveRetentionSnapshot, snapshotDateForRow } from "@/utils/retentionSnapshot";
import { applyMetricView } from "@/utils/metrics/metricView";
import MetricConfigPanel from "@/components/ds/MetricConfigPanel";
import AnalysisDetails from "@/components/ds/AnalysisDetails";
import DataTable from "@/components/ds/DataTable";

// 지표 뷰 설정 scope — §1 전체 리텐션 곡선 표의 지표 컬럼 표시/순서.
const COHORT_TABLE_SCOPE = "5-2:cohort-table";

export default function CohortTab({ locale = "ko" } = {}) {
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  const csvData = useAppStore((state) => state.csvData);
  const setCsvData = useAppStore((state) => state.setCsvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  // 전역 분모 기준(설치/가입) 구독 — index.html MON_DENOM_STATE 이식(§12.18).
  // 리텐션 기준 토글은 이 전역 상태를 바꿔 스코어카드·LTV 탭과 동기화된다.
  const denomBasis = useAppStore((state) => state.denomBasis);
  const setDenomBasis = useAppStore((state) => state.setDenomBasis);
  // 코호트 마감 필터(§7 미마감 부풀림 방지) — 오늘 기준 D일이 지난 코호트만 집계.
  const matureCohortOnly = useAppStore((state) => state.matureCohortOnly);
  const setMatureCohortOnly = useAppStore((state) => state.setMatureCohortOnly);

  // 다크모드 토글 시 차트 재렌더 트리거(테마색 refresh, §12.20 패턴).
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const cohortTableCfg = useAppStore((state) => state.viewConfig[COHORT_TABLE_SCOPE]);
  const setViewConfig = useAppStore((state) => state.setViewConfig);
  const resetViewConfig = useAppStore((state) => state.resetViewConfig);
  const [cohortCfgOpen, setCohortCfgOpen] = useState(false);
  const [snapshotDraft, setSnapshotDraft] = useState("");

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const segmentChartRefs = useRef({});
  const segmentChartInstancesRef = useRef({});

  // 실제 오늘이 아니라 "이 파일이 어디까지 관측했는가"를 기준으로 Dn 마감을
  // 판단한다. dashboardFilter는 결과 범위일 뿐 snapshot 추정에는 영향을 주지 않는다.
  const maturitySnapshot = useMemo(() => {
    const allRows = getMonFilteredRows(csvData, {});
    const base = resolveRetentionSnapshot({
      rows: allRows,
      fileName: csvData?.fileName,
      fileModifiedAt: csvData?.fileModifiedAt,
      manualDate: csvData?.retentionSnapshotOverride,
    });
    return { ...base, getDateForRow: (row) => snapshotDateForRow(base, row) };
  }, [csvData]);

  const saveSnapshotOverride = () => {
    const date = parseSnapshotDate(snapshotDraft);
    if (!date || !csvData) return;
    setCsvData({ ...csvData, retentionSnapshotOverride: date });
  };

  const { wrc, hasData, canActions, canInstalls } = useMemo(() => {
    if (!csvData || !csvData.raw || csvData.raw.length === 0) return { hasData: false };

    const rows = getMonFilteredRows(csvData, dashboardFilter);
    const mapping = csvData.mapping || {};
    const mapped = new Set(Object.values(mapping));

    const _canActions = mapped.has("actions");
    const _canInstalls = mapped.has("installs");

    // anchor = 전역 분모 기준(설치/가입). effectiveDenomBasis가 미매핑 자동 폴백.
    const anchor = effectiveDenomBasis(csvData, denomBasis);
    // D0은 항상 100% 앵커(설치/가입일=전원 잔존), D1 지원(브랜치 43e5950).
    // ret_dN(N≥1)이 하나라도 매핑됐을 때만 D0 prepend.
    const retDays = retentionDays(mapped);

    if (retDays.length === 0) return { hasData: false, canActions: _canActions, canInstalls: _canInstalls };

    // SSOT 가중 리텐션(computeWeightedRetention) — 비율/인원 자동 판별 + 모수 가중.
    // wholePct 여부는 각 점에 실어두고 렌더 후 파생(closure 재할당 금지 — react-hooks/immutability).
    const wgtCurve = (subset) =>
      retDays
        .map((day) => {
          // D0 = 항상 100%(설치/가입일 전원 잔존). 모수 = anchor 코호트 크기(마감 필터 무관).
          if (day === 0) {
            const n = subset.reduce((s, r) => s + (Number(r[anchor]) || 0), 0);
            if (!n) return null;
            return { day: 0, retentionRate: 1, n, survivors: n, wholePct: false };
          }
          // 마감 필터: 분자·분모 둘 다 동일 필터(분모만 필터하면 오히려 더 부풀려짐).
          const scoped = filterMaturedCohorts(subset, day, matureCohortOnly, maturitySnapshot);
          const r = computeWeightedRetention(scoped, day, anchor);
          if (r.rate == null) return null;
          return { day, retentionRate: r.rate, n: r.denom, survivors: r.survivors, wholePct: !!r.hasWholePct };
        })
        .filter(Boolean);

    const retCurve = wgtCurve(rows);

    // 세그먼트별 곡선(채널/국가/플랫폼) — 각 그룹당 상위 12개, 정렬은 index와 동일(가나다).
    const bySeg = {};
    for (const sk of ["channel", "country", "platform"]) {
      if (!mapped.has(sk)) continue;
      const groups = [...new Set(rows.map((r) => String(r[sk] || "")).filter(Boolean))].sort();
      bySeg[sk] = {};
      for (const g of groups.slice(0, 12)) {
        bySeg[sk][g] = wgtCurve(rows.filter((r) => String(r[sk] || "") === g));
      }
    }

    // 전체 리텐션 곡선(scorecard 기준)에 정수 퍼센트 의심값이 있으면 경고.
    const anyWholePct = retCurve.some((p) => p.wholePct);

    // power-law 외삽 — day>0 & rate>0 관측점만(D0은 정의상 1, 외삽 왜곡 방지).
    const predPts = retCurve.filter((p) => p.day > 0 && p.retentionRate > 0);
    const pwr = predPts.length >= 2
      ? fitPowerCurve(predPts.map((p) => p.day), predPts.map((p) => p.retentionRate))
      : null;

    return {
      hasData: true,
      wrc: {
        anchor,
        retDays,
        retCurve,
        bySegment: bySeg,
        pwr,
        wholePctWarn: anyWholePct,
        maturitySnapshot,
      },
      canActions: _canActions,
      canInstalls: _canInstalls
    };
  }, [csvData, dashboardFilter, denomBasis, matureCohortOnly, maturitySnapshot]);

  useEffect(() => {
    if (!hasData || !wrc.retCurve.length || !chartRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const curve = wrc.retCurve;
    const labels = curve.map(p => `D${p.day}`);
    const data = curve.map(p => p.retentionRate * 100);

    chartInstanceRef.current = new Chart(chartRef.current.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: tr("전체 리텐션 (%)", "Overall Retention (%)"),
          data,
          borderColor: CHART_THEME.primary,
          backgroundColor: "rgba(173,198,255,0.2)",
          fill: true,
          tension: 0.2,
          pointRadius: 3,
          pointBackgroundColor: CHART_THEME.primary,
        }]
      },
      options: {
        ...chartCommonOpts(),
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...chartCommonOpts().plugins,
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: getCssVar("--text-muted"), maxTicksLimit: 14 }, grid: { color: getCssVar("--border") } },
          y: { ticks: { color: getCssVar("--text-muted") }, grid: { color: getCssVar("--border") } }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [hasData, wrc, isDarkMode, locale, tr]);

  // Segment Charts
  useEffect(() => {
    if (!hasData || !wrc.bySegment) return;
    const PALETTE = CHART_THEME.colors; // 테마 전환 대응(감사 P1-14)
    
    const segmentChartInstances = segmentChartInstancesRef.current;
    Object.keys(wrc.bySegment).forEach(sk => {
      const canvas = segmentChartRefs.current[sk];
      if (!canvas) return;
      if (segmentChartInstances[sk]) segmentChartInstances[sk].destroy();
      
      const groups = Object.keys(wrc.bySegment[sk]);
      const datasets = groups.map((g, gi) => {
        // wgtCurve는 [{day, retentionRate, ...}] 배열 → day→rate 조회 맵.
        const byDay = {};
        wrc.bySegment[sk][g].forEach((p) => { byDay[p.day] = p.retentionRate; });
        const data = wrc.retDays.map(d => (byDay[d] != null ? byDay[d] * 100 : null));
        return {
          label: g.slice(0, 20),
          data,
          borderColor: PALETTE[gi % PALETTE.length],
          backgroundColor: PALETTE[gi % PALETTE.length],
          fill: false,
          tension: 0.2,
          pointRadius: 2,
        };
      });

      segmentChartInstances[sk] = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: { labels: wrc.retDays.map(d => `D${d}`), datasets },
        options: {
          ...chartCommonOpts(),
          responsive: true,
          maintainAspectRatio: false,
          plugins: { ...chartCommonOpts().plugins, legend: { labels: { color: getCssVar("--text-muted"), font: { size: 10 } } } },
          scales: {
            x: { ticks: { color: getCssVar("--text-muted") }, grid: { color: getCssVar("--border") } },
            y: { ticks: { color: getCssVar("--text-muted") }, grid: { color: getCssVar("--border") } }
          }
        }
      });
    });

    return () => {
      Object.values(segmentChartInstances).forEach(c => c && c.destroy());
    };
  }, [hasData, wrc, isDarkMode, tr]);

  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-cohort">
        <section className="block" id="s-retention">
          <h2 className="section-title">{tr("리텐션 곡선", "Retention Curve")}</h2>
          <div className="callout warn">
            <div className="ico">!</div>
            <div className="body">
              <strong>{tr("리텐션 데이터 없음", "No retention data")}</strong>
              <p>{tr(
                <>효율 CSV에 <code>ret_d30</code>, <code>ret_d90</code> 등 Retention(Dn) 컬럼을 매핑하세요.</>,
                <>Map Retention(Dn) columns like <code>ret_d30</code>, <code>ret_d90</code> in the efficiency CSV.</>
              )}</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const fmtPct = (v) => (v == null ? "—" : (v * 100).toFixed(1) + "%");
  const anchorLabel = wrc.anchor === "actions" ? tr("가입(액션)", "Signup (Action)") : tr("설치", "Install");
  const survLabel = wrc.anchor === "actions" ? tr("잔존 가입자 수", "Retained Signups") : tr("잔존 유저 수", "Retained Users");
  const snapshotSourceLabel = {
    manual: tr("직접 입력", "Manual input"),
    snapshot_column: tr("CSV 기준일 컬럼", "CSV snapshot column"),
    filename: tr("파일명 날짜", "Filename date"),
    data_max_date: tr("데이터 내 최대 날짜", "Latest date in data"),
    file_modified: tr("파일 수정 시각", "File modified time"),
    unknown: tr("기준일을 찾지 못함", "No snapshot date found"),
  }[maturitySnapshot.source] || maturitySnapshot.source;
  const confidenceLabel = {
    high: tr("높음", "High"),
    medium: tr("중간(추정)", "Medium (estimated)"),
    low: tr("낮음(보수 버퍼 적용)", "Low (conservative buffer applied)"),
    unknown: tr("알 수 없음", "Unknown"),
  }[maturitySnapshot.confidence] || maturitySnapshot.confidence;
  const longestObservedDay = Math.max(...wrc.retDays);
  const maturityCutoff = maturityCutoffDate(longestObservedDay, maturitySnapshot);

  const renderSegmentChart = (sk, label) => {
    return (
      <div key={sk} style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: ".05em" }}>
          {label}
        </div>
        <div className="chart-container" style={{ height: "200px" }}>
          <canvas id={`wide-ret-seg-${sk}`} ref={el => segmentChartRefs.current[sk] = el}></canvas>
        </div>
      </div>
    );
  };

  const horizons = [90, 180, 360].filter(d => !wrc.retDays.includes(d));

  // §1 리텐션 표 지표 컬럼 — 첫 컬럼 '구간'은 고정, 나머지만 표시/순서 토글(값 불변).
  const cohortCols = [
    { k: "rate", label: tr("잔존율", "Retention Rate"), render: (p) => fmtPct(p.retentionRate) },
    { k: "survivors", label: survLabel, render: (p) => (p.survivors || 0).toLocaleString() },
  ];
  const orderedCohortCols = applyMetricView(cohortCols, cohortTableCfg, (col) => col.k);

  return (
    <div className="tab-pane active" id="tab-cohort">
      <section className="block" id="s-retention">
        <h2 className="section-title">{tr("전체 리텐션 곡선", "Overall Retention Curve")}</h2>

        {canActions && canInstalls && (
          <PillGroup
            style={{ marginBottom: "10px" }}
            label={tr("리텐션 기준", "Retention basis")}
            value={wrc.anchor === "actions" ? "actions" : "installs"}
            onChange={setDenomBasis}
            options={[
              { value: "installs", label: tr("설치 기준", "By Install") },
              { value: "actions", label: tr("가입(액션) 기준", "By Signup (Action)") },
            ]}
          />
        )}

        <div className="callout" style={{ marginBottom: "10px" }}>
          <div className="ico">◷</div>
          <div className="body">
            <strong>{tr("리텐션 데이터 기준일", "Retention data snapshot")}: {maturitySnapshot.date || "—"}</strong>
            <p style={{ margin: ".25rem 0 0", fontSize: "11.5px" }}>
              {tr(
                <>근거: <strong>{snapshotSourceLabel}</strong> · 신뢰도: <strong>{confidenceLabel}</strong>{maturitySnapshot.perRow ? ` · ${maturitySnapshot.validRowDateCount.toLocaleString()}행별 기준` : ""}</>,
                <>Source: <strong>{snapshotSourceLabel}</strong> · confidence: <strong>{confidenceLabel}</strong>{maturitySnapshot.perRow ? ` · ${maturitySnapshot.validRowDateCount.toLocaleString()} row-level dates` : ""}</>
              )}
              {maturityCutoff && tr(
                <> · D{longestObservedDay}는 <strong>{maturityCutoff} 이전·당일</strong> 코호트만 마감으로 봅니다.</>,
                <> · For D{longestObservedDay}, only cohorts on or before <strong>{maturityCutoff}</strong> are mature.</>
              )}
            </p>
            <details open={maturitySnapshot.source === "unknown"} style={{ marginTop: "8px" }}>
              <summary style={{ cursor: "pointer", fontSize: "11px", color: "var(--text-muted)" }}>{tr("기준일 수정·확인", "Edit or confirm snapshot date")}</summary>
              <div style={{ display: "flex", alignItems: "end", gap: "8px", flexWrap: "wrap", marginTop: "7px" }}>
                <label style={{ display: "grid", gap: "3px", fontSize: "11px", color: "var(--text-muted)" }}>
                  {tr("기준일 직접 지정", "Set snapshot date")}
                  <input type="date" value={snapshotDraft} onChange={(event) => setSnapshotDraft(event.target.value)} style={{ minHeight: "32px" }} aria-label={tr("리텐션 데이터 기준일 직접 지정", "Set retention data snapshot date")} />
                </label>
                <button className="ab-pill" onClick={saveSnapshotOverride} disabled={!parseSnapshotDate(snapshotDraft)}>{tr("기준일 적용", "Apply date")}</button>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {tr("오늘 날짜를 쓰지 않습니다. 과거 다운로드 파일이면 실제 추출 기준일을 입력하세요.", "Today is never used. For an older export, enter its actual extraction date.")}
                </span>
              </div>
            </details>
          </div>
        </div>

        <PillGroup
          style={{ marginBottom: "10px" }}
          label={tr("코호트 마감", "Cohort maturity")}
          labelTitle={tr(
            "아직 D일이 지나지 않은(미마감) 최근 코호트는 잔존율을 왜곡시킵니다. '마감만'은 데이터 기준일로 D일이 지난 코호트만 분자·분모 양쪽에서 집계.",
            "Recent cohorts that haven't yet reached day D (immature) distort the retention rate. \"Matured only\" aggregates both numerator and denominator using only cohorts that have passed day D as of the data snapshot."
          )}
          value={matureCohortOnly ? "matured" : "all"}
          onChange={(next) => setMatureCohortOnly(next === "matured")}
          options={[
            { value: "all", label: tr("전체 포함", "Include All") },
            { value: "matured", label: tr("마감된 코호트만", "Matured Only") },
          ]}
        />

        <AnalysisDetails
          locale={locale}
          statusLabel={wrc.retCurve.length ? tr("가중 집계", "Weighted aggregate") : tr("판정 보류", "Abstain")}
          statusTone={wrc.retCurve.length ? "neutral" : "warning"}
          metric={tr("리텐션율·잔존 인원", "Retention rate · retained users")}
          unit="rate / users"
          meaning={tr("코호트 크기로 가중한 관측 리텐션입니다. 마감 여부는 오늘이 아닌 이 데이터의 기준일로 판단합니다.", "Observed retention weighted by cohort size. Maturity is evaluated from this dataset's snapshot date, not today.")}
          sampleSize={{ value: wrc.retCurve[0]?.n || 0, label: tr("기준 모수", "Base denominator"), detail: tr(`${wrc.anchor === "actions" ? "가입(액션)" : "설치"} 기준`, `By ${wrc.anchor === "actions" ? "signup/action" : "install"}`) }}
          scope={wrc.retDays.length ? `D${Math.min(...wrc.retDays)}–D${Math.max(...wrc.retDays)}` : ""}
          method="cohort-size-weighted-retention"
          version="cohort-retention-v1"
          metricDefinition={tr("Σ잔존 인원 ÷ Σ기준 모수; ret_dN이 0~1이면 모수로 환산하고 정수면 인원수로 합산합니다.", "Σ retained users ÷ Σ base denominator; 0–1 ret_dN values are converted by the base, while whole numbers are treated as headcounts.")}
          warnings={[
            ...(matureCohortOnly ? [] : [tr("마감만을 끄면 최근 미마감 코호트가 포함되어 장기 리텐션이 낮거나 높게 보일 수 있습니다.", "Including immature cohorts can make long-horizon retention look biased.")]),
            ...(maturitySnapshot.confidence === "unknown" ? [tr("데이터 기준일을 확인할 수 없습니다. 마감된 코호트만 보려면 실제 추출일을 직접 지정하세요.", "The data snapshot date is unknown. Set the actual extraction date before using matured cohorts only.")] : []),
            ...(maturitySnapshot.confidence === "low" ? [tr(`파일 수정 시각을 임시 기준으로 사용해 ${maturitySnapshot.bufferDays}일 보수 버퍼를 더했습니다. 실제 추출일을 확인하세요.`, `The file modified time is a temporary reference, so a ${maturitySnapshot.bufferDays}-day conservative buffer is applied. Confirm the real extraction date.`)] : []),
            ...(wrc.wholePctWarn ? [tr("정수 퍼센트 입력은 인원수로 해석됐습니다.", "Whole-number percentage-like inputs were interpreted as headcounts.")] : []),
          ]}
        />

        <div className="chart-container" style={{ height: "220px" }}>
          <canvas id="wide-ret-curve" ref={chartRef}></canvas>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", margin: "14px 0 -6px" }}>
          <button className="ab-pill" onClick={() => setCohortCfgOpen(true)} title={tr("표시할 지표 컬럼과 순서 편집", "Edit displayed metric columns and order")}>{tr("⚙ 컬럼 편집", "⚙ Edit columns")}</button>
        </div>
        <DataTable
          ariaLabel={tr("코호트 구간별 리텐션", "Retention by cohort period")}
          style={{ marginTop: "14px" }}
          tableStyle={{ fontSize: "12px" }}
          columns={[
            { key: "day", label: tr("구간", "Period"), fmt: (day) => `D${day}` },
            ...orderedCohortCols.map((col) => ({
              key: col.k,
              label: col.label,
              align: "right",
              fmt: (_, row) => col.render(row),
            })),
          ]}
          rows={wrc.retCurve}
          rowKey={(row) => row.day}
        />
        {orderedCohortCols.length === 0 && (
          <p className="muted" style={{ fontSize: "12px" }}>{tr("표시할 지표 컬럼이 없습니다. ⚙ 컬럼 편집에서 다시 켜세요.", "No metric columns are shown. Re-enable them in ⚙ Edit columns.")}</p>
        )}
        <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>
          {tr(
            <>{survLabel} = Σ(잔존 인원) ÷ Σ({anchorLabel} 모수). <code>ret_dN</code>이 <strong>0~1 비율</strong>이면 ×모수로 인원 환산, <strong>자연수면 인원수</strong> 그대로 합산합니다(코호트 크기 가중 — 단순평균 아님). 기준 토글은 모수({anchorLabel})를 바꿉니다.</>,
            <>{survLabel} = Σ(retained users) ÷ Σ(base of {anchorLabel}). If <code>ret_dN</code> is a <strong>0–1 rate</strong>, it&apos;s converted to a headcount (× base); if it&apos;s a <strong>whole number</strong>, it&apos;s summed as a headcount directly (weighted by cohort size — not a simple average). The basis toggle changes the base ({anchorLabel}).</>
          )}
        </p>
        {wrc.wholePctWarn && (
          <div className="callout warn" style={{ marginTop: "8px" }}>
            <div className="ico">!</div>
            <div className="body">
              <strong>{tr("리텐션 값이 1을 넘습니다(예: 30, 50)", "Retention values exceed 1 (e.g. 30, 50)")}</strong>
              <p style={{ margin: ".25rem 0 0", fontSize: "11.5px" }}>
                {tr(
                  <>정수 퍼센트(30=30%)가 아니라 <strong>잔존 인원수</strong>로 해석했습니다. 비율로 넣으려면 0~1(0.3·0.5)로, 인원수면 그대로 두세요.</>,
                  <>These were interpreted as <strong>retained headcount</strong>, not whole-number percentages (30=30%). Use 0–1 (0.3, 0.5) for rates, or leave as-is for headcounts.</>
                )}
              </p>
            </div>
          </div>
        )}
      </section>

      {Object.keys(wrc.bySegment).length > 0 && (
        <section className="block" id="s-ret-segment">
          <h2 className="section-title">{tr("세그먼트별 리텐션", "Retention by Segment")}</h2>
          {renderSegmentChart("channel", tr("채널", "Channel"))}
          {renderSegmentChart("country", tr("국가", "Country"))}
          {renderSegmentChart("platform", tr("플랫폼", "Platform"))}
        </section>
      )}

      {wrc.pwr && horizons.length > 0 && (
        <section className="block" id="s-ret-predict">
          <h2 className="section-title">{tr("리텐션 예측", "Retention Forecast")}</h2>
          <p className="muted" style={{ fontSize: "12px" }}>
            {tr(
              "관측된 Dn 데이터로 power-law 커브를 적합해 미관측 구간을 외삽합니다. 참고값으로만 사용하세요.",
              "Fits a power-law curve to the observed Dn data to extrapolate unobserved periods. Use as a reference value only."
            )}
          </p>
          <DataTable
            ariaLabel={tr("미관측 구간 리텐션 예측", "Retention forecast for unobserved periods")}
            style={{ marginTop: "8px" }}
            tableStyle={{ fontSize: "12px" }}
            columns={[
              { key: "day", label: tr("구간", "Period"), fmt: (day) => `D${day}` },
              {
                key: "prediction",
                label: tr("예측 잔존율", "Predicted Retention"),
                align: "right",
                cellStyle: { color: "var(--accent)" },
                fmt: (_, row) => fmtPct(Math.min(1, Math.max(0, wrc.pwr.a * Math.pow(row.day, wrc.pwr.b)))),
              },
              {
                key: "method",
                label: tr("방법", "Method"),
                align: "right",
                cellStyle: { color: "var(--text-muted)", fontSize: "11px" },
                fmt: () => tr("Power fit 외삽", "Power fit extrapolation"),
              },
            ]}
            rows={horizons.map((day) => ({ day }))}
            rowKey={(row) => row.day}
          />
        </section>
      )}
      <MetricConfigPanel
        open={cohortCfgOpen}
        onClose={() => setCohortCfgOpen(false)}
        locale={locale}
        title={tr("전체 리텐션 곡선 표 — 컬럼 편집", "Overall retention curve table — Edit columns")}
        items={cohortCols.map((col) => ({ key: col.k, label: col.label }))}
        config={cohortTableCfg}
        onSave={(next) => {
          if (!next.hidden.length && !next.order.length) resetViewConfig(COHORT_TABLE_SCOPE);
          else setViewConfig(COHORT_TABLE_SCOPE, next);
          setCohortCfgOpen(false);
        }}
      />
      <CustomChartsSection sectionNo="4" chartScope="5-2:cohort-charts" metricScope="5-2:viz-kpi" title={tr("커스텀 차트", "Custom Charts")} locale={locale} />
    </div>
  );
}
