import { _Z975, mmmNormCdf } from "../statPrimitives";
import {
  DAY, column, dot, fitOls, mean, metric, number, pair as P, requireInput, result, sum, table, text, timestamp, uniqueKey, validateRows,
} from "./commonMath";

export function projectSimplex(values) {
  const sorted = [...values].sort((a, b) => b - a);
  let cumulative = 0, theta = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i];
    const threshold = (cumulative - 1) / (i + 1);
    if (sorted[i] > threshold) theta = threshold;
  }
  return values.map((v) => Math.max(0, v - theta));
}
export function syntheticWeights(target, donors) {
  const count = donors[0].length, scale = Math.sqrt(mean(target.map((v) => v * v))) || 1;
  // The simplex has sum(weights)=1. Removing each row's common donor level
  // preserves residuals exactly and avoids a tiny step caused by that level.
  const centers = donors.map(mean);
  const x = donors.map((row, i) => row.map((v) => (v - centers[i]) / scale)), y = target.map((v, i) => (v - centers[i]) / scale);
  const step = 1 / Math.max(1e-12, 2 * mean(x.map((row) => dot(row, row))));
  let weights = Array(count).fill(1 / count), converged = false;
  for (let iteration = 0; iteration < 15000; iteration++) {
    const errors = x.map((row, i) => dot(row, weights) - y[i]);
    const gradient = weights.map((_, j) => 2 * mean(x.map((row, i) => row[j] * errors[i])));
    const next = projectSimplex(weights.map((w, j) => w - step * gradient[j]));
    if (Math.max(...next.map((w, j) => Math.abs(w - weights[j]))) < 1e-8) { weights = next; converged = true; break; }
    weights = next;
  }
  return { weights, converged };
}
const rmse = (values) => Math.sqrt(mean(values.map((v) => v * v)));
function longRunVariance(values, lag) {
  const center = mean(values), n = values.length;
  let value = mean(values.map((v) => (v - center) ** 2));
  for (let k = 1; k <= lag; k++) value += 2 * (1 - k / (lag + 1))
    * sum(values.slice(k).map((v, i) => (v - center) * (values[i] - center))) / n;
  return Math.max(0, value);
}
export function runGeoExperiment(rows, options = {}) {
  requireInput(options.predeclared === true, "confirm_geo_design");
  requireInput(options.noSpillover === true, "confirm_no_spillover");
  validateRows(rows, 20000);
  const treatment = text(options.treatedRegion, "treatedRegion"), cutoff = timestamp(options.interventionDate, "interventionDate");
  const seen = new Set(), panel = new Map(), datesSet = new Set();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], region = text(row.region, "region", i + 2);
    const date = timestamp(row.date, "date", i + 2);
    requireInput(date % DAY === 0, "daily_panel_required");
    uniqueKey(seen, [region, date], i + 2);
    if (!panel.has(region)) panel.set(region, new Map());
    panel.get(region).set(date, number(row.outcome, "outcome", i + 2, { min: 0 }));
    datesSet.add(date);
  }
  requireInput(panel.has(treatment) && panel.size >= 4 && panel.size <= 25, "geo_regions");
  const dates = [...datesSet].sort((a, b) => a - b), pre = dates.filter((date) => date < cutoff).length;
  const post = dates.length - pre;
  requireInput(pre >= 35 && post >= 7 && dates.length <= 730, "geo_periods");
  requireInput(dates.every((date, i) => !i || date - dates[i - 1] === DAY)
    && [...panel.values()].every((values) => dates.every((date) => values.has(date))), "unbalanced_panel");
  const train = Math.floor(pre * 0.6), validation = pre - train;
  const maxNrmse = number(options.maxNrmse ?? 0.25, "maxNrmse", undefined, { min: 0.01, max: 1 });
  const regions = [...panel.keys()].sort();
  const series = new Map(regions.map((region) => [region, dates.map((date) => panel.get(region).get(date))]));
  const fitRegion = (region, donorRegions) => {
    const y = series.get(region), x = dates.map((_, i) => donorRegions.map((donor) => series.get(donor)[i]));
    const fit = syntheticWeights(y.slice(0, train), x.slice(0, train));
    const predicted = x.map((row) => dot(row, fit.weights)), gap = y.map((v, i) => v - predicted[i]);
    const preGap = gap.slice(train, pre), preError = rmse(preGap), level = mean(y.slice(train, pre));
    return { region, donors: donorRegions, ...fit, predicted, gap, preGap, preError,
      nrmse: level > 0 ? preError / level : null, ratio: preError > 1e-9 ? rmse(gap.slice(pre)) / preError : null, level };
  };
  const donors = regions.filter((region) => region !== treatment), selected = fitRegion(treatment, donors);
  requireInput(selected.converged, "model_not_converged");
  requireInput(selected.nrmse !== null && selected.nrmse <= maxNrmse, "poor_pre_fit");
  const lag = Math.min(7, Math.floor(validation / 4));
  const gaps = selected.gap.slice(train);
  const fit = fitOls(gaps.map((_, i) => [1, i >= validation ? 1 : 0]), gaps, { hacLag: lag });
  requireInput(fit, "unidentified_model");
  const effect = fit.coefficients[1], preBias = mean(selected.preGap), rawPostGap = mean(selected.gap.slice(pre));
  const placebos = donors.map((region) => fitRegion(region, donors.filter((other) => other !== region)));
  const eligiblePlacebos = placebos.filter((fit) => fit.converged && fit.nrmse !== null && fit.nrmse <= maxNrmse && fit.ratio !== null);
  const placeboP = selected.ratio !== null && eligiblePlacebos.length
    ? (1 + eligiblePlacebos.filter((fit) => fit.ratio >= selected.ratio).length) / (1 + eligiblePlacebos.length) : null;
  const powerDays = number(options.powerDays ?? 14, "powerDays", undefined, { min: 7, max: 90, integer: true });
  const plannedLift = number(options.plannedLift ?? 0.1, "plannedLift", undefined, { min: 0.001, max: 2 });
  const planningVariance = longRunVariance(selected.preGap, lag);
  const planningSe = planningVariance > 1e-20 ? Math.sqrt(planningVariance * (1 / validation + 1 / powerDays)) : null;
  const expectedEffect = plannedLift * selected.level;
  const power = planningSe ? 1 - mmmNormCdf(_Z975 - expectedEffect / planningSe) + mmmNormCdf(-_Z975 - expectedEffect / planningSe) : null;
  const mde = planningSe ? (_Z975 + 0.8416212335729143) * planningSe : null;
  const daily = dates.map((date, i) => ({ date: new Date(date).toISOString().slice(0, 10),
    actual: series.get(treatment)[i], synthetic: selected.predicted[i], gap: selected.gap[i],
    phase: i < train ? P("학습", "Training") : i < pre ? P("사전 검증", "Pre-validation") : P("실험 후", "Post-intervention") }));
  const candidates = [selected, ...placebos].map((fit) => ({ region: fit.region, nrmse: fit.nrmse,
    ratio: fit.ratio, eligible: fit.converged && fit.nrmse !== null && fit.nrmse <= maxNrmse ? P("통과", "Pass") : P("미충족", "Not met") }));
  return result({
    headline: effect.low > 0 ? P("사전 오차를 보정한 실험 후 차이가 양수입니다.", "The post-intervention difference is positive after pre-period bias adjustment.")
      : effect.high !== null && effect.high < 0 ? P("사전 오차를 보정한 실험 후 차이가 음수입니다.", "The post-intervention difference is negative after pre-period bias adjustment.")
        : P("합성 대조 대비 차이의 방향은 불확실합니다.", "The direction relative to synthetic control remains uncertain."),
    action: P("사전 검증 오차·지역 위약 비교·동시 시행 변화를 함께 검토하세요. 다음 설계는 사전 기간만으로 정하세요.",
      "Review pre-validation error, regional placebos and concurrent changes. Design the next study using pre-period information only."),
    metrics: [metric("effect", P("일평균 보정 차이", "Adjusted daily difference"), effect.estimate, "number", effect),
      metric("preError", P("사전 검증 NRMSE", "Pre-validation NRMSE"), selected.nrmse, "rate"),
      metric("placebo", P("위약 순위 p (교환 가능 조건)", "Placebo-rank p (conditional exchangeability)"), placeboP),
      metric("mde", P("계획 기간 80% 검정력 MDE 근사", "Approximate 80%-power MDE for planned duration"), mde)],
    tables: [table("daily", P("실제와 합성 대조", "Observed and synthetic control"), [
      column("date", P("날짜", "Date"), "text"), column("phase", P("기간 역할", "Period role"), "text"),
      column("actual", P("실제", "Observed")), column("synthetic", P("합성 대조", "Synthetic control")), column("gap", P("원시 차이", "Raw gap")),
    ], daily), table("weights", P("학습 기간으로 고정한 가중치", "Weights fixed from training"), [
      column("region", P("대조 지역", "Donor region"), "text"), column("weight", P("가중치", "Weight"), "rate"),
    ], donors.map((region, i) => ({ region, weight: selected.weights[i] }))),
    table("candidates", P("사전 적합과 사후 위약 진단", "Pre-fit and post-period placebo diagnostics"), [
      column("region", P("지역", "Region"), "text"), column("nrmse", P("사전 검증 NRMSE", "Pre-validation NRMSE"), "rate"),
      column("ratio", P("사후/사전 RMSPE", "Post/pre RMSPE")), column("eligible", P("사전 적합 기준", "Pre-fit criterion"), "text"),
    ], candidates), table("power", P("사전 오차 기반 설계 근사", "Design approximation from pre-period errors"), [
      column("days", P("계획 일수", "Planned days"), "integer"), column("lift", P("계획 상승률", "Planned relative effect"), "rate"),
      column("power", P("검정력 근사", "Approximate power"), "rate"), column("mde", P("80% MDE", "80% MDE")),
    ], [{ days: powerDays, lift: plannedLift, power, mde }])],
    method: P("사전 앞 60%로 비음수·합 1 합성 대조를 적합하고 나머지 40%로 검증합니다. 고정 가중치의 검증/사후 격차 회귀에 Newey–West HAC 95% 구간을 적용합니다. 검정력은 사전 장기분산의 정규 근사입니다.",
      "Fit nonnegative, sum-to-one synthetic control on the first 60% of pre-data; validate on the remaining 40%. A validation/post gap regression uses Newey–West HAC 95% intervals conditional on fixed weights. Power uses a normal approximation from pre-period long-run variance."),
    warnings: [P("GeoLift 패키지의 재현 구현이 아닙니다. HAC 구간은 대조 가중치의 선택 불확실성을 포함하지 않습니다. 위약 순위는 지역 교환 가능성이 없으면 인과 검정 p값이 아닙니다.",
      "This is not a reproduction of the GeoLift package. HAC intervals omit donor-weight selection uncertainty. Placebo ranks are not causal-test p-values without regional exchangeability."),
    P("지역 간 노출 누출·다른 정책 변화·사전 추세 불일치가 있으면 인과 해석을 보류하세요. 대조 지역이 적으면 위약 비교의 분해능이 낮습니다.",
      "Withhold causal interpretation under spillovers, concurrent changes or mismatched trends. Few donors limit placebo resolution.")],
    diagnostics: { treatment, trainDays: train, validationDays: validation, postDays: post, lag, preBias, rawPostGap,
      eligiblePlacebos: eligiblePlacebos.length, placeboResolution: 1 / (eligiblePlacebos.length + 1), maxNrmse, planningVariance },
    figure: { kind: "line", tableId: "daily", label: "date", value: "actual", comparison: "synthetic" },
  });
}
