/* ============================================================
 * krLunarHolidays — 한국 음력 명절(설날·추석) 주간 달력
 *
 * 설·추석은 양력으로 해마다 1~3주 움직인다. 그래서
 *   ① "52주 전 같은 주"를 가져오는 연간 유사·계절 단순 예측은 작년 명절의 급등락을
 *      올해 명절이 아닌 주에 놓고,
 *   ② 사용자가 명절 더미를 매핑해도 예측은 미래 더미를 0으로 두어 다가오는 명절을
 *      모르는 채로 예측했다(2026-10 감사).
 * 이 모듈은 명절이 걸린 주를 알려 줄 뿐이고, 미래 더미를 채우는 것은 **사용자 데이터의
 * 과거 더미가 이 달력과 실제로 맞을 때만** 한다(matchLunarHolidayDummy). 달력이
 * 틀렸거나 사용자가 다른 의미로 더미를 썼다면 일치 검사에서 걸러진다.
 *
 * 날짜는 명절 당일(음력 1/1, 8/15)이며 연휴는 전날·당일·다음날 3일로 본다. 대체공휴일은
 * 해마다 달라 넣지 않는다. 범위 밖 연도는 "모름"이지 "명절 아님"이 아니다.
 * ============================================================ */

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

export const KR_LUNAR_HOLIDAY_DATES = Object.freeze({
  seollal: Object.freeze([
    "2016-02-08", "2017-01-28", "2018-02-16", "2019-02-05", "2020-01-25", "2021-02-12",
    "2022-02-01", "2023-01-22", "2024-02-10", "2025-01-29", "2026-02-17", "2027-02-07",
  ]),
  chuseok: Object.freeze([
    "2016-09-15", "2017-10-04", "2018-09-24", "2019-09-13", "2020-10-01", "2021-09-21",
    "2022-09-10", "2023-09-29", "2024-09-17", "2025-10-06", "2026-09-25", "2027-09-15",
  ]),
});

export const KR_LUNAR_CALENDAR_RANGE = Object.freeze({ firstYear: 2016, lastYear: 2027 });

const HOLIDAY_DAYS = Object.fromEntries(Object.entries(KR_LUNAR_HOLIDAY_DATES).map(([kind, dates]) => [
  kind,
  dates.flatMap((iso) => {
    const day = Date.parse(`${iso}T00:00:00Z`);
    return [day - DAY_MS, day, day + DAY_MS];
  }),
]));

const toMs = (value) => {
  if (value instanceof Date) return value.getTime();
  if (Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value).length === 10 ? `${value}T00:00:00Z` : String(value));
  return Number.isFinite(parsed) ? parsed : NaN;
};

/** 주 시작일(그 날부터 7일)에 명절 연휴가 걸리면 "seollal"·"chuseok", 아니면 null. */
export function lunarHolidayKindOfWeek(weekStart) {
  const start = toMs(weekStart);
  if (!Number.isFinite(start)) return null;
  const end = start + WEEK_MS;
  for (const [kind, days] of Object.entries(HOLIDAY_DAYS)) {
    if (days.some((day) => day >= start && day < end)) return kind;
  }
  return null;
}

/** 달력이 그 주를 안다고 말할 수 있는가(범위 밖이면 명절 여부를 모른다). */
export function isLunarCalendarCovered(weekStart) {
  const start = toMs(weekStart);
  if (!Number.isFinite(start)) return false;
  const year = new Date(start).getUTCFullYear();
  const endYear = new Date(start + WEEK_MS - DAY_MS).getUTCFullYear();
  return year >= KR_LUNAR_CALENDAR_RANGE.firstYear && endYear <= KR_LUNAR_CALENDAR_RANGE.lastYear;
}

/**
 * 패널의 각 행(과 그 뒤 extra주)의 주 시작일. 주가 연속이라는 가정 아래 첫 날짜에서
 * week 번호 차이로 계산한다(calendarized 예측 패널은 week가 달력 주 번호다).
 */
