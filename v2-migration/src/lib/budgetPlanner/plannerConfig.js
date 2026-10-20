// 계층형 예산 플래너의 규칙·임계값 SSOT (docs/hierarchical-budget-planner-spec.md §9).
// 엔진 코드는 임계값을 리터럴로 갖지 않고 여기서만 읽는다. 기본값은 출발점이며
// 실데이터 백테스트로 조정한다. 모르는 키·범위 밖 값은 조용히 무시하지 않고 거절한다.

export const PLANNER_LEVELS = Object.freeze(["country", "platform", "channel", "campaign_name", "adgroup_name", "creative_id"]);
export const PLANNER_VERDICTS = Object.freeze(["INCONCLUSIVE", "NEW_CREATIVE_LEARNING", "MARKET", "BUDGET_CURVE", "CREATIVE", "FUNNEL_POST_CLICK", "MIXED"]);
export const PLANNER_NODE_STATES = Object.freeze(["INSUFFICIENT", "EXTRAPOLATING", "DRIFT_WORSE", "DRIFT_BETTER", "LEARNING_TRANSITION", "IN_RANGE"]);
const STATE_POLICIES = ["hold", "decrease_only", "recent_regime", "freeze", "normal"];
const POOLING_STEPS = ["campaign_bucket", "mergeIntoSmallest", "excludeAndReport"];

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export const PLANNER_CONFIG = deepFreeze({
  version: "1.0.0",

  hierarchy: {
    levels: [...PLANNER_LEVELS],
    roles: { allocate: "campaign_name", constraint: ["country", "channel"], diagnose: ["adgroup_name", "creative_id"] },
  },

  metric: { result: "installs", view: "cpr" },

  // 지출이 큰 요일과 CPR이 높은 요일이 겹치면 백피팅이 천천히 수렴한다 → 변화가 tolerance 아래가 될 때까지(최대 N회).
  dow: { enabled: true, lookbackWeeks: 8, minPerDay: 3, shrinkK: 4, excludeHolidays: true, backfitMaxIterations: 30, backfitTolerance: 0.001 },

  curve: {
    minPoints: 6,
    trendType: "auto",
    outlier: { method: "iqr", strength: "standard" },
    weightMode: "exponential",
    halfLifeDays: 30,
    regimeMode: "auto",
    regimeStart: "",
    borrowParentBelow: 6,
  },

  conformity: { recentDays: 7, zBand: 2.0, breachShare: 0.5, medianShift: 0.15, extrapolationTol: 0.1, minSigma: 0.05 },

  events: { budgetChangePct: 0.2, minCreativeShare: 0.1, removedAfterDays: 3, windowDays: 7 },

  diagnosis: {
    controlScope: "same_country_other_channels",
    minControls: 2,
    noiseMultiple: 1.0,
    budgetDominant: 0.6,
    creativeDominant: 0.5,
    marketDominant: 0.5,
    cvrDominant: 0.5,
    newCreativeDominant: 0.5,
    mixedFloor: 0.3,
    priority: ["INCONCLUSIVE", "NEW_CREATIVE_LEARNING", "MARKET", "BUDGET_CURVE", "CREATIVE", "FUNNEL_POST_CLICK", "MIXED"],
  },

  pvm: {
    finestLevel: "auto",
    rateSplitOrder: ["budget", "market"],
    relabelEntryExit: true,
    zeroResultPooling: [...POOLING_STEPS],
    reviewDowngradeAfter: 2,
    reviewErrorThreshold: 0.2,
  },

  creative: {
    identityScope: "campaign",
    relaunchGapDays: 14,
    learningDays: 7,
    minHistoricalLaunches: 3,
    fatigue: { minAgeDays: 14, cannibalWindowDays: 7 },
    launch: {
      minResultsToJudge: 20,
      rampStableGrowth: 0.15,
      stallDays: 5,
      stallShare: 0.05,
      stallRateWarn: 0.3,
      priorStrengthResults: 10,
      defaultLaunchPenalty: 1.3,
      winMargin: 0.1,
      loseMargin: 0.15,
      learningShareExclude: 0.3,
      excludeLearningDays: true,
      learningShareFreeze: 0.3,
      learningFreezeChangePct: 0.1,
      loserShareAlert: 0.2,
      profileBuckets: [[0, 2], [3, 6], [7, 13]],
      defaultLaunchProfile: { cprRatio: [1.6, 1.3, 1.1], spendShare: [0.1, 0.2, 0.25] },
    },
  },

  optimizer: {
    stepPct: 0.002,
    maxDailyIncrease: 0.2,
    maxDailyDecrease: 0.3,
    extrapolationHeadroom: 0.1,
    learningMinWeeklyResults: 0,
    creativeBlockedIncrease: 0,
    groupShares: {},
    locked: [],
    statePolicy: {
      INSUFFICIENT: "hold",
      EXTRAPOLATING: "decrease_only",
      DRIFT_WORSE: "recent_regime",
      DRIFT_BETTER: "recent_regime",
      LEARNING_TRANSITION: "freeze",
      IN_RANGE: "normal",
    },
  },

  forecast: {
    horizonDays: 14,
    spendPacing: "dow",
    lowerQ: 0.1,
    upperQ: 0.9,
    intervalAggregation: "comonotonic",
    applyFatigue: false,
    fatiguePenalty: 0.15,
  },

  backtest: { holdoutDays: 14, minCoverage: 0.7 },

  // 업계에서 흔히 쓰는 운영 가이드를 옮긴 예시값. 계정마다 다르므로 채널별로 덮어쓴다.
  overrides: {
    channel: {
      Meta: { optimizer: { learningMinWeeklyResults: 50, maxDailyIncrease: 0.2 } },
      Google: { optimizer: { maxDailyIncrease: 0.3 } },
    },
    country_channel: {},
  },

  editable: [
    "metric.result",
    "forecast.horizonDays",
    "optimizer.maxDailyIncrease",
    "optimizer.maxDailyDecrease",
    "optimizer.groupShares",
    "optimizer.locked",
    "forecast.intervalAggregation",
  ],
});

