"use client";

import { useEffect, useId, useRef, useState } from "react";
import { addDays } from "@/lib/budgetPlanner/plannerStats";
import s from "./DiagnosisWorkbench.module.css";

const ticks = [0, .25, .5, .75, 1];
const left = 43, top = 22, bottom = 194;
const cpa = week => week.result > 0 ? week.cost / week.result : null;

export default function ChannelWeekScatter({pair, events, fmt, en, label, currency, grain}) {
  const t = (ko, english) => en ? english : ko;
  const titleId = useId();
  const container = useRef(null);
  const tipId = useId();
  const [width,setWidth] = useState(420);
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  },[]);
  const [picked,setPicked] = useState(null);
  const points = events.filter(event => cpa(event.after) !== null && Number.isFinite(event.sourceCost));
  const chosen = points.find(event => event.end === picked);
  useEffect(() => {
    if (!picked) return;
    const dismissOutside = e => {
      if (!container.current?.contains(e.target) || !e.target.closest?.("[data-week]")) setPicked(null);
    };
    const escape = e => { if (e.key === "Escape") setPicked(null); };
    document.addEventListener("pointerdown",dismissOutside);
    document.addEventListener("keydown",escape);
    return () => {
      document.removeEventListener("pointerdown",dismissOutside);
      document.removeEventListener("keydown",escape);
    };
  },[picked]);
  const maxCost = points.reduce((max,e) => Math.max(max,e.after.cost), 0) || 1;
  const maxCPA = points.reduce((max,e) => Math.max(max,cpa(e.after)), 0) || 1;
  const minSpend = points.reduce((min,p) => Math.min(min,p.sourceCost), Infinity);
  const maxSpend = points.reduce((max,p) => Math.max(max,p.sourceCost), 0);
  function spendColor(cost) {
    const fraction = minSpend === maxSpend ? 0.5 : (cost-minSpend)/(maxSpend-minSpend);
    return `color-mix(in srgb, var(--spend-high) ${fraction*100}%, var(--spend-low))`;
  }
  const right = width - 23;
  const x = event => left+(right-left)*event.after.cost/maxCost;
  const y = event => bottom-(bottom-top)*cpa(event.after)/maxCPA;
  const tipWidth = Math.min(260, width - 8);
  const measure = pair.exposure === "budget"
    ? (grain === "daily" ? t("일평균 설정 예산","average daily budget") : t("설정 예산","configured budget"))
    : t("주간 실제 지출","weekly actual spend");
  const resultUnit = currency ? " (" + currency + ")" : "";
  const info = event => [event.end, pair.source+" "+fmt.money(event.sourceCost),
    pair.target+" "+fmt.money(event.after.cost), "CPA "+fmt.money(cpa(event.after)), label+" "+fmt.num(event.after.result)].join(" · ");
  return <figure ref={container} className={s.weekScatter} aria-labelledby={titleId}>
    <figcaption id={titleId}><strong>{pair.target} · {t("주간 지출과 CPA","Weekly spend and CPA")}</strong>
      <span>{t(`점 하나는 한 주입니다. 색이 진할수록 그 주의 ${pair.source} 실제 지출액이 큽니다.`,
        `Each dot is one week. Darker blue means higher actual ${pair.source} spend that week.`)}</span></figcaption>
    {points.length > 0 && <>
      <div className={s.spendKey}>
        <strong>{pair.source} · {t("주간 실제 지출","Weekly actual spend")}</strong>
        {minSpend < maxSpend ? <span>{fmt.money(minSpend)} <i aria-hidden="true"/> {fmt.money(maxSpend)}</span> :
          <span><i aria-hidden="true" style={{background:spendColor(minSpend),width:8}}/>{fmt.money(minSpend)} · {t("모든 주 동일","Same in every week")}</span>}
      </div>
      <div className={s.scatterFrame}><svg className={s.bubblePlot} viewBox={`0 0 ${width} 232`} role="group" aria-label={t(`${pair.target} 지출과 CPA. 점에 마우스를 올리거나 탭하면 주간 상세값이 열립니다.`, `${pair.target} spend and CPA. Hover, focus or tap a dot for weekly details.`)}>
        <text x={left} y="10">{pair.target} CPA{resultUnit}</text>
        {ticks.map(n => {
          const x = left+n*(right-left), y=bottom-n*(bottom-top);
          return <g key={n}><line x1={left} x2={right} y1={y} y2={y}/><text x={left-7} y={y+3} textAnchor="end">{fmt.short(maxCPA*n)}</text>
            {(width >= 375 || n===0 || n===0.5 || n===1) && <text x={x} y={bottom+17} textAnchor="middle">{fmt.short(maxCost*n)}</text>}</g>;
        })}
        <text x={(left+right)/2} y="229" textAnchor="middle">{pair.target} · {t("주간 실제 지출","Weekly actual spend")}{resultUnit}</text>
        {points.map(event => <g key={event.end}
          transform={`translate(${x(event)} ${y(event)})`} className={s.weekDot}
          data-week={event.end} data-cost={event.sourceCost}
          role="button" tabIndex={0} aria-label={info(event)}
          aria-describedby={chosen===event ? tipId : undefined}
          onPointerEnter={e => { if (e.pointerType !== "touch") setPicked(event.end); }}
          onPointerLeave={e => { if (e.pointerType !== "touch") setPicked(null); }}
          onPointerDown={e => { if (e.pointerType === "touch") e.preventDefault(); }}
          onPointerUp={e => { if (e.pointerType === "touch") setPicked(previous => previous===event.end ? null : event.end); }}
          onFocus={() => setPicked(event.end)} onBlur={() => setPicked(null)}
          onKeyDown={e => { if (e.key==="Enter" || e.key===" ") { e.preventDefault(); setPicked(event.end); } }}>
          <circle r="12" fill="transparent"/>
          {chosen===event && <circle r="7" className={s.dotHalo}/>}
          <circle fill={spendColor(event.sourceCost)} r="3.7"/>
        </g>)}
      </svg>
      {chosen && <div id={tipId} role="tooltip" className={s.weekTooltip} style={{
        width:tipWidth, left:Math.max(4,Math.min(width-tipWidth-4, x(chosen)-tipWidth/2)),
        ...(y(chosen)>110 ? {bottom:232-y(chosen)+12} : {top:y(chosen)+12}),
      }}>
        <strong>{addDays(chosen.end,-6)} – {chosen.end}</strong>
        <span>{pair.source} · {measure} <b>{fmt.moneyDelta(chosen.to-chosen.from)}</b></span>
        <span>{pair.source} · {t("실제 지출","Actual spend")} <b>{fmt.money(chosen.sourceCost)}</b></span>
        <span>{pair.target} · {t("실제 지출","Actual spend")} <b>{fmt.money(chosen.after.cost)}</b></span>
        <span>{pair.target} · CPA <b>{fmt.money(cpa(chosen.after))}</b></span>
        <span>{pair.target} · {label} <b>{fmt.num(chosen.after.result)}</b></span>
      </div>}</div></>}
    {points.length < events.length && <p className={s.note}>{t("CPA 또는 실제 지출을 확인할 수 없어 산점도에서 제외한 주","Weeks without a calculable CPA or observed source spend")} · {events.length-points.length}</p>}
  </figure>;
}
