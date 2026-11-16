import { chi2Cdf, studentTcrit } from "../statPrimitives";
import { currencyOf } from "./transactionMath";
import {
  column, fitOls, mean, metric, number, pair, requireInput, result, sum, table, text,
  uniqueKey, validateRows, variance, welch, wilson,
} from "./commonMath";

const P = pair;
export function arm(value, row) {
  const label = String(value ?? "").trim().toLowerCase();
  if (["1", "treatment", "treated", "처치"].includes(label)) return 1;
  if (["0", "control", "대조"].includes(label)) return 0;
  requireInput(false, "invalid_arm", { field: "treatment", row });
}
export function assignmentCheck(rows, probability = 0.5) {
  const p = number(probability, "allocation", undefined, { min: 0.001, max: 0.999 });
  const treated = rows.filter((row) => row.treatment === 1).length;
  const n = rows.length, expected = n * p;
  requireInput(treated >= 2 && n - treated >= 2, "insufficient_groups");
  const statistic = (treated - expected) ** 2 / (n * p * (1 - p));
  const srmP = Math.min(expected, n - expected) >= 5 ? 1 - chi2Cdf(statistic, 1) : null;
  requireInput(srmP === null || srmP >= 0.001, "sample_ratio_mismatch", { treatment: treated, control: n - treated });
  return { treated, control: n - treated, probability: p, srmP };
}
function trialRows(rows, fields) {
  validateRows(rows);
  const seen = new Set();
  return rows.map((row, index) => {
    const n = index + 2, id = text(row.unit_id, "unit_id", n);
    uniqueKey(seen, [id], n);
    return { id, treatment: arm(row.treatment, n), ...Object.fromEntries(fields.map((key) => [key, number(row[key], key, n)])) };
  });
}
const effectColumns = [
  column("label", P("비교", "Comparison"), "text"),
  column("estimate", P("차이 추정값", "Estimated difference")),
  column("low", P("95% 구간 하한", "95% lower bound")),
  column("high", P("95% 구간 상한", "95% upper bound")),
];
// Reference: Lin/ANCOVA2 form documented by Microsoft ExP. Center at the pooled
// baseline mean and include treatment × baseline; HC3 includes slope estimation.
export function runCuped(rows, options = {}) {
  requireInput(options.randomized === true, "confirm_randomization");
  requireInput(options.preTreatment === true, "confirm_pre_treatment");
  const data = trialRows(rows, ["baseline", "outcome"]);
  const assignment = assignmentCheck(data, options.allocation ?? 0.5);
  requireInput(assignment.treated >= 5 && assignment.control >= 5, "insufficient_groups");
  const baseline = data.map((row) => row.baseline), center = mean(baseline);
  requireInput(variance(baseline) > 0, "constant_covariate");
  const design = data.map((row) => [1, row.treatment, row.baseline - center, row.treatment * (row.baseline - center)]);
  const fit = fitOls(design, data.map((row) => row.outcome));
  requireInput(fit, "unidentified_model");
  const adjusted = fit.coefficients[1];
  const raw = welch(data.filter((row) => row.treatment).map((row) => row.outcome),
    data.filter((row) => !row.treatment).map((row) => row.outcome));
  const reduction = raw.se > 0 && adjusted.se !== null ? 1 - adjusted.se ** 2 / raw.se ** 2 : null;
  const identified = adjusted.low !== null;
  return result({
    headline: !identified ? P("평균 차이는 계산됐지만 구간을 추정할 변동이 없습니다.", "The mean difference is available, but there is no variation for an interval.")
      : adjusted.low > 0 ? P("사전 행동을 보정한 결과 지표가 더 높습니다.", "The outcome is higher after adjusting for pre-experiment behavior.")
        : adjusted.high < 0 ? P("사전 행동을 보정한 결과 지표가 더 낮습니다.", "The outcome is lower after adjusting for pre-experiment behavior.")
          : P("사전 행동을 보정해도 차이의 방향은 아직 불확실합니다.", "The direction remains uncertain after baseline adjustment."),
    action: P("원시 결과·보정 결과를 함께 보고 사전에 정한 실무 차이와 비교하세요.", "Compare raw and adjusted results against the practical difference declared before the test."),
    metrics: [
      metric("adjusted", P("보정 평균 차이", "Adjusted mean difference"), adjusted.estimate, "number", adjusted),
      metric("raw", P("원시 평균 차이", "Raw mean difference"), raw.estimate, "number", raw),
      metric("varianceReduction", P("추정 분산 감소율", "Estimated variance reduction"), reduction, "rate"),
      metric("units", P("배정 단위", "Assigned units"), data.length, "integer"),
    ],
    tables: [table("effects", P("같은 표본의 원시·보정 결과", "Raw and adjusted results on the same sample"), effectColumns,
      [{ label: P("원시 차이 (Welch)", "Raw difference (Welch)"), ...raw },
        { label: P("CUPED (ANCOVA2·HC3)", "CUPED (ANCOVA2 · HC3)"), ...adjusted }])],
    method: P("평균 중심 ANCOVA2와 HC3 표준오차, 잔차 자유도의 t 근사 95% 구간. 단일 사전 공변량, 고정 종료 실험입니다.",
      "Mean-centered ANCOVA2 with HC3 standard errors and a residual-df t approximation for 95% intervals. One pre-experiment covariate; fixed-horizon testing."),
    warnings: [P("결과를 본 뒤 공변량·종료 시점·분석 대상을 고르면 이 구간의 의미가 유지되지 않습니다. 무유의성은 동등성이 아닙니다.",
      "Selecting covariates, stopping times or populations after outcomes invalidates this interpretation. Non-significance is not equivalence."),
    ...(!identified ? [P("잔차 변동이 없어 신뢰구간·유의성은 계산하지 않았습니다.", "No residual variation; confidence intervals and significance are uncomputed.")] : [])],
    diagnostics: { assignment, baselineMean: center, coefficients: fit.beta, covariance: fit.covariance },
    figure: { kind: "interval", tableId: "effects", label: "label", value: "estimate", low: "low", high: "high" },
  });
}

