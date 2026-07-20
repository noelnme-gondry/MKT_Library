// 달력 시즈널리티 엔진. 같은 국가/필터 안에서 연도별 같은 주·월을 비교한다.
// detrend=true는 중앙 이동평균(주=13, 월=5)을 추세선으로 사용해
// value / trend × 100 인덱스로 바꾼다. 완전한 인과 분해가 아니라, 규모 성장·하락을
// 걷어낸 반복 캘린더 패턴을 읽기 위한 결정론적 STL-lite 보정이다.

function dateOf(value) {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function movingMean(values, radius) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - radius), Math.min(values.length, i + radius + 1));
    const valid = slice.filter((v) => Number.isFinite(v));
    return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : null;
  });
}

export function buildCalendarSeasonality(rows, { metric = "installs", grain = "month", detrend = false } = {}) {
  const periods = new Map();
  for (const row of rows || []) {
    const d = dateOf(row.date);
    const value = Number(row[metric]);
    if (!d || !Number.isFinite(value)) continue;
    const year = d.getUTCFullYear();
    const bucket = grain === "week" ? getIsoWeek(d) : d.getUTCMonth() + 1;
    const key = `${year}:${bucket}`;
    const item = periods.get(key) || { year, bucket, value: 0 };
    item.value += value;
    periods.set(key, item);
  }

  const timeline = [...periods.values()].sort((a, b) => a.year - b.year || a.bucket - b.bucket);
  const years = [...new Set(timeline.map((d) => d.year))];
  if (years.length < 2 || timeline.length < (grain === "week" ? 16 : 4)) {
    return { sufficient: false, years, timeline, reason: "need_more_history" };
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

  return { sufficient: true, years, points, seasonal, grain, detrend, yearMean };
}
