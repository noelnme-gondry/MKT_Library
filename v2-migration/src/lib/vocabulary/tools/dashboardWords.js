import { DASHBOARD_CONTROLS } from '@/lib/recipe/dashboardRecipe';
export const DASHBOARD_WORDS = Object.entries(DASHBOARD_CONTROLS).map(([key, spec]) => ({
  id: `dashboard.${key}`, kind: 'view', slot: `dashboard.${key}`,
  label: params => ({ ko: `${spec.ko}: ${params.value}`, en: `${spec.en}: ${params.value}` }),
  // Existing tab/cohort/period controls are the direct editing surface.
  expand: () => [],
  apply: (state, params) => {
    if (!spec.values.includes(params.value)) throw new Error('INVALID_DASHBOARD_CONTROL');
    state.view.dashboard = { ...state.view.dashboard, [key]: params.value };
    return state;
  },
}));
