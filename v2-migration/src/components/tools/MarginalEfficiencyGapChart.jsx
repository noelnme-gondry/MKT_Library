"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import FigurePngButton from "@/components/ds/FigurePngButton";

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

// Labels follow their actual point; only labels near an edge are clamped.
// Nearby labels use separate lanes, without moving the data points themselves.
function GapPlot({ point, domainMax, metric, currency, isEn }) {
  const ref = useRef(null);
  const [plotWidth, setPlotWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const averagePos = position(point.average, domainMax);
  const marginalPos = position(point.plotMarginal, domainMax);
  const labelWidth = 112;
  const labelCenter = (pos) => Math.max(labelWidth / 2, Math.min(plotWidth - labelWidth / 2, pos / 100 * plotWidth));
  const leaderStyle = (pos) => {
    const shift = labelCenter(pos) - pos / 100 * plotWidth;
    return { "--leader-offset": `${Math.min(0, shift)}px`, "--leader-width": `${Math.abs(shift)}px` };
  };
  const stagger = Math.abs(labelCenter(averagePos) - labelCenter(marginalPos)) < labelWidth + 12;
  return (
    <div className="marginal-gap__plot">
      <div className="marginal-gap__track" ref={ref} data-stagger={stagger ? "true" : "false"}
        style={{ "--gap-start": `${Math.min(averagePos, marginalPos)}%`, "--gap-width": `${Math.abs(averagePos - marginalPos)}%`, "--avg-position": `${averagePos}%`, "--marginal-position": `${marginalPos}%` }}>
        <span className="marginal-gap__grid" aria-hidden="true"><i /><i /><i /></span>
        <span className="marginal-gap__connector" aria-hidden="true" />
        <span className="marginal-gap__dot is-average" aria-hidden="true" />
        <span className={`marginal-gap__dot is-marginal${point.isUnbounded ? " is-unbounded" : ""}`} aria-hidden="true">{point.isUnbounded ? "∞" : ""}</span>
        <span className="marginal-gap__leader is-average" style={leaderStyle(averagePos)} aria-hidden="true" />
        <span className="marginal-gap__leader is-marginal" style={leaderStyle(marginalPos)} aria-hidden="true" />
        <span className="marginal-gap__label is-average"><small>{isEn ? "Average" : "평균"}</small><strong>{formatMetric(point.average, metric, currency)}</strong></span>
        <span className="marginal-gap__label is-marginal"><small>{isEn ? "Marginal" : "한계"}</small><strong>{formatMetric(point.marginal, metric, currency)}</strong></span>
      </div>
      <div className="marginal-gap__axis" aria-label={isEn ? "Shared x-axis range" : "공통 X축 범위"}>
        <span>{formatMetric(0, metric, currency)}</span>
        <span>{formatMetric(domainMax / 2, metric, currency)}</span>
        <span>{formatMetric(domainMax, metric, currency)}</span>
      </div>
    </div>
  );
}

export default function MarginalEfficiencyGapChart({
  rows,
  grain,
  entityLabel = null,
  metric,
  metricLabel,
  currency,
  locale = "ko",
  selectedName = null,
  onSelect,
}) {
  const isEn = locale === "en";
  const view = useMemo(() => buildMarginalEfficiencyGap(rows, metric), [rows, metric]);
  const grainLabel = entityLabel || (grain === "campaign" ? (isEn ? "campaign" : "캠페인") : (isEn ? "channel" : "채널"));
  const sectionRef = useRef(null);

  return (
    <section ref={sectionRef} className="block marginal-gap saturation-surface" id="s-marginal-gap" aria-labelledby="marginal-gap-title">
      <header className="marginal-gap__head">
        <div>
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
        {view.points.length > 0 && <div className="marginal-gap__download" data-figure-skip="">
          <FigurePngButton title={locale === "en" ? "Average and marginal efficiency" : "평균 효율과 한계 효율"} target={sectionRef} fileName={`marginal_gap_${grain}_${metric}`} locale={locale} />
        </div>}
      </header>

      <dl className="saturation-reading-guide">
        <div><dt>{isEn ? "Average · observed performance" : "평균 · 지금까지의 성과"}</dt><dd>{isEn ? `The observed ${metricLabel} at the current spend level.` : `현재 지출 수준에서 관측한 ${metricLabel}입니다.`}</dd></div>
        <div><dt>{isEn ? "Marginal · the next increment" : "한계 · 예산을 더 쓸 때"}</dt><dd>{isEn ? `Modeled ${metricLabel} for an additional increment of spend, not a guaranteed outcome.` : `추가 지출에 대한 모델 ${metricLabel}입니다. 실제 성과를 보장하지 않습니다.`}</dd></div>
        <div><dt>{isEn ? "Saturation index · compare the two" : "포화지수 · 두 수치의 차이"}</dt><dd>{metric === "roas" ? (isEn ? "Average ÷ marginal ROAS" : "평균 ÷ 한계 ROAS") : (isEn ? `Marginal ÷ average ${metricLabel}` : `한계 ÷ 평균 ${metricLabel}`)}{isEn ? ". Above 1 means worse marginal efficiency." : ". 1보다 크면 추가 지출의 효율이 평균보다 나쁩니다."}</dd></div>
      </dl>

      {view.points.length === 0 ? (
        <p className="muted marginal-gap__empty">{isEn
          ? `No ${grainLabel} has both average and marginal ${metricLabel} available.`
          : `평균·한계 ${metricLabel}을 모두 계산할 수 있는 ${grainLabel}이 없습니다.`}</p>
      ) : (
        <div className="marginal-gap__chart" role="list" aria-label={isEn ? `${grainLabel} marginal-efficiency gaps` : `${grainLabel}별 평균·한계효율 차이`}>
          <div className="marginal-gap__scale-note" role="presentation">
            <span>{metricLabel} · {isEn ? "Same scale for every row" : "모든 대상에 같은 눈금"}</span>
            <span>{metric === "roas" ? (isEn ? "Higher is better →" : "높을수록 좋음 →") : (isEn ? "← Lower is better" : "← 낮을수록 좋음")}</span>
          </div>
          {view.points.map((point) => {
            const indexLabel = Number.isFinite(point.saturationIndex) && point.saturationIndex < 1e8
              ? `${point.saturationIndex.toFixed(2)}x`
              : "∞";
            return (
              <div
                className="marginal-gap__row"
                data-design-exempt="nested: user-requested entity grouping within a white analysis surface"
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
                <div className="marginal-gap__evidence tnum">
                  <span>{isEn ? "Observations" : "관측"} {point.observations ?? "—"}</span>
                  <span>R²={point.r2 == null ? "—" : point.r2.toFixed(2)}</span>
                </div>
                <GapPlot point={point} domainMax={view.domainMax} metric={metric} currency={currency} isEn={isEn} />
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
