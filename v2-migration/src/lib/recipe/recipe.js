import { buildVocabulary } from "@/lib/vocabulary/vocabulary";

// 레시피 = 유저가 고른 단어(단계)의 순서 목록(docs/result-autonomy-spec.md §2).
// 저장하는 것은 단계뿐이고, 화면 상태(데이터·보기·내보내기)는 매번 기본값에서 단계를 접어
// 파생한다 — 칩 목록과 실제 상태가 두 벌로 갈리지 않게(AGENTS §7 메타 4).
// 원본 행·파일명은 들어가지 않는다. 값 필터처럼 사용자 데이터 값을 담는 단계는
// partitionForSync가 기기 전용으로 가른다(2026-09-30 결정).

export const RECIPE_VERSION = 1;

const PERIOD_BASES = ["calendar", "rolling7"];
const FILTER_OPS = ["in", "notIn"];
const FILTER_SCOPES = ["analysis", "view"];
const VIEW_ONLY = ["worse", "better"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LIMITS = { values: 100, valueLength: 200, label: 60, steps: 100, params: 20, topN: 1000 };
const RECIPE_FIELDS = new Set(["version", "toolId", "steps"]);

function blockIds(spec) {
  return new Set((spec.blocks || []).map((block) => block.id));
}

function lockedBlockIds(spec) {
  return new Set((spec.blocks || []).filter((block) => block.locked).map((block) => block.id));
}

/** 도구 선언(spec)에서 파생한 기본 상태. 단계가 하나도 없으면 이 상태가 곧 화면이다. */
export function defaultRecipeState(spec = {}) {
  const defaults = spec.defaults || {};
  return {
    data: {
      levels: [...(defaults.levels || [])],
      metric: defaults.metric ?? null,
      period: defaults.period ? { ...defaults.period } : null,
      filters: [],
      // 대소문자·공백만 다른 값은 같은 값(2026-09-30 결정). true면 구분한다.
      caseSensitive: false,
    },
    view: { hidden: [], labels: {}, topN: null, only: null },
    export: {
      format: spec.exportFormats?.[0] ?? null,
      // 한계 문구는 기본 포함, 유저가 뺄 수 있다(2026-09-30 결정).
      includeCaveats: true,
      withFormulas: true,
    },
  };
}

function isStringList(value, { min = 0, max = LIMITS.values } = {}) {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every((item) => typeof item === "string" && item.length > 0 && item.length <= LIMITS.valueLength);
}

function validatePeriod(period, spec) {
  if (period == null) return null;
  if (typeof period !== "object") return "INVALID_PERIOD";
  if (Array.isArray(spec.periodKinds) && !spec.periodKinds.includes(period.kind)) return "PERIOD_NOT_SUPPORTED";
  if (period.kind === "lookback") {
    const weeks = spec.lookbackWeeks || [1, 2, 3];
    return weeks.includes(period.weeks) && PERIOD_BASES.includes(period.basis) ? null : "INVALID_PERIOD";
  }
  if (period.kind === "monthOverMonth") return null;
  if (period.kind === "range") {
    const ok = [period.a, period.b].every((range) => range
      && ISO_DATE.test(range.start ?? "") && ISO_DATE.test(range.end ?? "") && range.start <= range.end);
    return ok ? null : "INVALID_PERIOD";
  }
  return "INVALID_PERIOD";
}

/** 상태가 도구 선언 안에 있는지. 모르는 값은 조용히 넘기지 않고 사유 코드로 거절한다. */
export function validateRecipeState(state, spec = {}) {
  const errors = [];
  const push = (code, path) => errors.push({ code, path });
  const data = state?.data || {};
  const view = state?.view || {};
  const exp = state?.export || {};

  const maxLevels = spec.maxLevels ?? 3;
  if (!isStringList(data.levels, { max: maxLevels })) push("INVALID_LEVELS", "data.levels");
  else if (new Set(data.levels).size !== data.levels.length) push("DUPLICATE_LEVEL", "data.levels");
  if (Array.isArray(spec.metrics) && data.metric != null && !spec.metrics.includes(data.metric)) {
    push("METRIC_NOT_SUPPORTED", "data.metric");
  }
  const periodError = validatePeriod(data.period, spec);
  if (periodError) push(periodError, "data.period");
  if (!Array.isArray(data.filters) || !data.filters.every((filter) => filter
    && typeof filter.field === "string" && filter.field
    && FILTER_OPS.includes(filter.op)
    && FILTER_SCOPES.includes(filter.scope)
    && isStringList(filter.values, { min: 1 }))) push("INVALID_FILTER", "data.filters");
  if (typeof data.caseSensitive !== "boolean") push("INVALID_CASE_OPTION", "data.caseSensitive");

  const ids = blockIds(spec);
  const locked = lockedBlockIds(spec);
  if (!Array.isArray(view.hidden) || !view.hidden.every((id) => ids.has(id))) push("UNKNOWN_BLOCK", "view.hidden");
  // 항등식 확인·판정 보류 사유는 결과의 근거라 숨길 수 없다(2026-09-30 결정).
  else if (view.hidden.some((id) => locked.has(id))) push("LOCKED_BLOCK", "view.hidden");
  const labels = view.labels && typeof view.labels === "object" && !Array.isArray(view.labels) ? view.labels : null;
  if (!labels || !Object.entries(labels).every(([id, text]) => ids.has(id)
    && typeof text === "string" && text.length > 0 && text.length <= LIMITS.label)) push("INVALID_LABEL", "view.labels");
  if (view.topN != null && !(Number.isInteger(view.topN) && view.topN >= 1 && view.topN <= LIMITS.topN)) push("INVALID_TOP_N", "view.topN");
  if (view.only != null && !VIEW_ONLY.includes(view.only)) push("INVALID_VIEW_ONLY", "view.only");

  if (Array.isArray(spec.exportFormats) && exp.format != null && !spec.exportFormats.includes(exp.format)) {
    push("FORMAT_NOT_SUPPORTED", "export.format");
  }
  if (typeof exp.includeCaveats !== "boolean") push("INVALID_EXPORT", "export.includeCaveats");
  if (typeof exp.withFormulas !== "boolean") push("INVALID_EXPORT", "export.withFormulas");
  return { ok: errors.length === 0, errors };
}

function isPlainParam(value) {
  if (typeof value === "string") return value.length <= LIMITS.valueLength;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return isStringList(value);
}

/** 단계를 허용 필드만으로 다시 조립한다(§12.29 재조립 — 입력 객체를 펼치지 않는다). */
export function sanitizeStep(step) {
  if (!step || typeof step !== "object" || typeof step.id !== "string" || !step.id) return null;
  const rawParams = step.params == null ? {} : step.params;
  if (typeof rawParams !== "object" || Array.isArray(rawParams)) return null;
  const entries = Object.entries(rawParams);
  if (entries.length > LIMITS.params || !entries.every(([, value]) => isPlainParam(value))) return null;
  const params = Object.fromEntries(entries
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]));
  return { id: step.id, params };
}

