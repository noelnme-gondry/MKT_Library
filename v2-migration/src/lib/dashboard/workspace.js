import { periodProblem, dateBounds } from '@/lib/analysisPeriod';
import { getMonFilteredRows, getMappedRows } from '@/utils/dashboardAggregator';

export const WORKSPACE_SCOPE = 'dashboard-workspace';
export const SCOPE_FIELDS = { countries: 'country', channels: 'channel', platforms: 'platform', sources: 'source' };
export const EMPTY_WORKSPACE = { tabs: {}, boards: [] };

// Empty intersections must remain empty; an empty Set otherwise means “all”.
export function resolveBlockFilter(common = {}, scope = {}, bounds = {}) {
  const filter = { ...common };
  let conflict = false;
  for (const key of Object.keys(SCOPE_FIELDS)) {
    const globalValues = [...(common[key] || [])].map(v => String(v).trim());
    const localValues = (scope[key] || []).map(v => String(v).trim());
    const values = localValues.length && globalValues.length ? localValues.filter(v => globalValues.includes(v)) : localValues.length ? localValues : globalValues;
    if (localValues.length && globalValues.length && !values.length) conflict = true;
    filter[key] = new Set(values);
  }
  if (scope.period === 'custom') {
    filter.dateStart = scope.dateStart;
    filter.dateEnd = scope.dateEnd;
    filter.compareEnabled = Boolean(scope.compareEnabled);
    filter.comparisonStart = scope.comparisonStart;
    filter.comparisonEnd = scope.comparisonEnd;
  }
  return { filter, conflict, error: scopeError(scope, bounds) };
}
export function scopeError(scope = {}, bounds = {}) {
  if (scope.period !== 'custom') return null;
  const problem = periodProblem({ start: scope.dateStart, end: scope.dateEnd }, bounds) || (scope.compareEnabled && periodProblem({ start: scope.comparisonStart, end: scope.comparisonEnd }, bounds));
  return problem ? (problem === 'bounds' ? 'outside_data_period' : 'invalid_period') : null;
}
export function blockRows(csv, common, scope) {
  const result = resolveBlockFilter(common, scope, dateBounds(getMappedRows(csv).map(row => row.date)));
  return result.conflict || result.error ? [] : getMonFilteredRows(csv, result.filter);
}
export function scopeLabel(filter, scope = {}, locale = 'ko') {
  const parts = Object.keys(SCOPE_FIELDS).flatMap(key => [...(filter[key] || [])]);
  if (filter.dateStart || filter.dateEnd) parts.push(`${filter.dateStart || '…'} – ${filter.dateEnd || '…'}`);
  if (filter.compareEnabled) parts.push(`${locale === 'en' ? 'vs' : '비교'} ${filter.comparisonStart || '…'} – ${filter.comparisonEnd || '…'}`);
  parts.push(scope.period === 'custom' ? (locale === 'en' ? 'Independent dates' : '개별 기간') : (locale === 'en' ? 'Shared dates' : '공통 기간'));
  return parts.join(' · ');
}
export function orderBlocks(ids, config = {}) {
  return [...new Set([...(config.order || []).filter(id => ids.includes(id)), ...ids])];
}
export function moveBlock(ids, id, offset) {
  const from = ids.indexOf(id), to = from + offset;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids]; next.splice(from, 1); next.splice(to, 0, id); return next;
}
export function groupDates(rows, interval = 'day') {
  if (interval === 'day') return rows;
  return rows.map(row => {
    const date = String(row.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return row;
    if (interval === 'month') return { ...row, date: date.slice(0, 7) };
    const day = new Date(`${date}T00:00:00Z`); day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
    return { ...row, date: day.toISOString().slice(0, 10) };
  });
}
