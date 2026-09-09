// 파일 이름과 기간은 소속 판정에 쓰지 않는다. 사용자가 선택한 프로젝트가 소속을 소유한다.
import { getMappedRows } from "@/utils/dashboardAggregator";

export function describeDataSeries(csv, group) {
  const roles = [...new Set(Object.values(csv.mapping || {}).filter(value => value && value !== "__ignore__"))].sort();
  const rows = getMappedRows(csv);
  const dates = [...new Set(rows.map(row => String(row.date || "").slice(0, 10)).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
  return { group, roles, currency: csv.currency || null, start: dates[0] || null, end: dates.at(-1) || null };
}

export function compareDataSeries(previous, current) {
  if (!previous?.start || !current?.start) return "unconfirmed";
  if (previous.group !== current.group || JSON.stringify(previous.roles) !== JSON.stringify(current.roles)) return "schema_changed";
  if (previous.currency && current.currency && previous.currency !== current.currency) return "currency_changed";
  if (current.start === previous.start && current.end === previous.end) return "same_period";
  if (current.start > previous.end) {
    return Date.parse(current.start) - Date.parse(previous.end) === 86400000 ? "next_period" : "gap";
  }
  if (current.end < previous.start) return "historical";
  return "overlap";
}
