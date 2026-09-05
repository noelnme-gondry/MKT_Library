"use client";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import PillGroup from "@/components/ds/PillGroup";
import Chart from "@/utils/chartGlobals";
import { useAppStore } from "@/store/useDataStore";
import CustomChartsSection from "./CustomChartsSection";
import { getMonFilteredRows } from "@/utils/dashboardAggregator";
import { CHART_THEME, chartCommonOpts, getCssVar } from "@/utils/chartUtils";
import { buildFunnelData, FUNNEL_FIELD_LABEL } from "@/utils/funnelMath";
import { applyMetricView } from "@/utils/metrics/metricView";
import MetricConfigPanel from "@/components/ds/MetricConfigPanel";
import DataTable from "@/components/ds/DataTable";

// 지표 뷰 설정 scope — §5 전체 퍼널 단계 표의 지표 컬럼 표시/순서.
const FUNNEL_TABLE_SCOPE = "5-2:funnel-table";

// funnelMath.js FUNNEL_FIELD_LABEL(ko 고정)의 EN 대응 — 엔진은 불변, 표시만 로컬 override.
const FUNNEL_FIELD_LABEL_EN = {
  channel: "Channel",
  country: "Country",
  platform: "OS",
};

const fmtPct = (v) => (v == null ? "—" : (v * 100).toFixed(2) + "%");
const fmtDelta = (d) => {
  if (d == null) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  return (
    <span style={{ color: d >= 0 ? "var(--success)" : "var(--danger)" }}>
      {d >= 0 ? "▲ +" : "▼ "}{(d * 100).toFixed(1)}%
    </span>
  );
};

