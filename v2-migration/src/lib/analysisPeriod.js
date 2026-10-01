// 날짜 UI 검증만 담당한다. 분석 엔진의 기간 집계·숫자는 변경하지 않는다.
const DAY = 86400000;
export function dateOrdinal(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / DAY : null;
}

export function periodProblem(range) {
  if (dateOrdinal(range?.start) == null || dateOrdinal(range?.end) == null) return "invalid";
  return range.start > range.end ? "order" : null;
}

export function periodDays(range) {
  return periodProblem(range) ? null : dateOrdinal(range.end) - dateOrdinal(range.start) + 1;
}

export function previousPeriod(range) {
  const length = periodDays(range);
  if (length == null) return null;
  const start = dateOrdinal(range.start);
  const iso = (day) => new Date(day * DAY).toISOString().slice(0, 10);
  return { start: iso(start - length), end: iso(start - 1) };
}

export function comparisonWarnings(current, prior, locale = "ko") {
  if (periodProblem(current) || periodProblem(prior)) return [];
  const en = locale === "en";
  const messages = [];
  if (current.start <= prior.end && prior.start <= current.end) messages.push(en
    ? "The periods overlap: some dates are included in both."
    : "두 기간이 겹쳐 일부 날짜가 양쪽에 포함됩니다.");
  const currentDays = periodDays(current), priorDays = periodDays(prior);
  if (currentDays !== priorDays) messages.push(en
    ? `Current: ${currentDays} days; prior: ${priorDays} days. Consider the different durations when comparing totals.`
    : `분석 ${currentDays}일 · 비교 ${priorDays}일입니다. 합계를 비교할 때 기간 길이를 함께 확인하세요.`);
  return messages;
}
