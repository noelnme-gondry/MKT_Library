// 플래너 공용 수치·날짜 도우미. 결정론(같은 입력 → 같은 출력)만 쓴다.
import { KR_LUNAR_HOLIDAY_DATES } from "@/utils/krLunarHolidays";

const DAY_MS = 86400000;

export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 정규분포 표준편차로 환산한 MAD(1.4826 × 중앙절대편차). */
export function robustSigma(values) {
  const center = median(values);
  if (center == null) return null;
  return 1.4826 * median(values.map((v) => Math.abs(v - center)));
}

/** 선형 보간 분위수(R type 7). */
export function quantile(values, q) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const sum = (values) => values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);

export const isIsoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const toMs = (iso) => Date.parse(`${iso}T00:00:00Z`);

export function addDays(iso, days) {
  return new Date(toMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

export function dayDiff(fromIso, toIso) {
  return Math.round((toMs(toIso) - toMs(fromIso)) / DAY_MS);
}

/** 'YYYY-MM-DD'는 UTC로 파싱되므로 요일도 UTC로 읽는다(0=일 … 6=토). */
export function dowOf(iso) {
  return new Date(toMs(iso)).getUTCDay();
}

const HOLIDAY_SET = new Set(Object.values(KR_LUNAR_HOLIDAY_DATES).flatMap((dates) => dates.flatMap((iso) => [addDays(iso, -1), iso, addDays(iso, 1)])));

/** 설·추석 연휴(당일 ±1일). 달력 범위 밖 연도는 판정하지 않는다(false). */
export function isKrLunarHoliday(iso) {
  return HOLIDAY_SET.has(iso);
}