function stepKey(step) {
  return JSON.stringify([step.id, step.params]);
}

function asVocabulary(vocabulary) {
  return vocabulary instanceof Map ? vocabulary : buildVocabulary(vocabulary);
}

/**
 * 단계 추가. 같은 자리(slot)의 앞 단계는 교체되고(“채널별” 뒤 “채널+캠페인별”),
 * 완전히 같은 단계는 한 번만 남는다. 칩 목록 = 반환된 배열.
 */
export function addStep(steps, step, vocabulary) {
  const vocab = asVocabulary(vocabulary);
  const clean = sanitizeStep(step);
  // selectOnly 후보(매핑+축)는 toSelection이 만든 단계로 들어온다. 그 자체는 단계가 아니다.
  if (!clean || !vocab.has(clean.id) || vocab.get(clean.id).selectOnly) return steps;
  const slot = vocab.get(clean.id).slot;
  const key = stepKey(clean);
  const kept = steps.filter((existing) => {
    if (stepKey(existing) === key) return false;
    const existingSlot = vocab.get(existing.id)?.slot;
    return !(slot && existingSlot === slot);
  });
  return [...kept, clean];
}

export function removeStep(steps, index) {
  return steps.filter((_, i) => i !== index);
}

/**
 * 기본값에서 단계를 순서대로 접어 상태를 만든다. 적용 후 검증에 실패한 단계는 건너뛰고
 * 사유와 함께 rejected에 남긴다 — 칩은 남아 있어도 화면에 반영되지 않은 이유를 말할 수 있게.
 */
