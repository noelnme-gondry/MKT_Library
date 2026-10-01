import { describe, expect, it } from 'vitest';
import { dashboardPeriods } from './dashboardPeriods';
import { buildDashboardVerdict } from '@/utils/dashboardVerdict';
const raw = Array.from({ length: 30 }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, channel: 'Meta', country: 'KR', cost: (i + 1) * 100, installs: 10 }));
const csvData = { raw, headers: Object.keys(raw[0]), mapping: Object.fromEntries(Object.keys(raw[0]).map(key => [key, key])) };
describe('dashboard period selection', () => {
  it('preserves last-N observed dates when no explicit comparison is selected', () => {
    const periods = dashboardPeriods(csvData, {}, 7);
    expect(periods.current).toEqual({ start: '2024-01-24', end: '2024-01-30' });
    expect(periods.previous).toEqual({ start: '2024-01-17', end: '2024-01-23' });
  });
  it('compares explicit nonadjacent, unequal periods without clipping the prior data', () => {
    const filterState = { dateStart: '2024-01-20', dateEnd: '2024-01-22', compareEnabled: true, comparisonStart: '2024-01-02', comparisonEnd: '2024-01-03' };
    const result = buildDashboardVerdict({ csvData, filterState });
    expect(result.insufficient).toBe(false);
    expect(result.metricRows.find(row => row.key === 'cost')).toMatchObject({ prev: 500, recent: 6300 });
    expect(result.metricRows.find(row => row.key === 'cpi')).toMatchObject({ prev: 25, recent: 210 });
    expect(result.pvmSummary).toMatchObject({ available: true, prior: 25, current: 210 });
    expect(result.windowDays).toBe(3);
    expect(result.scopeEvidence.periods.map(p => [p.start, p.end])).toEqual([['2024-01-02', '2024-01-03'], ['2024-01-20', '2024-01-22']]);
  });
  it('does not turn a missing comparison into a zero baseline', () => {
    const result = buildDashboardVerdict({ csvData, filterState: { dateStart: '2024-01-20', dateEnd: '2024-01-22', compareEnabled: true, comparisonStart: '2023-12-01', comparisonEnd: '2023-12-07' } });
    expect(result.insufficient).toBe(true);
  });
  it('does not silently substitute dates for an invalid saved comparison', () => {
    const result = buildDashboardVerdict({ csvData, filterState: { compareEnabled: true, dateStart: '2024-01-20', dateEnd: '2024-01-22' } });
    expect(result.insufficient).toBe(true);
  });
  it('applies the same segment scope to both periods', () => {
    const result = dashboardPeriods(csvData, { channels: new Set(['Other']) });
    expect(result.recentRows).toEqual([]);
    expect(result.previousRows).toEqual([]);
  });
});
