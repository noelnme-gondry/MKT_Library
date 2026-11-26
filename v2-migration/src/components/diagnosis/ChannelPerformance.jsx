"use client";

import { useId, useMemo, useRef, useState } from "react";
import { compareChannelPerformance, scanChannelPairs, MIN_TREND_WEEKS, STABLE_SPEND_FRACTION } from "@/lib/channelPerformance";
import ChannelWeekScatter from "./ChannelWeekScatter";
import s from "./DiagnosisWorkbench.module.css";

const PAGE_SIZE = 5;
function pairKey(pair) { return JSON.stringify([pair.source,pair.target]); }

export default function ChannelPerformance({report,meta,en,fmt,track}) {
  const {channels,reason} = report.channelPerformance;
  const [mode,setMode] = useState("auto");
  const [stable,setStable] = useState(false);
  const [page,setPage] = useState(0);
  const [chosen,setChosen] = useState(null);
  const chartId = useId(), headingId = useId();
  const chart = useRef(null);
  const t = (ko,english) => en ? english : ko;
  const pairs = useMemo(() => scanChannelPairs(channels,mode,stable),[channels,mode,stable]);
  const currentPage = Math.max(0,Math.min(page,Math.ceil(pairs.length / PAGE_SIZE)-1));
  const visible = pairs.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
  const selected = visible.find(p => pairKey(p) === chosen) ?? visible[0];
  const events = selected ? compareChannelPerformance(
    channels.find(channel => channel.name === selected.source),
    channels.find(channel => channel.name === selected.target),
    selected.exposure, stable,
  ).events : [];
  const label = meta.resultLabel || t("성과","Outcomes");
  const heading = <h3 id={headingId}>{t("어느 매체를 증액했을 때 다른 매체의 성과가 달라졌나요?","When one channel increased its budget, what changed elsewhere?")}</h3>;
  if (!pairs.length) return <section className={s.pairReport} aria-labelledby={headingId}>{heading}<p>{reason==="scope" ? t("같은 시장과 플랫폼을 선택해 비교하세요.","Select one market and platform to compare.") : t("같은 기간에 집행한 두 매체 이상의 이름과 주별 지출·성과가 필요합니다.","Include at least two named channels with spend and outcomes for matching weeks.")}</p></section>;
  const evidence = p => {setChosen(pairKey(p));track?.("evidence_open");requestAnimationFrame(()=>chart.current?.focus());};
  const exposureLabel = pair => pair.exposure==="budget" ? t("설정 예산","Budget") : t("실제 지출","Spend");
  const changeCPA = g => g.lostAll ? t("성과 0건","0 outcomes") : fmt.moneyDelta(g.cpaChange);
  const percent = rate => Number.isFinite(rate) ? (rate>0?"+":"")+fmt.percent(rate) : "—";
  return <section className={s.pairReport} aria-labelledby={headingId}>
    {heading}
    <p>{t(`${channels.length}개 매체의 ${pairs.length}개 방향을 비교했습니다. 증액한 주와 그 직전 주를 짝지어, 상대 매체의 CPA 변화와 주당 평균 성과 증감을 계산했습니다.`,
      `Compared all ${pairs.length} directions across ${channels.length} channels. Each increase week is paired with the prior week to measure the outcome channel’s CPA change and average weekly change in outcomes.`)}</p>
    <div className={s.pairLayout}><div className={s.pairRows}>
      <div className={s.tableScroll}><table><caption className={s.tableCaption}>{t("CPA 상승과 성과 감소가 함께 관측된 조합부터 표시","Pairs with both rising CPA and fewer outcomes appear first")}</caption>
        <thead><tr>{[t("증액 → 성과 매체","Source → outcome"),t("CPA 변화","CPA change"),t(`주당 성과 증감 (${label})`,`Weekly change (${label})`)].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{visible.map(pair=><tr key={pairKey(pair)} data-selected={pair===selected} onClick={event => { if (!event.target.closest("button")) evidence(pair); }}>
          <th scope="row"><button type="button" onClick={()=>evidence(pair)} aria-controls={chartId} aria-pressed={pair===selected}>{pair.source} → {pair.target}</button>
            <small>{exposureLabel(pair)} · {pair.raised.weeks ? t(`증가 ${pair.raised.weeks}주 · 평균 ${fmt.moneyDelta(pair.raised.sourceChange)}`,`${pair.raised.weeks} increase wk · avg ${fmt.moneyDelta(pair.raised.sourceChange)}`):
              pair.other.weeks ? t("증가한 주 없음","No increase weeks") : t("비교 가능한 주 없음","No comparable weeks")}</small></th>
          <td>{changeCPA(pair.raised)}<small>{percent(pair.raised.cpaRate)}</small></td>
          <td>{fmt.delta(pair.raised.resultChange)}<small>{percent(pair.raised.resultRate)}</small></td></tr>)}</tbody></table></div>
      {pairs.length>PAGE_SIZE && <div className={s.pager}><button type="button" disabled={!currentPage} onClick={()=>setPage(currentPage-1)}>{t("이전","Previous")}</button>
        <span>{currentPage+1} / {Math.ceil(pairs.length/PAGE_SIZE)}</span><button type="button" disabled={(currentPage+1)*PAGE_SIZE>=pairs.length} onClick={()=>setPage(currentPage+1)}>{t("다음","Next")}</button></div>}
      <details><summary>{t("비교 기준과 필터","Comparison method and filters")}</summary>
        <div className={s.pairControls}><label>{t("증가 기준","Increase measure")}<select value={mode} onChange={e=>{setMode(e.target.value);setPage(0);}}>
          <option value="auto">{t("설정 예산 우선 · 없으면 지출","Budget when available, otherwise spend")}</option>
          <option value="cost">{t("모든 매체의 실제 지출","Actual spend for all channels")}</option></select></label></div>
        <label className={s.pairFilter}><input type="checkbox" checked={stable} onChange={e=>{setStable(e.target.checked);setPage(0);}}/>{t("상대 매체 자체 지출 변동","Outcome-channel spend change")} ±{fmt.percent(STABLE_SPEND_FRACTION)} {t("이내","or less")}</label>
        <p>{t("CPA는 양쪽 기간 각각의 총지출을 총성과로 나눴습니다. 성과 건수는 짝지은 주의 차이를 평균 냈습니다. 같은 기간에 여러 매체가 증액할 수 있어 조합별 증감을 합산할 수 없습니다.","CPA is total spend divided by total outcomes for each side of the comparison. Outcome changes are averaged across matched weeks. Multiple channels can increase together, so changes across pairs are not additive.")}</p>
      </details></div>
      <div className={s.pairEvidence} tabIndex={-1} ref={chart} id={chartId}>
        <h4>{selected.source} → {selected.target}</h4>
        {events.length ? <><ChannelWeekScatter key={pairKey(selected)} pair={selected} events={events} grain={report.grain} fmt={fmt} en={en} label={label} currency={report.currency || meta.currency}/>
          <p className={s.note}>{t("유지·감소한 주","Flat or lower weeks")} ({selected.other.weeks}) · CPA {changeCPA(selected.other)} · {t("주당 성과","Outcomes per week")} {fmt.delta(selected.other.resultChange)}</p>
          {selected.raised.weeks < MIN_TREND_WEEKS && <p className={s.note}>{t("증가한 주가 3주 미만이어서 반복 경향을 판단하기 어렵습니다.","Fewer than three increase weeks are available to assess recurrence.")}</p>}</> :
          <p>{t("두 매체가 연속 두 주에 함께 기록된 지출과 성과를 확인하세요.","Check both channels for spend and outcome records in consecutive weeks.")}</p>}
      </div></div><p className={s.note}>{t("같은 주에 관측된 변화입니다. 한 매체의 증액이 다른 매체의 변화를 일으켰는지는 별도 검증이 필요합니다.","These are same-week observations. Establishing whether one channel caused the change requires a separate test.")}</p>
  </section>;
}