const isPlainObject = (v) => v != null && typeof v === "object" && !Array.isArray(v);

// 값 자체가 사용자 정의 키를 갖는 맵 — 기본값에 없는 키를 허용하고 내용은 따로 검사한다.
const FREE_MAPS = new Set(["optimizer.groupShares", "overrides.channel", "overrides.country_channel"]);
// 채널 덮어쓰기에 허용하는 절. 계층·버전·덮어쓰기 자체는 노드마다 달라질 수 없다.
const OVERRIDABLE_SECTIONS = new Set(["dow", "curve", "conformity", "events", "diagnosis", "creative", "optimizer", "forecast"]);

const ENUMS = {
  "metric.result": ["installs", "actions", "revenue_d7"],
  "metric.view": ["cpr", "roas"],
  "curve.trendType": ["auto", "linear", "log", "poly2", "power"],
  "curve.outlier.method": ["none", "iqr", "modz"],
  "curve.outlier.strength": ["standard", "strong", "very_strong"],
  "curve.weightMode": ["none", "linear", "exponential"],
  "curve.regimeMode": ["all", "auto", "manual"],
  "diagnosis.controlScope": ["same_country_other_channels", "all_other_nodes"],
  "pvm.finestLevel": ["auto", ...PLANNER_LEVELS],
  "creative.identityScope": ["campaign", "global"],
  "forecast.spendPacing": ["dow", "flat"],
  "forecast.intervalAggregation": ["comonotonic", "independent"],
};

