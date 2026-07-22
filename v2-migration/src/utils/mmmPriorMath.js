import { mmmOls } from "./regMath";
import { mmmAdstock, mmmHill } from "./mmmMath";
import { studentTcrit } from "./statPrimitives";
import { mmmExcelSerialDateTimestamp, mmmParseNumericValue } from "./mmmInputUtils";

// 실험 원자료를 MMM 채널계수 prior로 바꾸는 순수 엔진.
// 점추정·표본 수로 임의 강도를 주지 않고, 실험 효과와 실제 집행 강도의 불확실성을
// 같은 설계에서 추정해 delta method(보수적으로 jackknife와 큰 쪽)로 전파한다.

function num(value) {
  return mmmParseNumericValue(value);
}

function treatmentIndicator(value) {
  const text = String(value ?? "").trim();
  if (/^(on|treat|treated|treatment|target|test|true|yes|y|1|처리|처리군|실험군)$/i.test(text)) return 1;
  if (/^(off|control|untreated|holdout|false|no|n|0|대조|대조군|통제|통제군)$/i.test(text)) return 0;
  return null;
}

function postIndicator(value) {
  const text = String(value ?? "").trim();
  if (/^(post|after|true|yes|y|1|사후)$/i.test(text)) return 1;
  if (/^(pre|before|false|no|n|0|사전)$/i.test(text)) return 0;
  return null;
}