export function panelWeekStarts(panel, extra = 0) {
  const n = panel?.week?.length || 0;
  if (!n) return null;
  const first = toMs(panel.dates?.[0] ?? panel.dateLabel?.[0] ?? panel.weekLabel?.[0]);
  if (!Number.isFinite(first)) return null;
  const firstWeek = Number(panel.week[0]);
  const lastWeek = Number(panel.week[n - 1]);
  if (!Number.isFinite(firstWeek) || !Number.isFinite(lastWeek)) return null;
  const history = panel.week.map((week) => first + (Number(week) - firstWeek) * WEEK_MS);
  const future = Array.from({ length: Math.max(0, extra) }, (_, index) => first + (lastWeek - firstWeek + index + 1) * WEEK_MS);
  return { history, future, futureWeeks: future.map((_, index) => lastWeek + index + 1) };
}

const KIND_MATCHERS = {
  seollal: (kind) => kind === "seollal",
  chuseok: (kind) => kind === "chuseok",
  both: (kind) => kind === "seollal" || kind === "chuseok",
};

/**
 * 사용자가 매핑한 0/1 더미가 명절 달력과 맞는지. 맞으면 어떤 명절인지와, 사용자가
 * 명절 주 앞뒤 어디까지 표시했는지(offsets: -1·0·1주)를 돌려준다.
 * 조건: 이력 안에 명절이 2번 이상, 명절의 80% 이상이 ±1주 안에서 표시, 표시된 주의
 * 80% 이상이 명절 ±1주 안. 그 밖이면 null(일반 이벤트 — 미래를 알 수 없다).
 */
export function matchLunarHolidayDummy(values, weekStarts) {
  if (!Array.isArray(values) || !Array.isArray(weekStarts) || values.length !== weekStarts.length) return null;
  // 달력 범위 밖 주는 명절인지 모르므로 일치 검사에서 뺀다(그 주의 표시는 판단하지 않는다).
  const covered = weekStarts.map(isLunarCalendarCovered);
  const kinds = weekStarts.map((start, index) => (covered[index] ? lunarHolidayKindOfWeek(start) : undefined));
  const active = values.map((value) => Number(value) > 0.5);
  const activeIndices = active.map((on, index) => (on && covered[index] ? index : -1)).filter((index) => index >= 0);
  if (!activeIndices.length) return null;
  let best = null;
  for (const [kind, matches] of Object.entries(KIND_MATCHERS)) {
    const occurrences = kinds.map((value, index) => (matches(value) ? index : -1)).filter((index) => index >= 0);
    // 연휴가 두 주에 걸치면 연속한 두 주가 모두 명절 주다 — 한 번의 명절로 센다.
    const events = occurrences.filter((index, position) => position === 0 || index - occurrences[position - 1] > 1);
    if (events.length < 2) continue;
    const near = (index) => occurrences.some((holiday) => Math.abs(holiday - index) <= 1);
    const recall = events.filter((event) => [-1, 0, 1, 2].some((d) => active[event + d])).length / events.length;
    const precision = activeIndices.filter(near).length / activeIndices.length;
    if (recall < 0.8 || precision < 0.8) continue;
    // 사용자가 명절 주 앞뒤 어디까지 표시했는지: 명절 주(연휴가 두 주에 걸치면 두 주
    // 모두) 기준 −1·0·+1주 중 절반 이상의 명절 주에서 표시된 위치.
    const offsets = [-1, 0, 1].filter((d) =>
      occurrences.filter((holiday) => active[holiday + d]).length >= occurrences.length / 2);
    if (!offsets.length) continue;
    const score = recall * precision;
    if (!best || score > best.score + 1e-12) best = { kind, offsets, events: events.length, recall, precision, score };
  }
  return best;
}

