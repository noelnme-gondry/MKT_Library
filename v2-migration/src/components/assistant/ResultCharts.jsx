"use client";

import { useId, useRef, useState } from "react";
import FigurePngButton from "@/components/ds/FigurePngButton";
import { fmtCurrency, fmtNum } from "@/utils/format";

// 결과 작업대의 분석별 핵심 그림. 예전에는 PVM·포화도·예산·VIF·소재 피로도가 전부 같은
// 가로 막대(ResultBars)로 그려져 "무엇을 보여 주는 분석인지"가 그림에서 사라졌다(2026-09-25).
// 그림은 각 분석이 답하는 질문의 모양을 따른다 — 값은 어댑터가 엔진에서 받은 것만 쓴다.

const tr = (locale, ko, en) => (locale === "en" ? en : ko);
const sum = (values) => values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
const finite = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

// 작은 단가(₩3.13)는 소수까지, 0은 ₩0으로(₩0.00은 값이 있는 것처럼 읽힌다).
function money(value, currency) {
  return fmtCurrency(value, { currency, precise: value !== 0 });
}

function signedMoney(value, currency) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${money(Math.abs(value), currency)}`;
}

// 비용 지표(CPA·CPI)는 오르면 나쁘다.
function costTone(value) {
  if (!Number.isFinite(value) || value === 0) return "flat";
  return value > 0 ? "worse" : "better";
}

// 가운데 0을 기준으로 좌우로 뻗는 막대의 위치. 값이 없으면 그리지 않는다.
function divergingStyle(value, max) {
  if (!Number.isFinite(value) || !(max > 0)) return null;
  const size = Math.max(0.5, (Math.abs(value) / max) * 50);
  return { "--bar-start": `${value >= 0 ? 50 : 50 - size}%`, "--bar-size": `${size}%` };
}

function FigureRows({ rows, limit = 8, className, locale, children }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const visibleRows = expanded ? rows : rows.slice(0, limit);
  return <>
    {rows.length > limit && <p className="result-chart__coverage">{tr(locale,
      `전체 ${rows.length}개 중 ${visibleRows.length}개 표시`,
      `Showing ${visibleRows.length} of ${rows.length}`)}</p>}
    <ul id={id} className={className}>{visibleRows.map(children)}</ul>
    {rows.length > limit && <button type="button" className="btn ghost result-chart__expand" data-figure-skip="" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>
      {expanded ? tr(locale, "주요 항목만 보기", "Show fewer") : tr(locale, `전체 ${rows.length}개 보기`, `Show all ${rows.length}`)}
    </button>}
  </>;
}

// 값의 단위별 표기. rate는 0~1 비율(표시는 %, 차이는 %p).
function unitFormatter(unit, currency) {
  if (unit === "rate") {
    return {
      level: (value) => (Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—"),
      signed: (value) => {
        if (!Number.isFinite(value)) return "—";
        // 표시 자리수에서 0이면 부호를 붙이지 않는다("−0.0%p"는 줄어든 것처럼 읽힌다).
        if (Math.abs(value) < 0.0005) return "0.0%p";
        const sign = value > 0 ? "+" : "−";
        return `${sign}${(Math.abs(value) * 100).toFixed(1)}%p`;
      },
      epsilon: 0.0005,
    };
  }
  if (unit === "count") {
    return {
      level: (value) => (Number.isFinite(value) ? fmtNum(value) : "—"),
      signed: (value) => {
        if (!Number.isFinite(value)) return "—";
        const sign = value > 0 ? "+" : value < 0 ? "−" : "";
        return `${sign}${fmtNum(Math.abs(value))}`;
      },
    };
  }
  return { level: (value) => (Number.isFinite(value) ? money(value, currency) : "—"), signed: (value) => signedMoney(value, currency) };
}

// 오르면 좋은 지표(전환율)와 오르면 나쁜 지표(CPA)의 색을 가른다.
function directionTone(value, lowerIsBetter, epsilon = 0) {
  if (lowerIsBetter == null) return "flat";
  if (Number.isFinite(value) && Math.abs(value) < epsilon) return "flat";
  const tone = costTone(value);
  if (lowerIsBetter || tone === "flat") return tone;
  return tone === "worse" ? "better" : "worse";
}

/** 성과 변동 분해: 직전 → 비중 변화 → 효율 변화(→ 상호작용) → 최근 다리 + 대상별 성분.
 *  5-21은 비용 지표(오르면 나쁨·통화), 5-29는 비율 지표(오르면 좋음·%p)라 단위·방향·이름을 옵션으로 받는다. */
export function ResultMixRate({ visualization, locale, currency, fallback = null }) {
  const options = visualization.options || {};
  const metric = options.metric || "CPA";
  const unit = options.unit || "currency";
  const lowerIsBetter = options.lowerIsBetter === undefined ? unit === "currency" : options.lowerIsBetter;
  const format = unitFormatter(unit, currency);
  const rows = (visualization.data || [])
    .map((row) => ({ entity: row.entity, mix: finite(row.mix), rate: finite(row.rate), interaction: finite(row.interaction), contribution: finite(row.contribution) }))
    .filter((row) => row.mix != null || row.rate != null)
    .sort((a, b) => Math.abs(b.contribution || 0) - Math.abs(a.contribution || 0));
  if (!rows.length) return fallback;
  const labels = options.labels || {};
  const parts = [
    { key: "mix", label: labels.mix || tr(locale, "비중 변화", "Mix"), short: labels.mixShort, hint: labels.mixHint || tr(locale, "싼·비싼 채널의 성과 비중이 바뀐 몫", "Share moved between cheaper and costlier channels") },
    { key: "rate", label: labels.rate || tr(locale, "효율 변화", "Rate"), short: labels.rateShort, hint: labels.rateHint || tr(locale, "채널 자체 단가가 바뀐 몫", "Each channel's own unit cost changed") },
    ...(rows.some((row) => row.interaction != null && row.interaction !== 0)
      ? [{ key: "interaction", label: labels.interaction || tr(locale, "함께 바뀐 몫", "Interaction"), short: labels.interactionShort || tr(locale, "함께", "Both"), hint: labels.interactionHint || tr(locale, "비중과 내부 값이 동시에 바뀌어 어느 한쪽에 나눌 수 없는 몫", "The part that moved because both changed at once") }]
      : []),
  ];
  const max = Math.max(...rows.flatMap((row) => parts.map((part) => Math.abs(row[part.key] || 0))), 0);
  const start = finite(options.start);
  const end = finite(options.end);
  const up = lowerIsBetter ? tr(locale, `오른쪽은 ${metric} 상승, 왼쪽은 하락에 기여한 값입니다.`, `Values on the right raised ${metric}; values on the left lowered it.`)
    : tr(locale, `오른쪽은 ${metric}을 올린 값, 왼쪽은 내린 값입니다.`, `Values on the right raised ${metric}; values on the left lowered it.`);
  return <figure className="result-chart result-mix-rate" aria-label={visualization.question}>
    <ol className="result-bridge tnum">
      <li><span>{tr(locale, `직전 ${metric}`, `Prior ${metric}`)}</span><b>{start != null ? format.level(start) : "—"}</b></li>
      {parts.map((part) => {
        const total = sum(rows.map((row) => row[part.key]));
        return <li data-tone={directionTone(total, lowerIsBetter, format.epsilon)} key={part.key}><span>{part.label}</span><b>{format.signed(total)}</b></li>;
      })}
      <li><span>{tr(locale, `최근 ${metric}`, `Recent ${metric}`)}</span><b>{end != null ? format.level(end) : "—"}</b></li>
    </ol>
    <FigureRows rows={rows} limit={6} locale={locale} className="result-split">
      {(row) => <li key={row.entity} className="result-split__entity" data-design-exempt="nested: user-requested grouping of each entity and its contribution bars">
        <div className="result-split__head"><strong>{row.entity}</strong><span className="tnum" data-tone={directionTone(row.contribution, lowerIsBetter, format.epsilon)}>{format.signed(row.contribution)}</span></div>
        {/* 막대 줄의 이름 칸은 좁다(줄마다 같은 폭이어야 막대가 맞는다) — 긴 이름은 짧은 이름으로. 전체 이름은 다리·설명에 있다. */}
        {parts.map((part) => <div className={`result-split__bar is-${part.key}`} key={part.key}>
          <span>{part.short || part.label}</span>
          <div className="result-diverging" aria-hidden="true"><i style={divergingStyle(row[part.key], max) || undefined} /></div>
          <b className="tnum">{format.signed(row[part.key])}</b>
        </div>)}
      </li>}
    </FigureRows>
    <figcaption className="result-mix-guide">
      <p className="sr-only">{up}</p>
      <div className="result-mix-guide__direction" aria-hidden="true"><span>← {metric} {tr(locale, "하락", "decrease")}</span><span>0</span><span>{metric} {tr(locale, "상승", "increase")} →</span></div>
      <dl className="result-mix-guide__legend">{parts.map(part => <div key={part.key}>
        <dt><i className={`is-${part.key}`} aria-hidden="true" />{part.label}</dt><dd>{part.hint}</dd>
      </div>)}</dl>
    </figcaption>
  </figure>;
}

/** 증분 추정: 점추정과 95% 구간을 0(변화 없음) 기준선 위에 그린다(5-23 · 5-24).
 *  구간이 0을 걸치면 방향을 칠하지 않는다 — 무유의는 "효과 없음"이 아니라 "판단 보류"다(§8.6).
 *  rows: [{entity, estimate, low, high}], options: {unit, goodDirection: "up"|"down", withheld} */
export function ResultEffectInterval({ visualization, locale, currency, fallback = null }) {
  const options = visualization.options || {};
  const format = unitFormatter(options.unit || "count", currency);
  const rows = (visualization.data || [])
    .map((row) => ({ entity: row.entity, estimate: finite(row.estimate), low: finite(row.low), high: finite(row.high) }))
    .filter((row) => row.estimate != null);
  if (!rows.length) return fallback;
  const values = rows.flatMap((row) => [row.estimate, row.low, row.high, 0]).filter((value) => value != null);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  const min = lo - pad;
  const span = hi + pad - min;
  const at = (value) => `${((value - min) / span) * 100}%`;
  const toneOf = (row) => {
    if (options.withheld || row.low == null || row.high == null) return "flat";
    const clear = (row.low > 0 && row.high > 0) || (row.low < 0 && row.high < 0);
    if (!clear) return "flat";
    const up = row.estimate > 0;
    if (!options.goodDirection) return "caution";
    return (options.goodDirection === "up") === up ? "better" : "worse";
  };
  return <figure className="result-chart result-effect" aria-label={visualization.question}>
    <ul>
      {rows.map((row) => {
        const hasRange = row.low != null && row.high != null;
        return <li key={row.entity} data-tone={toneOf(row)}>
          <div className="result-effect__head">
            <strong>{row.entity}</strong>
            <span className="tnum"><b>{format.signed(row.estimate)}</b>{hasRange && <> · {tr(locale, "95% 구간", "95% interval")} {format.signed(row.low)} ~ {format.signed(row.high)}</>}</span>
          </div>
          <div className="result-effect__track" aria-hidden="true">
            <span className="result-effect__zero" style={{ left: at(0) }} />
            {hasRange && <span className="result-effect__range" style={{ left: at(row.low), width: `${((row.high - row.low) / span) * 100}%` }} />}
            <span className="result-effect__dot" style={{ left: at(row.estimate) }} />
          </div>
        </li>;
      })}
    </ul>
    <figcaption>
      <p>{tr(locale, "점: 추정값. 선: 95% 구간. 기준선: 변화 없음(0).", "Dot: estimate. Bar: 95% interval. Reference line: no change (0).")}</p>
      <p>{options.withheld
        ? tr(locale, "비교 조건이 충분하지 않아 방향을 판정하지 않습니다.", "The comparison conditions do not support a directional verdict.")
        : rows.some(row => row.low == null || row.high == null)
          ? tr(locale, "일부 추정값의 구간을 계산할 수 없어 방향 판단을 보류합니다.", "Some intervals cannot be estimated; direction remains undecided.")
          : rows.some(row => row.low <= 0 && row.high >= 0)
            ? tr(locale, "구간이 0을 포함해 효과의 방향을 판단하기 어렵습니다.", "The interval includes zero, so the direction remains uncertain.")
            : tr(locale, "관측된 차이입니다. 인과효과 여부는 비교 설계에 따라 다릅니다.", "This is an observed difference. Causal interpretation depends on the comparison design.")}</p>
    </figcaption>
  </figure>;
}

const SATURATION_LABEL = {
  saturated: ["포화", "Saturated", "worse"],
  scale: ["여유", "Headroom", "better"],
};

/** 5-22 포화도: 평균 단가와 한계 단가(조금 더 쓸 때의 단가) 사이의 거리. */
export function ResultUnitCostGap({ visualization, locale, currency, fallback = null }) {
  const options = visualization.options || {};
  const metric = options.metric || "CPA";
  const from = options.from || "averageUnitCost";
  const to = options.to || "marginalUnitCost";
  const rows = (visualization.data || [])
    .map((row) => ({ entity: row.entity, average: finite(row[from]), marginal: finite(row[to]), verdict: row.verdict }))
    .filter((row) => row.average != null && row.marginal != null);
  if (!rows.length) return fallback;
  const max = Math.max(...rows.flatMap((row) => [row.average, row.marginal]), 0);
  if (!(max > 0)) return fallback;
  // 0~1 비율로 넘기고 CSS가 점 크기만큼 안쪽으로 줄여 놓는다 — 끝의 점이 잘리지 않게.
  const at = (value) => Math.max(0, Math.min(1, value / max));
  return <figure className="result-chart result-gap" aria-label={visualization.question}>
    <FigureRows rows={rows} limit={8} locale={locale}>
      {(row) => {
        const [ko, en, tone] = SATURATION_LABEL[row.verdict] || ["적정", "Steady", "flat"];
        const low = Math.min(row.average, row.marginal);
        const high = Math.max(row.average, row.marginal);
        return <li key={row.entity}>
          <div className="result-gap__head"><strong>{row.entity}</strong><span data-tone={tone}>{tr(locale, ko, en)} · ×{(row.marginal / row.average).toFixed(2)}</span></div>
          <div className="result-gap__track" aria-hidden="true">
            <i className="result-gap__span" style={{ "--gap-start": at(low), "--gap-end": at(high) }} />
            <i className="result-gap__dot is-average" style={{ "--gap-at": at(row.average) }} />
            <i className="result-gap__dot is-marginal" data-tone={tone} style={{ "--gap-at": at(row.marginal) }} />
          </div>
          <p className="tnum">{tr(locale, "평균", "Average")} {money(row.average, currency)} → {tr(locale, "한계", "Marginal")} {money(row.marginal, currency)}</p>
        </li>;
      }}
    </FigureRows>
    <figcaption><i className="result-gap__dot is-average" /> {tr(locale, `평균 ${metric}`, `Average ${metric}`)} <i className="result-gap__dot is-marginal" /> {tr(locale, `한계 ${metric} — 지금보다 조금 더 쓸 때 한 건의 단가`, `Marginal ${metric} — the unit cost of spending a little more`)}</figcaption>
  </figure>;
}

/** 5-3 예산 재배분: 채널별 지금 하루 예산과 바꾼 안의 하루 예산. */
export function ResultBudgetShift({ visualization, locale, currency, fallback = null }) {
  const options = visualization.options || {};
  const fromKey = options.from || "current";
  const toKey = options.to || "budget";
  const rows = (visualization.data || [])
    .map((row) => ({ entity: row.entity, current: finite(row[fromKey]), next: finite(row[toKey]) }))
    .filter((row) => row.current != null || row.next != null)
    .sort((a, b) => Math.abs((b.next || 0) - (b.current || 0)) - Math.abs((a.next || 0) - (a.current || 0)));
  if (!rows.length) return fallback;
  const max = Math.max(...rows.flatMap((row) => [row.current || 0, row.next || 0]), 0);
  if (!(max > 0)) return fallback;
  const size = (value) => `${Math.max(0, ((value || 0) / max) * 100)}%`;
  return <figure className="result-chart result-shift" aria-label={visualization.question}>
    <figcaption className="result-shift__guide">
      <span>{tr(locale, "변경 금액이 큰 순서", "Largest budget changes first")}</span>
      <span>{tr(locale, "모든 막대는 같은 금액 눈금입니다", "All bars share the same currency scale")}</span>
    </figcaption>
    <FigureRows rows={rows} className="result-shift__grid" limit={8} locale={locale}>
      {(row) => {
        const delta = row.current != null && row.next != null ? row.next - row.current : null;
        const direction = delta == null ? "unknown" : delta > 0 ? "increase" : delta < 0 ? "decrease" : "hold";
        const label = delta == null ? tr(locale, "비교 불가", "Unavailable") : delta > 0 ? tr(locale, "증액", "Increase") : delta < 0 ? tr(locale, "감액", "Decrease") : tr(locale, "유지", "Unchanged");
        return <li key={row.entity} className="result-shift__entity">
          <div className="result-shift__head"><strong>{row.entity}</strong><span className="result-shift__direction" data-direction={direction}>{label}</span></div>
          <div className="result-shift__comparison">
            {[["current", tr(locale, "현재", "Current"), row.current], ["next", tr(locale, "변경안", "Plan"), row.next]].map(([key, name, value]) => <div className={`result-shift__measure is-${key}`} key={key}>
              <div><span>{name}</span><strong className="tnum">{value != null ? money(value, currency) : "—"}</strong></div>
              <div className="result-shift__track" aria-hidden="true"><i style={{ "--shift-size": size(value) }} /></div>
            </div>)}
          </div>
          <div className="result-shift__delta"><span>{tr(locale, "하루 예산 변화", "Daily budget change")}</span><strong className="tnum">{signedMoney(delta, currency)}</strong></div>
        </li>;
      }}
    </FigureRows>
  </figure>;
}

/** 5-25 채널 중복: 채널별 VIF를 주의·심각 기준선과 함께(로그 눈금). */
export function ResultVifThreshold({ visualization, locale, fallback = null }) {
  const [warn, severe] = visualization.options?.thresholds || [];
  // ∞(완전 공선)는 가장 심각한 상태지 "계산 불가"가 아니다 — 둘을 섞으면 심각을 판정 보류로 뒤집는다.
  // 결과 작업대는 JSON 안전을 위해 ∞를 null + isInfinite로 싣고, 도구 화면은 Infinity를 그대로 넘긴다.
  const rows = (visualization.data || []).map((row) => ({
    entity: row.entity,
    vif: row.vif === Infinity || row.isInfinite === true ? Infinity : finite(row.vif),
  })).sort((a, b) => (b.vif ?? -Infinity) > (a.vif ?? -Infinity) ? 1 : (b.vif ?? -Infinity) < (a.vif ?? -Infinity) ? -1 : 0);
  if (!rows.length || !Number.isFinite(warn) || !Number.isFinite(severe)) return fallback;
  const top = Math.max(severe * 10, ...rows.map((row) => (Number.isFinite(row.vif) ? row.vif : 0)));
  const at = (value) => (value === Infinity ? 100 : Math.max(0, Math.min(100, (Math.log10(Math.max(1, value)) / Math.log10(top)) * 100)));
  const toneOf = (value) => (value == null ? "muted" : value >= severe ? "worse" : value >= warn ? "caution" : "better");
  return <figure className="result-chart result-vif" aria-label={visualization.question}>
    <FigureRows rows={rows} limit={8} locale={locale}>
      {(row) => <li key={row.entity}>
        <strong>{row.entity}</strong>
        <div className="result-vif__track" aria-hidden="true">
          <i className="result-vif__bar" data-tone={toneOf(row.vif)} style={{ "--vif-size": `${row.vif == null ? 0 : Math.max(1, at(row.vif))}%` }} />
          <i className="result-vif__line" style={{ "--vif-at": `${at(warn)}%` }} />
          <i className="result-vif__line is-severe" style={{ "--vif-at": `${at(severe)}%` }} />
        </div>
        <b className="tnum" data-tone={toneOf(row.vif)}>{row.vif == null ? tr(locale, "계산 불가", "Not computable") : row.vif === Infinity ? "∞" : fmtNum(row.vif, row.vif < 10 ? 1 : 0)}</b>
      </li>}
    </FigureRows>
    <figcaption>{tr(locale, `세로선: 주의 ${warn} · 심각 ${severe}. 로그 눈금이라 오른쪽으로 갈수록 급격히 커집니다.`, `Lines: caution ${warn} · severe ${severe}. Log scale — values grow quickly to the right.`)}</figcaption>
  </figure>;
}

/** 9-6 소재 상태: 전체 소재를 상태별로 나눈 띠 하나. */
export function ResultStatusShare({ visualization, locale, fallback = null }) {
  const x = visualization.options?.x || "status";
  const y = visualization.options?.y || "count";
  const rows = (visualization.data || []).map((row) => ({ label: row[x], count: finite(Number(row[y])) || 0, tone: row.tone || "flat" }));
  const total = sum(rows.map((row) => row.count));
  if (!(total > 0)) return fallback;
  return <figure className="result-chart result-share" aria-label={visualization.question}>
    <div className="result-share__bar" aria-hidden="true">
      {rows.filter((row) => row.count > 0).map((row) => <i key={row.label} data-tone={row.tone} style={{ "--share-size": `${(row.count / total) * 100}%` }} />)}
    </div>
    <ul className="tnum">
      {rows.map((row) => <li key={row.label}><i data-tone={row.tone} /><span>{row.label}</span><b>{fmtNum(row.count)}{tr(locale, "개", "")}</b></li>)}
    </ul>
    <figcaption>{tr(locale, `전체 소재 ${fmtNum(total)}개`, `${fmtNum(total)} creatives in total`)}</figcaption>
  </figure>;
}

/** 5-28 생존: Kaplan–Meier 계단 곡선 + 95% 구간 띠 + 중앙값(50%) 선. */
export function ResultSurvival({ visualization, locale, fallback = null }) {
  const x = visualization.options?.x || "period";
  const y = visualization.options?.y || "survival";
  const points = (visualization.data || [])
    .map((row) => ({ t: finite(Number(row[x])), s: finite(Number(row[y])), lo: finite(Number(row.ciLow)), hi: finite(Number(row.ciHigh)) }))
    .filter((point) => point.t != null && point.s != null)
    .sort((a, b) => a.t - b.t);
  if (points.length < 2) return fallback;
  const tMin = Math.min(0, points[0].t);
  const tMax = points.at(-1).t;
  if (!(tMax > tMin)) return fallback;
  const xAt = (t) => 44 + ((t - tMin) / (tMax - tMin)) * 568;
  const yAt = (value) => 16 + (1 - Math.max(0, Math.min(1, value))) * 184;
  // 계단: 다음 사건 시점까지 수평으로 가고 그 시점에서 떨어진다.
  const stepPoints = (key) => points.reduce((list, point) => {
    const value = point[key] ?? point.s;
    const prevY = list.at(-1)[1];
    return [...list, [xAt(point.t), prevY], [xAt(point.t), yAt(value)]];
  }, [[xAt(tMin), yAt(1)]]);
  const toPath = (list) => list.map(([px, py], index) => `${index ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const hasBand = points.every((point) => point.lo != null && point.hi != null);
  const band = hasBand ? `${toPath([...stepPoints("hi"), ...stepPoints("lo").reverse()])} Z` : null;
  const line = toPath(stepPoints("s"));
  return <figure className="result-chart result-survival" aria-label={visualization.question}>
    <svg viewBox="0 0 640 230" role="img" aria-label={visualization.question} preserveAspectRatio="xMidYMid meet">
      {[1, 0.5, 0].map((tick) => <g key={tick}><line className="result-survival__grid" x1="44" x2="612" y1={yAt(tick)} y2={yAt(tick)} /><text className="result-survival__tick" x="38" y={yAt(tick) + 4} textAnchor="end">{Math.round(tick * 100)}%</text></g>)}
      {band && <path className="result-survival__band" d={band} />}
      <path className="result-survival__line" d={line} />
      <text className="result-survival__tick" x="44" y="222">{tMin}</text>
      <text className="result-survival__tick" x="612" y="222" textAnchor="end">{tMax}</text>
    </svg>
    <figcaption>{tr(locale, "가로: 경과 개월 · 세로: 아직 이탈하지 않은 비율. 옅은 띠는 95% 구간, 가운데 선은 절반(중앙값)입니다.", "Across: months elapsed · Up: share not yet exited. The pale band is the 95% interval; the middle line is the median.")}</figcaption>
  </figure>;
}

