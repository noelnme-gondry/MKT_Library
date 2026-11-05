import { fmtCurrency, fmtNum } from "@/utils/format";
import { OperationsMixChart } from "./OperationsCharts";
import { operationContributionLabels } from "@/lib/operations/operationsPresentation";

export default function OperationsChangeComparison({ comparison, currency, metricName, locale, isDemo, concurrent = 0 }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const money = value => Number.isFinite(value) ? fmtCurrency(value, { currency, precise: true }) : tr("추정 불가", "Unavailable");
  if (!comparison?.ok) return <p role="status">{tr("전후 매일의 비용·성과가 확인되지 않아 비교를 보류합니다. 빠진 날짜를 0으로 간주하지 않습니다.", "Comparison is withheld until spend and outcomes are available for every day. Missing dates are not treated as zero.")}</p>;
  return <div className="operations-change-comparison">
    <p>{comparison.before.start} – {comparison.before.end} → {comparison.after.start} – {comparison.after.end}</p>
    <dl className="operations-loop__metrics">
      <div><dt>{tr("하루 평균 지출", "Average daily spend")}</dt><dd>{money(comparison.previous.cost / (comparison.previousDays || comparison.days))} → {money(comparison.current.cost / comparison.days)}</dd></div>
      <div><dt>{tr("성과 합계", "Total outcomes")}</dt><dd>{fmtNum(comparison.previous.results)} → {fmtNum(comparison.current.results)}</dd></div>
      <div><dt>{metricName}</dt><dd>{money(comparison.previous.cpr)} → {money(comparison.current.cpr)}</dd></div>
      <div><dt>{operationContributionLabels(metricName, locale).share}</dt><dd>{money(comparison.pvm?.finest.reduce((sum, row) => sum + row.mix, 0))}</dd></div>
      <div><dt>{operationContributionLabels(metricName, locale).cost}</dt><dd>{money(comparison.pvm?.finest.reduce((sum, row) => sum + row.rate, 0))}</dd></div>
    </dl>
    <OperationsMixChart value={comparison.pvm} currency={currency} metricName={metricName} locale={locale} isDemo={isDemo}
      periods={{ previous: comparison.before, current: comparison.after }} />
    <p className="operations-chart__caption">{tr("소재별 성과 비중과 소재별 성과당 비용의 변화를 나눈 산술 설명입니다. 액션의 인과 효과가 아닙니다.", "An arithmetic breakdown of changes in outcome share and cost per outcome by creative, not the causal effect of the action.")}
      {concurrent > 0 && ` ${tr(`같은 대상의 비교 구간에 다른 변화·실행 ${concurrent}건이 겹칩니다.`, `${concurrent} other changes or executions overlap this target’s comparison window.`)}`}</p>
  </div>;
}
