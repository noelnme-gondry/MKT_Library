"use client";

import { useMemo } from "react";

import { fmtCurrencyPrecise } from "@/utils/dashboardAggregator";
import { buildMarginalEfficiencyGap } from "@/utils/marginalEfficiencyGap";

function formatMetric(value, metric, currency) {
  if (value === Infinity) return "∞";
  if (!Number.isFinite(value)) return "—";
  return metric === "roas" ? `${value.toFixed(2)}x` : fmtCurrencyPrecise(value, currency);
}

function verdictCopy(verdict, isEn) {
  if (verdict === "scale") return isEn ? "Prioritize added budget" : "추가 예산 우선";
  if (verdict === "saturated") return isEn ? "Hold added budget" : "증액 보류";
  return isEn ? "Monitor" : "유지 관찰";
}

function position(value, domainMax) {
  if (!(domainMax > 0) || !Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, (value / domainMax) * 100));
}

export default function MarginalEfficiencyGapChart({
  rows,
  grain,
  metric,
  metricLabel,
  currency,
  locale = "ko",
  selectedName = null,
  onSelect,
}) {
  const isEn = locale === "en";
  const view = useMemo(() => buildMarginalEfficiencyGap(rows, metric), [rows, metric]);
  const grainLabel = grain === "campaign" ? (isEn ? "campaign" : "캠페인") : (isEn ? "channel" : "채널");
  const midpoint = view.domainMax / 2;

  return (
    <section className="block marginal-gap" id="s-marginal-gap" aria-labelledby="marginal-gap-title">
      <header className="marginal-gap__head">
        <div>
          <span>{isEn ? "AVERAGE ↔ MARGINAL" : "평균 ↔ 한계"}</span>
          <h2 className="section-title" id="marginal-gap-title">{isEn
            ? "Average efficiency vs. marginal efficiency on the next budget increase"
            : "평균 효율 vs 다음 예산 투입 시 한계효율"}</h2>
          <p>{isEn
            ? `Sorted by the modeled marginal-efficiency headroom for each ${grainLabel}. Values stay within the observed spend range and are not causal incrementality estimates.`
            : `${grainLabel}별 모델 한계효율 여유가 큰 순서입니다. 관측 지출 범위 안의 추정치이며 인과적 증분효과가 아닙니다.`}</p>
        </div>
        <div className="marginal-gap__legend" aria-label={isEn ? "Marker legend" : "표식 설명"}>
          <span><i className="is-average" aria-hidden="true" />{isEn ? "Average" : "평균"}</span>
          <span><i className="is-marginal" aria-hidden="true" />{isEn ? "Marginal" : "한계"}</span>
        </div>
      </header>

      {view.points.length === 0 ? (
        <p className="muted marginal-gap__empty">{isEn
          ? `No ${grainLabel} has both average and marginal ${metricLabel} available.`
          : `평균·한계 ${metricLabel}을 모두 계산할 수 있는 ${grainLabel}이 없습니다.`}</p>
      ) : (
        <div className="marginal-gap__chart" role="list" aria-label={isEn ? `${grainLabel} marginal-efficiency gaps` : `${grainLabel}별 평균·한계효율 차이`}>
          <div className="marginal-gap__columns" aria-hidden="true">
            <span>{isEn ? grainLabel : `${grainLabel}·판정`}</span>
            <span>{metric === "roas" ? (isEn ? "Higher is better →" : "높을수록 좋음 →") : (isEn ? "Lower is better ←" : "← 낮을수록 좋음")}</span>
            <span>{isEn ? "Values" : "수치"}</span>
            <span>{isEn ? "Evidence" : "근거"}</span>
          </div>
          <div className="marginal-gap__axis" aria-hidden="true">
            <span>{formatMetric(0, metric, currency)}</span>
            <span>{formatMetric(midpoint, metric, currency)}</span>
            <span>{formatMetric(view.domainMax, metric, currency)}</span>
          </div>

          {view.points.map((point) => {
            const averagePos = position(point.average, view.domainMax);
            const marginalPos = position(point.plotMarginal, view.domainMax);
            const start = Math.min(averagePos, marginalPos);
            const width = Math.abs(averagePos - marginalPos);
            const indexLabel = Number.isFinite(point.saturationIndex) && point.saturationIndex < 1e8
              ? `${point.saturationIndex.toFixed(2)}x`
              : "∞";
            return (
              <div
                className="marginal-gap__row"
                data-selected={selectedName === point.name ? "true" : "false"}
                data-verdict={point.verdict || "linear"}
                key={point.name}
                role="listitem"
              >
                <div className="marginal-gap__entity">
                  <button type="button" onClick={() => onSelect?.(point.name)} aria-pressed={selectedName === point.name}>
                    {point.name}
                  </button>
                  <span>{verdictCopy(point.verdict, isEn)} · {indexLabel}</span>
                </div>
                <div
                  className="marginal-gap__track"
                  style={{ "--gap-start": `${start}%`, "--gap-width": `${width}%`, "--avg-position": `${averagePos}%`, "--marginal-position": `${marginalPos}%` }}
                  aria-label={`${point.name}: ${isEn ? "average" : "평균"} ${formatMetric(point.average, metric, currency)}, ${isEn ? "marginal" : "한계"} ${formatMetric(point.marginal, metric, currency)}`}
                >
                  <span className="marginal-gap__connector" aria-hidden="true" />
                  <span className="marginal-gap__dot is-average" aria-hidden="true" />
                  <span className={`marginal-gap__dot is-marginal${point.isUnbounded ? " is-unbounded" : ""}`} aria-hidden="true">
                    {point.isUnbounded ? "∞" : ""}
                  </span>
                  <span className="marginal-gap__tip" data-side={marginalPos > 55 ? "left" : "right"} aria-hidden="true">
                    {isEn ? "Average" : "평균"} {formatMetric(point.average, metric, currency)}
                    {" → "}
                    {isEn ? "marginal" : "한계"} {formatMetric(point.marginal, metric, currency)}
                    {" · "}{indexLabel}
                  </span>
                </div>
                <div className="marginal-gap__values">
                  <span><i className="is-average" aria-hidden="true" />{formatMetric(point.average, metric, currency)}</span>
                  <span><i className="is-marginal" aria-hidden="true" />{formatMetric(point.marginal, metric, currency)}</span>
                </div>
                <div className="marginal-gap__evidence tnum">
                  <span>n={point.observations || "—"}</span>
                  <span>R²={point.r2 == null ? "—" : point.r2.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view.excluded.length > 0 && (
        <p className="marginal-gap__excluded">{isEn
          ? `${view.excluded.length} ${grainLabel}(s) without a calculable average or marginal value are excluded.`
          : `평균 또는 한계효율을 계산할 수 없는 ${grainLabel} ${view.excluded.length}개는 제외했습니다.`}</p>
      )}
    </section>
  );
}