export function runPromotion(rows, options = {}) {
  requireInput(options.randomized === true, "confirm_randomization");
  requireInput(options.includesNonbuyers === true, "confirm_nonbuyers");
  const data = trialRows(rows, ["net_revenue", "variable_cost"]);
  const currency = currencyOf(rows);
  const assignment = assignmentCheck(data, options.allocation ?? 0.5);
  const byArm = (key, treatment) => data.filter((row) => row.treatment === treatment).map((row) =>
    key === "profit" ? row.net_revenue - row.variable_cost : row[key]);
  const profit = welch(byArm("profit", 1), byArm("profit", 0));
  const revenue = welch(byArm("net_revenue", 1), byArm("net_revenue", 0));
  return result({
    headline: profit.low > 0 ? P("할인 집단의 단위당 공헌이익이 더 높습니다.", "Contribution margin per assigned unit is higher in the promotion arm.")
      : profit.high !== null && profit.high < 0 ? P("매출과 별개로 할인 집단의 단위당 공헌이익이 낮습니다.", "Contribution margin per unit is lower in the promotion arm, regardless of sales.")
        : P("프로모션의 공헌이익 차이는 아직 불확실합니다.", "The contribution-margin difference remains uncertain."),
    action: P("공헌이익 구간과 재고·반품·후속 구매를 확인한 뒤 확대 여부를 정하세요.", "Check margin uncertainty, stock, returns and later purchases before scaling."),
    metrics: [
      metric("profit", P("단위당 공헌이익 차이", "Margin difference per unit"), profit.estimate, "money", profit),
      metric("revenue", P("단위당 순매출 차이", "Net-revenue difference per unit"), revenue.estimate, "money", revenue),
      metric("units", P("배정 단위", "Assigned units"), data.length, "integer"),
    ],
    tables: [table("effects", P("프로모션의 매출과 이익", "Revenue and margin effects"),
      effectColumns.map((col) => col.type === "text" ? col : { ...col, type: "money" }), [{ label: P("공헌이익", "Contribution margin"), ...profit }, { label: P("순매출", "Net revenue"), ...revenue }])],
    method: P("미구매자를 포함한 배정 단위의 평균 차이와 Welch 95% 구간. 순매출은 할인·환불 후 값이며 할인액을 다시 빼지 않습니다.",
      "Mean differences and Welch 95% intervals across assigned units, including non-buyers. Net revenue is after discounts/refunds; discounts are not subtracted twice."),
    warnings: [P("미래 구매 당김·다른 상품 잠식·실험 밖 고정비는 입력에 포함된 경우만 반영됩니다.",
      "Purchase pull-forward, substitution and fixed costs outside the experiment are reflected only when included in the input.")],
    diagnostics: { currency, assignment, meanTreatmentProfit: mean(byArm("profit", 1)), meanControlProfit: mean(byArm("profit", 0)) },
    figure: { kind: "interval", tableId: "effects", label: "label", value: "estimate", low: "low", high: "high" },
  });
}

