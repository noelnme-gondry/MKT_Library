import {
  MMM_METH_CONFIG,
  mmmForecastBackgroundCandidateCap,
  mmmForecastRollingSelection,
} from "../utils/mmmMath";
import { runAnnualAnalogRouter } from "../utils/annualAnalogForecast";
import { runAttributedForecastLiveRouter } from "../utils/attributedForecastLiveMath";

function failedSelection(task, error) {
  return {
    workerError: true,
    kind: task?.kind || "mmm-selection",
    reason: "worker-task-error",
    message: String(error?.message || error || "Unknown forecast worker error"),
  };
}

export function backgroundCandidateCap(panel) {
  const featureCount = Object.keys(panel?.ch || {}).length
    + Object.keys(panel?.dummy || {}).length
    + Object.keys(panel?.steps || {}).length
    + Object.keys(panel?.external || {}).length;
  return mmmForecastBackgroundCandidateCap(featureCount);
}

export function hydrateForecastConfig(dto = {}) {
  return {
    ...MMM_METH_CONFIG,
    ...dto,
    absorbed: new Set(Array.isArray(dto.absorbed) ? dto.absorbed : []),
  };
}

export function slicePanel(panel, trainingWeeks) {
  const n = panel?.week?.length || 0;
  const keep = Math.max(1, Math.min(n, Number(trainingWeeks) || n));
  const start = Math.max(0, n - keep);
  return {
    ...panel,
    week: (panel.week || []).slice(start),
    weekLabel: panel.weekLabel?.slice(start),
    dateLabel: panel.dateLabel?.slice(start),
    dates: panel.dates?.slice(start),
    ch: Object.fromEntries(Object.entries(panel.ch || {})
      .map(([key, values]) => [key, values.slice(start)])),
    reach: Object.fromEntries(Object.entries(panel.reach || {})
      .map(([key, values]) => [key, values.slice(start)])),
    frequency: Object.fromEntries(Object.entries(panel.frequency || {})
      .map(([key, values]) => [key, values.slice(start)])),
    dummy: Object.fromEntries(Object.entries(panel.dummy || {})
      .map(([key, values]) => [key, values.slice(start)])),
    steps: Object.fromEntries(Object.entries(panel.steps || {})
      .map(([key, values]) => [key, values.slice(start)])),
    external: Object.fromEntries(Object.entries(panel.external || {})
      .map(([key, values]) => [key, values.slice(start)])),
    geo: Array.isArray(panel.geo) ? panel.geo.slice(start) : panel.geo,
    targets: Object.fromEntries(Object.entries(panel.targets || {})
      .map(([key, values]) => [key, values.slice(start)])),
  };
}

function recommendRegimeWindow(candidates, maxWeeks) {
  const full = candidates.find((candidate) =>
    candidate.trainingWeeks === maxWeeks && candidate.available) || null;
  const bestShorter = candidates
    .filter((candidate) =>
      candidate.available
      && candidate.decisionEligible
      && candidate.trainingWeeks < maxWeeks)
    .sort((left, right) =>
      left.developmentWmape - right.developmentWmape
      || right.trainingWeeks - left.trainingWeeks)[0] || null;
  const recommended = full && bestShorter
    && full.developmentWmape > 10
    && bestShorter.developmentWmape <= full.developmentWmape * 0.8
    && full.developmentWmape - bestShorter.developmentWmape >= 3
    ? bestShorter
    : null;
  return {
    available: Boolean(full),
    full,
    candidates,
    recommended,
  };
}

function nonnegativeFoldWmape(fold) {
  if (!Array.isArray(fold?.actual)
    || !Array.isArray(fold?.predicted)
    || fold.actual.length === 0
    || fold.actual.length !== fold.predicted.length) return null;
  const denominator = fold.actual.reduce((sum, value) =>
    sum + Math.abs(Number(value) || 0), 0);
  if (!(denominator > 0)) return null;
  const absoluteError = fold.actual.reduce((sum, value, index) => {
    const actual = Number(value) || 0;
    const predicted = Math.max(0, Number(fold.predicted[index]) || 0);
    return sum + Math.abs(actual - predicted);
  }, 0);
  return absoluteError / denominator * 100;
}

