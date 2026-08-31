// 달력 시즈널리티 엔진. 같은 국가/필터 안에서 연도별 같은 주·월을 비교한다.
// detrend=true는 중앙 이동평균(주=13, 월=5)을 추세선으로 사용해
// value / trend × 100 인덱스로 바꾼다. 완전한 인과 분해가 아니라, 규모 성장·하락을
// 걷어낸 반복 캘린더 패턴을 읽기 위한 결정론적 STL-lite 보정이다.
import { parseDateValue } from "@/lib/data-import/normalizeValues";

function periodOf(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = parseDateValue(text, { minYear: 1900, maxYear: 2200 });
  if (!parsed) return null;
  if (parsed.grain === "week") {
    return { sourceGrain: "week", year: Number(parsed.canonical.slice(0, 4)), bucket: Number(parsed.canonical.slice(-2)) };
  }
  if (parsed.grain === "month") {
    return { sourceGrain: "month", year: Number(parsed.canonical.slice(0, 4)), bucket: Number(parsed.canonical.slice(-2)) };
  }
  return { sourceGrain: "day", date: parsed.date, year: parsed.date.getUTCFullYear(), bucket: parsed.date.getUTCMonth() + 1 };
}

export function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function getIsoWeekYear(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return d.getUTCFullYear();
}

/** 입력 date 컬럼의 실제 grain을 판별한다. date/week/month 헤더명에 기대지 않는다. */
export function detectCalendarGrain(rows) {
  const parsed = (rows || []).map((row) => periodOf(row.date)).filter(Boolean);
  if (!parsed.length) return "unknown";
  const explicit = parsed.find((item) => item.sourceGrain !== "day");
  if (explicit) return explicit.sourceGrain;
  const uniqueTimes = [...new Set(parsed.map((item) => item.date.getTime()))].sort((a, b) => a - b);
  if (uniqueTimes.length < 2) return "day";
  const gaps = uniqueTimes.slice(1).map((time, index) => (time - uniqueTimes[index]) / 86400000).sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)];
  if (medianGap >= 20) return "month";
  if (medianGap >= 6) return "week";
  return "day";
}

/**
 * 한 날짜 값을 현재 grain 기준 달력 구간으로 주석(연도·버킷·ISO 라벨·월).
 * buildCalendarSeasonality가 쓰는 것과 동일한 버킷 규칙을 재사용한다 —
 * 다운로드 ISO 뷰·숫자 검증용 표시 헬퍼(수학 아님, 골든 무관).
 */
export function annotateCalendarPeriod(dateValue, grain = "week") {
  const source = periodOf(dateValue);
  if (!source) return null;
  const isDayWeek = source.sourceGrain === "day" && grain === "week";
  const year = isDayWeek ? getIsoWeekYear(source.date) : source.year;
  const bucket = isDayWeek ? getIsoWeek(source.date) : source.bucket;
  const month = source.sourceGrain === "day" ? source.date.getUTCMonth() + 1 : source.sourceGrain === "month" ? source.bucket : null;
  const pad = String(bucket).padStart(2, "0");
  return {
    sourceGrain: source.sourceGrain,
    year,
    bucket,
    month,
    isoLabel: grain === "week" ? `${year}-W${pad}` : `${year}-${pad}`,
  };
}

function movingMean(values, radius) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - radius), Math.min(values.length, i + radius + 1));
    const valid = slice.filter((v) => Number.isFinite(v));
    return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : null;
  });
}

export function buildCalendarSeasonality(rows, { metric = "installs", grain = "month", detrend = false } = {}) {
  const sourceGrain = detectCalendarGrain(rows);
  const permittedGrains = sourceGrain === "day" ? ["month", "week"] : sourceGrain === "week" ? ["week"] : sourceGrain === "month" ? ["month"] : [];
  if (!permittedGrains.includes(grain)) return { sufficient: false, years: [], timeline: [], sourceGrain, reason: "grain_not_supported" };
  const periods = new Map();
  const ratio = metric && typeof metric === "object" && metric.numerator && metric.denominator ? metric : null;
  for (const row of rows || []) {
    const source = periodOf(row.date);
    const value = ratio ? null : Number(row[metric]);
    const numerator = ratio ? Number(row[ratio.numerator]) : null;
    const denominator = ratio ? Number(row[ratio.denominator]) : null;
    if (!source || (ratio ? !Number.isFinite(numerator) || !Number.isFinite(denominator) : !Number.isFinite(value))) continue;
    const year = source.sourceGrain === "day" && grain === "week" ? getIsoWeekYear(source.date) : source.year;
    const bucket = source.sourceGrain === "day" && grain === "week" ? getIsoWeek(source.date) : source.bucket;
    const key = `${year}:${bucket}`;
    const item = periods.get(key) || { year, bucket, value: 0, numerator: 0, denominator: 0 };
    if (ratio) {
      // CPI/CPA/ROAS는 row별 비율의 평균이 아니다. 같은 달력 구간의 분자·분모를
      // 먼저 합산한 뒤 한 번만 나눠, 채널/캠페인 행 수가 결과를 왜곡하지 않게 한다.
      item.numerator += numerator;
      item.denominator += denominator;
      item.value = item.denominator > 0 ? item.numerator / item.denominator : null;
    } else item.value += value;
    periods.set(key, item);
  }

  const timeline = [...periods.values()].filter((item) => Number.isFinite(item.value)).sort((a, b) => a.year - b.year || a.bucket - b.bucket);
  const years = [...new Set(timeline.map((d) => d.year))];
  if (years.length < 2 || timeline.length < (grain === "week" ? 16 : 4)) {
    return { sufficient: false, years, timeline, sourceGrain, reason: "need_more_history" };
  }

  const byYear = new Map();
  for (const point of timeline) {
    const list = byYear.get(point.year) || [];
    list.push(point);
    byYear.set(point.year, list);
  }
  const yearMean = new Map([...byYear.entries()].map(([year, list]) => [year, list.reduce((sum, d) => sum + d.value, 0) / list.length]));
  const trend = movingMean(timeline.map((d) => d.value), grain === "week" ? 6 : 2);
  const points = timeline.map((point, index) => {
    const baseline = detrend ? trend[index] : yearMean.get(point.year);
    const indexValue = baseline > 0 ? (point.value / baseline) * 100 : null;
    return { ...point, trend: trend[index], index: indexValue, display: detrend ? indexValue : point.value };
  });

  const bucketMap = new Map();
  for (const point of points) {
    const item = bucketMap.get(point.bucket) || { bucket: point.bucket, points: [] };
    item.points.push(point);
    bucketMap.set(point.bucket, item);
  }
  const seasonal = [...bucketMap.values()]
    .map((item) => {
      const indices = item.points.map((p) => p.index).filter(Number.isFinite);
      const mean = indices.reduce((sum, v) => sum + v, 0) / indices.length;
      return {
        bucket: item.bucket,
        index: mean,
        delta: mean - 100,
        min: Math.min(...indices),
        max: Math.max(...indices),
        n: indices.length,
      };
    })
    .sort((a, b) => a.bucket - b.bucket);

  const coverage = Object.fromEntries([...byYear.entries()].map(([year, list]) => [year, list.length]));
  return { sufficient: true, years, points, seasonal, grain, detrend, yearMean, sourceGrain, coverage };
}
