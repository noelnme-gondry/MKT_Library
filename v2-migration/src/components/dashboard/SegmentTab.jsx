"use client";
import React, { useState, useMemo, useCallback } from "react";
import PillGroup from "@/components/ds/PillGroup";
import { useAppStore } from "@/store/useDataStore";
import { getMonFilteredRows, fmtCurrencyPrecise } from "@/utils/dashboardAggregator";
import { segmentMetricValue, buildSegmentGrid } from "@/utils/segmentMath";
import CustomChartsSection from "./CustomChartsSection";

export default function SegmentTab({ locale = "ko" } = {}) {
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  // 엔진(segmentMath)이 빈 값에 붙이는 "(미지정)"·"전체" 그룹 라벨 렌더층 로컬라이즈.
  const luLabel = (k) => (k === "(미지정)" ? tr("(미지정)", "(unspecified)") : k === "전체" ? tr("전체", "All") : k);
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const displayCurrency = useAppStore((state) => state.displayCurrency);

  const [rowAxis, setRowAxis] = useState("channel");
  const [colAxis, setColAxis] = useState("country");
  const [metric, setMetric] = useState("cpi");

  const { grid, rowKeys, colKeys, hasData, availFields, mappedKeys } = useMemo(() => {
    if (!csvData || !csvData.raw || csvData.raw.length === 0) return { hasData: false, availFields: [] };

    const rows = getMonFilteredRows(csvData, dashboardFilter);
    const mapping = csvData.mapping || {};

    const _availFields = [
      { k: "country", l: tr("국가", "Country") },
      { k: "channel", l: tr("채널", "Channel") },
      { k: "platform", l: "OS" },
      { k: "campaign_name", l: tr("캠페인", "Campaign") }
    ];
    
    const hasField = (k) => Object.values(mapping).includes(k);

    const _mappedKeys = {
      impressions: hasField("impressions") ? "impressions" : null,
      clicks: hasField("clicks") ? "clicks" : null,
      installs: hasField("installs") ? "installs" : null,
      actions: hasField("actions") ? "actions" : null,
      revenue_d7: hasField("revenue_d7") ? "revenue_d7" : null,
    };

    const { grid: _grid, rows: _rowKeys, cols: _colKeys } = buildSegmentGrid(rows, rowAxis, colAxis);

    return { hasData: true, grid: _grid, rowKeys: _rowKeys, colKeys: _colKeys, availFields: _availFields, mappedKeys: _mappedKeys, hasField };
  }, [csvData, dashboardFilter, rowAxis, colAxis, tr]);

  const METRICS = {
    cpi: { label: "CPI", better: "low", val: c => segmentMetricValue(c, "cpi"), fmt: c => { const v = segmentMetricValue(c, "cpi"); return v != null ? fmtCurrencyPrecise(v, displayCurrency) : "—"; } },
    cpa: { label: "CPA", better: "low", val: c => segmentMetricValue(c, "cpa"), fmt: c => { const v = segmentMetricValue(c, "cpa"); return v != null ? fmtCurrencyPrecise(v, displayCurrency) : "—"; } },
    cvr: { label: "CVR", better: "high", val: c => segmentMetricValue(c, "cvr"), fmt: c => { const v = segmentMetricValue(c, "cvr"); return v != null ? (v * 100).toFixed(2) + "%" : "—"; } },
    ctr: { label: "CTR", better: "high", val: c => segmentMetricValue(c, "ctr"), fmt: c => { const v = segmentMetricValue(c, "ctr"); return v != null ? (v * 100).toFixed(2) + "%" : "—"; } },
    // ROAS: index.html은 cost>0 && rev>0일 때만 표시(분자 0이어도 0%가 아니라 "—" — 매출 데이터 자체가 없다는 뜻), 소수 없이 표시.
    roas: { label: "ROAS (D7)", better: "high", val: c => segmentMetricValue(c, "roas"), fmt: c => { const v = segmentMetricValue(c, "roas"); return (c.cost > 0 && c.rev > 0 && v != null) ? (v * 100).toFixed(0) + "%" : "—"; } },
    cost: { label: "Cost", better: "none", val: c => segmentMetricValue(c, "cost"), fmt: c => fmtCurrencyPrecise(c.cost, displayCurrency) }
  };

  const renderMatrix = (renderMetric) => {
    if (!grid || !rowKeys.length) return <p className="muted">{tr("데이터 없음", "No data")}</p>;
    
    const met = METRICS[renderMetric];
    const vals = [];
    grid.forEach(row => row.forEach(cell => {
      if (cell) {
        const v = met.val(cell);
        if (v != null && isFinite(v)) vals.push(v);
      }
    }));
    
    const vmin = Math.min(...vals) || 0;
    const vmax = Math.max(...vals) || 0;
    const span = (vmax - vmin) || 1;

    const getBg = (v) => {
      if (v == null || !isFinite(v) || met.better === "none") return "transparent";
      let t = (v - vmin) / span;
      if (met.better === "low") t = 1 - t;
      const g = Math.round(34 + t * (180 - 34));
      const r = Math.round(248 - t * (248 - 60));
      return `rgba(${r},${g},90,0.18)`;
    };

    return (
      <>
        <div className="table-wrap">
          <table className="data" style={{ fontSize: "11.5px" }}>
            <thead>
              <tr>
                <th>{availFields.find(f => f.k === rowAxis)?.l} ↓ \ {availFields.find(f => f.k === colAxis)?.l} →</th>
                {colKeys.map(ck => <th key={ck}>{luLabel(ck).slice(0, 16)}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, i) => (
                <tr key={rowKeys[i]}>
                  <th>{luLabel(rowKeys[i]).slice(0, 20)}</th>
                  {row.map((cell, ci) => {
                    if (!cell) return <td key={ci} className="tnum">—</td>;
                    const v = met.val(cell);
                    return (
                      <td key={ci} className="tnum" style={{ background: getBg(v) }}>
                        {met.fmt(cell)}
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {fmtCurrencyPrecise(cell.cost, displayCurrency)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: "8px", fontSize: "11px" }}>
          {tr("셀 하단 작은 숫자는 해당 조합의 비용(규모). 진한 초록=상대적으로 우수, 빨강=열위.", "The small number under each cell is that combination's cost (scale). Deep green = relatively strong, red = weak.")} {met.better === "none" ? tr("(Cost는 규모 지표라 색 없음)", "(Cost is a scale metric, so no color)") : ""}
        </p>
      </>
    );
  };

  if (!hasData) {
    return (
      <div className="tab-pane active" id="tab-segment">
        <section className="block" id="s-matrix">
          <h2 className="section-title">{tr("세그먼트 효율 매트릭스", "Segment efficiency matrix")}</h2>
          <p className="muted">{tr("데이터 없음", "No data")}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="tab-pane active" id="tab-segment">
      <section className="block" id="s-matrix">
        <h2 className="section-title">{tr("세그먼트 효율 매트릭스", "Segment efficiency matrix")}</h2>

        <PillGroup
          label={tr("행 축", "Row axis")}
          value={rowAxis}
          onChange={setRowAxis}
          options={availFields.map((f) => {
            const ok = !!csvData.mapping && Object.values(csvData.mapping).includes(f.k);
            return { value: f.k, label: <>{f.l}{!ok && " 🔒"}</>, disabled: !ok };
          })}
        />

        <PillGroup
          label={tr("열 축", "Column axis")}
          value={colAxis}
          onChange={setColAxis}
          options={availFields.map((f) => {
            const ok = !!csvData.mapping && Object.values(csvData.mapping).includes(f.k);
            return { value: f.k, label: <>{f.l}{!ok && " 🔒"}</>, disabled: !ok };
          })}
        />

        <PillGroup
          label={tr("지표", "Metric")}
          value={metric}
          onChange={setMetric}
          options={Object.entries(METRICS).filter(([k]) => k !== "cost").map(([k, v]) => ({ value: k, label: v.label }))}
        />

        {renderMatrix(metric)}

        <h3 style={{ fontSize: "13px", fontWeight: "600", margin: "20px 0 8px", color: "var(--text-muted)" }}>{tr("Cost 분배 (고정)", "Cost distribution (fixed)")}</h3>
        {renderMatrix("cost")}

      </section>

      <CustomChartsSection
        sectionNo="2"
        chartScope="5-2:seg-charts"
        metricScope="5-2:viz-kpi"
        title={tr("커스텀 차트", "Custom charts")}
        locale={locale}
      />
    </div>
  );
}