export function runUplift(rows, options = {}) {
  requireInput(options.randomized === true, "confirm_randomization");
  requireInput(options.preTreatment === true, "confirm_pre_treatment");
  requireInput(options.heldout === true, "confirm_holdout");
  const base = trialRows(rows, ["outcome"]);
  const data = base.map((row, i) => {
    requireInput(row.outcome === 0 || row.outcome === 1, "binary_outcome", { row: i + 2 });
    const role = text(rows[i].sample_role, "sample_role", i + 2).toLowerCase();
    requireInput(["train", "evaluation"].includes(role), "invalid_sample_role", { row: i + 2 });
    return { ...row, role, segment: text(rows[i].segment, "segment", i + 2) };
  });
  const training = data.filter((row) => row.role === "train"), evaluation = data.filter((row) => row.role === "evaluation");
  const trainAssignment = assignmentCheck(training, options.allocation ?? 0.5);
  const evalAssignment = assignmentCheck(evaluation, options.allocation ?? 0.5);
  const p = evalAssignment.probability;
  const margin = number(options.margin ?? 1, "margin", undefined, { min: 0 });
  const contactCost = number(options.contactCost ?? 0, "contactCost", undefined, { min: 0 });
  const segments = new Map();
  for (const row of training) {
    if (!segments.has(row.segment)) segments.set(row.segment, { treatment: [], control: [] });
    segments.get(row.segment)[row.treatment ? "treatment" : "control"].push(row.outcome);
  }
  requireInput(segments.size <= 100, "too_many_segments", { max: 100 });
  const models = new Map([...segments].map(([segment, groups]) => {
    requireInput(groups.treatment.length >= 2 && groups.control.length >= 2, "segment_overlap", { field: "segment" });
    return [segment, { ...groups, score: mean(groups.treatment) - mean(groups.control) }];
  }));
  requireInput(evaluation.length >= 20, "insufficient_evaluation");
  requireInput(evaluation.every((row) => models.has(row.segment)), "unseen_segment");
  const segmentRows = [...models].map(([segment, model]) => {
    const test = evaluation.filter((row) => row.segment === segment);
    const t = test.filter((row) => row.treatment).map((row) => row.outcome);
    const c = test.filter((row) => !row.treatment).map((row) => row.outcome);
    const a = wilson(sum(t), t.length), b = wilson(sum(c), c.length);
    const difference = a && b ? a.estimate - b.estimate : null;
    // Newcombe score interval for a difference of two independent proportions.
    const low = a && b ? difference - Math.hypot(a.estimate - a.low, b.high - b.estimate) : null;
    const high = a && b ? difference + Math.hypot(a.high - a.estimate, b.estimate - b.low) : null;
    return { segment, trainingLift: model.score, estimate: difference, low, high, n: test.length,
      target: model.score * margin > contactCost };
  });
  // Scores come only from training. Whole tied-score groups enter together;
  // ordering outcome rows inside a tie would manufacture a better Qini curve.
  const groups = new Map();
  const ht = (row) => row.treatment ? row.outcome / p : -row.outcome / (1 - p);
  for (const row of evaluation) {
    const score = models.get(row.segment).score;
    if (!groups.has(score)) groups.set(score, []);
    groups.get(score).push(row);
  }
  const curve = [{ fraction: 0, gain: 0, baseline: 0 }];
  const totalGain = sum(evaluation.map(ht)) / evaluation.length;
  let count = 0, gain = 0, auuc = 0;
  for (const [, group] of [...groups].sort((a, b) => b[0] - a[0])) {
    count += group.length; gain += sum(group.map(ht));
    const point = { fraction: count / evaluation.length, gain: gain / evaluation.length, baseline: totalGain * count / evaluation.length };
    const previous = curve.at(-1);
    auuc += (point.fraction - previous.fraction) * (point.gain + previous.gain) / 2;
    curve.push(point);
  }
  const rewards = evaluation.map((row) => models.get(row.segment).score * margin > contactCost
    ? margin * ht(row) - contactCost : 0);
  const policy = mean(rewards), se = Math.sqrt(variance(rewards) / rewards.length), half = studentTcrit(0.95, rewards.length - 1) * se;
  const interval = se > 0 ? { low: policy - half, high: policy + half } : null;
  const selected = evaluation.filter((row) => models.get(row.segment).score * margin > contactCost).length;
  return result({
    headline: interval?.low > 0 ? P("별도 평가 표본에서 선택 정책의 추가 가치가 양수입니다.", "The targeting policy has positive incremental value in the held-out evaluation sample.")
      : P("선택 정책의 추가 가치를 아직 확정하기 어렵습니다.", "The incremental value of the targeting policy is not established."),
    action: P("평가 결과를 다시 학습 선택에 쓰지 말고 새 무작위 홀드아웃에서 정책을 확인하세요.",
      "Do not reuse evaluation outcomes for model selection; validate the policy in a new randomized holdout."),
    metrics: [
      metric("policy", P("평가 단위당 추가 순가치", "Incremental net value per evaluation unit"), policy, "money", interval),
      metric("qini", P("정규화 Qini 면적", "Normalized Qini area"), auuc - totalGain / 2),
      metric("auuc", P("정규화 AUUC", "Normalized AUUC"), auuc),
      metric("selected", P("정책이 선택한 평가 단위", "Evaluation units selected"), selected, "integer"),
    ],
    tables: [
      table("segments", P("학습 점수와 별도 평가 결과", "Training scores and held-out results"), [
        column("segment", P("사전 세그먼트", "Pre-treatment segment"), "text"),
        column("trainingLift", P("학습 반응률 차이", "Training response-rate difference"), "rate"),
        column("estimate", P("평가 반응률 차이", "Evaluation response-rate difference"), "rate"),
        column("low", P("95% 하한", "95% lower"), "rate"), column("high", P("95% 상한", "95% upper"), "rate"),
        column("n", P("평가 단위", "Evaluation units"), "integer"),
      ], segmentRows),
      table("curve", P("선택 비중별 평가 이득", "Held-out gain by targeted fraction"), [
        column("fraction", P("선택 비중", "Targeted fraction"), "rate"),
        column("gain", P("정규화 이득", "Normalized gain")),
        column("baseline", P("무작위 선택 기준", "Random-targeting baseline")),
      ], curve),
    ],
    method: P("사전 세그먼트별 두 집단 평균 차이를 학습합니다. 별도 평가 표본에서 사전 배정 확률을 사용한 Horvitz–Thompson 이득·정책 가치와 근사 95% 구간을 계산합니다.",
      "Learn two-arm mean differences within pre-treatment segments. Evaluate Horvitz–Thompson gains and policy value using the planned assignment probability on a held-out sample, with approximate 95% intervals."),
    warnings: [P("개인의 인과효과를 관측한 값이 아닙니다. 세그먼트 구간은 개별 구간이며 다중 선택을 보정하지 않았습니다.",
      "These are not observed individual causal effects. Segment intervals are pointwise and not adjusted for multiple selection.")],
    diagnostics: { trainAssignment, evalAssignment, margin, contactCost, evaluationUnits: evaluation.length },
    figure: { kind: "line", tableId: "curve", label: "fraction", value: "gain", comparison: "baseline" },
  });
}
