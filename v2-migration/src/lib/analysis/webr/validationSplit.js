// Validation assignments only; no fitting or outcome-dependent split selection.
export function chronologicalDate(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const stamp = Date.parse(text);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === text ? stamp : null;
}

export function buildValidationSplit({ n, groups, times, y, predictorCount = 1 } = {}) {
  if (!groups && !times) return { ok: true, mode: "random_rows", foldIds: null };
  if (!Number.isInteger(n) || n < 1 || y?.length !== n
    || (groups && (groups.length !== n || groups.some((value) => value == null || String(value).trim() === "")))
    || (times && times.length !== n)) return { ok: false, reason: "validation_alignment" };
  const units = groups?.map(String);
  let foldIds;
  let mode;
  let folds;
  if (times) {
    const dates = times.map(chronologicalDate);
    if (dates.some((date) => date == null)) return { ok: false, reason: "validation_dates" };
    const unique = [...new Set(dates)].sort((a, b) => a - b);
    if (unique.length < 5) return { ok: false, reason: "validation_support" };
    const cutoff = unique[Math.floor(unique.length * 0.8)];
    const testUnits = new Set(units?.filter((_, index) => dates[index] >= cutoff));
    // -1 = purged repeated units, 0 = past training only, 1 = future validation.
    foldIds = dates.map((date, index) => date >= cutoff ? 1 : units && testUnits.has(units[index]) ? -1 : 0);
    mode = units ? "time_group_holdout" : "time_holdout";
    folds = 1;
  } else {
    const counts = new Map();
    units.forEach((unit) => counts.set(unit, (counts.get(unit) || 0) + 1));
    if (counts.size < 4) return { ok: false, reason: "validation_support" };
    folds = Math.min(5, counts.size);
    const loads = Array(folds).fill(0);
    const assignments = new Map();
    // Greedy size balancing is deterministic and never reads the outcome.
    [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en")).forEach(([unit, count]) => {
      const fold = loads.indexOf(Math.min(...loads));
      assignments.set(unit, fold + 1);
      loads[fold] += count;
    });
    foldIds = units.map((unit) => assignments.get(unit));
    mode = "group_cv";
  }
  const binary = y.every((value) => value === 0 || value === 1);
  for (let fold = 1; fold <= folds; fold += 1) {
    const train = foldIds.flatMap((id, index) => (times ? id === 0 : id !== fold) ? [index] : []);
    const test = foldIds.flatMap((id, index) => id === fold ? [index] : []);
    if (train.length < Math.max(30, predictorCount * 10) || test.length < 10
      || new Set(train.map((index) => y[index])).size < 2
      || (binary && [0, 1].some((value) => train.filter((index) => y[index] === value).length < 5))) {
      return { ok: false, reason: "validation_support" };
    }
  }
  return { ok: true, mode, foldIds, folds, validationN: foldIds.filter((id) => id > 0).length, purgedN: foldIds.filter((id) => id < 0).length };
}
