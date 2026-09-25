"use client";

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
  if (!Number.isFinite(value) || !(max > 0)) return fallback;
  const size = Math.max(0.5, (Math.abs(value) / max) * 50);
  return { "--bar-start": `${value >= 0 ? 50 : 50 - size}%`, "--bar-size": `${size}%` };
}

/** 5-21 성과 변동: 직전 → 비중 변화 → 효율 변화 → 최근 다리 + 채널별 두 성분. */
export function ResultMixRate({ visualization, locale, currency, fallback = null }) {
  const options = visualization.options || {};
  const metric = options.metric || "CPA";
  const rows = (visualization.data || [])
    .map((row) => ({ entity: row.entity, mix: finite(row.mix), rate: finite(row.rate), contribution: finite(row.contribution) }))
    .filter((row) => row.mix != null || row.rate != null)
    .sort((a, b) => Math.abs(b.contribution || 0) - Math.abs(a.contribution || 0));
  if (!rows.length) return fallback;
  const mixTotal = sum(rows.map((row) => row.mix));
  const rateTotal = sum(rows.map((row) => row.rate));
  const max = Math.max(...rows.flatMap((row) => [Math.abs(row.mix || 0), Math.abs(row.rate || 0)]), 0);
  const start = finite(options.start);
  const end = finite(options.end);
  const parts = [
    { key: "mix", label: tr(locale, "비중 변화", "Mix"), hint: tr(locale, "싼·비싼 채널의 성과 비중이 바뀐 몫", "Share moved between cheaper and costlier channels") },
    { key: "rate", label: tr(locale, "효율 변화", "Rate"), hint: tr(locale, "채널 자체 단가가 바뀐 몫", "Each channel's own unit cost changed") },
  ];
  return <figure className="result-chart result-mix-rate" aria-label={visualization.question}>
    <ol className="result-bridge tnum">
      <li><span>{tr(locale, `직전 ${metric}`, `Prior ${metric}`)}</span><b>{start != null ? money(start, currency) : "—"}</b></li>
      <li data-tone={costTone(mixTotal)}><span>{parts[0].label}</span><b>{signedMoney(mixTotal, currency)}</b></li>
      <li data-tone={costTone(rateTotal)}><span>{parts[1].label}</span><b>{signedMoney(rateTotal, currency)}</b></li>
      <li><span>{tr(locale, `최근 ${metric}`, `Recent ${metric}`)}</span><b>{end != null ? money(end, currency) : "—"}</b></li>
    </ol>
    <ul className="result-split">
      {rows.slice(0, 6).map((row) => <li key={row.entity}>
        <div className="result-split__head"><strong>{row.entity}</strong><span className="tnum" data-tone={costTone(row.contribution)}>{signedMoney(row.contribution, currency)}</span></div>
        {parts.map((part) => <div className={`result-split__bar is-${part.key}`} key={part.key}>
          <span>{part.label}</span>
          <div className="result-diverging" aria-hidden="true"><i style={divergingStyle(row[part.key], max) || undefined} /></div>
          <b className="tnum">{signedMoney(row[part.key], currency)}</b>
        </div>)}
      </li>)}
    </ul>
    <figcaption>{tr(locale, `가운데 선 오른쪽은 ${metric}를 올린 쪽, 왼쪽은 낮춘 쪽입니다. `, `Right of the centre line raised ${metric}; left lowered it. `)}{parts.map((part) => `${part.label}: ${part.hint}`).join(" · ")}</figcaption>
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
    <ul>
      {rows.slice(0, 8).map((row) => {
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
      })}
    </ul>
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
    <ul>
      {rows.slice(0, 8).map((row) => {
        const delta = row.current != null && row.next != null ? row.next - row.current : null;
        return <li key={row.entity}>
          <div className="result-shift__head"><strong>{row.entity}</strong><span className="tnum">{signedMoney(delta, currency)}</span></div>
          <div className="result-shift__bars" aria-hidden="true">
            <i className="is-current" style={{ "--shift-size": size(row.current) }} />
            <i className="is-next" style={{ "--shift-size": size(row.next) }} />
          </div>
          <p className="tnum">{tr(locale, "지금", "Now")} {row.current != null ? money(row.current, currency) : "—"} → {tr(locale, "바꾼 안", "Plan")} {row.next != null ? money(row.next, currency) : "—"}</p>
        </li>;
      })}
    </ul>
    <figcaption><i className="result-shift__key is-current" /> {tr(locale, "지금 하루 예산", "Daily budget now")} <i className="result-shift__key is-next" /> {tr(locale, "바꾼 안의 하루 예산", "Daily budget in the plan")}</figcaption>
  </figure>;
}

/** 5-25 채널 중복: 채널별 VIF를 주의·심각 기준선과 함께(로그 눈금). */
export function ResultVifThreshold({ visualization, locale, fallback = null }) {
  const [warn, severe] = visualization.options?.thresholds || [];
  const rows = (visualization.data || []).map((row) => ({ entity: row.entity, vif: finite(row.vif) }));
  if (!rows.length || !Number.isFinite(warn) || !Number.isFinite(severe)) return fallback;
  const top = Math.max(severe * 10, ...rows.map((row) => row.vif || 0));
  const at = (value) => Math.max(0, Math.min(100, (Math.log10(Math.max(1, value)) / Math.log10(top)) * 100));
  const toneOf = (value) => (value == null ? "muted" : value >= severe ? "worse" : value >= warn ? "caution" : "better");
  return <figure className="result-chart result-vif" aria-label={visualization.question}>
    <ul>
      {rows.slice(0, 8).map((row) => <li key={row.entity}>
        <strong>{row.entity}</strong>
        <div className="result-vif__track" aria-hidden="true">
          <i className="result-vif__bar" data-tone={toneOf(row.vif)} style={{ "--vif-size": `${row.vif == null ? 0 : Math.max(1, at(row.vif))}%` }} />
          <i className="result-vif__line" style={{ "--vif-at": `${at(warn)}%` }} />
          <i className="result-vif__line is-severe" style={{ "--vif-at": `${at(severe)}%` }} />
        </div>
        <b className="tnum" data-tone={toneOf(row.vif)}>{row.vif == null ? tr(locale, "계산 불가", "Not computable") : fmtNum(row.vif, row.vif < 10 ? 1 : 0)}</b>
      </li>)}
    </ul>
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
  "survival-step": ResultSurvival,
  "hazard-columns": ResultHazardColumns,
});
