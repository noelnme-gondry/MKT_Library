// Compare two allocations on the same response curves. Every bound is in observed spend units.
import { addDays } from "./budgetPlanner/plannerStats";
import { PLANNER_CONFIG } from "./budgetPlanner/plannerConfig";
import { fitNodeCurve, predictNodeCpr } from "./budgetPlanner/plannerCurve";
import { improveAllocationFromCurrent } from "@/utils/budgetAllocTool";

const config = { ...PLANNER_CONFIG, dow: { ...PLANNER_CONFIG.dow, enabled: false } };
const minTraining = 14;
const validationPoints = 7;

function validatedChannel(channel, days, limit, grain) {
  const positive = channel.points.filter((p) => p.cost > 0 || p.result > 0);
  if (positive.length < minTraining + validationPoints || positive.some((p) => !(p.cost > 0 && p.result > 0)))
    return null;
  // Holdout observations must be consecutive at the declared reporting grain.
  const interval = grain === "weekly" ? 7 : 1;
  const tail = positive.slice(-validationPoints - 1);
  if (tail.slice(1).some((p, i) => addDays(tail[i].date, interval) !== p.date)) return null;
  const validation = positive.slice(-validationPoints);
  const train = positive.slice(0, -validationPoints);
  if (new Set(train.map((p) => p.cost)).size < 4) return null;
  const fit = (points) => fitNodeCurve(new Map(points.map((p) => [p.date, p])), config);
  const prior = fit(train);
  if (!prior || !validation.every((p) => p.cost >= prior.observed.xMin && p.cost <= prior.observed.xMax))
    return null;
  const errors = validation.map((p) => {
    const predictedCpa = predictNodeCpr(prior, p.cost);
    return predictedCpa > 0 ? Math.abs(p.cost / predictedCpa - p.result) : Infinity;
  });
  const actual = validation.reduce((a, p) => a + p.result, 0);
  const error = errors.reduce((a, b) => a + b, 0) / actual;
  if (!Number.isFinite(error) || error > PLANNER_CONFIG.pvm.reviewErrorThreshold) return null;
  const model = fit(positive);
  if (!model) return null;
  const current = channel.current.cost / days;
  const low = Math.max(current * (1 - limit), model.observed.xMin);
  const high = Math.min(current * (1 + limit), model.observed.xMax);
  if (!(current > 0 && low <= current && current <= high)) return null;
  return { name: channel.name, current, low, high, model, error };
}

export function diagnosisBudget(channels, currentTotal, { grain, changeLimit, currency, complete, days }) {
  const held = (reason) => ({
    status: "insufficient",
    reason,
    reasonCode: reason,
    rows: [],
    totalCost: currentTotal.cost,
    currentResult: null,
    proposedResult: null,
    currentCpa: null,
    proposedCpa: null,
    validationError: null,
  });
  if (!complete || !days || currentTotal.cpa == null) return held("coverage");
  const active = channels.filter((ch) => ch.current.cost > 0);
  if (active.length < 2) return held("channels");
  // A missing or zero-result day cannot silently disappear from training.
  if (
    active.some(
      (ch) =>
        ch.points.some((p) => p.result == null || p.cost == null) ||
        ch.points.filter((p) => p.period === "current").length !== days,
    )
  )
    return held("coverage");
  const limit = Number.isFinite(changeLimit) ? Math.min(1, Math.max(0, changeLimit)) : 0.2;
  const fitted = active.map((ch) => validatedChannel(ch, days, limit, grain));
  if (fitted.some((model) => !model)) return held("validation");
  const asObject = (key) => Object.fromEntries(fitted.map((channel) => [channel.name, channel[key]]));
  const planned = improveAllocationFromCurrent({
    modelsMap: new Map(fitted.map((ch) => [ch.name, ch.model.wrapper])),
    currentSpends: asObject("current"),
    minSpends: asObject("low"),
    maxSpends: asObject("high"),
    totalBudget: currentTotal.cost / days,
    currency,
  });
  if (
    planned.items.length !== active.length ||
    Math.abs(planned.totalAllocated * days - currentTotal.cost) > 0.001
  )
    return held("constraints");
  const byChannel = new Map(planned.items.map((row) => [row.channel, row]));
  const rows = fitted.map((ch) => {
    const proposal = byChannel.get(ch.name);
    const currentResult = (ch.current * days) / predictNodeCpr(ch.model, ch.current);
    const currentCost = ch.current * days;
    const proposedCost = proposal.cost * days;
    const proposedResult = proposal.results * days;
    const diff = proposedResult - currentResult;
    return {
      name: ch.name,
      currentCost,
      proposedCost,
      currentResult,
      proposedResult,
      marginalCpa:
        Math.abs(diff) > 1e-8 && (proposedCost - currentCost) / diff > 0
          ? (proposedCost - currentCost) / diff
          : null,
      minSpend: ch.low * days,
      maxSpend: ch.high * days,
      validationError: ch.error,
    };
  });
  const currentResult = rows.reduce((total, row) => total + row.currentResult, 0);
  const proposedResult = rows.reduce((total, row) => total + row.proposedResult, 0);
  const validationError =
    rows.reduce((total, row) => total + row.currentResult * row.validationError, 0) / currentResult;
  if (!(proposedResult > 0 && currentResult > 0)) return held("validation");
  const gain = proposedResult - currentResult;
  const decision = gain <= Math.max(1, validationError * currentResult) ? "hold" : "test";
  return {
    status: "ready",
    decision,
    reason: decision === "hold" ? "uncertain_gain" : null,
    rows,
    currentResult,
    proposedResult,
    totalCost: currentTotal.cost,
    currentCpa: currentTotal.cost / currentResult,
    proposedCpa: currentTotal.cost / proposedResult,
    validationError,
  };
}
