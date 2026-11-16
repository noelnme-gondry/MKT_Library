import { studentTcrit } from "../statPrimitives";
import { currencyOf } from "./transactionMath";
import {
  column, dot, inverse, mean, metric, multiply, nelderMead, number, pair as P, quadratic, requireInput, result, sum, table, text, uniqueKey, validateRows, zeros,
} from "./commonMath";

export function choiceProbabilities(beta, alternatives) {
  const utilities = alternatives.map((a) => dot(beta, a.x)), max = Math.max(...utilities);
  const exponentials = utilities.map((u) => Math.exp(u - max)), total = sum(exponentials);
  return { probabilities: exponentials.map((e) => e / total), logDenominator: max + Math.log(total), utilities };
}
export function choiceLoss(beta, tasks) {
  return sum(tasks.map((task) => {
    const p = choiceProbabilities(beta, task.alternatives);
    return p.logDenominator - p.utilities[task.chosen];
  }));
}
export function fitChoice(tasks, parameterCount) {
  const objective = (beta) => beta.some((v) => Math.abs(v) > 40) ? Infinity : choiceLoss(beta, tasks);
  const fit = nelderMead(objective, Array(parameterCount).fill(0), { maxIterations: 3000, tolerance: 1e-12 });
  requireInput(fit.converged && fit.x.every((v) => Math.abs(v) < 39.9), "model_not_converged");
  const information = zeros(parameterCount), scores = new Map();
  for (const task of tasks) {
    const { probabilities } = choiceProbabilities(fit.x, task.alternatives);
    const expected = fit.x.map((_, j) => sum(task.alternatives.map((a, i) => probabilities[i] * a.x[j])));
    const score = task.alternatives[task.chosen].x.map((v, j) => v - expected[j]);
    if (!scores.has(task.respondent)) scores.set(task.respondent, Array(parameterCount).fill(0));
    const cluster = scores.get(task.respondent);
    score.forEach((v, j) => { cluster[j] += v; });
    for (let j = 0; j < parameterCount; j++) for (let k = 0; k < parameterCount; k++) {
      information[j][k] += sum(task.alternatives.map((a, i) => probabilities[i] * (a.x[j] - expected[j]) * (a.x[k] - expected[k])));
    }
  }
  const bread = inverse(information);
  requireInput(bread && scores.size >= 10, "unidentified_model");
  const meat = zeros(parameterCount);
  for (const score of scores.values()) for (let j = 0; j < parameterCount; j++) for (let k = 0; k < parameterCount; k++) meat[j][k] += score[j] * score[k];
  const correction = scores.size / (scores.size - 1) * (tasks.length - 1) / (tasks.length - parameterCount);
  const covariance = multiply(multiply(bread, meat), bread).map((row) => row.map((v) => v * correction));
  return { beta: fit.x, covariance, clusters: scores.size, loss: fit.value };
}

