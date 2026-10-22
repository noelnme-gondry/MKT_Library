// 요일 계수 (spec §3). 지출 요일 계수와 CPR 요일 계수를 따로 만든다.
// 추세를 걷어내려고 7일 중심 이동평균 대비 비율을 쓰고, 표본이 적은 요일은 부모 쪽으로 수축한다.
import { addDays, dowOf, median } from "./plannerStats";

export const NEUTRAL_DOW = Object.freeze([1, 1, 1, 1, 1, 1, 1]);

/**
 * 요일별 로그 비율 표본 → 수축·정규화된 계수 7개.
 * @param {{dow:number, logRatio:number}[]} samples
 * @param {{minPerDay:number, shrinkK:number}} opts
 * @param {number[]} parent 부모 계수(없으면 1)
 */
export function dowFactorsFromSamples(samples, { minPerDay, shrinkK }, parent = NEUTRAL_DOW) {
  const byDay = Array.from({ length: 7 }, () => []);
  for (const sample of samples) {
    if (Number.isFinite(sample.logRatio)) byDay[sample.dow].push(sample.logRatio);
  }
  const counts = byDay.map((values) => values.length);
  const raw = byDay.map((values, day) => {
    const n = values.length;
    if (n < minPerDay) return parent[day];
    const own = Math.exp(median(values));
    return (n * own + shrinkK * parent[day]) / (n + shrinkK);
  });
  const mean = raw.reduce((a, b) => a + b, 0) / 7;
  const factors = mean > 0 ? raw.map((v) => v / mean) : [...NEUTRAL_DOW];
  return { factors, counts };
}

/**
 * 일 시계열의 요일 표본: 값 ÷ 7일 중심 이동평균. 앞뒤 3일이 모두 있는 날만 쓴다.
 * @param {Map<string, number>} byDate 날짜 → 값(양수)
 * @param {{excludeDates?:Set<string>}} opts
 */
export function ratioToMovingAverageSamples(byDate, { excludeDates } = {}) {
  const samples = [];
  for (const [date, value] of byDate) {
    if (!(value > 0) || excludeDates?.has(date)) continue;
    let total = 0;
    let complete = true;
    for (let offset = -3; offset <= 3; offset += 1) {
      const neighbour = byDate.get(addDays(date, offset));
      if (!(neighbour > 0)) {
        complete = false;
        break;
      }
      total += neighbour;
    }
    if (complete) samples.push({ dow: dowOf(date), logRatio: Math.log(value / (total / 7)) });
  }
  return samples;
}

/** 최근 lookbackWeeks주 안의 날짜만 남긴다(asOf 포함). */
export function withinLookback(byDate, asOf, lookbackWeeks) {
  const start = addDays(asOf, -(lookbackWeeks * 7 - 1));
  return new Map([...byDate].filter(([date]) => date >= start && date <= asOf));
}
