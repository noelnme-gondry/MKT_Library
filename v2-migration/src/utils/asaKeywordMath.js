// ASA search-term operations rules. Pure and deterministic: this module only
// turns already-mapped report rows into recommendations; it never calls an API
// or changes a live bid.

const number = (value) => {
  const parsed = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ASA_RULES = Object.freeze({
  underPace: 0.7,
  overPace: 1.1,
  severeUnderPace: 0.4,
  severeOverPace: 1.4,
  minExactInstalls: 3,
  minExactTaps: 8,
  minNegativeSpendMultiplier: 1.5,
});

export function normalizeMatchType(value) {
  const text = String(value || "").trim().toLowerCase();
  if (/(exact|정확)/.test(text)) return "exact";
  if (/(broad|broad match|광범위)/.test(text)) return "broad";
  if (/(search match|discovery|검색 일치|디스커버리)/.test(text)) return "discovery";
  return "unknown";
}

function quality({ cpa, targetCpa, cpt, targetCpt }) {
  if (targetCpa > 0) return cpa > 0 && cpa <= targetCpa;
  if (targetCpt > 0) return cpt > 0 && cpt <= targetCpt;
  return null;
}

function bidAction({ pace, isGood }) {
  if (isGood === null) return { code: "target_needed", pct: 0 };
  if (pace < ASA_RULES.underPace && isGood) {
    return { code: "raise", pct: pace < ASA_RULES.severeUnderPace ? 0.15 : 0.1 };
  }
  if (pace > ASA_RULES.overPace && !isGood) {
    return { code: "lower", pct: pace > ASA_RULES.severeOverPace ? -0.15 : -0.1 };
  }
  if (pace < ASA_RULES.underPace) return { code: "hold_underperforming", pct: 0 };
  if (pace > ASA_RULES.overPace) return { code: "hold_good", pct: 0 };
  return { code: "hold", pct: 0 };
}

// rows may contain one daily row per search term. targetCpa/targetCpt/global
// values are compared only within the same currency and outcome definition.
export function buildAsaKeywordRecommendations(rows = [], { globalDailyBudget = 0, globalTargetCpa = 0, globalTargetCpt = 0 } = {}) {
  const groups = new Map();
  rows.forEach((row) => {
    const term = String(row.search_term || "").trim();
    if (!term) return;
    const campaign = String(row.campaign_name || "").trim();
    const adgroup = String(row.adgroup_name || "").trim();
    const matchType = normalizeMatchType(row.match_type);
    const key = [term, campaign, adgroup, matchType].join("\u001f");
    const current = groups.get(key) || { term, campaign, adgroup, matchType, cost: 0, taps: 0, installs: 0, activeDates: new Set(), budgets: new Map(), targetCpa: 0, targetCpt: 0, currentCpt: 0 };
    current.cost += number(row.cost);
    current.taps += number(row.clicks);
    current.installs += number(row.installs || row.actions);
    if (row.date) current.activeDates.add(String(row.date));
    const dailyBudget = number(row.daily_budget);
    if (dailyBudget > 0 && row.date) current.budgets.set(String(row.date), Math.max(current.budgets.get(String(row.date)) || 0, dailyBudget));
    current.targetCpa = Math.max(current.targetCpa, number(row.target_cpa));
    current.targetCpt = Math.max(current.targetCpt, number(row.target_cpt));
    current.currentCpt = Math.max(current.currentCpt, number(row.current_cpt));
    groups.set(key, current);
  });

  return [...groups.values()].map((group) => {
    const targetCpa = group.targetCpa || number(globalTargetCpa);
    const targetCpt = group.targetCpt || number(globalTargetCpt);
    const dailyBudgetTotal = [...group.budgets.values()].reduce((sum, value) => sum + value, 0);
    const expectedSpend = dailyBudgetTotal || number(globalDailyBudget) * group.activeDates.size;
    const pace = expectedSpend > 0 ? group.cost / expectedSpend : null;
    const cpt = group.taps > 0 ? group.cost / group.taps : null;
    const cpa = group.installs > 0 ? group.cost / group.installs : null;
    const isGood = quality({ cpa, targetCpa, cpt, targetCpt });
    const action = pace == null ? { code: "budget_needed", pct: 0 } : bidAction({ pace, isGood });
    const bidBase = group.currentCpt || targetCpt || cpt;
    const recommendedCpt = bidBase > 0 && action.pct ? bidBase * (1 + action.pct) : null;
    const isExactCandidate = group.matchType !== "exact"
      && group.installs >= ASA_RULES.minExactInstalls
      && group.taps >= ASA_RULES.minExactTaps
      && isGood === true;
    const isNegativeCandidate = group.cost > 0
      && targetCpa > 0
      && (group.installs === 0 ? group.cost >= targetCpa * ASA_RULES.minNegativeSpendMultiplier : cpa > targetCpa * ASA_RULES.minNegativeSpendMultiplier);
    return { ...group, expectedSpend, pace, cpt, cpa, targetCpa, targetCpt, isGood, action, recommendedCpt, isExactCandidate, isNegativeCandidate };
  }).sort((a, b) => b.cost - a.cost || a.term.localeCompare(b.term));
}