const FRACTIONS = new Set([
  "conformity.breachShare", "events.minCreativeShare",
  "diagnosis.budgetDominant", "diagnosis.creativeDominant", "diagnosis.marketDominant", "diagnosis.cvrDominant",
  "diagnosis.newCreativeDominant", "diagnosis.mixedFloor",
  "optimizer.stepPct", "optimizer.maxDailyDecrease",
  "forecast.lowerQ", "forecast.upperQ", "backtest.minCoverage",
  "creative.launch.stallShare", "creative.launch.stallRateWarn", "creative.launch.learningShareExclude",
"creative.launch.learningShareFreeze", "creative.launch.learningFreezeChangePct",
  "creative.launch.loserShareAlert", "creative.launch.winMargin", "creative.launch.loseMargin",
]);

const POSITIVE_INTS = new Set([
  "dow.lookbackWeeks", "dow.minPerDay", "dow.backfitMaxIterations", "curve.minPoints", "curve.borrowParentBelow",
  "conformity.recentDays", "events.windowDays", "events.removedAfterDays", "creative.learningDays",
  "creative.relaunchGapDays", "creative.minHistoricalLaunches", "creative.fatigue.minAgeDays",
  "creative.fatigue.cannibalWindowDays", "creative.launch.minResultsToJudge", "creative.launch.stallDays",
  "forecast.horizonDays", "backtest.holdoutDays", "pvm.reviewDowngradeAfter",
]);
const NON_NEGATIVE_INTS = new Set(["diagnosis.minControls", "optimizer.learningMinWeeklyResults"]);

function checkNumber(path, value, errors) {
  if (typeof value !== "number" || !Number.isFinite(value)) return errors.push({ path, reason: "not_a_finite_number" });
  if (value < 0) return errors.push({ path, reason: "negative" });
  if (FRACTIONS.has(path) && value > 1) errors.push({ path, reason: "fraction_out_of_range" });
  if (POSITIVE_INTS.has(path) && (!Number.isInteger(value) || value < 1)) errors.push({ path, reason: "positive_integer_required" });
  if (NON_NEGATIVE_INTS.has(path) && !Number.isInteger(value)) errors.push({ path, reason: "integer_required" });
  return undefined;
}

// 기본값의 모양을 기준으로 패치를 훑는다: 모르는 키·타입 불일치를 모은다.
function walkShape(base, patch, path, errors) {
  if (!isPlainObject(patch)) {
    errors.push({ path: path || "(root)", reason: "object_required" });
    return;
  }
  for (const [key, value] of Object.entries(patch)) {
    const childPath = path ? `${path}.${key}` : key;
    if (!Object.hasOwn(base, key)) {
      errors.push({ path: childPath, reason: "unknown_key" });
      continue;
    }
    const expected = base[key];
    if (FREE_MAPS.has(childPath)) {
      if (!isPlainObject(value)) errors.push({ path: childPath, reason: "object_required" });
      continue;
    }
    if (Array.isArray(expected)) {
      if (!Array.isArray(value)) errors.push({ path: childPath, reason: "array_required" });
      continue;
    }
    if (isPlainObject(expected)) {
      walkShape(expected, value, childPath, errors);
      continue;
    }
    if (typeof value !== typeof expected) errors.push({ path: childPath, reason: `type_${typeof expected}_required` });
  }
}

function getPath(obj, path) {
  return path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), obj);
}

function eachLeaf(node, path, visit) {
  for (const [key, value] of Object.entries(node)) {
    const childPath = path ? `${path}.${key}` : key;
    if (FREE_MAPS.has(childPath)) continue;
    if (isPlainObject(value)) eachLeaf(value, childPath, visit);
    else visit(childPath, value);
  }
}

const isPermutation = (value, items) => Array.isArray(value) && value.length === items.length && items.every((item) => value.includes(item));

