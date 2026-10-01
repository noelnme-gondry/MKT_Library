"use client";

export default function AllocationPeriodComparison({ periods, budgetLabel, baselineDays, formatMoney, result, busy, run, en }) {
  const labels = en ? { stable: "Same recommendation", changed: "Recommendation changed", unavailable: "Not comparable", increase: "Increase", decrease: "Decrease", hold: "Hold" } : { stable: "추천 유지", changed: "추천 변경", unavailable: "비교 불가", increase: "증액", decrease: "감액", hold: "유지" };
  const reasons = en ? {
    budget: "The fixed budget cannot be fully allocated within this period’s evidence limits.",
    sample: "Fewer than 4 retained observations.", range: "Recommended spend is outside the observed range.",
    baseline: "Current spend is unavailable.", universe: "The two periods contain different allocation targets.",
    overlap: "Observed spend ranges do not overlap.", missing: "No usable model or recommendation."
  } : {
    budget: "이 기간의 관측 범위·제약 안에서 고정 예산을 모두 배분할 수 없습니다.",
    sample: "사용 가능한 관측이 4개 미만입니다.", range: "추천 지출이 관측 범위를 벗어납니다.",
    baseline: "기준 지출을 확인할 수 없습니다.", universe: "전반·후반의 배분 대상 구성이 다릅니다.",
    overlap: "두 기간의 관측 지출 범위가 겹치지 않습니다.", missing: "사용 가능한 모형 또는 추천이 없습니다."
  };
  const periodBudgetBlocked = result?.periods.some(period => period.budgetFeasible === false);
  const money = value => Number.isFinite(value) ? formatMoney(value) : "—";
  return <>
    <div className="allocation-period-head">
      <div><h3>{en ? "Do the two periods recommend the same budget moves?" : "전반·후반에도 같은 채널을 증액할까?"}</h3><p>{en ? "Refit each half of the selected dates and compare increase / decrease recommendations at the same total budget." : "선택 데이터를 전반·후반으로 나눠 다시 계산하고, 같은 총예산에서 증액·감액 추천이 달라지는지 확인합니다."}</p></div>
      <button type="button" className="btn secondary" disabled={busy} onClick={run}>{busy ? (en ? "Comparing…" : "비교 중…") : (en ? "Compare recommendations" : "기간별 추천 비교")}</button>
    </div>
    <dl className="allocation-period-inputs">
      {periods.map((period, i) => <div key={i}><dt>{i === 0 ? (en ? "First half" : "전반 데이터") : (en ? "Second half" : "후반 데이터")}</dt><dd>{period.start || "—"}<span aria-hidden="true"> – </span>{period.end || "—"}</dd>{result && <dd className="allocation-period-budget"><span>{en ? "Observed spend ceiling" : "관측 지출 합계 상한"} <strong>{money(result.periods[i]?.maxSupportedBudget)}</strong></span><span>{en ? "Allocated by the model" : "모형 배분 합계"} <strong>{money(result.periods[i]?.allocatedBudget)}</strong></span></dd>}</div>)}
      <div><dt>{en ? "Fixed total daily budget" : "양쪽에 같은 전체 일예산"}</dt><dd>{budgetLabel}</dd></div>
    </dl>
    <p className="allocation-period-context">{en ? `All allocation countries are compared. Each recommendation is relative to that half’s last ${baselineDays} days of daily spend. A matching recommendation does not guarantee future performance.` : `전체 배분 국가를 비교합니다. 각 기간의 마지막 ${baselineDays}일 기준 일지출보다 늘릴지 줄일지를 판단합니다. 추천이 같아도 미래 성과를 보장하지 않습니다.`}</p>
    {result && <div className="allocation-period-results">
      {periodBudgetBlocked && <p className="allocation-period-notice">{en ? "The fixed daily budget cannot be fully allocated within at least one period’s observed limits and constraints. This comparison is unavailable; it does not mean the recommendation is stable. Review the totals above and adjust the budget or analysis dates before comparing again." : "한쪽 이상의 기간에서 관측 범위·제약 안에 전체 일예산을 배분하지 못했습니다. 추천이 유지된다는 뜻이 아니라 비교할 수 없는 상태입니다. 위의 모형 배분 합계를 확인하고 총예산이나 분석 기간을 조정한 뒤 다시 비교하세요."}</p>}
      <div className="allocation-period-counts" role="status">{["changed", "stable", "unavailable"].map(status => <span key={status} data-status={status}>{labels[status]} <strong>{result.rows.filter(row => row.status === status).length}</strong></span>)}</div>
      {!result.rows.length ? <p>{en ? "No dated observations to compare." : "비교할 날짜 관측이 없습니다."}</p> : <div className="table-wrap" tabIndex={0} role="region" aria-label={en ? "Period recommendation details" : "기간별 추천 상세"}><table className="data">
        <caption>{en ? "Daily spend → recommendation, refitted independently for each period" : "기간별 기준 일지출 → 재계산한 추천 일예산"}</caption>
        <thead><tr><th>{en ? "Allocation target" : "배분 대상"}</th><th>{en ? "First half" : "전반 추천"}</th><th>{en ? "Second half" : "후반 추천"}</th><th>{en ? "Comparison" : "비교 결과"}</th></tr></thead>
        <tbody>{result.rows.map(row => <tr key={row.name}><th scope="row">{row.name}</th>{[row.before, row.after].map((part, i) => <td key={i}><strong>{labels[part.direction] || labels.unavailable}</strong><span className="allocation-period-values">{money(part.current)} → {part.direction ? money(part.planned) : "—"}</span><small>{en ? "Observations" : "사용 관측"} {part.n ?? 0}</small>{part.reason && !(part.reason === "budget" && periodBudgetBlocked) && <small>{reasons[part.reason]}</small>}</td>)}<td><strong>{labels[row.status]}</strong>{row.status === "unavailable" && !row.before.reason && !row.after.reason && <small>{reasons[row.before.direction && row.after.direction ? "overlap" : "missing"]}</small>}</td></tr>)}</tbody>
      </table></div>}
    </div>}
  </>;
}