export default function FunnelTab({ locale = "ko" } = {}) {
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  const fieldLabel = (key) => (locale === "en" ? FUNNEL_FIELD_LABEL_EN[key] : FUNNEL_FIELD_LABEL[key]) || key;
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const funnelTableCfg = useAppStore((state) => state.viewConfig[FUNNEL_TABLE_SCOPE]);
  const setViewConfig = useAppStore((state) => state.setViewConfig);
  const resetViewConfig = useAppStore((state) => state.resetViewConfig);
  const [funnelCfgOpen, setFunnelCfgOpen] = useState(false);

  const [unitField, setUnitField] = useState("_all");
  const [cvrStep, setCvrStep] = useState(2);
  const [weekdayAdj, setWeekdayAdj] = useState(false);

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const { cache, hasData, mappedKeys } = useMemo(() => {
    if (!csvData || !csvData.raw || csvData.raw.length === 0)
      return { hasData: false, mappedKeys: new Set() };
    const rows = getMonFilteredRows(csvData, dashboardFilter);
    const mapping = csvData.mapping || {};
    const mk = new Set(Object.values(mapping));
    const c = buildFunnelData(rows, mk, { unitField, cvrStep, weekdayAdj }, locale);
    if (!c.rows.length) return { hasData: false, mappedKeys: mk };
    return { cache: c, hasData: true, mappedKeys: mk };
  }, [csvData, dashboardFilter, unitField, cvrStep, weekdayAdj, locale]);

  const adjOn = weekdayAdj && cache && cache.weekdayAdjOk;

  useEffect(() => {
    if (!hasData || !cache) return;
    const daily = (cache.daily || []).filter((x) => x.cvr != null);
    if (daily.length < 3 || !chartRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const labels = daily.map((x) => x.date.slice(5));
    const cvrData = daily.map((x) =>
      +((adjOn && x.cvrAdj != null ? x.cvrAdj : x.cvr) * 100).toFixed(2)
    );
    const mean = cache.dailyMean != null ? +(cache.dailyMean * 100).toFixed(2) : null;
    const ptColors = daily.map((x) => ((adjOn ? x.lowAdj : x.low) ? CHART_THEME.danger : CHART_THEME.primary));
    const ptR = daily.map((x) => ((adjOn ? x.lowAdj : x.low) ? 4 : 2));
    const lbl = `${cache.selLabel || tr("선택 단계", "Selected stage")} CVR(%)${adjOn ? tr(" (요일보정)", " (weekday-adj)") : ""}`;

    const ds = [
      {
        label: lbl,
        data: cvrData,
        borderColor: CHART_THEME.primary,
        backgroundColor: getCssVar("--chart-primary-soft") || "rgba(143,177,255,0.12)",
        fill: true,
        tension: 0.2,
        pointRadius: ptR,
        pointBackgroundColor: ptColors,
        pointBorderColor: ptColors,
      },
    ];
    if (mean != null)
      ds.push({
        label: tr("평균", "Average"),
        data: daily.map(() => mean),
        borderColor: CHART_THEME.tertiary,
        borderDash: [5, 4],
        borderWidth: 1.5,
        pointRadius: 0,
      });

    chartInstanceRef.current = new Chart(chartRef.current.getContext("2d"), {
      type: "line",
      data: { labels, datasets: ds },
      options: {
        ...chartCommonOpts(),
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...chartCommonOpts().plugins,
          legend: { labels: { color: getCssVar("--text-muted"), font: { size: 11 } } },
        },
        scales: {
          x: { ticks: { color: getCssVar("--text-muted"), maxTicksLimit: 12 }, grid: { color: getCssVar("--border") } },
          y: { ticks: { color: getCssVar("--text-muted"), callback: (v) => v + "%" }, grid: { color: getCssVar("--border") } },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [hasData, cache, adjOn, isDarkMode, locale, tr]);

  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-funnel">
        <section className="block" id="s-funnel-wow">
          <h2 className="section-title">{tr("퍼널 진단", "Funnel diagnosis")}</h2>
          <p className="muted">{tr("데이터 없음", "No data")}</p>
        </section>
      </div>
    );
  }

  const c = cache;
  const bd = c.wowBiggestDrop;
  const rangeStr = c.wowRange ? `${c.wowRange.from} ~ ${c.wowRange.to}` : tr("최근 주", "recent week");
  const lows = adjOn ? (c.daily || []).filter((x) => x.lowAdj) : (c.daily || []).filter((x) => x.low);
  const selLbl = c.selLabel || tr("선택 단계", "Selected stage");

  const unitPills = [["_all", tr("전체", "All")], ["channel", tr("채널", "Channel")], ["country", tr("국가", "Country")], ["platform", "OS"]];

  // §5 전체 퍼널 단계 표 지표 컬럼(데이터 주도) — 단계별 건수 + 단계간 CVR.
  // 첫 컬럼 '단위'는 행 헤더라 고정, 나머지 지표 컬럼만 표시/순서 토글(render/값 불변).
  const funnelCols = [
    ...c.stages.map((s, si) => ({
      k: `cnt:${s.key}`,
      label: s.label,
      render: (r) => (r.steps[si].count || 0).toLocaleString(),
    })),
    ...c.stages.slice(1).map((s, i) => {
      const si = i + 1;
      const isSel = si === c.selStep;
      return {
        k: `cvr:${s.key}`,
        label: `→${s.label} CVR${isSel ? " ◆" : ""}`,
        cellStyle: isSel ? { background: "rgba(122,162,247,0.08)", fontWeight: 700 } : undefined,
        render: (r) => {
          const step = r.steps[si];
          return (
            <>
              {fmtPct(step.cvr)}
              {step.drop != null && <span style={{ color: "var(--text-muted)", fontSize: "12px" }}> ({tr("이탈", "drop")} {(step.drop * 100).toFixed(0)}%)</span>}
            </>
          );
        },
      };
    }),
  ];
  const orderedFunnelCols = applyMetricView(funnelCols, funnelTableCfg, (col) => col.k);

  return (
    <div className="tab-pane active" id="tab-funnel">
      {/* §1 주간 변화(WoW) */}
      <section className="block" id="s-funnel-wow">
        {!c.wow ? (
          <>
            <h2 className="section-title">{tr("주간 변화", "Weekly change")}</h2>
            <p className="muted" style={{ fontSize: "12px" }}>
              {tr(
                <>날짜 컬럼을 매핑하면 <strong>최근 주 vs 지난 주</strong> 단계별 전환율 변화를 볼 수 있습니다.</>,
                <>Map a date column to see <strong>this week vs last week</strong> stage-by-stage conversion changes.</>
              )}
            </p>
          </>
        ) : (
          <>
            <h2 className="section-title">{tr("주간 변화 — 지난 주 대비", "Weekly change — vs last week")}</h2>
            <p className="muted" style={{ fontSize: "12px", margin: "-4px 0 10px" }}>
              {tr(
                `이번 주(${rangeStr}) 단계별 전환율을 직전 주와 비교합니다. (최근 7개 영업일 vs 직전 7개)`,
                `Compares this week's (${rangeStr}) stage conversion rates to the prior week. (last 7 business days vs prior 7)`
              )}
            </p>
            {bd && bd.delta != null && bd.delta < 0 ? (
              <div className="callout warning">
                <div className="ico">!</div>
                <div className="body">
                  <p style={{ margin: 0, fontSize: "13px" }}>
                    {tr(
                      <><strong>{bd.label}</strong> 전환율이 지난 주 대비 가장 많이 떨어졌습니다 — {fmtDelta(bd.delta)}{" "}
                      <span style={{ color: "var(--text-muted)" }}>({fmtPct(bd.cvrLast)} → {fmtPct(bd.cvrThis)})</span></>,
                      <><strong>{bd.label}</strong> dropped the most vs last week — {fmtDelta(bd.delta)}{" "}
                      <span style={{ color: "var(--text-muted)" }}>({fmtPct(bd.cvrLast)} → {fmtPct(bd.cvrThis)})</span></>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="callout ok">
                <div className="ico">✓</div>
                <div className="body"><p style={{ margin: 0, fontSize: "13px" }}>{tr("지난 주 대비 전환율이 하락한 단계가 없습니다.", "No stage dropped in conversion rate vs last week.")}</p></div>
              </div>
            )}
            <div className="table-wrap" style={{ marginTop: "10px" }}>
              <table className="data" style={{ fontSize: "12px" }}>
                <thead><tr><th>{tr("전환 단계", "Stage")}</th><th>{tr("지난 주", "Last week")}</th><th>{tr("이번 주", "This week")}</th><th>{tr("변화", "Change")}</th></tr></thead>
                <tbody>
                  {c.wow.map((w) => (
                    <tr key={w.i} style={bd && w.i === bd.i && w.delta != null && w.delta < 0 ? { background: "rgba(248,113,113,0.06)" } : {}}>
                      <td><strong>{w.label}</strong></td>
                      <td className="tnum">{fmtPct(w.cvrLast)}</td>
                      <td className="tnum">{fmtPct(w.cvrThis)}</td>
                      <td className="tnum">{fmtDelta(w.delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* §2 컨트롤: 전환 단계 · 분리 단위 · 요일 보정 */}
      <section className="block" id="s-funnel-ctl" style={{ padding: "12px 16px" }}>
        <PillGroup
          style={{ marginBottom: "8px" }}
          label={tr("전환 단계", "Conversion stage")}
          value={c.selStep}
          onChange={setCvrStep}
          options={(c.trans || []).map((t) => ({ value: t.i, label: t.label }))}
        />
        <PillGroup
          style={{ marginBottom: "8px" }}
          label={tr("분리 단위", "Split by")}
          value={unitField}
          onChange={setUnitField}
          options={unitPills.map(([k, l]) => {
            const av = k === "_all" || mappedKeys.has(k);
            return { value: k, label: <>{l}{!av && " 🔒"}</>, disabled: !av };
          })}
        />
        <div className="ab-pillgroup" style={{ margin: 0 }}>
          <span className="ab-pillgroup-label">§3 {tr("요일", "Weekday")}</span>
          {c.weekdayAdjOk ? (
            <button className={`ab-pill ${adjOn ? "active" : ""}`} onClick={() => setWeekdayAdj((v) => !v)}>
              {tr("요일 보정", "Weekday adj.")} {adjOn ? "ON" : "OFF"}
            </button>
          ) : (
            <button className="ab-pill disabled" disabled title={tr("평일·주말 각 3일 이상 필요", "Needs 3+ weekday and 3+ weekend days")}>{tr("요일 보정", "Weekday adj.")} 🔒</button>
          )}
        </div>
        <p className="muted" style={{ fontSize: "12px", margin: "8px 0 0" }}>
          {tr(
            <>아래 추이·세그먼트·랭킹은 선택한 <strong>전환 단계({selLbl})</strong> 기준입니다.</>,
            <>The trend, segment, and ranking below are based on the selected <strong>conversion stage ({selLbl})</strong>.</>
          )}
        </p>
      </section>

      {/* §3 시계열 추이 + 평균 대비 저조일 */}
      {(c.daily || []).filter((x) => x.cvr != null).length >= 3 && (
        <section className="block" id="s-funnel-trend" style={{ marginTop: "24px" }}>
          <h2 className="section-title">{selLbl} CVR {tr("추이", "trend")}{adjOn ? tr(" (요일 보정)", " (weekday-adj)") : ""}</h2>
          {adjOn && c.weekdayProfile && (
            <div className="callout" style={{ margin: "0 0 8px", padding: "8px 12px" }}>
              <div className="ico">i</div>
              <div className="body">
                <p style={{ margin: 0, fontSize: "12px" }}>
                  {tr(
                    `💡 요일(평일/주말) 보정됨 — 같은 요일끼리 비교한 결과입니다. 평일 평균 ${(c.weekdayProfile.weekday * 100).toFixed(1)}% / 주말 평균 ${(c.weekdayProfile.weekend * 100).toFixed(1)}%.`,
                    `💡 Weekday-adjusted (weekday/weekend) — compares same-type days. Weekday avg ${(c.weekdayProfile.weekday * 100).toFixed(1)}% / weekend avg ${(c.weekdayProfile.weekend * 100).toFixed(1)}%.`
                  )}
                </p>
              </div>
            </div>
          )}
          <div className="chart-container" style={{ height: "240px" }}>
            <canvas id="funnel-trend-chart" ref={chartRef}></canvas>
          </div>
          {lows.length ? (
            <div className="callout" style={{ marginTop: "10px" }}>
              <div className="ico">!</div>
              <div className="body">
                <p style={{ margin: "0 0 4px", fontSize: "12px" }}>
                  <strong>{tr(`평균보다 유독 낮았던 날 (−1σ 이하${adjOn ? ", 요일 보정 후" : ""})`, `Days notably below average (−1σ or lower${adjOn ? ", after weekday adj." : ""})`)}</strong>
                </p>
                <p className="muted" style={{ margin: "0 0 6px", fontSize: "12px" }}>
                  {tr(
                    "기간 전체 평균과 비교한 것으로, 전날보다는 올랐지만 여전히 평균보다 낮은 날도 포함됩니다.",
                    "Compared against the full-period average — includes days that rose vs the prior day but were still below average."
                  )}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {lows.map((x) => {
                    const cv = adjOn ? x.cvrAdj : x.cvr;
                    const dp = adjOn ? x.devPctAdj : x.devPct;
                    const idx = (c.daily || []).findIndex((d) => d.date === x.date);
                    const prevRow = idx > 0 ? c.daily[idx - 1] : null;
                    const prevCv = prevRow ? (adjOn ? prevRow.cvrAdj : prevRow.cvr) : null;
                    const vsPrevUp = cv != null && prevCv != null ? cv > prevCv : null;
                    return (
                      <span key={x.date} className="chip warning" style={{ fontSize: "12px" }}>
                        {x.date} · {cv != null ? (cv * 100).toFixed(1) : "—"}%{" "}
                        <span style={{ color: "var(--text-secondary)" }}>({dp != null && dp < 0 ? "" : "+"}{dp != null ? (dp * 100).toFixed(0) : "—"}%)</span>
                        {vsPrevUp != null && (
                          <span style={{ color: "var(--text-secondary)", marginLeft: "4px" }} title={tr("전날 대비", "vs prior day")}>
                            {vsPrevUp ? tr("↑전일比", "↑ vs prev") : tr("↓전일比", "↓ vs prev")}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: "8px", fontSize: "12px" }}>{tr("평균보다 −1σ 이상 낮았던 날은 없습니다. CVR이 안정적입니다.", "No days fell −1σ or more below average. CVR is stable.")}</p>
          )}
        </section>
      )}

      {/* §4 세그먼트 랭킹 */}
      {c.segRank && (
        <section className="block" id="s-funnel-seg" style={{ marginTop: "24px" }}>
          <h2 className="section-title">{tr(`${fieldLabel(c.segRank.field) || c.segRank.field}별 ${selLbl} CVR`, `${selLbl} CVR by ${fieldLabel(c.segRank.field) || c.segRank.field}`)} — {tr("평균 대비", "vs average")}</h2>
          <p className="muted" style={{ fontSize: "12px", margin: "-4px 0 10px" }}>
            {tr(
              `평균(${fmtPct(c.segRank.avg)}) 대비 높은/낮은 ${fieldLabel(c.segRank.field) || c.segRank.field}. 분모 볼륨이 충분한 세그먼트만 표시합니다.`,
              `${fieldLabel(c.segRank.field) || c.segRank.field} above/below the average (${fmtPct(c.segRank.avg)}). Only segments with sufficient denominator volume are shown.`
            )}
          </p>
          <div className="table-wrap">
            <table className="data" style={{ fontSize: "12px" }}>
              <thead><tr><th>{fieldLabel(c.segRank.field) || c.segRank.field}</th><th>{selLbl} CVR</th><th>{tr("평균 대비", "vs average")}</th><th>{tr("분모 볼륨", "Denom. volume")}</th></tr></thead>
              <tbody>
                <tr><td colSpan="4" style={{ fontWeight: 700, color: "var(--success)", fontSize: "12px", paddingTop: "8px" }}>{tr(`▲ 잘 전환되는 ${fieldLabel(c.segRank.field) || c.segRank.field}`, `▲ Best-converting ${fieldLabel(c.segRank.field) || c.segRank.field}`)}</td></tr>
                {c.segRank.best.map((x) => {
                  const dev = c.segRank.avg > 0 ? (x.cvr - c.segRank.avg) / c.segRank.avg : 0;
                  return (
                    <tr key={"b-" + x.seg}>
                      <td><strong>{String(x.seg).slice(0, 24)}</strong></td>
                      <td className="tnum pos">{fmtPct(x.cvr)}</td>
                      <td className="tnum" style={{ color: dev >= 0 ? "var(--success)" : "var(--danger)" }}>{dev >= 0 ? "+" : ""}{(dev * 100).toFixed(0)}%</td>
                      <td className="tnum" style={{ color: "var(--text-muted)" }}>{(x.vol || 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
                <tr><td colSpan="4" style={{ fontWeight: 700, color: "var(--danger)", fontSize: "12px", paddingTop: "8px" }}>{tr(`▼ 전환이 낮은 ${fieldLabel(c.segRank.field) || c.segRank.field}`, `▼ Lowest-converting ${fieldLabel(c.segRank.field) || c.segRank.field}`)}</td></tr>
                {c.segRank.worst.map((x) => {
                  const dev = c.segRank.avg > 0 ? (x.cvr - c.segRank.avg) / c.segRank.avg : 0;
                  return (
                    <tr key={"w-" + x.seg}>
                      <td><strong>{String(x.seg).slice(0, 24)}</strong></td>
                      <td className="tnum neg">{fmtPct(x.cvr)}</td>
                      <td className="tnum" style={{ color: dev >= 0 ? "var(--success)" : "var(--danger)" }}>{dev >= 0 ? "+" : ""}{(dev * 100).toFixed(0)}%</td>
                      <td className="tnum" style={{ color: "var(--text-muted)" }}>{(x.vol || 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* §5 전체 퍼널 단계 표 */}
      <section className="block" id="s-funnel" style={{ marginTop: "24px" }}>
        <div className="section-head">
          <h2 className="section-title">{tr("전체 퍼널 단계 표", "Full funnel stage table")}</h2>
          <button className="ab-pill" onClick={() => setFunnelCfgOpen(true)} title={tr("표시할 지표 컬럼과 순서 편집", "Edit displayed metric columns and order")}>⚙ {tr("컬럼 편집", "Edit columns")}</button>
        </div>
        <DataTable
          ariaLabel={tr("전체 퍼널 단계", "Full funnel stages")}
          tableStyle={{ fontSize: "12px" }}
          columns={[
            { key: "unit", label: tr("단위", "Unit"), fmt: (unit) => <strong>{String(unit).slice(0, 24)}</strong> },
            ...orderedFunnelCols.map((col) => ({
              key: col.k,
              label: col.label,
              align: "right",
              cellStyle: col.cellStyle,
              fmt: (_, row) => col.render(row),
            })),
          ]}
          rows={c.rows.slice(0, 40)}
          rowKey={(row, index) => `${row.unit}-${index}`}
        />
        {orderedFunnelCols.length === 0 && (
          <p className="muted" style={{ fontSize: "12px" }}>{tr("표시할 지표 컬럼이 없습니다. ⚙ 컬럼 편집에서 다시 켜세요.", "No metric columns to display. Re-enable one via ⚙ Edit columns.")}</p>
        )}
        <div className="callout" style={{ marginTop: "10px" }}>
          <div className="ico">i</div>
          <div className="body">
            <p style={{ margin: 0, fontSize: "12px" }}>
              {tr(
                <>◆ = 선택한 전환 단계. 노출→클릭(CTR)은 보통 97~99% 이탈이 정상이므로 병목 판단에서 제외하고, <strong>클릭→설치 / 설치→액션</strong> 같은 후속 단계로 진단하세요.</>,
                <>◆ = selected conversion stage. Impression→Click (CTR) typically drops 97–99% normally, so exclude it from bottleneck judgment and diagnose later stages like <strong>Click→Install / Install→Action</strong> instead.</>
              )}
            </p>
          </div>
        </div>
      </section>
      <MetricConfigPanel
        open={funnelCfgOpen}
        onClose={() => setFunnelCfgOpen(false)}
        locale={locale}
        title={tr("전체 퍼널 단계 표 — 컬럼 편집", "Full funnel stage table — Edit columns")}
        items={funnelCols.map((col) => ({ key: col.k, label: col.label }))}
        config={funnelTableCfg}
        onSave={(next) => {
          if (!next.hidden.length && !next.order.length) resetViewConfig(FUNNEL_TABLE_SCOPE);
          else setViewConfig(FUNNEL_TABLE_SCOPE, next);
          setFunnelCfgOpen(false);
        }}
      />
      <CustomChartsSection sectionNo="6" chartScope="5-2:funnel-charts" metricScope="5-2:viz-kpi" title={tr("커스텀 차트", "Custom charts")} locale={locale} />
    </div>
  );
}
