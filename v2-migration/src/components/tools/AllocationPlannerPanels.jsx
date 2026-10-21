"use client";
// 5-3 결과에 붙는 플래너 근거: 성과 예측 · 대상별 상태와 원인 · 단가 변화 분해 · 소재 상태.
// 계산은 lib/budgetPlanner가 하고, 여기서는 읽는 순서대로 보여 주기만 한다.
import { useState } from "react";
import DataTable from "@/components/ds/DataTable";
import {
  bindingLabel, CREATIVE_STATE_LABELS, CREATIVE_STATE_ORDER, NODE_STATE_LABELS, PVM_COLUMN_LABELS,
  VERDICT_LABELS, VERDICT_REASON_LABELS, plannerLabel,
} from "@/lib/budgetPlanner/plannerLabels";
import { addDays } from "@/lib/budgetPlanner/plannerStats";
import { planReviewText } from "@/lib/budgetPlanner/planReview";

// 표시 자리수에서 0이면 부호를 붙이지 않는다("−0.0%" 금지).
const pct = (value) => {
  const text = Math.abs(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0);
  if (Number(text) === 0) return "0%";
  return `${value > 0 ? "+" : "−"}${text}%`;
};

/** 이 배분안으로 앞으로 N일 — 기간 합계와 범위, 그리고 그 범위를 얼마나 믿을 수 있는지(백테스트). */
export function PlannerForecast({
  forecast, backtest, locale = "ko", resultLabel, metricLabel, fmtMoney, fmtCount, fmtUnitCost, resultIsMoney = false,
  units = [], newCreativeUnit = "", onNewCreativeUnit, newCreativeScenario = null, fatigueScenario = null,
}) {
  if (!forecast?.total || !(forecast.total.results > 0)) return null;
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const { total, flags, startDate, horizonDays } = forecast;
  const fmtResult = resultIsMoney ? fmtMoney : fmtCount;
  const end = addDays(startDate, horizonDays - 1);
  return (
    <section className="planner-forecast" aria-labelledby="planner-forecast-title">
      <h3 id="planner-forecast-title">{tr(`이 배분안으로 앞으로 ${horizonDays}일`, `Next ${horizonDays} days with this plan`)}</h3>
      <p className="planner-forecast__period">{startDate} – {end}</p>
      <dl className="planner-forecast__stats">
        <div>
          <dt>{tr(`예상 ${resultLabel}`, `Expected ${resultLabel}`)}</dt>
          <dd>{fmtResult(total.results)}</dd>
          <dd className="planner-forecast__range">{tr("범위", "Range")} {fmtResult(total.lo)} – {fmtResult(total.hi)}</dd>
        </div>
        <div>
          <dt>{tr(`예상 ${metricLabel}`, `Expected ${metricLabel}`)}</dt>
          <dd>{fmtUnitCost(total.cpr)}</dd>
        </div>
        <div>
          <dt>{tr("지출 합계", "Total spend")}</dt>
          <dd>{fmtMoney(total.cost)}</dd>
        </div>
      </dl>
      <ul className="planner-forecast__notes">
        <li>{tr(
          "요일별 지출·효율 차이를 반영해 하루씩 더했습니다. 범위는 과거 예측 오차의 10~90% 구간을 대상끼리 그대로 더한 값이라 넓게 잡힌 편입니다.",
          "Summed day by day with weekday spend and efficiency patterns. The range adds each target's 10–90% past-error band, so it is deliberately wide.",
        )}</li>
        {backtest?.evaluated ? (
          <li>{tr(
            `최근 ${backtest.holdoutDays}일을 빼고 같은 방법으로 맞춰 보니 합계 오차 ${pct(backtest.totalError)}, 하루 범위 안에 든 날 ${Math.round(backtest.dailyCoverage * 100)}%였습니다.`,
            `Refitting without the last ${backtest.holdoutDays} days, the total was off by ${pct(backtest.totalError)} and ${Math.round(backtest.dailyCoverage * 100)}% of days fell inside the daily range.`,
          )}{backtest.belowCoverage ? tr(" 범위가 실제보다 좁을 수 있습니다.", " The range may be narrower than reality.") : ""}</li>
        ) : (
          <li>{tr("과거 기간으로 맞춰 볼 데이터가 부족해 예측 오차를 확인하지 못했습니다.", "Not enough history to check the forecast error against a held-out period.")}</li>
        )}
        {flags.extrapolatedNodes > 0 && <li>{tr(`${flags.extrapolatedNodes}개 대상은 써 본 적 없는 지출 수준이 섞여 있어 추정치입니다.`, `${flags.extrapolatedNodes} target(s) include spend levels outside history, so their numbers are estimates.`)}</li>}
        {flags.assumedLaunchProfiles > 0 && <li>{tr(`${flags.assumedLaunchProfiles}개 대상은 신규 소재 출시 이력이 부족해 학습 비용을 기본 가정으로 넣었습니다.`, `${flags.assumedLaunchProfiles} target(s) lack launch history, so new-creative learning costs use default assumptions.`)}</li>}
      </ul>
      <PlannerForecastScenarios
        locale={locale}
        resultLabel={resultLabel}
        metricLabel={metricLabel}
        fmtResult={fmtResult}
        fmtUnitCost={fmtUnitCost}
        horizonDays={horizonDays}
        units={units}
        newCreativeUnit={newCreativeUnit}
        onNewCreativeUnit={onNewCreativeUnit}
        newCreativeScenario={newCreativeScenario}
        fatigueScenario={fatigueScenario}
      />
    </section>
  );
}

