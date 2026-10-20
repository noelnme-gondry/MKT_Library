"use client";
// 5-3 결과에 붙는 플래너 근거: 성과 예측 · 대상별 상태와 원인 · 단가 변화 분해 · 소재 상태.
// 계산은 lib/budgetPlanner가 하고, 여기서는 읽는 순서대로 보여 주기만 한다.
import DataTable from "@/components/ds/DataTable";
import {
  bindingLabel, CREATIVE_STATE_LABELS, CREATIVE_STATE_ORDER, NODE_STATE_LABELS, PVM_COLUMN_LABELS,
  VERDICT_LABELS, VERDICT_REASON_LABELS, plannerLabel,
} from "@/lib/budgetPlanner/plannerLabels";
import { addDays } from "@/lib/budgetPlanner/plannerStats";

const pct = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%`;

/** 이 배분안으로 앞으로 N일 — 기간 합계와 범위, 그리고 그 범위를 얼마나 믿을 수 있는지(백테스트). */
export function PlannerForecast({ forecast, backtest, locale = "ko", resultLabel, metricLabel, fmtMoney, fmtCount, fmtUnitCost, resultIsMoney = false }) {
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
    </section>
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
export function PlannerCreativeStatus({ planner, locale = "ko", metricLabel, limit = 20 }) {
  if (!planner?.ok || !planner.creatives?.length) return null;
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const notable = planner.creatives.filter((entry) => entry.state !== "UNKNOWN_AGE" || entry.fatigue?.fatigued);
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
  }));
  const shown = rows.slice(0, limit);
  return (
    <section className="planner-creatives" aria-labelledby="planner-creatives-title">
      <h3 id="planner-creatives-title">{tr("소재 상태", "Creative status")}</h3>
      <p>{tr(
        `신규 소재는 같은 날 같은 대상의 기존 소재와 비교합니다. 초반 몇 건으로 판정하지 않도록 과거 신규 소재 평균 쪽으로 당겨서 봅니다(${metricLabel} 기준). 학습·노출 확대 중이거나 노출을 거의 못 받은 소재는 판정하지 않습니다.`,
        `New creatives are compared with incumbents in the same target on the same days, shrunk toward past launches so a few early conversions do not decide (${metricLabel}). Creatives that are learning, ramping or barely served are not judged.`,
      )}</p>
      <DataTable
        ariaLabel={tr("소재 상태", "Creative status")}
        rows={shown}
        rowKey={(row) => row.key}
        columns={[
          { key: "unit", label: tr("대상", "Target") },
          { key: "creative", label: tr("소재", "Creative") },
          { key: "state", label: tr("상태", "State"), fmt: (value) => plannerLabel(CREATIVE_STATE_LABELS, value, locale) },
          { key: "age", label: tr("나이(일)", "Age (days)"), align: "right", fmt: (value) => (value == null ? "—" : String(value)) },
          { key: "share", label: tr("대상 내 지출 비중", "Spend share in target"), align: "right", fmt: (value) => `${Math.round(value * 100)}%` },
          { key: "vsIncumbent", label: tr(`기존 대비 ${metricLabel}`, `${metricLabel} vs incumbents`), align: "right", fmt: (value, row) => (value == null ? "—" : <>{pct(value)}{row.priorAssumed ? <small className="planner-cell-note">{tr("기본 가정 사용", "Default prior")}</small> : null}</>) },
          { key: "fatigue", label: tr("피로", "Fatigue"), fmt: (value) => (!value ? "—" : <>{value.fatigued ? tr("피로 신호", "Fatigue signal") : tr("신호 없음", "No signal")}{value.ctrOnly ? <small className="planner-cell-note">{tr("소재 교체 직후라 클릭률만 봄", "CTR only (right after a creative change)")}</small> : null}</>) },
        ]}
      />
      {rows.length > shown.length && <p className="planner-cell-note">{tr(`외 ${rows.length - shown.length}개 소재`, `${rows.length - shown.length} more creative(s)`)}</p>}
    </section>
  );
}
