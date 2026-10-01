// 기존 PVM/Mix·Rate 엔진과 독립된 보조 분해. 동일 기간·범위의 집계 수치만 사용한다.
// cost/result = cost/impressions × impressions/clicks × clicks/installs × installs/actions.
// 모든 교체 순서의 한계 차이를 평균(Shapley)해 순서에 무관한 단가 기여를 구한다.
// 중간 컬럼이 없으면 그 구간을 합쳐 표시한다. 누락을 0으로 바꾸지 않는다.
import { parseNumericStrict } from "./parseNumeric";

function sumComplete(rows, field) {
  if (!rows?.length) return null;
  let sum = 0;
  for (const row of rows) {
    const raw = row[field];
    if (raw == null || String(raw).trim() === "") return null;
    const value = parseNumericStrict(raw);
    if (value == null || value < 0) return null;
    sum += value;
  }
  return Number.isFinite(sum) ? sum : null;
}

export function efficiencyStages(beforeRows, afterRows, resultField, mappedFields) {
  const mapped = new Set(mappedFields);
  const fields = ["impressions", "clicks", "installs", "actions"];
  const end = fields.indexOf(resultField);
  if (end < 2) return { ok: false, reason: "unsupported-result" };
  const before = {}, after = {};
  for (const field of ["spend", ...fields.slice(0, end + 1)]) {
    before[field] = sumComplete(beforeRows, field);
    after[field] = sumComplete(afterRows, field);
  }
  if (!["spend", "impressions", resultField].every(field => before[field] > 0 && after[field] > 0)) {
    return { ok: false, reason: "needs-complete-positive-totals" };
  }
  const omitted = fields.slice(1, end).filter(field => !mapped.has(field) || !(before[field] > 0 && after[field] > 0));
  const path = fields.slice(0, end + 1).filter(field => !omitted.includes(field));
  const stages = [{ key: "cpm", fromField: "impressions", toField: "spend", before: before.spend / before.impressions * 1000, after: after.spend / after.impressions * 1000 }];
  for (let i = 1; i < path.length; i++) {
    const fromField = path[i - 1], toField = path[i];
    stages.push({ key: `${fromField}-${toField}`, fromField, toField, before: before[toField] / before[fromField], after: after[toField] / after[fromField] });
  }
  const factorsBefore = stages.map((stage, index) => index ? 1 / stage.before : stage.before / 1000);
  const factorsAfter = stages.map((stage, index) => index ? 1 / stage.after : stage.after / 1000);
  const product = values => values.reduce((acc, value) => acc * value, 1);
  const contributions = stages.map(() => 0);
  let orders = 0;
  function visit(order, remaining) {
    if (remaining.length) {
      for (const index of remaining) visit([...order, index], remaining.filter(value => value !== index));
      return;
    }
    orders++;
    const values = [...factorsBefore];
    let previous = product(values);
    for (const index of order) {
      values[index] = factorsAfter[index];
      const next = product(values);
      contributions[index] += next - previous;
      previous = next;
    }
  }
  visit([], stages.map((_, index) => index));
  const start = before.spend / before[resultField], finish = after.spend / after[resultField];
  const result = stages.map((stage, index) => ({ ...stage, changePct: (stage.after / stage.before - 1) * 100, contribution: contributions[index] / orders }));
  const delta = finish - start;
  if (!result.every(stage => [stage.before, stage.after, stage.changePct, stage.contribution].every(Number.isFinite))
    || Math.abs(result.reduce((sum, stage) => sum + stage.contribution, 0) - delta) > 1e-8 * Math.max(1, start, finish)) {
    return { ok: false, reason: "unreliable-decomposition" };
  }
  return { ok: true, start, finish, delta, stages: result, omitted };
}
