/* ============================================================
 * periodCompare — "앞뒤 기간" 비교를 화면이 검증 가능하게 말하는 계층.
 *
 * 도구들이 "앞 기간 / 뒤 기간"이라고만 쓰고 있었다. 그러면 읽는 사람은
 * ① 두 기간이 정말 같은 길이인지 ② 어디서 갈렸는지를 확인할 수 없다.
 * 실제 날짜와 일수를 같이 적으면 사용자가 스스로 공정성을 검증한다(§9).
 *
 * 그리고 변화량은 단위가 둘이라 섞이면 오독된다:
 *   - 비율 지표(전환율 30%→40%)  → 절대 차이는 **%p**, 상대 차이는 %
 *   - 수량 지표(설치 3,000→4,000) → 상대 차이만 %
 * 이 모듈이 접미사를 강제해 "10% 올랐다"가 어느 쪽인지 헷갈리지 않게 한다.
 * ============================================================ */

/** 날짜 배열 → { start, end, days }. 빈 입력은 null(없는 기간을 만들지 않는다). */
export function describePeriod(dates) {
  const clean = [...new Set((dates || []).map((date) => String(date ?? "").trim()).filter(Boolean))].sort();
  if (!clean.length) return null;
  return { start: clean[0], end: clean[clean.length - 1], days: clean.length };
}

/** "2025-03-01 ~ 2025-04-11 (42일)" — 일수는 실제 데이터가 있는 날 수다(달력 일수 아님). */
export function formatPeriod(period, locale = "ko") {
  if (!period) return locale === "en" ? "no data" : "데이터 없음";
  const unit = locale === "en" ? (period.days === 1 ? "day" : "days") : "일";
  return `${period.start} ~ ${period.end} (${period.days}${locale === "en" ? " " : ""}${unit})`;
}

/**
 * 두 기간의 길이가 다르면 비교가 공정하지 않을 수 있다. 조용히 넘기지 말고
 * 사실을 돌려줘서 화면이 말하게 한다(§8).
 */
export function comparePeriodLengths(before, after) {
  if (!before || !after) return { balanced: false, reason: "missing" };
  if (before.days === after.days) return { balanced: true, reason: "equal" };
  return { balanced: false, reason: "unequal", beforeDays: before.days, afterDays: after.days };
}

const signed = (value, digits) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;

/**
 * 비율 지표의 변화 → %p(절대) + %(상대). 0.3221 → 0.2100 이면 "−11.21%p (−34.8%)".
 * 기준이 0이면 상대 변화가 정의되지 않으므로 %p만 돌려준다.
 */
export function formatRateDelta(before, after, { digits = 2 } = {}) {
  if (before == null || after == null || !Number.isFinite(before) || !Number.isFinite(after)) return null;
  const points = (after - before) * 100;
  const relative = before === 0 ? null : ((after - before) / Math.abs(before)) * 100;
  return {
    points,
    relative,
    // 단위 접미사를 붙여야 "10% 올랐다"가 어느 쪽인지 갈린다.
    text: relative == null ? `${signed(points, digits)}%p` : `${signed(points, digits)}%p (${signed(relative, 1)}%)`,
    tone: points > 0 ? "up" : points < 0 ? "down" : "flat",
  };
}

/** 수량 지표의 변화 → 상대 %만. 3,000 → 4,000 이면 "+33.3%". */
export function formatCountDelta(before, after, { digits = 1 } = {}) {
  if (before == null || after == null || !Number.isFinite(before) || !Number.isFinite(after)) return null;
  if (before === 0) return { relative: null, text: "—", tone: "flat" };
  const relative = ((after - before) / Math.abs(before)) * 100;
  return { relative, text: `${signed(relative, digits)}%`, tone: relative > 0 ? "up" : relative < 0 ? "down" : "flat" };
}
