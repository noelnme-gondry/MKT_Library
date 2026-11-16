"use client";
import { fmtCurrency, fmtNum, fmtPct } from "@/utils/format";

const gapText = value => Number.isFinite(value) ? `${value > 0.0005 ? "+" : value < -0.0005 ? "−" : ""}${fmtPct(Math.abs(value))}` : "—";

// 저장한 예산 계획의 예측과, 실행 후 같은 기간의 실제. 예측이 없는 기록(소재·관찰, 예전 기록)에는 그리지 않는다.
export default function OperationsForecastCheck({ action, check, metricName, locale }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const forecast = action?.forecast;
  if (!forecast) return null;
  const money = value => Number.isFinite(value) ? fmtCurrency(value, { currency: action.currency || "KRW", precise: true }) : "—";
  const outcomeName = action.metric === "actions" ? tr("가입", "Sign-ups") : tr("설치", "Installs");
  const days = forecast.days, plan = action.planContext;
  const planLine = plan?.planId ? tr(`같은 계획 ${plan.selected}건 · 기간 예산 ${money(plan.totalBudget)} · 예상 ${outcomeName} ${fmtNum(plan.baselineResults)} → ${fmtNum(plan.expectedResults)}`,
    `Same plan: ${plan.selected} actions · period budget ${money(plan.totalBudget)} · expected ${outcomeName.toLowerCase()} ${fmtNum(plan.baselineResults)} → ${fmtNum(plan.expectedResults)}`) : "";
  if (!check?.ok) {
    const reason = check?.reason === "window" ? tr("검토 기간을 바꿔 예측 기간과 달라졌습니다. 예측과 비교하지 않습니다.", "The review window was changed and no longer matches the forecast, so they are not compared.")
      : action.state !== "executed" ? tr(`실제 실행일을 기록하면 그날부터 ${days}일의 실제와 비교합니다.`, `Record the actual execution date to compare the ${days} days that follow.`)
        : tr(`실행 후 ${days}일 데이터가 모두 올라오면 비교합니다.`, `Compared once all ${days} days after execution are in the data.`);
    return <section className="ops-forecast" aria-label={tr("저장한 예상", "Saved forecast")}>
      <h4>{tr(`저장한 예상 · 실행일부터 ${days}일`, `Saved forecast · ${days} days from execution`)}</h4>
      <dl className="ops-forecast__saved"><div><dt>{tr("계획 지출", "Planned spend")}</dt><dd>{money(forecast.dailySpend * days)}</dd></div>
        <div><dt>{tr(`예상 ${outcomeName}`, `Expected ${outcomeName.toLowerCase()}`)}</dt><dd>{fmtNum(forecast.dailyResults * days)}</dd></div>
        <div><dt>{tr(`예상 ${metricName}`, `Expected ${metricName}`)}</dt><dd>{money(forecast.dailySpend / forecast.dailyResults)}</dd></div></dl>
      <p role="status">{reason}</p>
      {planLine && <p className="ops-forecast__plan">{planLine}</p>}
    </section>;
  }
  const rows = [
    [tr("지출", "Spend"), money(check.plannedSpend), money(check.actualSpend), gapText(check.spendGap)],
    [outcomeName, fmtNum(check.expectedResults), fmtNum(check.actualResults), gapText(check.resultsGap)],
    [metricName, money(check.expectedCpr), money(check.actualCpr), gapText(check.cprGap)],
  ];
  return <section className="ops-forecast" aria-label={tr("예상 대비 실제", "Expected vs actual")}>
    <h4>{tr(`예상 대비 실제 · 실행일부터 ${days}일`, `Expected vs actual · ${days} days from execution`)}</h4>
    <div className="ops-forecast__table"><table>
      <thead><tr><th scope="col">{tr("항목", "Item")}</th><th scope="col">{tr("예상", "Expected")}</th><th scope="col">{tr("실제", "Actual")}</th><th scope="col">{tr("차이", "Gap")}</th></tr></thead>
      <tbody>{rows.map(([label, expected, actual, gap]) => <tr key={label}><th scope="row">{label}</th><td>{expected}</td><td>{actual}</td><td>{gap}</td></tr>)}</tbody>
    </table></div>
    <p>{Math.abs(check.spendGap) > 0.05
      ? tr("실제 지출이 계획과 달라, 단가 차이의 일부는 계획과 다르게 쓴 데서 옵니다.", "Actual spend differs from the plan, so part of the unit-cost gap comes from spending differently.")
      : tr("계획한 만큼 썼으므로 단가 차이는 주로 예측과 실제 효율의 차이입니다.", "Spend matched the plan, so the unit-cost gap mainly reflects forecast versus actual efficiency.")}
      {" "}{tr("예측은 관측 추세에 따른 조건부 값이며, 차이만으로 원인을 확정하지 않습니다.", "Forecasts are conditional on observed trends; a gap alone does not establish a cause.")}</p>
    {planLine && <p className="ops-forecast__plan">{planLine}</p>}
  </section>;
}

/** 검토 메모에 남길 한 줄(예측이 있고 비교가 가능할 때만). */
export function forecastCheckText(check, { metricName, currency, locale }) {
  if (!check?.ok) return "";
  const money = value => Number.isFinite(value) ? fmtCurrency(value, { currency, precise: true }) : "—";
  return locale === "en"
    ? `Expected ${metricName} ${money(check.expectedCpr)} vs actual ${money(check.actualCpr)} (${gapText(check.cprGap)}) · spend ${money(check.plannedSpend)} planned vs ${money(check.actualSpend)} (${gapText(check.spendGap)})`
    : `예상 ${metricName} ${money(check.expectedCpr)} · 실제 ${money(check.actualCpr)} (${gapText(check.cprGap)}) · 지출 계획 ${money(check.plannedSpend)} · 실제 ${money(check.actualSpend)} (${gapText(check.spendGap)})`;
}