export function runConjoint(rows, options = {}) {
  requireInput(options.choiceDesign === true, "confirm_choice_design");
  validateRows(rows, 20000);
  const currency = currencyOf(rows), seen = new Set(), grouped = new Map(), respondentRoles = new Map();
  const features = ["price", "attribute_1", ...(["attribute_2", "attribute_3"].filter((key) => rows.some((row) => row[key] != null && row[key] !== "")))];
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i], line = i + 2, respondent = text(raw.respondent_id, "respondent_id", line), taskId = text(raw.task_id, "task_id", line);
    uniqueKey(seen, [respondent, taskId, text(raw.alternative_id, "alternative_id", line)], line);
    const role = text(raw.sample_role, "sample_role", line).toLowerCase();
    requireInput(["train", "evaluation"].includes(role), "invalid_sample_role", { row: line });
    requireInput(!respondentRoles.has(respondent) || respondentRoles.get(respondent) === role, "respondent_leakage");
    respondentRoles.set(respondent, role);
    const key = JSON.stringify([respondent, taskId]), chosen = number(raw.chosen, "chosen", line, { min: 0, max: 1, integer: true });
    if (!grouped.has(key)) grouped.set(key, { respondent, taskId, role, alternatives: [] });
    grouped.get(key).alternatives.push({ chosen, x: features.map((field) => number(raw[field], field, line, field === "price" ? { min: 0 } : {})) });
  }
  const tasks = [...grouped.values()];
  for (const task of tasks) {
    requireInput(task.alternatives.length >= 2 && task.alternatives.length <= 20
      && sum(task.alternatives.map((a) => a.chosen)) === 1, "invalid_choice_set");
    task.chosen = task.alternatives.findIndex((a) => a.chosen === 1);
  }
  const train = tasks.filter((task) => task.role === "train"), evaluation = tasks.filter((task) => task.role === "evaluation");
  requireInput(train.length >= 30 && evaluation.length >= 10
    && new Set(evaluation.map((task) => task.respondent)).size >= 5, "insufficient_choice_sample");
  // Center within choice sets. Scale using training data only.
  for (const task of tasks) {
    const center = features.map((_, j) => mean(task.alternatives.map((a) => a.x[j])));
    task.alternatives = task.alternatives.map((a) => ({ ...a, x: a.x.map((v, j) => v - center[j]) }));
  }
  const scales = features.map((_, j) => Math.sqrt(mean(train.flatMap((task) => task.alternatives.map((a) => a.x[j] ** 2)))));
  requireInput(scales.every((s) => s > 1e-12), "constant_covariate");
  for (const task of tasks) task.alternatives = task.alternatives.map((a) => ({ ...a, x: a.x.map((v, j) => v / scales[j]) }));
  const fit = fitChoice(train, features.length), beta = fit.beta.map((v, j) => v / scales[j]);
  const covariance = fit.covariance.map((row, j) => row.map((v, k) => v / scales[j] / scales[k]));
  const critical = studentTcrit(0.95, fit.clusters - 1), priceSe = Math.sqrt(covariance[0][0]);
  const canPrice = Number.isFinite(priceSe) && priceSe > 0 && beta[0] + critical * priceSe < 0;
  const coefficients = features.map((feature, j) => {
    const se = covariance[j][j] > 1e-20 ? Math.sqrt(covariance[j][j]) : null;
    let wtp = null, wtpLow = null, wtpHigh = null;
    if (j && canPrice) {
      wtp = -beta[j] / beta[0];
      const gradient = features.map((_, k) => k === 0 ? beta[j] / beta[0] ** 2 : k === j ? -1 / beta[0] : 0);
      const uncertainty = quadratic(gradient, covariance);
      if (uncertainty > 0) { wtpLow = wtp - critical * Math.sqrt(uncertainty); wtpHigh = wtp + critical * Math.sqrt(uncertainty); }
    }
    return { feature, estimate: beta[j], low: se ? beta[j] - critical * se : null, high: se ? beta[j] + critical * se : null, wtp, wtpLow, wtpHigh };
  });
  const holdoutLoss = choiceLoss(fit.beta, evaluation) / evaluation.length;
  const uniformLoss = mean(evaluation.map((task) => Math.log(task.alternatives.length)));
  const predictions = evaluation.map((task) => {
    const { probabilities } = choiceProbabilities(fit.beta, task.alternatives);
    const predicted = probabilities.indexOf(Math.max(...probabilities));
    return { respondent: task.respondent, task: task.taskId, selectedProbability: probabilities[task.chosen], correct: predicted === task.chosen ? 1 : 0 };
  });
  return result({
    headline: holdoutLoss < uniformLoss ? P("별도 응답자의 선택 예측이 균등 선택 기준보다 낫습니다.", "Held-out choice prediction improves on uniform choice.")
      : P("별도 응답자의 선택 예측이 균등 선택 기준을 넘지 못했습니다.", "Held-out choice prediction does not improve on uniform choice."),
    action: P("평가 로그손실과 가격 계수의 구간을 먼저 확인한 뒤 속성 단위당 교환가치를 해석하세요.",
      "Check evaluation log loss and the price-coefficient interval before interpreting monetary trade-offs per attribute unit."),
    metrics: [metric("loss", P("평가 로그손실 (낮을수록 좋음)", "Evaluation log loss (lower is better)"), holdoutLoss),
      metric("uniform", P("균등 선택 로그손실", "Uniform-choice log loss"), uniformLoss),
      metric("respondents", P("학습 응답자", "Training respondents"), fit.clusters, "integer"),
      metric("price", P("가격 계수", "Price coefficient"), beta[0], "number", coefficients[0])],
    tables: [table("coefficients", P("선택 효용과 금액 교환가치", "Choice utility and monetary trade-offs"), [
      column("feature", P("입력 속성", "Input attribute"), "text"), column("estimate", P("단위당 계수", "Coefficient per unit")),
      column("low", P("95% 하한", "95% lower")), column("high", P("95% 상한", "95% upper")),
      column("wtp", P("단위당 금액 교환가치", "Monetary trade-off per unit"), "money"),
      column("wtpLow", P("교환가치 95% 하한", "Trade-off 95% lower"), "money"),
      column("wtpHigh", P("교환가치 95% 상한", "Trade-off 95% upper"), "money"),
    ], coefficients), table("evaluation", P("학습에서 제외한 응답자 평가", "Evaluation on excluded respondents"), [
      column("respondent", P("응답자", "Respondent"), "text"), column("task", P("문항", "Task"), "text"),
      column("selectedProbability", P("실제 선택 대안의 예측 확률", "Predicted probability of chosen alternative"), "rate"),
      column("correct", P("최대 확률 선택 일치", "Top-choice match"), "integer"),
    ], predictions)],
    method: P("선택 세트별 조건부 다항 로짓, 응답자 군집 샌드위치 공분산과 t 근사 95% 구간. 수치형 속성은 단위당 선형 효과입니다. 금액 교환가치는 −속성계수/가격계수와 델타법입니다.",
      "Conditional multinomial logit with respondent-cluster sandwich covariance and t-approximate 95% intervals. Numeric attributes have linear per-unit effects. Monetary trade-offs use −attribute/price coefficient and the delta method."),
    warnings: [P("선호 선택 확률은 실제 시장 점유율이나 매출 예측이 아닙니다. 가격 계수의 95% 구간이 0 이상을 포함하면 금액 교환가치를 계산하지 않습니다. 속성 코딩·단위·대안 구성을 함께 확인하세요.",
      "Preference probabilities are not actual market share or revenue forecasts. Monetary trade-offs are uncomputed unless the price coefficient's 95% interval is strictly negative. Check coding, units and alternative design.")],
    diagnostics: { currency, trainTasks: train.length, evaluationTasks: evaluation.length, scales, covariance, priceIdentified: canPrice },
    figure: { kind: "interval", tableId: "coefficients", label: "feature", value: "estimate", low: "low", high: "high" },
  });
}