// 병합이 끝난 완성본의 값·관계를 검사한다.
function validateResolved(cfg, errors) {
  eachLeaf(cfg, "", (path, value) => {
    if (typeof value === "number") checkNumber(path, value, errors);
    if (ENUMS[path] && !ENUMS[path].includes(value)) errors.push({ path, reason: "unknown_value" });
  });

  const levels = cfg.hierarchy.levels;
  if (!Array.isArray(levels) || !levels.length || levels.some((level) => !PLANNER_LEVELS.includes(level))) {
    errors.push({ path: "hierarchy.levels", reason: "unknown_level" });
  }
  if (!levels.includes(cfg.hierarchy.roles.allocate)) errors.push({ path: "hierarchy.roles.allocate", reason: "unknown_level" });
  for (const key of ["constraint", "diagnose"]) {
    const value = cfg.hierarchy.roles[key];
    if (!Array.isArray(value) || value.some((level) => !levels.includes(level))) errors.push({ path: `hierarchy.roles.${key}`, reason: "unknown_level" });
  }

  const { regimeMode, regimeStart } = cfg.curve;
  if (regimeStart !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(regimeStart)) errors.push({ path: "curve.regimeStart", reason: "iso_date_or_empty_required" });
  if (regimeMode === "manual" && regimeStart === "") errors.push({ path: "curve.regimeStart", reason: "required_for_manual_regime" });
  if (!(cfg.forecast.lowerQ < cfg.forecast.upperQ)) errors.push({ path: "forecast.lowerQ", reason: "must_be_below_upperQ" });
  // 원인 진단은 B·R 두 창의 합계를 비교한다. 7일 배수여야 요일 구성이 같아 요일 효과가 상쇄된다.
  if (cfg.events.windowDays % 7 !== 0) errors.push({ path: "events.windowDays", reason: "multiple_of_7_required" });
  if (cfg.diagnosis.priority.length !== PLANNER_VERDICTS.length || !isPermutation(cfg.diagnosis.priority, PLANNER_VERDICTS)) {
    errors.push({ path: "diagnosis.priority", reason: "must_list_every_verdict_once" });
  }
  if (!isPermutation(cfg.pvm.rateSplitOrder, ["budget", "market"])) errors.push({ path: "pvm.rateSplitOrder", reason: "must_be_budget_market_order" });
  const pooling = cfg.pvm.zeroResultPooling;
  if (!Array.isArray(pooling) || pooling.some((step) => !POOLING_STEPS.includes(step))
    || pooling.some((step, index) => POOLING_STEPS.indexOf(step) < POOLING_STEPS.indexOf(pooling[index - 1] ?? POOLING_STEPS[0]))) {
    errors.push({ path: "pvm.zeroResultPooling", reason: "unknown_or_out_of_order_step" });
  }
  for (const [state, policy] of Object.entries(cfg.optimizer.statePolicy)) {
    if (!PLANNER_NODE_STATES.includes(state)) errors.push({ path: `optimizer.statePolicy.${state}`, reason: "unknown_state" });
    else if (!STATE_POLICIES.includes(policy)) errors.push({ path: `optimizer.statePolicy.${state}`, reason: "unknown_value" });
  }
  if (!cfg.optimizer.locked.every((key) => typeof key === "string")) errors.push({ path: "optimizer.locked", reason: "string_list_required" });
  for (const [key, bounds] of Object.entries(cfg.optimizer.groupShares)) {
    const [level, ...rest] = key.split(":");
    const valid = levels.includes(level) && rest.join(":").length > 0 && Array.isArray(bounds) && bounds.length === 2
      && bounds.every((v) => typeof v === "number" && v >= 0 && v <= 1) && bounds[0] <= bounds[1];
    if (!valid) errors.push({ path: `optimizer.groupShares.${key}`, reason: "level_value_and_0_1_bounds_required" });
  }

  const { profileBuckets, defaultLaunchProfile } = cfg.creative.launch;
  const bucketsValid = Array.isArray(profileBuckets) && profileBuckets.length > 0 && profileBuckets.every((bucket, index) => Array.isArray(bucket)
    && bucket.length === 2 && bucket.every((v) => Number.isInteger(v) && v >= 0) && bucket[0] <= bucket[1]
    && (index === 0 || bucket[0] > profileBuckets[index - 1][1]));
  if (!bucketsValid) errors.push({ path: "creative.launch.profileBuckets", reason: "ascending_integer_ranges_required" });
  const ratios = defaultLaunchProfile?.cprRatio;
  const shares = defaultLaunchProfile?.spendShare;
  if (!Array.isArray(ratios) || !Array.isArray(shares) || ratios.length !== profileBuckets.length || shares.length !== profileBuckets.length
    || ratios.some((v) => !(v > 0)) || shares.some((v) => !(v >= 0 && v <= 1))) {
    errors.push({ path: "creative.launch.defaultLaunchProfile", reason: "one_positive_ratio_and_share_per_bucket" });
  }
  if (!cfg.editable.every((path) => typeof path === "string" && getPath(PLANNER_CONFIG, path) !== undefined)) {
    errors.push({ path: "editable", reason: "unknown_path" });
  }
}