/** 명절 주 기준 offsets(−1·0·+1주)를 미래 주 시작일에 적용한 0/1. 달력이 모르면 null. */
export function lunarDummyForWeeks(match, weekStarts) {
  const matches = KIND_MATCHERS[match?.kind];
  if (!matches) return null;
  return weekStarts.map((start) => {
    if (!isLunarCalendarCovered(start)) return null;
    return match.offsets.some((d) => matches(lunarHolidayKindOfWeek(start - d * WEEK_MS))) ? 1 : 0;
  });
}

/**
 * 예측용 미래 더미. 달력과 맞는 더미만 채우고, 달력 범위 밖 주는 채우지 않는다.
 * 반환 futureDummy는 mmmBayesianForecast의 options.futureDummy 형식이다.
 */
export function lunarFutureDummies(panel, horizon) {
  const starts = panelWeekStarts(panel, horizon);
  if (!starts) return { futureDummy: {}, matches: [], uncoveredFutureWeeks: 0 };
  const futureDummy = {};
  const matches = [];
  let uncoveredFutureWeeks = 0;
  Object.entries(panel.dummy || {}).forEach(([key, values]) => {
    const match = matchLunarHolidayDummy(values, starts.history);
    if (!match) return;
    const future = lunarDummyForWeeks(match, starts.future);
    if (!future) return;
    uncoveredFutureWeeks = Math.max(uncoveredFutureWeeks, future.filter((value) => value == null).length);
    futureDummy[key] = future.map((value) => value ?? 0);
    matches.push({ key, kind: match.kind, offsets: match.offsets, events: match.events });
  });
  return { futureDummy, matches, uncoveredFutureWeeks };
}

/**
 * "52주 전 같은 주" 예측을 명절에 맞춰 옮긴다. 목표 주와 52주 전 주의 명절 여부가
 * 다르면, 52주 전 주 ±3주 안에서 목표 주와 같은 상태(같은 명절 / 명절 아님)인 가장
 * 가까운 관측 주를 대신 쓴다. 달력이 모르는 주는 옮기지 않는다.
 * kindAt(index)는 시리즈 인덱스(미래 포함)의 명절 종류, maxIndex는 쓸 수 있는 관측의 끝(배타).
 */
export function lunarAlignedAnalogIndex(targetIndex, analogIndex, kindAt, maxIndex) {
  if (typeof kindAt !== "function") return analogIndex;
  const targetKind = kindAt(targetIndex);
  const analogKind = kindAt(analogIndex);
  if (targetKind === undefined || analogKind === undefined || targetKind === analogKind) return analogIndex;
  for (let distance = 1; distance <= 3; distance++) {
    for (const candidate of [analogIndex - distance, analogIndex + distance]) {
      if (candidate < 0 || candidate >= maxIndex) continue;
      const kind = kindAt(candidate);
      if (kind !== undefined && kind === targetKind) return candidate;
    }
  }
  return analogIndex;
}

/** 시리즈 인덱스 → 명절 종류(null=명절 아님, undefined=달력이 모름). */
export function lunarKindAtFromPanel(panel) {
  const starts = panelWeekStarts(panel, 0);
  if (!starts) return null;
  const n = starts.history.length;
  const last = starts.history[n - 1];
  return (index) => {
    if (!Number.isInteger(index) || index < 0) return undefined;
    const start = index < n ? starts.history[index] : last + (index - n + 1) * WEEK_MS;
    return isLunarCalendarCovered(start) ? lunarHolidayKindOfWeek(start) : undefined;
  };
}

/** 패널 week 번호(미래 포함) → 명절 종류(null=명절 아님, undefined=달력이 모름). */
export function lunarKindAtWeekFromPanel(panel) {
  const starts = panelWeekStarts(panel, 0);
  if (!starts) return null;
  const firstWeek = Number(panel.week[0]);
  const first = starts.history[0];
  return (week) => {
    if (!Number.isFinite(Number(week))) return undefined;
    const start = first + (Number(week) - firstWeek) * WEEK_MS;
    return isLunarCalendarCovered(start) ? lunarHolidayKindOfWeek(start) : undefined;
  };
}
