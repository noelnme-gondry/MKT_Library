'use client';
import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useDataStore';
import { resolveBlockFilter } from '@/lib/dashboard/workspace';
export const DashboardWorkspaceContext = createContext(null);
export const DashboardBlockContext = createContext(null);
export function useDashboardFilter() {
  const common = useAppStore(state => state.dashboardFilter);
  const block = useContext(DashboardBlockContext);
  return useMemo(() => resolveBlockFilter(common, block?.config?.scope).filter, [common, block?.config?.scope]);
}
// Control values are shared by a tab's default and independently scoped views.
// Presentation-only dialogs retain their local useState in their owner.
export function useDashboardControl(key, initial) {
  const workspace = useContext(DashboardWorkspaceContext);
  const [local, setLocal] = useState(initial);
  const values = workspace?.controls || {};
  const value = Object.hasOwn(values, key) ? values[key] : local;
  const setControl = workspace?.setControl;
  const update = useCallback(next => setControl ? setControl(key, next, local) : setLocal(next), [setControl, key, local]);
  return [value, update];
}

export function useDashboardSetting(kind, scope) {
  const fallback = useAppStore(state => state[kind]?.[scope]);
  const workspace = useContext(DashboardWorkspaceContext);
  return workspace?.legacy?.[kind] ? workspace.legacy[kind][scope] : fallback;
}
export function useDashboardAction(action) {
  const fallback = useAppStore(state => state[action]);
  const workspace = useContext(DashboardWorkspaceContext);
  return workspace?.editing ? (...args) => workspace.mutateLegacy(action, ...args) : fallback;
}