/** 객체는 키별로 병합하고 배열·원시값은 통째로 바꾼다. */
export function mergePlannerConfig(base, patch) {
  if (!isPlainObject(patch)) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isPlainObject(value) && isPlainObject(base?.[key]) ? mergePlannerConfig(base[key], value) : value;
  }
  return out;
}

function validateOverride(base, patch, path, errors) {
  if (!isPlainObject(patch)) {
    errors.push({ path, reason: "object_required" });
    return;
  }
  for (const section of Object.keys(patch)) {
    if (!OVERRIDABLE_SECTIONS.has(section)) errors.push({ path: `${path}.${section}`, reason: "section_not_overridable" });
  }
  const shapeErrors = [];
  walkShape(base, patch, "", shapeErrors);
  shapeErrors.forEach((error) => errors.push({ ...error, path: `${path}.${error.path}` }));
  if (!shapeErrors.length) {
    const resolvedErrors = [];
    validateResolved(mergePlannerConfig(base, patch), resolvedErrors);
    resolvedErrors.forEach((error) => errors.push({ ...error, path: `${path} → ${error.path}` }));
  }
}

/**
 * 기본값에 사용자 패치를 병합하고 검증한다.
 * @returns {{ok:true, config:object} | {ok:false, errors:{path:string, reason:string}[]}}
 */
export function resolvePlannerConfig(patch = {}, base = PLANNER_CONFIG) {
  const errors = [];
  walkShape(base, patch, "", errors);
  if (errors.length) return { ok: false, errors };
  const merged = mergePlannerConfig(base, patch);
  validateResolved(merged, errors);
  for (const [name, override] of Object.entries(merged.overrides.channel)) validateOverride(merged, override, `overrides.channel.${name}`, errors);
  for (const [name, override] of Object.entries(merged.overrides.country_channel)) {
    if (!name.includes("|")) errors.push({ path: `overrides.country_channel.${name}`, reason: "key_must_be_country|channel" });
    validateOverride(merged, override, `overrides.country_channel.${name}`, errors);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, config: deepFreeze(merged) };
}

/** 노드에 실제로 적용되는 config: 기본 → 채널 → 국가×채널 순으로 덮어쓴다. */
export function configFor(cfg, { country = "", channel = "" } = {}) {
  let out = cfg;
  const byChannel = cfg.overrides?.channel?.[channel];
  if (byChannel) out = mergePlannerConfig(out, byChannel);
  const byCountryChannel = cfg.overrides?.country_channel?.[`${country}|${channel}`];
  if (byCountryChannel) out = mergePlannerConfig(out, byCountryChannel);
  return out;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** 같은 config면 같은 문자열. 분석 시그·다운로드 README에 넣는다. */
export function plannerConfigSignature(cfg) {
  const text = stableStringify(cfg);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${cfg.version}-${hash.toString(16).padStart(8, "0")}`;
}