export function scanMmmRegimeWindows(task) {
  const models = (task.models || []).filter((model) =>
    model?.panel?.week?.length && model?.cfg && model?.target);
  if (!models.length) {
    return { available: false, reason: "missing-source", candidates: [], recommended: null };
  }
  const horizon = Math.max(1, Math.min(52, Number(task.horizon) || 13));
  const minimumWeeks = Math.max(78, Number(task.minimumWeeks) || 0);
  const maxWeeks = Math.min(...models.map((model) => model.panel.week.length));
  const windows = [...new Set([
    maxWeeks,
    ...(task.candidateWeeks || [208, 156, 130, 104, 78]),
  ])]
    .filter((weeks) =>
      Number.isInteger(weeks) && weeks >= minimumWeeks && weeks <= maxWeeks)
    .sort((left, right) => right - left);
  const candidates = windows.map((trainingWeeks) => {
    const sliced = models.map((model) => ({
      ...model,
      panel: slicePanel(model.panel, trainingWeeks),
    }));
    const selections = sliced.map((model) => mmmForecastRollingSelection(
      model.panel,
      hydrateForecastConfig(model.cfg),
      model.target,
      {
        horizon,
        maxCandidateConfigurations: backgroundCandidateCap(model.panel),
      },
    ));
    const latestWmapes = selections.map((selection) =>
      nonnegativeFoldWmape(selection?.nested?.latest));
    const available = selections.every((selection) =>
      Number.isFinite(selection?.selected?.wmape))
      && latestWmapes.every(Number.isFinite);
    return {
      trainingWeeks,
      startLabel: sliced[0]?.panel?.weekLabel?.[0] || null,
      endLabel: sliced[0]?.panel?.weekLabel?.at(-1) || null,
      available,
      developmentWmape: available
        ? Math.max(...selections.map((selection) => selection.selected.wmape))
        : null,
      latestWmape: available
        ? Math.max(...latestWmapes)
        : null,
      decisionEligible: available
        && selections.every((selection) => selection.decisionEligible === true),
    };
  });
  return recommendRegimeWindow(candidates, maxWeeks);
}

export function scanAnnualRegimeWindows(task) {
  const { totalPanel, androidPanel, iosPanel, target } = task;
  const panels = [totalPanel, androidPanel, iosPanel];
  if (panels.some((panel) => !panel?.week?.length) || !target) {
    return { available: false, reason: "missing-source", candidates: [], recommended: null };
  }
  const horizon = Math.max(1, Math.min(52, Number(task.horizon) || 13));
  const minimumWeeks = Math.max(91, 68 + horizon);
  const maxWeeks = Math.min(...panels.map((panel) => panel.week.length));
  const windows = [...new Set([
    maxWeeks,
    ...(task.candidateWeeks || [208, 156, 130, 104, 91]),
  ])]
    .filter((weeks) =>
      Number.isInteger(weeks) && weeks >= minimumWeeks && weeks <= maxWeeks)
    .sort((left, right) => right - left);
  const candidates = windows.map((trainingWeeks) => {
    const annual = runAnnualAnalogRouter({
      totalPanel: slicePanel(totalPanel, trainingWeeks),
      androidPanel: slicePanel(androidPanel, trainingWeeks),
      iosPanel: slicePanel(iosPanel, trainingWeeks),
      target,
      horizon,
      allowedProductionRoutes: task.allowedProductionRoutes,
    });
    const selected = annual?.selected;
    const componentDevelopmentPass = annual?.componentGuardrailRequired === false
      || ((annual?.osGuardrail || []).length >= 2
        && annual.osGuardrail.every((item) =>
          Number.isFinite(item.developmentWmape) && item.developmentWmape < 10));
    const available = Number.isFinite(selected?.developmentWmape)
      && Number.isFinite(selected?.latestWmape);
    return {
      trainingWeeks,
      startLabel: totalPanel.weekLabel?.[Math.max(0, totalPanel.week.length - trainingWeeks)] || null,
      endLabel: totalPanel.weekLabel?.at(-1) || null,
      available,
      developmentWmape: available ? selected.developmentWmape : null,
      latestWmape: available ? selected.latestWmape : null,
      decisionEligible: available
        && selected.developmentWmape < 10
        && componentDevelopmentPass,
    };
  });
  return recommendRegimeWindow(candidates, maxWeeks);
}

export function runForecastSelectionTask(task) {
  if (task.kind === "regime-mmm") return scanMmmRegimeWindows(task);
  if (task.kind === "regime-annual") return scanAnnualRegimeWindows(task);
  if (task.kind === "annual-router") {
    return runAnnualAnalogRouter(task.args || {});
  }
  if (task.kind === "attributed-router") {
    return runAttributedForecastLiveRouter(task.dataset, {
      holdout: task.horizon,
      horizon: task.horizon,
    });
  }
  const selection = mmmForecastRollingSelection(
    task.panel,
    hydrateForecastConfig(task.cfg),
    task.target,
    {
      ...(task.options || {}),
      horizon: task.horizon,
      maxCandidateConfigurations: task.options?.maxCandidateConfigurations
        || backgroundCandidateCap(task.panel),
    },
  );
  selection.backgroundSearch = {
    enabled: true,
    candidateCap: selection?.candidateConfigurationCounts?.cap
      || backgroundCandidateCap(task.panel),
  };
  return selection;
}

export function executeForecastSelectionTasks(tasks = []) {
  const results = {};
  tasks.forEach((task) => {
    try {
      results[task.id] = runForecastSelectionTask(task);
    } catch (error) {
      results[task.id] = failedSelection(task, error);
    }
  });
  return results;
}

globalThis.onmessage = (event) => {
  const { requestId, tasks = [] } = event.data || {};
  const results = {};

  tasks.forEach((task, index) => {
    Object.assign(results, executeForecastSelectionTasks([task]));
    globalThis.postMessage({
      type: "progress",
      requestId,
      completed: index + 1,
      total: tasks.length,
    });
  });

  globalThis.postMessage({
    type: "complete",
    requestId,
    results,
  });
};