const changeText = (from, to) => (from > 0 && Number.isFinite(to) ? pct(to / from - 1) : "—");

/** 가정을 바꿔 보기: 같은 배분에서 신규 소재 투입·주력 소재 피로를 가정하면 예측이 어떻게 바뀌나(spec §8·§8.1). */
function PlannerForecastScenarios({ locale, resultLabel, metricLabel, fmtResult, fmtUnitCost, horizonDays, units, newCreativeUnit, onNewCreativeUnit, newCreativeScenario, fatigueScenario }) {
  const [showFatigue, setShowFatigue] = useState(false);
  const tr = (ko, en) => (locale === "en" ? en : ko);
  if (!units.length || !onNewCreativeUnit) return null;
  const selectId = "planner-new-creative-unit";
  const nc = newCreativeScenario;
  const fatigueTargets = fatigueScenario?.targets ?? [];
  const fatigueNames = fatigueTargets.slice(0, 3).map((target) => `${target.unit} (${target.date})`).join(", ");
  const fatigueMore = fatigueTargets.length - 3;
  return (
    <div className="planner-scenarios" role="group" aria-label={tr("가정을 바꿔 보기", "Try different assumptions")}>
      <div className="planner-scenarios__row">
        <label htmlFor={selectId}>{tr("새 소재를 넣는다면", "If you launch a new creative")}</label>
        <select id={selectId} value={newCreativeUnit} onChange={(event) => onNewCreativeUnit(event.target.value)}>
          <option value="">{tr("넣지 않음", "No new creative")}</option>
          {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </select>
      </div>
      {nc?.base && nc?.scenario && (
        <p className="planner-scenarios__result" aria-live="polite">
          {tr(
            `${nc.unit}에 내일 새 소재를 넣으면 ${horizonDays}일 예상 ${resultLabel} ${fmtResult(nc.base.results)} → ${fmtResult(nc.scenario.results)} (${changeText(nc.base.results, nc.scenario.results)})`,
            `Launching a new creative in ${nc.unit} tomorrow: ${horizonDays}-day expected ${resultLabel} ${fmtResult(nc.base.results)} → ${fmtResult(nc.scenario.results)} (${changeText(nc.base.results, nc.scenario.results)})`,
          )}
          {nc.node ? tr(`, 이 대상 ${metricLabel} ${fmtUnitCost(nc.node.baseCpr)} → ${fmtUnitCost(nc.node.scenarioCpr)}.`, `; this target's ${metricLabel} ${fmtUnitCost(nc.node.baseCpr)} → ${fmtUnitCost(nc.node.scenarioCpr)}.`) : "."}
          {" "}
          {nc.assumed
            ? tr("과거 출시 이력이 부족해 학습 비용은 기본 가정(첫 3일·다음 4일·그다음 7일 동안 기존 대비 비싸게)으로 넣었습니다.", "Launch history is too short, so learning costs use the default assumption (pricier than incumbents for the first 3, next 4 and following 7 days).")
            : tr(`과거 출시 ${nc.launches}건에서 배운 학습 비용을 썼습니다.`, `Learning costs come from ${nc.launches} past launches.`)}
        </p>
      )}
      {fatigueScenario?.base && fatigueScenario?.scenario && (
        <>
          <label className="planner-scenarios__check">
            <input type="checkbox" checked={showFatigue} onChange={(event) => setShowFatigue(event.target.checked)} />
            <span>{tr("주력 소재 피로를 반영", "Include main-creative fatigue")}</span>
          </label>
          <p className="planner-scenarios__result">
            {tr(
              `피로 지수가 지금 추세대로 임계에 닿는 날: ${fatigueNames}${fatigueMore > 0 ? ` 외 ${fatigueMore}개` : ""}.`,
              `Days when the fatigue index reaches its threshold at the current trend: ${fatigueNames}${fatigueMore > 0 ? ` and ${fatigueMore} more` : ""}.`,
            )}
            {showFatigue && tr(
              ` 그날부터 ${metricLabel}가 ${Math.round(fatigueScenario.penalty * 100)}% 나빠진다고 보면 ${horizonDays}일 예상 ${resultLabel} ${fmtResult(fatigueScenario.base.results)} → ${fmtResult(fatigueScenario.scenario.results)} (${changeText(fatigueScenario.base.results, fatigueScenario.scenario.results)}).`,
              ` If ${metricLabel} worsens by ${Math.round(fatigueScenario.penalty * 100)}% from then, ${horizonDays}-day expected ${resultLabel} ${fmtResult(fatigueScenario.base.results)} → ${fmtResult(fatigueScenario.scenario.results)} (${changeText(fatigueScenario.base.results, fatigueScenario.scenario.results)}).`,
            )}
          </p>
        </>
      )}
    </div>
  );
}

/** 대상별: 지금 소진이 과거 범위 안인가 · 최근 단가 변화의 원인 후보 · 배분에서 무엇에 걸렸나. */
export function PlannerTargetStatus({ planner, allocation, locale = "ko", metricLabel, isRoas = false }) {
  if (!planner?.ok || !planner.units?.length) return null;
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const itemByUnit = new Map((allocation?.items || []).map((item) => [item.channel, item]));
  const rows = [...planner.units].sort((a, b) => (b.current || 0) - (a.current || 0) || a.unit.localeCompare(b.unit)).map((unit) => {
    const total = unit.diagnosis?.components?.total;
    const change = Number.isFinite(total) ? (isRoas ? Math.exp(-total) - 1 : Math.exp(total) - 1) : null;
    const reason = unit.diagnosis?.verdict === "INCONCLUSIVE" || !unit.diagnosis?.verdict ? plannerLabel(VERDICT_REASON_LABELS, unit.diagnosis?.reason, locale) : null;
    return {
      unit: unit.unit,
      state: unit.state,
      borrowed: unit.curveSource === "borrowed",
      change,
      verdict: unit.diagnosis?.verdict,
      reason,
      // 지금 소진 열이 이미 "써 본 적 없는 지출 수준"이라고 말하면 원인 열에서 반복하지 않는다.
      extrapolated: unit.diagnosis?.extrapolated && unit.state !== "EXTRAPOLATING",
      binding: itemByUnit.get(unit.unit)?.binding || null,
    };
  });
  const { windows } = planner;
  // 모든 대상이 같은 제약에 걸렸으면 행마다 반복하지 않고 한 문장으로 말한다.
  const bindings = new Set(rows.map((row) => row.binding));
  const sharedBinding = rows.length > 1 && bindings.size === 1 ? [...bindings][0] : undefined;
  return (
    <section className="planner-status" aria-labelledby="planner-status-title">
      <h3 id="planner-status-title">{tr("대상별 소진 상태와 변화 원인", "Spend state and change cause by target")}</h3>
      <p>{tr(
        `단가 변화는 최근 7일(${windows.R.from} – ${windows.R.to})과 직전 7일(${windows.B.from} – ${windows.B.to})의 비교입니다. 원인은 데이터로 고른 후보이며 인과 판정이 아닙니다.`,
        `Unit-cost change compares the last 7 days (${windows.R.from} – ${windows.R.to}) with the 7 days before (${windows.B.from} – ${windows.B.to}). Causes are data-based candidates, not causal findings.`,
      )}{sharedBinding ? tr(` 이번 배분에서는 모든 대상이 '${bindingLabel(sharedBinding, locale)}'에 걸렸습니다.`, ` In this allocation every target hit '${bindingLabel(sharedBinding, locale)}'.`) : sharedBinding === null ? tr(" 이번 배분에서는 어떤 대상도 제약에 걸리지 않았습니다.", " No target hit a limit in this allocation.") : ""}</p>
      <DataTable
        ariaLabel={tr("대상별 소진 상태와 변화 원인", "Spend state and change cause by target")}
        rows={rows}
        rowKey={(row) => row.unit}
        columns={[
          { key: "unit", label: tr("대상", "Target"), headStyle: { minWidth: "10rem" } },
          { key: "state", label: tr("지금 소진", "Current spend"), headStyle: { minWidth: "9rem" }, fmt: (value, row) => <>{plannerLabel(NODE_STATE_LABELS, value, locale)}{row.borrowed ? <small className="planner-cell-note">{tr("채널 곡선 차용", "Borrowed channel curve")}</small> : null}</> },
          { key: "change", label: tr(`최근 ${metricLabel} 변화`, `Recent ${metricLabel} change`), align: "right", fmt: (value) => (value == null ? "—" : pct(value)) },
          { key: "verdict", label: tr("원인 후보", "Likely cause"), headStyle: { minWidth: "11rem" }, fmt: (value, row) => <>{value ? plannerLabel(VERDICT_LABELS, value, locale) : "—"}{row.reason ? <small className="planner-cell-note">{row.reason}</small> : null}{row.extrapolated ? <small className="planner-cell-note">{tr("관측 밖 지출 포함", "Includes spend outside history")}</small> : null}</> },
          ...(sharedBinding === undefined ? [{ key: "binding", label: tr("배분에서 걸린 제약", "Allocation limit hit"), fmt: (value) => (value ? bindingLabel(value, locale) : "—") }] : []),
        ]}
      />
    </section>
  );
}

/** 최근 7일 vs 직전 7일 단가 변화를 대상·소재 단위로 무잔차 분해(PVM). */
export function PlannerChangeBreakdown({ planner, locale = "ko", metricLabel, fmtMoney, isRoas = false }) {
  if (!planner?.ok) return null;
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const { pvm } = planner;
  if (isRoas) {
    return (
      <section className="planner-breakdown" aria-labelledby="planner-breakdown-title">
        <h3 id="planner-breakdown-title">{tr("단가 변화 분해", "Unit-cost change breakdown")}</h3>
        <p>{tr("ROAS 기준에서는 매출 1원당 비용으로 분해해야 해 읽기 어려워 표시하지 않습니다. CPI·CPA 기준으로 바꾸면 볼 수 있습니다.", "Not shown for ROAS: the breakdown would be in cost per unit of revenue, which is hard to read. Switch to CPI or CPA to see it.")}</p>
      </section>
    );
  }
  if (!pvm?.ok) {
    return (
      <section className="planner-breakdown" aria-labelledby="planner-breakdown-title">
        <h3 id="planner-breakdown-title">{tr("단가 변화 분해", "Unit-cost change breakdown")}</h3>
        <p>{tr("두 기간 모두 결과가 있는 대상이 부족해 분해하지 못했습니다.", "Too few targets have results in both weeks to break down the change.")}</p>
      </section>
    );
  }
  // 표시 자리수에서 0이면 부호를 붙이지 않는다("−₩0" 금지).
  const signed = (value) => {
    const text = fmtMoney(Math.abs(value));
    if (!/[1-9]/.test(text)) return "0";
    return `${value > 0 ? "+" : "−"}${text}`;
  };
  // "예산 탓인가 소재 탓인가"에 답하는 열을 앞에 둔다. 좁은 화면에서 표가 가로로 밀려도 답이 먼저 보이게.
  const DISPLAY_ORDER = ["budget", "market", "creative", "betweenMix", "withinMix", "entry", "exit"];
  const visible = DISPLAY_ORDER.filter((name) => pvm.columns.includes(name) && (Math.abs(pvm.totals[name]) > 1e-9 || pvm.groups.some((group) => Math.abs(group[name]) > 1e-9)));
  const rows = [
    { unit: tr("전체", "Total"), contribution: pvm.deltaCpa, ...pvm.totals, isTotal: true },
    ...pvm.groups.map((group) => ({ ...group, unit: planner.toUnit.get(group.key) || group.key })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
  ];
  const excludedCost = pvm.excluded.reduce((acc, item) => acc + item.costR, 0);
  return (
    <section className="planner-breakdown" aria-labelledby="planner-breakdown-title">
      <h3 id="planner-breakdown-title">{tr(`${metricLabel} 변화 분해`, `${metricLabel} change breakdown`)}</h3>
      <p>{tr(
        `${pvm.scope === "all" ? "전체" : "분해 대상"} ${metricLabel} ${fmtMoney(pvm.CPA1)} → ${fmtMoney(pvm.CPA2)}. 각 열을 더하면 변화와 같습니다. 비중은 결과 비중 기준이고, 예산 곡선·시장 몫을 먼저 떼고 남은 몫이 '그 밖'입니다 — 소재·클릭 이후 전환·노출 단가 변화가 섞여 있고, 어느 쪽인지는 위 원인 후보가 말합니다.`,
        `${pvm.scope === "all" ? "Overall" : "Decomposed"} ${metricLabel} ${fmtMoney(pvm.CPA1)} → ${fmtMoney(pvm.CPA2)}. The columns add up to the change. Shares are result shares; the budget-curve and market parts are removed first; the remainder ("Other") mixes creative, post-click and impression-cost changes — the likely-cause column above says which.`,
      )}{pvm.pooled.length ? tr(` 결과가 0인 소재 ${pvm.pooled.reduce((acc, item) => acc + item.members.length, 0)}개는 묶어서 계산했습니다.`, ` ${pvm.pooled.reduce((acc, item) => acc + item.members.length, 0)} zero-result creative(s) were pooled.`) : ""}{excludedCost > 0 ? tr(` 결과 없는 지출 ${fmtMoney(excludedCost)}은 분해에서 뺐습니다.`, ` ${fmtMoney(excludedCost)} of spend with no results was excluded.`) : ""}</p>
      <DataTable
        ariaLabel={tr(`${metricLabel} 변화 분해`, `${metricLabel} change breakdown`)}
        rows={rows}
        rowKey={(row) => row.unit}
        columns={[
          { key: "unit", label: tr("대상", "Target"), fmt: (value, row) => (row.isTotal ? <strong>{value}</strong> : value) },
          { key: "contribution", label: tr("변화", "Change"), align: "right", fmt: signed },
          ...visible.map((name) => ({ key: name, label: plannerLabel(PVM_COLUMN_LABELS, name, locale), align: "right", fmt: signed })),
        ]}
      />
    </section>
  );
}

/** 소재 상태: 신규 소재는 학습·노출 확대·정체·판정, 기존 소재는 피로만. 행동이 필요한 것부터. */
export function PlannerCreativeStatus({ planner, locale = "ko", metricLabel, limit = 20, learningWarnings = [], loserScenario = null, resultLabel = "", resultIsMoney = false, fmtMoney = String, fmtCount = String }) {
  if (!planner?.ok || !planner.creatives?.length) return null;
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const warningOf = new Map((learningWarnings || []).map((warning) => [`${warning.nodeKey}|${warning.creativeId}`, warning]));
  const fmtResult = resultIsMoney ? fmtMoney : fmtCount;
  // 지금 피로 신호는 없어도 같은 추세로 예측 기간 안에 임계에 닿는 소재는 함께 보여 준다 — 예측의 "피로 반영"과 같은 기준.
  const horizonEnd = addDays(planner.asOf, planner.cfg.forecast.horizonDays);
  const projectedOf = (entry) => {
    const eta = entry.fatigue?.etaDays;
    if (entry.fatigue?.fatigued || !Number.isFinite(eta)) return null;
    const date = addDays(planner.asOf, Math.max(1, Math.ceil(eta)));
    return date <= horizonEnd ? date : null;
  };
  const notable = planner.creatives.filter((entry) => entry.state !== "UNKNOWN_AGE" || entry.fatigue?.fatigued || projectedOf(entry));
  // 볼 소재가 없을 때도 구역을 지우지 않는다 — 소재를 못 읽은 것과 구분되도록 무엇을 확인했는지 말한다.
  if (!notable.length) {
    return (
      <section className="planner-creatives" aria-labelledby="planner-creatives-title">
        <h3 id="planner-creatives-title">{tr("소재 상태", "Creative status")}</h3>
        <p>{tr(
          `소재 ${planner.creatives.length}개 모두 데이터 첫날부터 쓰던 소재라 신규 소재 판정 대상이 없고, 피로 신호도 없습니다.`,
          `All ${planner.creatives.length} creatives were already running on the first day of the data, so none is judged as new, and none shows a fatigue signal.`,
        )}</p>
      </section>
    );
  }
  const order = (entry) => (entry.fatigue?.fatigued ? 0.5 : CREATIVE_STATE_ORDER.indexOf(entry.state));
  const rows = [...notable].sort((a, b) => order(a) - order(b) || b.share - a.share).map((entry) => ({
    key: `${entry.nodeKey}|${entry.creativeId}`,
    unit: planner.toUnit.get(entry.nodeKey) || entry.nodeKey,
    creative: entry.creativeId,
    state: entry.state,
    age: entry.age,
    share: entry.share,
    vsIncumbent: entry.judgment?.cprPost && entry.judgment?.cprIncumbent ? entry.judgment.cprPost / entry.judgment.cprIncumbent - 1 : null,
    priorAssumed: entry.judgment?.priorAssumed,
    fatigue: entry.fatigue,
    fatigueFrom: projectedOf(entry),
    learningWarning: warningOf.get(`${entry.nodeKey}|${entry.creativeId}`) || null,
  }));
  const shown = rows.slice(0, limit);
  // 값이 모두 비는 열은 빼고, 답(상태·피로)을 앞에 둔다 — 좁은 화면에서 표가 밀려도 답이 먼저 보이게.
  const hasNew = shown.some((row) => row.state !== "UNKNOWN_AGE");
  const hasAge = shown.some((row) => row.age != null);
  const hasJudgment = shown.some((row) => row.vsIncumbent != null);
  return (
    <section className="planner-creatives" aria-labelledby="planner-creatives-title">
      <h3 id="planner-creatives-title">{tr("소재 상태", "Creative status")}</h3>
      <p>{hasNew ? tr(
        `신규 소재는 같은 날 같은 대상의 기존 소재와 비교합니다. 초반 몇 건으로 판정하지 않도록 과거 신규 소재 평균 쪽으로 당겨서 봅니다(${metricLabel} 기준). 학습·노출 확대 중이거나 노출을 거의 못 받은 소재는 판정하지 않습니다.`,
        `New creatives are compared with incumbents in the same target on the same days, shrunk toward past launches so a few early conversions do not decide (${metricLabel}). Creatives that are learning, ramping or barely served are not judged.`,
      ) : tr(
        `소재 ${planner.creatives.length}개 모두 데이터 첫날부터 쓰던 소재라 신규 소재 판정은 없습니다. 피로 신호가 있거나 지금 추세대로면 ${planner.cfg.forecast.horizonDays}일 안에 임계에 닿는 소재만 보여 줍니다.`,
        `All ${planner.creatives.length} creatives were already running on the first day of the data, so none is judged as new. Only creatives with a fatigue signal, or that reach the threshold within ${planner.cfg.forecast.horizonDays} days at the current trend, are listed.`,
      )}</p>
      <DataTable
        ariaLabel={tr("소재 상태", "Creative status")}
        rows={shown}
        rowKey={(row) => row.key}
        columns={[
          { key: "unit", label: tr("대상", "Target") },
          { key: "creative", label: tr("소재", "Creative") },
          { key: "state", label: tr("상태", "State"), headStyle: { minWidth: "9rem" }, fmt: (value, row) => <>{plannerLabel(CREATIVE_STATE_LABELS, value, locale)}{row.learningWarning?.status === "short" ? <small className="planner-cell-note">{tr(`이 배분으로는 학습 완료가 어려움: 하루 약 ${fmtMoney(row.learningWarning.neededDaily)} 필요, 배정 기준 약 ${fmtMoney(row.learningWarning.expectedDaily)}`, `This plan may not finish learning: needs about ${fmtMoney(row.learningWarning.neededDaily)}/day, gets about ${fmtMoney(row.learningWarning.expectedDaily)}`)}</small> : row.learningWarning?.status === "unknown" ? <small className="planner-cell-note">{tr("학습 완료 필요 예산은 비교할 기존 소재가 없어 계산하지 않음", "Learning budget not computed (no incumbent to compare)")}</small> : null}</> },
          { key: "fatigue", label: tr("피로", "Fatigue"), headStyle: { minWidth: "8rem" }, fmt: (value, row) => (!value ? "—" : <>{value.fatigued ? tr("피로 신호", "Fatigue signal") : row.fatigueFrom ? tr(`${row.fatigueFrom}경 임계 예상`, `Threshold around ${row.fatigueFrom}`) : tr("신호 없음", "No signal")}{value.ctrOnly ? <small className="planner-cell-note">{tr("소재 교체 직후라 클릭률만 봄", "CTR only (right after a creative change)")}</small> : null}</>) },
          { key: "share", label: tr("대상 내 지출 비중", "Spend share in target"), align: "right", fmt: (value) => `${Math.round(value * 100)}%` },
          ...(hasAge ? [{ key: "age", label: tr("나이(일)", "Age (days)"), align: "right", fmt: (value) => (value == null ? "—" : String(value)) }] : []),
          ...(hasJudgment ? [{ key: "vsIncumbent", label: tr(`기존 대비 ${metricLabel}`, `${metricLabel} vs incumbents`), align: "right", fmt: (value, row) => (value == null ? "—" : <>{pct(value)}{row.priorAssumed ? <small className="planner-cell-note">{tr("기본 가정 사용", "Default prior")}</small> : null}</>) }] : []),
        ]}
      />
      {rows.length > shown.length && <p className="planner-cell-note">{tr(`외 ${rows.length - shown.length}개 소재`, `${rows.length - shown.length} more creative(s)`)}</p>}
      {loserScenario && <PlannerLoserOff scenario={loserScenario} locale={locale} resultLabel={resultLabel} fmtResult={fmtResult} />}
    </section>
  );
}

/** "기존보다 나쁜 소재를 끄면" — 자동 반영하지 않는 별도 안(spec §6.6.4 [F]). 구성 효과만이라는 가정을 같이 말한다. */
function PlannerLoserOff({ scenario, locale, resultLabel, fmtResult }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const names = scenario.offs.map((off) => `${off.creativeIds.join(", ")} (${off.unit})`).join(" · ");
  if (!scenario.base || !scenario.scenario) {
    return <p className="planner-scenarios__result">{tr(`기존보다 나쁜 소재 ${names}를 끄는 효과는 최근 결과가 부족해 계산하지 않았습니다.`, `The effect of turning off ${names} was not computed: too few recent results.`)}</p>;
  }
  return (
    <p className="planner-scenarios__result">
      {tr(
        `기존보다 나쁜 소재 ${names}를 끄면 같은 예산으로 ${scenario.horizonDays}일 예상 ${resultLabel} ${fmtResult(scenario.base.results)} → ${fmtResult(scenario.scenario.results)} (${changeText(scenario.base.results, scenario.scenario.results)}). 남은 소재가 늘어난 예산을 지금 효율 그대로 쓴다는 가정이라 실제 증액분 효율은 다를 수 있고, 배분안에는 자동으로 넣지 않았습니다.`,
        `Turning off worse-than-incumbent creatives ${names} would move ${scenario.horizonDays}-day expected ${resultLabel} ${fmtResult(scenario.base.results)} → ${fmtResult(scenario.scenario.results)} (${changeText(scenario.base.results, scenario.scenario.results)}) at the same budget. This assumes the remaining creatives spend the extra at today's efficiency, which may not hold, so it is not applied to the plan.`,
      )}
    </p>
  );
}

/** 저장해 둔 배분안 중 이 CSV가 기간을 다 덮는 것: 계획 대비 실적과 차이의 출처(spec §8.2). */
export function PlannerPlanReview({ matches = [], locale = "ko", today = "", fmtCpr, fmtCount, onApply }) {
  if (!matches.length) return null;
  const tr = (ko, en) => (locale === "en" ? en : ko);
  return (
    <section className="block planner-plan-review" aria-labelledby="planner-plan-review-title">
      <h2 id="planner-plan-review-title" className="section-title">{tr(`지난 배분안 대조 ${matches.length}건`, `${matches.length} past ${matches.length === 1 ? "plan" : "plans"} to compare`)}</h2>
      <p>{tr(
        "저장한 배분안의 기간이 이 CSV에 모두 들어 있습니다. 같은 대상의 실제 지출·결과와 비교해, 차이가 계획과 다르게 쓴 예산 비중(실행 편차)에서 왔는지 대상별 효율 예측 오차(모형 오차)에서 왔는지 나눕니다. 기록 버튼을 눌러야 결정 기록에 반영됩니다.",
        "This CSV covers the whole period of these saved plans. Each is compared with actual spend and results for the same targets, splitting the gap into spending a different mix than planned (execution) and per-target efficiency forecast error (model). Nothing is written until you record it.",
      )}</p>
      <ul className="planner-plan-review__list">
        {matches.map((match) => {
          const text = planReviewText(match, { locale, formatCpr: fmtCpr(match.plan.metric), formatCount: fmtCount });
          const due = Boolean(match.reviewDate) && match.reviewDate <= today;
          return (
            <li key={match.recordId}>
              <strong>{match.action}</strong>
              <p>{text.actual}</p>
              {text.learning && <p className="planner-cell-note">{text.learning}</p>}
              <button type="button" className="btn" disabled={!due} onClick={() => onApply(match, text)}>{tr("이 대조 결과 기록", "Record this comparison")}</button>
              {!due && <small className="planner-cell-note">{tr(`검토일 ${match.reviewDate}부터 기록할 수 있습니다.`, `Can be recorded from the review date ${match.reviewDate}.`)}</small>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
