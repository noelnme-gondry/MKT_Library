// 플래너 골든용 합성 데이터. Math.random 없이 결정론적 의사 잡음만 쓴다.
import { addDays } from "../plannerStats";

/** 결정론 잡음 [-1, 1]: 정수 해시. */
export function noise(seed) {
  let x = (seed * 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  x ^= x >>> 12;
  return ((x % 20001) / 10000) - 1;
}

/**
 * 하루 지출 cost에서 CPR = a · cost^b (b>0이면 수확체감), 요일 배율 dowCpr, 잡음 폭 jitter.
 * @returns 표준키 행 배열
 */
export function curveRows({ start = "2026-06-01", days = 84, path, spend, a, b, dowCpr = [1, 1, 1, 1, 1, 1, 1], jitter = 0.03, seed = 1, cprShift = () => 1, extra = () => ({}) }) {
  const rows = [];
  for (let t = 0; t < days; t += 1) {
    const date = addDays(start, t);
    const cost = spend(t, date);
    if (!(cost > 0)) continue;
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const cpr = a * Math.pow(cost, b) * dowCpr[dow] * cprShift(t, date) * (1 + jitter * noise(seed * 1000 + t));
    rows.push({ date, cost: String(Math.round(cost)), installs: String(Math.max(0, Math.round((cost / cpr) * 100) / 100)), ...path, ...extra(t, date, cost, cost / cpr) });
  }
  return rows;
}