/** 5-28 위험도: 시간 순서가 있는 값이라 세로 막대를 시간축에 세운다. */
export function ResultHazardColumns({ visualization, locale, fallback = null }) {
  const x = visualization.options?.x || "period";
  const y = visualization.options?.y || "hazard";
  const rows = (visualization.data || []).map((row) => ({ t: row[x], value: finite(Number(row[y])) })).filter((row) => row.value != null);
  const max = Math.max(...rows.map((row) => row.value), 0);
  if (!rows.length || !(max > 0)) return fallback;
  const peak = rows.reduce((best, row) => (row.value > best.value ? row : best), rows[0]);
  return <figure className="result-chart result-columns" aria-label={visualization.question}>
    <div className="result-columns__plot" aria-hidden="true">
      {rows.map((row) => <i key={row.t} data-tone={row === peak ? "worse" : "flat"} style={{ "--column-size": `${Math.max(2, (row.value / max) * 100)}%` }} title={`${row.t}: ${(row.value * 100).toFixed(1)}%`} />)}
    </div>
    <div className="result-columns__axis tnum" aria-hidden="true"><span>{rows[0].t}</span><span>{rows.at(-1).t}</span></div>
    <figcaption>{tr(locale, `가장 높은 시점: ${peak.t}개월 (${(peak.value * 100).toFixed(1)}%). 가로는 경과 개월입니다.`, `Highest at month ${peak.t} (${(peak.value * 100).toFixed(1)}%). Across: months elapsed.`)}</figcaption>
  </figure>;
}

