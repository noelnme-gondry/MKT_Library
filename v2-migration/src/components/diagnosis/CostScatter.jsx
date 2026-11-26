"use client";

import { useId, useState } from "react";
import styles from "./DiagnosisWorkbench.module.css";

const PERIODS = ["history", "previous", "current"];
function axisMax(value) {
  if (!(value > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(value));
  const step = base / 2;
  return Math.ceil(value / step) * step;
}

export default function CostScatter({ entity, locale, fmt, target, grain, currency, resultLabel }) {
  const en = locale === "en";
  const titleId = useId();
  const points = (entity.points || []).filter((p) => Number.isFinite(p.cost) && Number.isFinite(p.cpa));
  const zeroCount = (entity.points || []).filter((p) => p.result === 0).length;
  const [picked, setPicked] = useState(null);
  const chosen = points.find((p) => p.date === picked) || points[points.length - 1];
  const periodLabel = en ? ["Earlier", "Previous", "Current"] : ["이전 이력", "비교 기간", "분석 기간"];
  const grainLabel = grain === "weekly" ? (en ? "week" : "주") : (en ? "day" : "일");
  const unit = currency ? " (" + currency + ")" : "";
  const unitCost = (en ? "Spend per " + grainLabel : grainLabel + "별 집행액") + unit;
  const pointTitle = (p) => p.date + " · " + (en ? "Spend " : "집행액 ") + fmt.money(p.cost) + " · CPA " + fmt.money(p.cpa);
  const xMax = axisMax(points.reduce((n, p) => Math.max(n, p.cost), 0));
  const yMax = axisMax(points.reduce((n, p) => Math.max(n, p.cpa), Number.isFinite(target) ? target : 0));
  return <figure className={styles.scatter} aria-labelledby={titleId}>
    <figcaption id={titleId}><strong>{en ? "Spend vs. cost per acquisition" : "집행액에 따른 CPA"}</strong>
      <span>{entity.name} · {en ? "One point per " + grainLabel : "점 하나는 1" + grainLabel + " 집계"}</span></figcaption>
    {chosen ? <>
      <div className={styles.plotKey}>{PERIODS.map((period, i) => points.some((p) => p.period === period) &&
        <span key={period}><i data-period={period} />{periodLabel[i]}</span>)}
        {Number.isFinite(target) && <span><i className={styles.dash} />{en ? "Target" : "목표"} {fmt.money(target)}</span>}</div>
      <div className={styles.axisTitle}>CPA{unit}</div>
      <div className={styles.plotArea}>
        <div className={styles.yAxis}>{[1,.75,.5,.25,0].map((n) => <span key={n}>{fmt.short(yMax*n)}</span>)}</div>
        <svg viewBox="0 0 500 200" preserveAspectRatio="none" role="img" aria-label={en ? "Observed spend and CPA. Select a date below for exact values." : "관측 집행액과 CPA. 아래 날짜를 선택하면 정확한 수치를 확인할 수 있습니다."}>
          {[0,.25,.5,.75,1].map((r) => <line key={r} x1="0" x2="500" y1={200*r} y2={200*r} className={styles.gridLine} />)}
          {Number.isFinite(target) && <line x1="0" x2="500" y1={200 * (1 - target / yMax)} y2={200 * (1 - target / yMax)} className={styles.targetLine} />}
        </svg>
        {points.map((p) => <button key={p.date} type="button" className={styles.dot} data-period={p.period}
          aria-label={pointTitle(p)} tabIndex={-1} title={pointTitle(p)} aria-pressed={p.date === chosen.date}
          style={{left: (100*p.cost/xMax)+"%", bottom:(100*p.cpa/yMax)+"%"}} onClick={() => setPicked(p.date)} />)}
        <div className={styles.xAxis}>{[0,.25,.5,.75,1].map((r) => <span key={r}>{fmt.short(xMax*r)}</span>)}</div>
      </div>
      <div className={styles.xTitle}>{unitCost}</div>
      <div className={styles.pointReadout}>
        <label>{en ? "Observation" : "관측일"} <select value={chosen.date} onChange={(e) => setPicked(e.target.value)}>{points.map((p) => <option key={p.date} value={p.date}>{p.date}</option>)}</select></label>
        <span>{en ? "Spend" : "집행액"} <b>{fmt.money(chosen.cost)}</b></span><span>{resultLabel} <b>{fmt.num(chosen.result)}</b></span><span>CPA <b>{fmt.money(chosen.cpa)}</b></span>
      </div>
    </> : <p>{en ? "There are no observations with a calculable CPA." : "CPA를 계산할 수 있는 관측점이 없습니다."}</p>}
    {zeroCount > 0 && <p className={styles.note}>{en ? "Observations with zero results, excluded from this plot" : "성과가 0건이라 그래프에서 제외한 관측 수"} · {zeroCount}</p>}
  </figure>;
}
