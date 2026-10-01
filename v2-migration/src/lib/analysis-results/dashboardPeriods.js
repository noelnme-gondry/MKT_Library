import { getMonFilteredRows } from '@/utils/dashboardAggregator';
import { periodProblem } from '@/lib/analysisPeriod';

// Select observations only. Metric formulas and default last-N-observation behavior
// are unchanged. Explicit comparison dates must not be clipped by the current dates.
export function dashboardPeriods(csvData, filter = {}, windowDays = 7) {
  const current = { start: filter.dateStart, end: filter.dateEnd };
  const previous = { start: filter.comparisonStart, end: filter.comparisonEnd };
  const custom = Boolean(filter.compareEnabled);
  const invalid = custom && (periodProblem(current) || periodProblem(previous));
  const rows = invalid ? [] : getMonFilteredRows(csvData, custom ? { ...filter, dateStart: null, dateEnd: null } : filter);
  const dates = [...new Set(rows.map(row => row.date).filter(Boolean))].sort();
  const recentDates = new Set(custom ? dates.filter(date => date >= current.start && date <= current.end) : dates.slice(-windowDays));
  const prevDates = new Set(custom ? dates.filter(date => date >= previous.start && date <= previous.end) : dates.slice(-2 * windowDays, -windowDays));
  const range = values => ({ start: [...values][0] || '', end: [...values].at(-1) || '' });
  return { rows, dates, custom, recentDates, prevDates, current: custom ? current : range(recentDates), previous: custom ? previous : range(prevDates), recentRows: rows.filter(row => recentDates.has(row.date)), previousRows: rows.filter(row => prevDates.has(row.date)) };
}