export const RESULT_CHART_VARIANTS = Object.freeze({
  "mix-rate": ResultMixRate,
  "unit-cost-gap": ResultUnitCostGap,
  "budget-shift": ResultBudgetShift,
  "vif-threshold": ResultVifThreshold,
  "status-share": ResultStatusShare,
  "effect-interval": ResultEffectInterval,
  "survival-step": ResultSurvival,
  "hazard-columns": ResultHazardColumns,
});

/** 도구 화면의 결론 카드 바로 아래에 두는 핵심 그림. 결과 작업대와 같은 사양(`lib/assistant/coreFigures`)과
 *  같은 그림을 써서, 결과 화면에서 도구로 들어가도 같은 분석이 같은 모양으로 보인다. 그릴 값이 없으면 아무것도 그리지 않는다.
 *  `downloadName`을 주면 제목 줄에 PNG 받기(Pro)가 붙는다 — 캔버스 차트를 걷어낸 자리의 다운로드를 잇는다. */
export function ToolCoreFigure({ figure, locale = "ko", currency = "KRW", downloadName = null, embedded = false }) {
  const holderRef = useRef(null);
  const Chart = figure && RESULT_CHART_VARIANTS[figure.options?.variant];
  if (!Chart || !figure.data?.length) return null;
  const headingId = `tool-core-figure-${figure.id}`;
  const Heading = embedded ? "h3" : "h2";
  return <section className={`tool-core-figure${embedded ? " tool-core-figure--embedded" : " block"}`} id={headingId} aria-labelledby={`${headingId}-title`}>
    <div className="section-head">
      <Heading className="section-title" id={`${headingId}-title`}>{figure.question}</Heading>
      {downloadName && <FigurePngButton target={() => holderRef.current?.querySelector(".result-chart")} fileName={downloadName} locale={locale} title={figure.question} />}
    </div>
    <div ref={holderRef}><Chart visualization={figure} locale={locale} currency={currency} /></div>
  </section>;
}