export function foldSteps(steps, vocabulary, spec = {}) {
  const vocab = asVocabulary(vocabulary);
  let state = defaultRecipeState(spec);
  const applied = [];
  const rejected = [];
  let normalized = [];
  for (const raw of Array.isArray(steps) ? steps : []) {
    const step = sanitizeStep(raw);
    if (!step) {
      rejected.push({ step: raw, code: "INVALID_STEP" });
      continue;
    }
    if (!vocab.has(step.id)) {
      rejected.push({ step, code: "UNKNOWN_ENTRY" });
      continue;
    }
    if (vocab.get(step.id).selectOnly) {
      rejected.push({ step, code: "SELECT_ONLY" });
      continue;
    }
    normalized = addStep(normalized, step, vocab);
  }
  // phase는 적용 순서만 정한다(칩 순서는 유저가 고른 순서 그대로). 같은 phase는 입력 순.
  const ordered = normalized
    .map((step, order) => ({ step, order, phase: vocab.get(step.id).phase ?? 0 }))
    .sort((a, b) => a.phase - b.phase || a.order - b.order)
    .map((item) => item.step);
  for (const step of ordered) {
    const entry = vocab.get(step.id);
    let next;
    try {
      next = entry.apply(structuredClone(state), step.params, spec);
    } catch {
      rejected.push({ step, code: "APPLY_FAILED" });
      continue;
    }
    const check = validateRecipeState(next, spec);
    if (!check.ok) {
      rejected.push({ step, code: check.errors[0].code });
      continue;
    }
    state = next;
    applied.push(step);
  }
  return { state, applied, rejected };
}

/** 저장·공유용 직렬화. 단계는 재조립하고 상한을 건다. */
export function serializeRecipe({ toolId, steps }) {
  return {
    version: RECIPE_VERSION,
    toolId: String(toolId ?? ""),
    steps: (Array.isArray(steps) ? steps : []).map(sanitizeStep).filter(Boolean).slice(0, LIMITS.steps),
  };
}

/**
 * 저장된 레시피 읽기. 모르는 버전·필드·도구는 건너뛰지 않고 거절한다
 * (AGENTS §7 "모르는 미래 값은 건너뛰지 말고 거절할 것").
 */
export function parseRecipe(raw, { toolId } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, code: "INVALID_RECIPE" };
  if (Object.keys(raw).some((key) => !RECIPE_FIELDS.has(key))) return { ok: false, code: "UNKNOWN_FIELD" };
  if (!Number.isInteger(raw.version) || raw.version < 1 || raw.version > RECIPE_VERSION) return { ok: false, code: "UNKNOWN_VERSION" };
  if (toolId && raw.toolId !== toolId) return { ok: false, code: "TOOL_MISMATCH" };
  if (!Array.isArray(raw.steps) || raw.steps.length > LIMITS.steps) return { ok: false, code: "INVALID_STEPS" };
  const steps = raw.steps.map(sanitizeStep);
  if (steps.some((step) => !step)) return { ok: false, code: "INVALID_STEPS" };
  return { ok: true, recipe: { version: raw.version, toolId: raw.toolId, steps } };
}

/** 계정 동기화 대상과 기기 전용(사용자 데이터 값을 담은 단계)을 가른다. */
export function partitionForSync(steps, vocabulary) {
  const vocab = asVocabulary(vocabulary);
  const syncable = [];
  const deviceOnly = [];
  for (const step of steps) {
    (vocab.get(step.id)?.carriesUserValues ? deviceOnly : syncable).push(step);
  }
  return { syncable, deviceOnly };
}
