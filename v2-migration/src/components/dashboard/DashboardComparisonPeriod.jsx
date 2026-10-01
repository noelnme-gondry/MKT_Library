"use client";
import ResultPeriodPicker from '@/components/ds/ResultPeriodPicker';
import { comparisonWarnings } from '@/lib/analysisPeriod';
export default function DashboardComparisonPeriod({ periods, windowDays, onWindowChange, onPeriodChange, locale }) {
  const en = locale === 'en';
  const warnings = comparisonWarnings(periods.current, periods.previous, locale);
  return <section className="dashboard-comparison-period" aria-label={en ? 'Conclusion comparison periods' : '결론 비교 기간'}>
    <div className="dashboard-comparison-period__head">
      <strong>{en ? 'Compare performance' : '성과 비교'}</strong>
      <div className="dashboard-period-presets" role="group" aria-label={en ? 'Recent observation days' : '최근 관측일 수'}>
        {[7, 14, 28].map(days => <button key={days} type="button" aria-pressed={!periods.custom && windowDays === days} onClick={() => onWindowChange(days)}>{en ? `${days} days` : `${days}일`}</button>)}
      </div>
    </div>
    <div className="dashboard-comparison-period__dates">
      <ResultPeriodPicker label={en ? 'Analysis period' : '분석 기간'} range={periods.current} onApply={range => onPeriodChange(range, periods.previous)} locale={locale} />
      <ResultPeriodPicker label={en ? 'Comparison period' : '비교 기간'} range={periods.previous} previousOf={periods.current} onApply={range => onPeriodChange(periods.current, range)} locale={locale} />
    </div>
    <p>{en ? `Observed dates: ${periods.recentDates.size} current / ${periods.prevDates.size} comparison. Totals are not normalized by duration.` : `실제 관측일: 분석 ${periods.recentDates.size}일 / 비교 ${periods.prevDates.size}일. 합계는 기간 길이로 보정하지 않습니다.`}</p>
    {warnings.map(warning => <p role="status" key={warning}>{warning}</p>)}
  </section>;
}
