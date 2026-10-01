import { describe, it, expect } from 'vitest';
import { resolveBlockFilter, blockRows, orderBlocks, moveBlock, groupDates, scopeError } from './workspace';
import { useAppStore } from '@/store/useDataStore';
const paid = { plan: 'paid', expiresAt: Date.now() + 60000, offlineUntil: Date.now() + 60000 };
describe('dashboard block scope', () => {
  it('intersects dimensions without turning disjoint selections into all rows', () => {
    const { filter, conflict } = resolveBlockFilter({ countries: new Set([' KR ']), channels: new Set(['Meta']) }, { countries: ['US'] });
    expect(conflict).toBe(true); expect([...filter.channels]).toEqual(['Meta']);
    expect(blockRows({ raw: [{country:'KR',cost:10}], mapping: { country:'country',cost:'cost' } }, { countries: new Set(['KR']) }, { countries: ['US'] })).toEqual([]);
  });
  it('inherits dates by default and allows independent current and comparison windows', () => {
    const common = { dateStart: '2024-01-01', dateEnd: '2024-01-31' };
    expect(resolveBlockFilter(common, { countries: ['US'] }).filter.dateStart).toBe('2024-01-01');
    const local = { period: 'custom', dateStart:'2024-02-01',dateEnd:'2024-02-07',compareEnabled:true,comparisonStart:'2024-01-20',comparisonEnd:'2024-01-26' };
    const { period: _period, ...expected } = local;
    expect(resolveBlockFilter(common,local).filter).toMatchObject(expected);
    expect(scopeError({ ...local,dateEnd:'2024-01-01' })).toBe('invalid_period');
  });
  it('groups calendar weeks and months without changing numeric observations', () => {
    const rows = [{date:'2024-01-01',cost:9},{date:'2024-01-07',cost:10},{date:'2024-01-08',cost:11}];
    expect(groupDates(rows,'week').map(r=>r.date)).toEqual(['2024-01-01','2024-01-01','2024-01-08']);
    expect(groupDates(rows,'month').map(r=>r.cost)).toEqual([9,10,11]);
    expect(rows[1].date).toBe('2024-01-07');
  });
  it('preserves newly available blocks and ignores removed ids when reordering', () => {
    expect(orderBlocks(['a','b','c'],{order:['b','gone','b']})).toEqual(['b','a','c']);
    expect(moveBlock(['a','b','c'],'c',-2)).toEqual(['c','a','b']);
  });
});
describe('Pro dashboard mutations', () => {
  it('blocks unpaid and expired writes while retaining saved layouts', () => {
    const before = useAppStore.getState();
    try {
      useAppStore.setState({ entitlement: paid, viewConfig: {},customCharts:{},customMetrics:{} });
      expect(useAppStore.getState().saveDashboardWorkspace({ tabs: {pacing:{order:['s-pace']}} })).toBe(true);
      useAppStore.setState({ entitlement: { ...paid,expiresAt:0 } });
      expect(useAppStore.getState().saveDashboardWorkspace({tabs:{}})).toBe(false);
      useAppStore.getState().setViewConfig('dashboard-workspace',{tabs:{}});
      useAppStore.getState().addCustomChart('5-2:viz-charts',{name:'Blocked'});
      useAppStore.getState().addCustomMetric('5-2:viz-kpi',{name:'Blocked'});
      expect(useAppStore.getState().viewConfig['dashboard-workspace'].tabs.pacing.order).toEqual(['s-pace']);
      expect(useAppStore.getState().customCharts).toEqual({});
      expect(useAppStore.getState().customMetrics).toEqual({});
      useAppStore.getState().setViewConfig('analysis-inputs:5-2',{recipeSteps:[]});
      expect(useAppStore.getState().viewConfig['analysis-inputs:5-2']).toBeDefined();
    } finally { useAppStore.setState(before); }
  });
});