function matrix(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function addOuter(target, left, right, scale) {
  for (let i = 0; i < left.length; i++) {
    for (let j = 0; j < right.length; j++) target[i][j] += scale * left[i] * right[j];
  }
}

function matmul(left, right) {
  return left.map((row) => right[0].map((_, j) => row.reduce((sum, value, k) => sum + value * right[k][j], 0)));
}

function sandwichSe(inv, meat, correction = 1) {
  const covariance = matmul(matmul(inv, meat), inv).map((row) => row.map((value) => value * correction));
  return covariance.map((row, i) => Math.sqrt(Math.max(0, row[i])));
}

function sandwichCovarianceAt(inv, meat, index, correction = 1) {
  const covariance = matmul(matmul(inv, meat), inv);
  return covariance[index]?.[index] * correction;
}

function hacSe(fit, X) {
  const n = X.length;
  const p = X[0].length;
  const lag = Math.min(n - 1, Math.max(0, Math.floor(4 * Math.pow(n / 100, 2 / 9))));
  const meat = matrix(p);
  fit.resid.forEach((residual, i) => addOuter(meat, X[i], X[i], residual * residual));
  for (let l = 1; l <= lag; l++) {
    const weight = 1 - l / (lag + 1);
    for (let i = l; i < n; i++) {
      const scale = weight * fit.resid[i] * fit.resid[i - l];
      addOuter(meat, X[i], X[i - l], scale);
      addOuter(meat, X[i - l], X[i], scale);
    }
  }
  return sandwichSe(fit.XtXinv, meat, n / Math.max(1, n - p));
}

function clusterSe(fit, X, clusterKeys) {
  const groups = new Map();
  X.forEach((row, i) => {
    const key = String(clusterKeys[i] ?? "");
    const score = groups.get(key) || Array(row.length).fill(0);
    row.forEach((value, j) => { score[j] += value * fit.resid[i]; });
    groups.set(key, score);
  });
  const count = groups.size;
  if (count < 4) return null;
  const meat = matrix(X[0].length);
  groups.forEach((score) => addOuter(meat, score, score, 1));
  const n = X.length, p = X[0].length;
  return sandwichSe(fit.XtXinv, meat, (count / (count - 1)) * ((n - 1) / Math.max(1, n - p)));
}

function fitWithDesignSe(X, y, method, clusterKeys) {
  const fit = mmmOls(X, y);
  if (!fit) return null;
  let se = fit.se;
  let ciMethod = "OLS";
  if (method === "cluster") {
    const clustered = clusterSe(fit, X, clusterKeys || []);
    // Geo prior는 지역 내 상관을 무시한 OLS SE로 조용히 후퇴하면 안 된다.
    // cluster covariance가 식별되지 않으면 해당 실험 자체를 보류한다.
    if (!clustered?.every(Number.isFinite)) return null;
    se = clustered;
    ciMethod = "Geo cluster-robust";
  } else if (method === "hac") {
    const robust = hacSe(fit, X);
    // 시계열 prior도 HAC가 실패하면 독립 OLS SE로 조용히 후퇴하지 않는다.
    if (!robust.every(Number.isFinite)) return null;
    se = robust;
    ciMethod = "HAC";
  }
  return { ...fit, se, ciMethod };
}

function fiellerRatioInterval(estimate, criticalValue) {
  if (!estimate || !(criticalValue > 0)) return null;
  const a = estimate.effect;
  const b = estimate.exposureEffect;
  const varianceA = estimate.effectSe ** 2;
  const varianceB = estimate.exposureSe ** 2;
  const covariance = estimate.effectExposureCovariance;
  if (![a, b, varianceA, varianceB, covariance].every(Number.isFinite)) return null;
  const c2 = criticalValue ** 2;
  const quadratic = b ** 2 - c2 * varianceB;
  const linearHalf = a * b - c2 * covariance;
  const constant = a ** 2 - c2 * varianceA;
  const discriminant = linearHalf ** 2 - quadratic * constant;
  // A<=0이면 denominator가 90% 수준에서 0과 구분되지 않아 bounded ratio
  // interval이 존재하지 않는다. disjoint/unbounded Fieller 집합도 prior로 쓰지 않는다.
  if (!(quadratic > 0) || !(discriminant >= 0)) return null;
  const root = Math.sqrt(Math.max(0, discriminant));
  const low = (linearHalf - root) / quadratic;
  const high = (linearHalf + root) / quadratic;
  return Number.isFinite(low) && Number.isFinite(high)
    ? [Math.min(low, high), Math.max(low, high)]
    : null;
}

function geoTransformAlignment(targetSpend, targetTimes, evidenceRows, timeHeader, params) {
  if (!Array.isArray(targetSpend) || !targetSpend.length || !Array.isArray(targetTimes)
    || targetTimes.length !== targetSpend.length || !timeHeader) return null;
  const spend = targetSpend.map(num);
  if (spend.some((value) => !Number.isFinite(value) || value < 0)) return null;
  const periodKey = (value) => {
    const parsed = experimentTimeKey(value);
    if (!parsed) return null;
    const periodValue = parsed.kind === "date" ? mondayTimestamp(parsed.value) : parsed.value;
    return `${parsed.kind}:${periodValue}`;
  };
  const evidencePeriods = new Set((evidenceRows || []).map((row) => periodKey(row?.[timeHeader])).filter(Boolean));
  if (!evidencePeriods.size) return null;
  const adstock = mmmAdstock(spend, params.alpha);
  const overlap = targetTimes.map((value, index) => ({ key: periodKey(value), value: adstock[index] }))
    .filter((item) => item.key && evidencePeriods.has(item.key) && Number.isFinite(item.value) && item.value > 0)
    .map((item) => item.value);
  // 한두 주 우연히 겹친 운용점으로 비선형 단위를 정하지 않는다.
  if (overlap.length < 4) return null;
  const basis = overlap.reduce((sum, value) => sum + value, 0) / overlap.length;
  if (!(basis > 0) || !(params.ec > 0) || !(params.slope > 0)) return null;
  const hill = mmmHill(basis, params.ec, params.slope);
  // d Hill(A) / d A = slope * H * (1-H) / A. Geo별 adstock는 합산 가능하지만
  // Hill은 비선형이므로, raw Geo DiD를 national feature coefficient로 옮길 때
  // 타깃 시장의 최근 adstock 운용점에서 이 미분값으로 단위를 맞춘다.
  const derivative = params.slope * hill * (1 - hill) / basis;
  return Number.isFinite(derivative) && derivative > 1e-12
    ? { basisAdstock: basis, hill, derivative, basisWeeks: overlap.length }
    : null;
}

// Outcome 효과와 transformed-exposure 효과는 같은 행·같은 설계행렬에서 추정된다.
// 두 계수의 covariance를 0으로 두면 ratio delta variance가 실제 joint sampling
// variation과 달라지므로 OLS/HAC/cluster 각각 동일한 sandwich score로 계산한다.
function coefficientCrossCovariance(effectFit, exposureFit, X, effectIndex, method, clusterKeys) {
  const n = X.length;
  const p = X[0].length;
  const inv = effectFit.XtXinv;
  if (method === "cluster" && effectFit.ciMethod === "Geo cluster-robust" && exposureFit.ciMethod === "Geo cluster-robust") {
    const groups = new Map();
    X.forEach((row, i) => {
      const key = String(clusterKeys?.[i] ?? "");
      const scores = groups.get(key) || { outcome: Array(p).fill(0), exposure: Array(p).fill(0) };
      row.forEach((value, j) => {
        scores.outcome[j] += value * effectFit.resid[i];
        scores.exposure[j] += value * exposureFit.resid[i];
      });
      groups.set(key, scores);
    });
    const count = groups.size;
    if (count < 4) return null;
    const meat = matrix(p);
    groups.forEach((scores) => addOuter(meat, scores.outcome, scores.exposure, 1));
    return sandwichCovarianceAt(inv, meat, effectIndex, (count / (count - 1)) * ((n - 1) / Math.max(1, n - p)));
  }
  if (method === "hac" && effectFit.ciMethod === "HAC" && exposureFit.ciMethod === "HAC") {
    const lag = Math.min(n - 1, Math.max(0, Math.floor(4 * Math.pow(n / 100, 2 / 9))));
    const meat = matrix(p);
    effectFit.resid.forEach((residual, i) => addOuter(meat, X[i], X[i], residual * exposureFit.resid[i]));
    for (let l = 1; l <= lag; l++) {
      const weight = 1 - l / (lag + 1);
      for (let i = l; i < n; i++) {
        addOuter(meat, X[i], X[i - l], weight * effectFit.resid[i] * exposureFit.resid[i - l]);
        addOuter(meat, X[i - l], X[i], weight * effectFit.resid[i - l] * exposureFit.resid[i]);
      }
    }
    return sandwichCovarianceAt(inv, meat, effectIndex, n / Math.max(1, n - p));
  }
  const residualCross = effectFit.resid.reduce((sum, value, i) => sum + value * exposureFit.resid[i], 0) / Math.max(1, n - p);
  return residualCross * inv[effectIndex][effectIndex];
}

function ratioEstimate(X, target, exposure, effectIndex, method, clusterKeys) {
  const effectFit = fitWithDesignSe(X, target, method, clusterKeys);
  const exposureFit = fitWithDesignSe(X, exposure, method, clusterKeys);
  if (!effectFit || !exposureFit) return null;
  const effect = effectFit.beta[effectIndex];
  const exposureEffect = exposureFit.beta[effectIndex];
  const effectSe = effectFit.se[effectIndex];
  const exposureSe = exposureFit.se[effectIndex];
  if (![effect, exposureEffect, effectSe, exposureSe].every(Number.isFinite) || Math.abs(exposureEffect) < 1e-8) return null;
  const mean = effect / exposureEffect;
  const covariance = coefficientCrossCovariance(effectFit, exposureFit, X, effectIndex, method, clusterKeys);
  if (!Number.isFinite(covariance)) return null;
  const deltaVarianceIgnoringCovariance = (effectSe / exposureEffect) ** 2 + ((effect * exposureSe) / (exposureEffect ** 2)) ** 2;
  const covarianceAdjustment = -2 * effect * covariance / (exposureEffect ** 3);
  const deltaVariance = deltaVarianceIgnoringCovariance + covarianceAdjustment;
  return {
    mean,
    effect,
    effectSe,
    exposureEffect,
    exposureSe,
    effectExposureCovariance: covariance,
    covarianceAdjustment,
    deltaVarianceIgnoringCovariance,
    variance: Math.max(0, deltaVariance),
    ciMethod: effectFit.ciMethod,
  };
}

function jackknifeSe(X, target, exposure, effectIndex, method, clusterKeys) {
  const n = X.length;
  const p = X[0].length;
  // Geo 실험은 시간순 행 블록이 아니라 지역 하나를 통째로 빼야 지역 간
  // 전이 가능성과 특정 지역 의존도를 실제로 반영한다.
  if (method === "cluster" && clusterKeys?.length) {
    const clusters = [...new Set(clusterKeys.map((key) => String(key ?? "")))];
    if (clusters.length < 3) return null;
    const estimates = [];
    for (const omitted of clusters) {
      const keep = Array.from({ length: n }, (_, i) => i).filter((i) => String(clusterKeys[i] ?? "") !== omitted);
      const subTarget = keep.map((i) => target[i]);
      const subExposure = keep.map((i) => exposure[i]);
      let columnIndices = Array.from({ length: X[0].length }, (_, i) => i);
      let estimate = null;
      // 한 geo를 빼면 해당 dummy가 전부 0이 되거나, 기준 geo를 뺄 때 intercept와
      // 남은 geo dummy 합이 완전공선이 된다. 효과 interaction은 보존하고 nuisance
      // column을 하나씩 제거해 식별 가능한 leave-one-geo 설계로 축약한다.
      while (!estimate && columnIndices.length > 2) {
        const subX = keep.map((i) => columnIndices.map((j) => X[i][j]));
        const subEffectIndex = columnIndices.indexOf(effectIndex);
        estimate = ratioEstimate(subX, subTarget, subExposure, subEffectIndex, "ols", null);
        if (estimate) break;
        let reduced = false;
        for (let pos = 1; pos < columnIndices.length; pos++) {
          if (columnIndices[pos] === effectIndex) continue;
          const trialColumns = columnIndices.filter((_, index) => index !== pos);
          const trialX = keep.map((i) => trialColumns.map((j) => X[i][j]));
          const trial = ratioEstimate(trialX, subTarget, subExposure, trialColumns.indexOf(effectIndex), "ols", null);
          if (trial) {
            estimate = trial;
            reduced = true;
            break;
          }
        }
        if (!estimate && !reduced) break;
      }
      if (estimate && Number.isFinite(estimate.mean)) estimates.push(estimate.mean);
    }
    // 일부 삭제 표본만 성공한 값으로 SE를 만들면 "잘 맞는 geo만" 선택하는 셈이다.
    // 모든 leave-one-geo-out 적합이 성공할 때만 LOCO 불확실성을 인정한다.
    if (estimates.length !== clusters.length) return null;
    const mean = estimates.reduce((sum, value) => sum + value, 0) / estimates.length;
    return Math.sqrt(((estimates.length - 1) / estimates.length) * estimates.reduce((sum, value) => sum + (value - mean) ** 2, 0));
  }
  const blocks = Math.min(6, Math.floor(n / Math.max(5, p + 2)));
  if (blocks < 3) return null;
  const estimates = [];
  for (let block = 0; block < blocks; block++) {
    const start = Math.floor((block * n) / blocks);
    const end = Math.floor(((block + 1) * n) / blocks);
    const keep = Array.from({ length: n }, (_, i) => i).filter((i) => i < start || i >= end);
    const estimate = ratioEstimate(
      keep.map((i) => X[i]),
      keep.map((i) => target[i]),
      keep.map((i) => exposure[i]),
      effectIndex,
      method,
      keep.map((i) => clusterKeys?.[i]),
    );
    if (estimate && Number.isFinite(estimate.mean)) estimates.push(estimate.mean);
  }
  if (estimates.length < 3) return null;
  const mean = estimates.reduce((sum, value) => sum + value, 0) / estimates.length;
  return Math.sqrt(((estimates.length - 1) / estimates.length) * estimates.reduce((sum, value) => sum + (value - mean) ** 2, 0));
}

const DAY_MS = 86400000;

function isoWeekMonday(year, week) {
  if (!(year >= 1900) || !(week >= 1 && week <= 53)) return null;
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Day = new Date(jan4).getUTCDay() || 7;
  const timestamp = jan4 - (jan4Day - 1) * DAY_MS + (week - 1) * 7 * DAY_MS;
  // ISO week-year is defined by the Thursday contained in the week. This also
  // rejects impossible W53 values for years that only have 52 ISO weeks.
  if (new Date(timestamp + 3 * DAY_MS).getUTCFullYear() !== year) return null;
  return timestamp;
}

function experimentTimeKey(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const isoWeek = text.match(/^(\d{4})\s*-?\s*W\s*(\d{1,2})$/i);
  if (isoWeek) {
    const timestamp = isoWeekMonday(Number(isoWeek[1]), Number(isoWeek[2]));
    return timestamp == null ? null : { kind: "date", value: timestamp, source: "iso-week" };
  }
  const calendar = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (calendar) {
    const year = Number(calendar[1]), month = Number(calendar[2]), day = Number(calendar[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const parsed = new Date(timestamp);
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
    return { kind: "date", value: timestamp, source: "calendar-date" };
  }
  const excelTimestamp = mmmExcelSerialDateTimestamp(value);
  if (excelTimestamp != null) return { kind: "date", value: excelTimestamp, source: "excel-serial-date" };
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return { kind: "index", value: Number(text), source: "numeric-week" };
  return null;
}

function mondayTimestamp(timestamp) {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.getTime();
}

function formatMonday(timestamp) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function sortRows(rows, timeHeader) {
  const indexed = rows.map((row, index) => ({ row, index }));
  // 시간 컬럼이 없으면 원자료 순서가 유일한 시계열 계약이다.
  if (!timeHeader) return indexed;
  return indexed.sort((a, b) => {
    const left = experimentTimeKey(a.row[timeHeader]);
    const right = experimentTimeKey(b.row[timeHeader]);
    if (left && right && left.kind === right.kind) return left.value - right.value || a.index - b.index;
    return a.index - b.index;
  });
}

function aggregateExperimentWeeks(rows, {
  targetHeader,
  spendHeader,
  stateHeader,
  armHeader,
  periodHeader,
  timeHeader,
  geoHeader,
}) {
  const emptyMeta = { droppedMixedWeeks: 0, droppedMissingWeeks: 0, droppedUnknownCategoryWeeks: 0, droppedUnparseableRows: 0, boundaryPartialWeeks: 0, internalPartialWeeks: 0, missingTimePeriods: 0, timeGaps: [], incompatibleTimeKinds: false, duplicateProvidedPeriods: 0 };
  if (!timeHeader) return { rows, cadence: "input-order", sourceN: rows.length, hasCanonicalTime: false, ...emptyMeta };
  const parsedRows = rows.map((row, index) => ({ row, index, time: experimentTimeKey(row?.[timeHeader]) }));
  const validRows = parsedRows.filter((item) => item.time);
  if (!validRows.length) return { rows, cadence: "provided-period", sourceN: rows.length, hasCanonicalTime: false, ...emptyMeta };
  const timeKinds = new Set(validRows.map((item) => item.time.kind));
  const incompatibleTimeKinds = timeKinds.size > 1;
  const groups = new Map();
  let droppedUnparseableRows = rows.length - validRows.length;
  validRows.forEach(({ row, time }) => {
    const periodValue = time.kind === "date" ? mondayTimestamp(time.value) : time.value;
    const periodLabel = time.kind === "date" ? formatMonday(periodValue) : String(periodValue);
    const geo = geoHeader ? String(row?.[geoHeader] ?? "") : "";
    const key = `${geo}\u0001${time.kind}\u0001${periodValue}`;
    let item = groups.get(key);
    if (!item) {
      item = {
        row: { ...row, [timeHeader]: periodLabel, [targetHeader]: 0, [spendHeader]: 0 },
        states: new Set(), arms: new Set(), periods: new Set(),
        rowCount: 0, targetCount: 0, spendCount: 0, hasUnknownCategory: false,
        geo,
        periodValue,
        timeKind: time.kind,
        sources: new Set(),
        distinctDates: new Set(),
        duplicateDailyRows: 0,
      };
    }
    item.sources.add(time.source);
    if (time.source === "calendar-date") {
      if (item.distinctDates.has(time.value)) item.duplicateDailyRows += 1;
      item.distinctDates.add(time.value);
    }
    item.rowCount += 1;
    const target = num(row?.[targetHeader]);
    const spend = num(row?.[spendHeader]);
    if (Number.isFinite(target)) {
      item.row[targetHeader] += target;
      item.targetCount += 1;
    }
    if (Number.isFinite(spend)) {
      item.row[spendHeader] += spend;
      item.spendCount += 1;
    }
    if (stateHeader) {
      const indicator = treatmentIndicator(row?.[stateHeader]);
      if (indicator == null) item.hasUnknownCategory = true;
      else item.states.add(indicator ? "treatment" : "control");
    }
    if (armHeader) {
      const indicator = treatmentIndicator(row?.[armHeader]);
      if (indicator == null) item.hasUnknownCategory = true;
      else item.arms.add(indicator ? "treatment" : "control");
    }
    if (periodHeader) {
      const indicator = postIndicator(row?.[periodHeader]);
      if (indicator == null) item.hasUnknownCategory = true;
      else item.periods.add(indicator ? "post" : "pre");
    }
    groups.set(key, item);
  });
  let droppedMixedWeeks = 0;
  let droppedMissingWeeks = 0;
  let droppedUnknownCategoryWeeks = 0;
  let duplicateProvidedPeriods = 0;
  const accepted = [];
  groups.forEach((item) => {
    if (item.targetCount !== item.rowCount || item.spendCount !== item.rowCount) {
      droppedMissingWeeks += 1;
      return;
    }
    if (item.hasUnknownCategory) {
      droppedUnknownCategoryWeeks += 1;
      return;
    }
    // 주중에 treatment 상태/arm/period가 바뀐 경계 주는 하나의 주간 처리효과로
    // 정의할 수 없으므로 보수적으로 제외한다.
    if (item.states.size > 1 || item.arms.size > 1 || item.periods.size > 1) {
      droppedMixedWeeks += 1;
      return;
    }
    if (!item.sources.has("calendar-date") && item.rowCount > 1) {
      duplicateProvidedPeriods += 1;
      return;
    }
    if (item.duplicateDailyRows > 0) {
      duplicateProvidedPeriods += item.duplicateDailyRows;
      return;
    }
    if (stateHeader && item.states.size) item.row[stateHeader] = [...item.states][0];
    if (armHeader && item.arms.size) item.row[armHeader] = [...item.arms][0];
    if (periodHeader && item.periods.size) item.row[periodHeader] = [...item.periods][0];
    accepted.push(item);
  });

  // 일자 원자료만 5일/7일 cadence를 판정한다. 주별 원자료(주당 1행)는 이
  // 검사 대상이 아니다. 첫·마지막 경계 partial은 제외하고, 내부 partial은
  // prior 생성 자체를 막을 수 있도록 별도 진단한다.
  const dailyCounts = accepted.filter((item) => item.sources.has("calendar-date")).map((item) => item.distinctDates.size);
  const countFreq = new Map();
  dailyCounts.forEach((count) => countFreq.set(count, (countFreq.get(count) || 0) + 1));
  const modalDays = [...countFreq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] || 0;
  const expectedDaysPerWeek = modalDays >= 5 ? (modalDays >= 6 ? 7 : 5) : null;
  const byGeo = new Map();
  accepted.forEach((item) => {
    if (!byGeo.has(item.geo)) byGeo.set(item.geo, []);
    byGeo.get(item.geo).push(item);
  });
  let boundaryPartialWeeks = 0;
  let internalPartialWeeks = 0;
  const kept = [];
  byGeo.forEach((items) => {
    items.sort((a, b) => a.periodValue - b.periodValue);
    items.forEach((item, index) => {
      if (expectedDaysPerWeek && item.sources.has("calendar-date") && item.distinctDates.size !== expectedDaysPerWeek) {
        if (index === 0 || index === items.length - 1) boundaryPartialWeeks += 1;
        else {
          internalPartialWeeks += 1;
          kept.push(item);
        }
      } else kept.push(item);
    });
  });

  const continuityGroups = new Map();
  kept.forEach((item) => {
    if (!continuityGroups.has(item.geo)) continuityGroups.set(item.geo, []);
    continuityGroups.get(item.geo).push(item);
  });
  const timeGaps = [];
  let missingTimePeriods = 0;
  continuityGroups.forEach((items, geo) => {
    items.sort((a, b) => a.periodValue - b.periodValue);
    for (let i = 1; i < items.length; i++) {
      const previous = items[i - 1], current = items[i];
      const distance = current.timeKind === "date"
        ? Math.round((current.periodValue - previous.periodValue) / (7 * DAY_MS))
        : Math.round(current.periodValue - previous.periodValue);
      const missing = Math.max(0, distance - 1);
      if (missing) {
        missingTimePeriods += missing;
        timeGaps.push({ geo, after: previous.row[timeHeader], before: current.row[timeHeader], missing });
      }
    }
  });
  const cadence = expectedDaysPerWeek ? "monday-week" : "provided-week";
  return {
    rows: kept.map((item) => item.row),
    cadence,
    sourceN: rows.length,
    hasCanonicalTime: true,
    droppedMixedWeeks,
    droppedMissingWeeks,
    droppedUnknownCategoryWeeks,
    droppedUnparseableRows,
    boundaryPartialWeeks,
    internalPartialWeeks,
    expectedDaysPerWeek,
    missingTimePeriods,
    timeGaps,
    incompatibleTimeKinds,
    duplicateProvidedPeriods,
  };
}

const EXPERIMENT_FAILURE_COPY = {
  "invalid-input": ["실험 prior 필수 입력이 없습니다.", "Required experiment-prior inputs are missing."],
  "missing-experiment-time": ["On/Off 실험에는 정렬 가능한 날짜/주차 컬럼이 필요합니다.", "On/Off experiments require a sortable date/week column."],
  "missing-geo-time": ["Geo 실험에는 비교 가능한 날짜/주차 컬럼이 필요합니다.", "Geo experiments require a comparable date/week column."],
  "unparseable-time-axis": ["시간 컬럼을 주차로 해석할 수 없어 prior를 만들지 않았습니다.", "The time column could not be parsed into weekly periods, so no prior was created."],
  "mixed-time-axis": ["날짜형과 숫자형 주차가 섞여 있어 prior를 만들지 않았습니다.", "Date-based and numeric week values are mixed, so no prior was created."],
  "duplicate-time-period": ["주별 원자료에 같은 주차가 중복되어 prior를 만들지 않았습니다.", "The weekly source contains duplicate periods, so no prior was created."],
  "partial-internal-week": ["일자 원자료의 내부 주차에 날짜가 빠져 있어 prior를 만들지 않았습니다.", "An internal week is incomplete in the daily source, so no prior was created."],
  "missing-time-period": ["실험 시계열에 빠진 주차가 있어 잔효를 안전하게 계산할 수 없습니다.", "The experiment time series has missing weeks, so carryover cannot be computed safely."],
  "insufficient-data": ["실험 prior를 추정할 유효 주차가 부족합니다.", "There are too few usable weeks to estimate an experiment prior."],
  "invalid-treatment-design": ["처리·대조 또는 사전·사후 상태를 식별할 수 없습니다.", "Treatment/control or pre/post states are not identifiable."],
  "insufficient-state-replication": ["On/Off 상태의 반복 구간이 부족합니다.", "The On/Off states are not replicated enough."],
  "unsupported-design": ["지원되는 On/Off 또는 Geo 실험 설계를 찾지 못했습니다.", "No supported On/Off or Geo design was found."],
  "non-independent-outcome-reuse": ["메인 MMM과 같은 주의 동일 KPI가 실험 결과에 그대로 재사용되어 prior를 적용하지 않았습니다.", "No prior was applied because the experiment reuses the same KPI values for the same weeks as the main MMM."],
  "outcome-reuse-not-comparable": ["메인 MMM과 실험의 시간축을 서로 비교할 수 없어 동일 KPI 중복 사용을 배제할 수 없습니다.", "No prior was applied because the main MMM and experiment clocks are not comparable, so duplicate KPI reuse cannot be ruled out."],
  "fit-failed": ["실험 효과와 처리 강도를 안정적으로 추정할 수 없습니다.", "The experiment effect and treatment intensity could not be estimated stably."],
  "weak-treatment-intensity": ["처리 강도 차이가 불확실해 효과/강도 비율 prior가 불안정합니다.", "The treatment-intensity contrast is too uncertain for a stable effect/intensity ratio prior."],
  "unbounded-ratio-interval": ["효과/처리강도 비율의 Fieller 90% 구간이 유한하지 않아 prior를 적용하지 않았습니다.", "No prior was applied because the Fieller 90% interval for the effect/intensity ratio is unbounded."],
  "geo-unit-alignment-failed": ["Geo 효과를 타깃 국가의 Hill 계수 단위로 정렬할 수 없습니다.", "The Geo effect could not be aligned to the target market's Hill-coefficient unit."],
  "invalid-variance": ["실험 prior 분산을 안정적으로 계산할 수 없습니다.", "The experiment-prior variance could not be computed stably."],
};

function failedExperimentPrior(reason, metadata = {}) {
  let [messageKo, messageEn] = EXPERIMENT_FAILURE_COPY[reason] || [reason, reason];
  if (reason === "insufficient-data") {
    const detailsKo = [];
    const detailsEn = [];
    if (Number.isFinite(metadata.usableWeeks)) {
      detailsKo.push(`사용 가능한 주/행 ${metadata.usableWeeks}개`);
      detailsEn.push(`${metadata.usableWeeks} usable week(s)/row(s)`);
    }
    if (Number.isFinite(metadata.minimumUsableWeeks)) {
      detailsKo.push(`최소 ${metadata.minimumUsableWeeks}개 필요`);
      detailsEn.push(`minimum ${metadata.minimumUsableWeeks} required`);
    }
    if (Number.isFinite(metadata.geoCount)) {
      detailsKo.push(`Geo ${metadata.geoCount}개`);
      detailsEn.push(`${metadata.geoCount} geo(s)`);
    }
    if (Number.isFinite(metadata.minimumGeoCount)) {
      detailsKo.push(`최소 Geo ${metadata.minimumGeoCount}개 필요`);
      detailsEn.push(`minimum ${metadata.minimumGeoCount} geos required`);
    }
    if (Number.isFinite(metadata.residualDf)) {
      detailsKo.push(`잔여 자유도 ${metadata.residualDf}`);
      detailsEn.push(`residual df ${metadata.residualDf}`);
    }
    if (detailsKo.length) {
      messageKo += ` (${detailsKo.join(" · ")})`;
      messageEn += ` (${detailsEn.join(" · ")}).`;
    }
  }
  if (reason === "insufficient-state-replication") {
    messageKo += ` (ON ${metadata.onWeeks ?? 0}주 · OFF ${metadata.offWeeks ?? 0}주 · 전환 ${metadata.transitionCount ?? 0}회; 상태별 최소 ${metadata.minimumWeeksPerState ?? 4}주·전환 최소 ${metadata.minimumTransitions ?? 2}회)`;
    messageEn += ` (ON ${metadata.onWeeks ?? 0} weeks · OFF ${metadata.offWeeks ?? 0} weeks · ${metadata.transitionCount ?? 0} transitions; minimum ${metadata.minimumWeeksPerState ?? 4} weeks per state and ${metadata.minimumTransitions ?? 2} transitions).`;
  }
  return { prior: null, diagnostic: { ok: false, reason, messageKo, messageEn, ...metadata } };
}

function compactWeeklyDiagnostic(weekly) {
  const metadata = { ...(weekly || {}) };
  delete metadata.rows;
  return metadata;
}

function experimentOutcomeReuseDiagnostic(weeklyRows, timeHeader, targetHeader, targetTimes, targetValues) {
  if (!timeHeader || !Array.isArray(targetTimes) || !Array.isArray(targetValues) || targetTimes.length !== targetValues.length) {
    return { outcomeOverlapWeeks: 0, outcomeExactMatchWeeks: 0, outcomeExactMatchShare: null, outcomeIndependenceCheck: "not-comparable" };
  }
  const keyOf = (value) => {
    const parsed = experimentTimeKey(value);
    if (!parsed) return null;
    return `${parsed.kind}:${parsed.kind === "date" ? mondayTimestamp(parsed.value) : parsed.value}`;
  };
  const target = new Map();
  const targetKinds = new Set();
  targetTimes.forEach((value, index) => {
    const parsed = experimentTimeKey(value);
    const key = keyOf(value);
    const outcome = num(targetValues[index]);
    if (key && Number.isFinite(outcome)) {
      target.set(key, outcome);
      targetKinds.add(parsed.kind);
    }
  });
  const evidenceByTime = new Map();
  const evidenceKinds = new Set();
  (weeklyRows || []).forEach((row) => {
    const parsed = experimentTimeKey(row?.[timeHeader]);
    const key = keyOf(row?.[timeHeader]);
    const evidenceOutcome = num(row?.[targetHeader]);
    if (!key || !Number.isFinite(evidenceOutcome)) return;
    evidenceKinds.add(parsed.kind);
    if (!evidenceByTime.has(key)) evidenceByTime.set(key, []);
    evidenceByTime.get(key).push(evidenceOutcome);
  });
  if (targetKinds.size !== 1 || evidenceKinds.size !== 1 || [...targetKinds][0] !== [...evidenceKinds][0]) {
    return {
      outcomeOverlapWeeks: 0,
      outcomeOverlapObservations: 0,
      outcomeExactMatchWeeks: 0,
      outcomeExactMatchShare: null,
      outcomeIndependenceCheck: "not-comparable",
      targetTimeKinds: [...targetKinds],
      experimentTimeKinds: [...evidenceKinds],
      isLikelyOutcomeReuse: false,
    };
  }
  const overlapKeys = [...evidenceByTime.keys()].filter((key) => target.has(key));
  const overlap = overlapKeys.length;
  const overlapObservations = overlapKeys.reduce((sum, key) => sum + evidenceByTime.get(key).length, 0);
  const exact = overlapKeys.reduce((count, key) => {
    const outcomes = evidenceByTime.get(key);
    const targetOutcome = target.get(key);
    return count + (outcomes.length === 1 && Math.abs(outcomes[0] - targetOutcome) <= 1e-8 * Math.max(1, Math.abs(outcomes[0]), Math.abs(targetOutcome)) ? 1 : 0);
  }, 0);
  const share = overlap ? exact / overlap : null;
  return {
    outcomeOverlapWeeks: overlap,
    outcomeOverlapObservations: overlapObservations,
    outcomeExactMatchWeeks: exact,
    outcomeExactMatchShare: share,
    outcomeIndependenceCheck: overlap ? "overlap-not-proven-independent" : "no-overlap-detected",
    isLikelyOutcomeReuse: overlap >= 4 && share >= 0.95,
  };
}

// On/Off 또는 Geo DiD 원자료 → Normal(mean, variance) prior와 실패 진단.
// 기존 호출자는 buildExperimentMediaPrior의 prior|null 계약을 유지하고, UI는 이
// detailed API로 gap·약한 처리강도 같은 거절 이유를 노출할 수 있다.
export function buildExperimentMediaPriorDetailed(rows, {
  targetHeader,
  spendHeader,
  stateHeader = null,
  armHeader = null,
  periodHeader = null,
  timeHeader = null,
  geoHeader = null,
  targetSpend = null,
  targetTimes = null,
  targetValues = null,
  params,
} = {}) {
  if (!rows?.length || !targetHeader || !spendHeader || !params) return failedExperimentPrior("invalid-input");
  const isGeoDid = !!(geoHeader && armHeader && periodHeader);
  if (!timeHeader) return failedExperimentPrior(isGeoDid ? "missing-geo-time" : "missing-experiment-time", isGeoDid ? { minimumGeoCount: 4 } : {});
  const weekly = aggregateExperimentWeeks(rows, {
    targetHeader, spendHeader, stateHeader, armHeader, periodHeader, timeHeader, geoHeader: isGeoDid ? geoHeader : null,
  });
  const weeklyMeta = compactWeeklyDiagnostic(weekly);
  if (timeHeader && !weekly.hasCanonicalTime) return failedExperimentPrior("unparseable-time-axis", weeklyMeta);
  if (weekly.incompatibleTimeKinds) return failedExperimentPrior("mixed-time-axis", weeklyMeta);
  if (weekly.duplicateProvidedPeriods > 0) return failedExperimentPrior("duplicate-time-period", weeklyMeta);
  if (weekly.internalPartialWeeks > 0) return failedExperimentPrior("partial-internal-week", weeklyMeta);
  if (weekly.missingTimePeriods > 0) return failedExperimentPrior("missing-time-period", weeklyMeta);
  const ordered = sortRows(weekly.rows, timeHeader);
  const usable = ordered.filter(({ row }) => Number.isFinite(num(row[targetHeader])) && Number.isFinite(num(row[spendHeader])));
  const usableUniquePeriods = new Set(usable.map(({ row }) => String(row?.[timeHeader] ?? ""))).size;
  if (usable.length < 8) return failedExperimentPrior("insufficient-data", { ...weeklyMeta, usableWeeks: usable.length, minimumUsableWeeks: 16 });
  const spend = usable.map(({ row }) => num(row[spendHeader]));
  // Geo 패널은 지역별로 adstock 상태를 분리한다. Geo별 Hill을 적용한 뒤 합치면
  // ΣHill(spend_geo) != Hill(Σspend)가 되어 national MMM 계수 단위와 맞지 않는다.
  // 따라서 Geo DiD는 합산 가능한 raw adstock 단위로 추정하고, 아래에서 타깃
  // national Hill의 국소 미분으로 coefficient 단위를 변환한다.
  const exposure = Array(usable.length).fill(0);
  if (isGeoDid) {
    const byGeo = new Map();
    usable.forEach(({ row }, index) => {
      const key = String(row[geoHeader] ?? "");
      if (!byGeo.has(key)) byGeo.set(key, []);
      byGeo.get(key).push(index);
    });
    byGeo.forEach((indices) => {
      const transformed = mmmAdstock(indices.map((index) => spend[index]), params.alpha);
      indices.forEach((index, localIndex) => { exposure[index] = transformed[localIndex]; });
    });
  } else {
    mmmAdstock(spend, params.alpha)
      .map((value) => mmmHill(value, params.ec, params.slope))
      .forEach((value, index) => { exposure[index] = value; });
  }
  const target = usable.map(({ row }) => num(row[targetHeader]));
  let X = null;
  let effectIndex = -1;
  let method = "hac";
  let clusterKeys = null;
  let design = null;
  let onWeeks = null;
  let offWeeks = null;
  let transitionCount = null;
  if (armHeader && periodHeader) {
    const treated = usable.map(({ row }) => treatmentIndicator(row[armHeader]));
    const post = usable.map(({ row }) => postIndicator(row[periodHeader]));
    if (treated.some((value) => value == null) || post.some((value) => value == null)
      || !treated.some(Boolean) || treated.every(Boolean) || !post.some(Boolean) || post.every(Boolean)) {
      return failedExperimentPrior("invalid-treatment-design", weeklyMeta);
    }
    if (isGeoDid && timeHeader) {
      const geoValues = usable.map(({ row }) => String(row[geoHeader] ?? "").trim());
      if (geoValues.some((value) => !value)) return failedExperimentPrior("invalid-treatment-design", { ...weeklyMeta, designIssue: "blank-geo" });
      const geoKeys = [...new Set(geoValues)];
      const timeKeys = [...new Set(usable.map(({ row }) => String(row[timeHeader] ?? "")))];
      if (geoKeys.length < 4 || timeKeys.length < 2) return failedExperimentPrior("insufficient-data", { ...weeklyMeta, usableWeeks: usable.length, minimumUsableWeeks: 16, geoCount: geoKeys.length, minimumGeoCount: 4 });
      const armsByGeo = new Map();
      const periodsByGeo = new Map();
      const periodsByTime = new Map();
      const treatmentCells = new Set();
      usable.forEach(({ row }, index) => {
        const geo = geoValues[index];
        const time = String(row[timeHeader] ?? "");
        if (!armsByGeo.has(geo)) armsByGeo.set(geo, new Set());
        if (!periodsByGeo.has(geo)) periodsByGeo.set(geo, new Set());
        if (!periodsByTime.has(time)) periodsByTime.set(time, new Set());
        armsByGeo.get(geo).add(treated[index]);
        periodsByGeo.get(geo).add(post[index]);
        periodsByTime.get(time).add(post[index]);
        treatmentCells.add(`${treated[index]}:${post[index]}`);
      });
      const hasSwitchingArm = [...armsByGeo.values()].some((values) => values.size !== 1);
      const treatedGeoCount = [...armsByGeo.values()].filter((values) => values.has(1)).length;
      const controlGeoCount = [...armsByGeo.values()].filter((values) => values.has(0)).length;
      const hasIncompleteGeoPeriod = [...periodsByGeo.values()].some((values) => values.size !== 2);
      const hasMixedTimePeriod = [...periodsByTime.values()].some((values) => values.size !== 1);
      if (hasSwitchingArm || treatedGeoCount < 2 || controlGeoCount < 2 || hasIncompleteGeoPeriod || hasMixedTimePeriod || treatmentCells.size !== 4) {
        return failedExperimentPrior("invalid-treatment-design", {
          ...weeklyMeta,
          geoCount: geoKeys.length,
          designIssue: hasSwitchingArm
            ? "arm-varies-within-geo"
            : treatedGeoCount < 2 || controlGeoCount < 2
              ? "minimum-two-geos-per-arm"
            : hasMixedTimePeriod
              ? "period-varies-within-time"
              : hasIncompleteGeoPeriod
                ? "geo-missing-pre-or-post"
                : "missing-treatment-period-cell",
        });
      }
      X = usable.map(({ row }, i) => [
        1,
        ...geoKeys.slice(1).map((key) => (String(row[geoHeader] ?? "") === key ? 1 : 0)),
        ...timeKeys.slice(1).map((key) => (String(row[timeHeader] ?? "") === key ? 1 : 0)),
        treated[i] * post[i],
      ]);
      effectIndex = X[0].length - 1;
    } else {
      X = usable.map((_, i) => [1, treated[i], post[i], treated[i] * post[i]]);
      effectIndex = 3;
    }
    method = isGeoDid ? "cluster" : "hac";
    clusterKeys = usable.map(({ row }) => row[isGeoDid ? geoHeader : armHeader]);
    design = isGeoDid && timeHeader ? "Geo DiD (geo + time fixed effects)" : "Pre/Post DiD";
  } else if (stateHeader || (!armHeader && !periodHeader)) {
    // 상태 열이 없더라도 모든 spend 값이 실제 관측값이고 0/양수 구간이 모두
    // 존재하면 0=OFF, 양수=ON으로 보조 상태를 만든다. 결측 spend 행은 위에서
    // 이미 제외되므로 수집 누락을 OFF로 바꾸지 않는다.
    const inferredFromSpend = !stateHeader;
    const on = inferredFromSpend
      ? spend.map((value) => (Math.abs(value) > 1e-12 ? 1 : 0))
      : usable.map(({ row }) => treatmentIndicator(row[stateHeader]));
    if (on.some((value) => value == null) || !on.some(Boolean) || on.every(Boolean)) return failedExperimentPrior("invalid-treatment-design", weeklyMeta);
    onWeeks = on.filter(Boolean).length;
    offWeeks = on.length - onWeeks;
    transitionCount = on.slice(1).reduce((count, value, index) => count + (value !== on[index] ? 1 : 0), 0);
    if (onWeeks < 4 || offWeeks < 4 || transitionCount < 2) {
      return failedExperimentPrior("insufficient-state-replication", {
        ...weeklyMeta,
        onWeeks,
        offWeeks,
        transitionCount,
        minimumWeeksPerState: 4,
        minimumTransitions: 2,
      });
    }
    X = usable.map((_, i) => [1, i, Math.sin((2 * Math.PI * i) / 52), Math.cos((2 * Math.PI * i) / 52), on[i]]);
    effectIndex = 4;
    design = inferredFromSpend ? "On/Off (state inferred from verified spend zero)" : "On/Off";
  } else return failedExperimentPrior("unsupported-design", weeklyMeta);

  const outcomeReuse = experimentOutcomeReuseDiagnostic(weekly.rows, timeHeader, targetHeader, targetTimes, targetValues);
  const reuseCheckRequested = Array.isArray(targetTimes) || Array.isArray(targetValues);
  // National On/Off가 MMM과 같은 주의 동일 KPI 합계를 그대로 재사용하면 같은 Y가
  // prior와 likelihood에 두 번 들어간다. 현재 모델은 그 공분산을 공동 추정하지
  // 않으므로 exact reuse는 자동 보류한다. Geo contrast는 별도 cross-geo 식별정보가
  // 있어 경고 metadata만 남기고 통과시킨다.
  if (design.startsWith("On/Off") && outcomeReuse.isLikelyOutcomeReuse) {
    return failedExperimentPrior("non-independent-outcome-reuse", { ...weeklyMeta, ...outcomeReuse, design });
  }
  if (design.startsWith("On/Off") && reuseCheckRequested && outcomeReuse.outcomeIndependenceCheck === "not-comparable") {
    return failedExperimentPrior("outcome-reuse-not-comparable", { ...weeklyMeta, ...outcomeReuse, design });
  }

  const residualDf = usable.length - X[0].length;
  if (usable.length < 16 || residualDf < 8) return failedExperimentPrior("insufficient-data", { ...weeklyMeta, usableWeeks: usable.length, minimumUsableWeeks: 16, residualDf, ...(isGeoDid ? { geoCount: new Set(usable.map(({ row }) => String(row[geoHeader] ?? ""))).size, minimumGeoCount: 4 } : {}) });
  let estimate = ratioEstimate(X, target, exposure, effectIndex, method, clusterKeys);
  if (!estimate) return failedExperimentPrior("fit-failed", { ...weeklyMeta, residualDf });
  const geoCount = method === "cluster" ? new Set(clusterKeys.map((key) => String(key ?? ""))).size : null;
  const strengthDf = method === "cluster" ? Math.max(1, geoCount - 1) : residualDf;
  const weakExposureCriticalValue = studentTcrit(0.90, strengthDf);
  const exposureStrength = estimate.exposureSe > 0 ? Math.abs(estimate.exposureEffect) / estimate.exposureSe : Infinity;
  if (!(exposureStrength > weakExposureCriticalValue)) {
    return failedExperimentPrior("weak-treatment-intensity", {
      ...weeklyMeta,
      design,
      exposureEffect: estimate.exposureEffect,
      exposureSe: estimate.exposureSe,
      exposureStrength,
      weakExposureCriticalValue,
      strengthDf,
    });
  }
  const rawFieller90 = fiellerRatioInterval(estimate, weakExposureCriticalValue);
  if (!rawFieller90) {
    return failedExperimentPrior("unbounded-ratio-interval", {
      ...weeklyMeta,
      design,
      exposureEffect: estimate.exposureEffect,
      exposureSe: estimate.exposureSe,
      exposureStrength,
      weakExposureCriticalValue,
      strengthDf,
    });
  }
  const rawEstimate = estimate;
  const rawJackknife = jackknifeSe(X, target, exposure, effectIndex, method, clusterKeys);
  const geoAlignment = isGeoDid ? geoTransformAlignment(targetSpend, targetTimes, weekly.rows, timeHeader, params) : null;
  if (isGeoDid && !geoAlignment) {
    return failedExperimentPrior("geo-unit-alignment-failed", {
      ...weeklyMeta,
      design,
      geoCount,
      messageKo: "Geo 실험 효과를 타깃 국가의 Hill 계수 단위로 바꿀 기준 spend를 확인할 수 없어 prior를 적용하지 않았습니다.",
      messageEn: "No prior was applied because a valid target-market spend basis was unavailable for converting the Geo effect into the national Hill-coefficient unit.",
    });
  }
  const unitScale = geoAlignment ? 1 / geoAlignment.derivative : 1;
  if (geoAlignment) {
    estimate = {
      ...estimate,
      mean: estimate.mean * unitScale,
      variance: estimate.variance * unitScale ** 2,
      deltaVarianceIgnoringCovariance: estimate.deltaVarianceIgnoringCovariance * unitScale ** 2,
      covarianceAdjustment: estimate.covarianceAdjustment * unitScale ** 2,
    };
  }
  const fieller90 = rawFieller90.map((value) => value * unitScale).sort((a, b) => a - b);
  const jackknife = Number.isFinite(rawJackknife) ? rawJackknife * Math.abs(unitScale) : null;
  // 화면은 90% CI이므로 small-sample 보정도 동일한 양측 90% t 임계값을 쓴다.
  const smallClusterInflation = geoCount && geoCount > 1
    ? Math.max(1, studentTcrit(0.90, geoCount - 1) / 1.645)
    : 1;
  const smallSampleInflation = method === "hac"
    ? Math.max(1, studentTcrit(0.90, residualDf) / 1.645)
    : 1;
  const fiellerHalfWidth = Math.max(Math.abs(estimate.mean - fieller90[0]), Math.abs(fieller90[1] - estimate.mean));
  const fiellerEquivalentVariance = (fiellerHalfWidth / 1.645) ** 2;
  const uncertaintyInflation = Math.max(smallClusterInflation, smallSampleInflation);
  // robust delta, bounded Fieller, delete-block/geo jackknife 중 가장 넓은 원분산을
  // 고른 뒤 small-sample inflation을 전체에 적용한다. jackknife만 보정에서 빠지는
  // 비대칭을 만들지 않는다.
  const variance = Math.max(
    estimate.variance * uncertaintyInflation ** 2,
    fiellerEquivalentVariance,
    Number.isFinite(jackknife) ? jackknife ** 2 * uncertaintyInflation ** 2 : 0,
  );
  if (!(variance > 0) || !Number.isFinite(variance)) return failedExperimentPrior("invalid-variance", { ...weeklyMeta, residualDf });
  const se = Math.sqrt(variance);
  const prior = {
    mean: estimate.mean,
    variance,
    precision: 1 / variance,
    se,
    ci90: [estimate.mean - 1.645 * se, estimate.mean + 1.645 * se],
    ciLevel: 0.90,
    effect: estimate.effect,
    effectSe: estimate.effectSe,
    exposureEffect: estimate.exposureEffect,
    exposureSe: estimate.exposureSe,
    treatmentIntensity: estimate.exposureEffect,
    effectExposureCovariance: estimate.effectExposureCovariance,
    covarianceAdjustment: estimate.covarianceAdjustment,
    deltaVarianceIgnoringCovariance: estimate.deltaVarianceIgnoringCovariance,
    deltaVariance: estimate.variance,
    fieller90,
    fiellerEquivalentVariance,
    jackknifeSe: Number.isFinite(jackknife) ? jackknife : null,
    geoRawAdstockReturn: geoAlignment ? rawEstimate.mean : null,
    geoRawFieller90: geoAlignment ? rawFieller90 : null,
    geoTargetBasisAdstock: geoAlignment?.basisAdstock ?? null,
    geoTargetHillDerivative: geoAlignment?.derivative ?? null,
    geoTargetBasisWeeks: geoAlignment?.basisWeeks ?? null,
    exposureStrength,
    weakExposureCriticalValue,
    strengthDf,
    design,
    stateInferredFromSpend: !stateHeader && design.startsWith("On/Off"),
    ciMethod: jackknife
      ? `${estimate.ciMethod} + ${method === "cluster" ? "leave-one-geo-out" : "block"} jackknife`
      : estimate.ciMethod,
    n: usable.length,
    usableUniquePeriods,
    sourceN: weekly.sourceN,
    cadence: weekly.cadence,
    droppedMixedWeeks: weekly.droppedMixedWeeks,
    droppedMissingWeeks: weekly.droppedMissingWeeks || 0,
    droppedUnknownCategoryWeeks: weekly.droppedUnknownCategoryWeeks || 0,
    droppedUnparseableRows: weekly.droppedUnparseableRows || 0,
    boundaryPartialWeeks: weekly.boundaryPartialWeeks || 0,
    expectedDaysPerWeek: weekly.expectedDaysPerWeek || null,
    missingTimePeriods: weekly.missingTimePeriods || 0,
    geoCount,
    smallClusterInflation,
    smallSampleInflation,
    residualDf,
    onWeeks,
    offWeeks,
    transitionCount,
    ...outcomeReuse,
    targetLockedTransform: {
      alpha: params.alpha,
      ec: params.ec,
      slope: params.slope,
      ...(geoAlignment ? { basisAdstock: geoAlignment.basisAdstock, hillDerivative: geoAlignment.derivative } : {}),
    },
    transformUnitAligned: true,
  };
  return { prior, diagnostic: { ok: true, reason: null, ...weeklyMeta, usableUniquePeriods, exposureStrength, weakExposureCriticalValue, strengthDf, fieller90, jackknifeSe: Number.isFinite(jackknife) ? jackknife : null, onWeeks, offWeeks, transitionCount, ...outcomeReuse } };
}

export function buildExperimentMediaPrior(rows, options = {}) {
  return buildExperimentMediaPriorDetailed(rows, options).prior;
}

// 최근 한 번의 holdout 운에 기대지 않도록, 12주 창을 과거로 이동시켜 반복 검증한다.
export function mmmRollingOrigins(n, { holdout = 12, minTrain = 24, stride = 12, maxFolds = 3 } = {}) {
  const starts = [];
  for (let cut = n - holdout; cut >= minTrain && starts.length < maxFolds; cut -= stride) starts.push({ cut, holdout });
  return starts;
}

export function summarizeRollingErrors(errors, complexity = 1) {
  const finite = (errors || []).filter(Number.isFinite);
  if (!finite.length) return null;
  const meanRmse = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const sdRmse = Math.sqrt(finite.reduce((sum, value) => sum + (value - meanRmse) ** 2, 0) / finite.length);
  return {
    folds: finite.length,
    meanRmse,
    sdRmse,
    // 불안정한 조합과 불필요하게 큰 국가 세트가 한 번의 우연한 승리로 선택되지 않게 한다.
    score: (meanRmse + 0.25 * sdRmse) * (1 + 0.015 * Math.max(0, complexity - 1)),
  };
}
