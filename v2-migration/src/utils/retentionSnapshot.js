// 리텐션의 Dn 마감 여부는 "오늘"이 아니라 데이터가 실제로 관측된 기준일로
// 판단한다. 과거에 내려받은 CSV를 오늘 다시 열어 최근 코호트를 성숙으로 오판하지
// 않도록, 근거·신뢰도·보수 버퍼를 결과 객체에 함께 남긴다.

export const LOW_CONFIDENCE_BUFFER_DAYS = 2;

export function parseSnapshotDate(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})(?:$|[ T])/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function snapshotDateFromFilename(fileName) {
  const name = String(fileName || "");
  const matches = [...name.matchAll(/(?:^|[^\d])(\d{4}[-_.]?\d{2}[-_.]?\d{2})(?=$|[^\d])/g)];
  // 보고 기간이 함께 들어간 파일은 일반적으로 마지막 날짜가 export/snapshot 날짜다.
  return matches.length ? parseSnapshotDate(matches[matches.length - 1][1].replaceAll("_", "-").replaceAll(".", "-")) : null;
}

function maxDate(dates) {
  return dates.reduce((latest, date) => (!latest || date > latest ? date : latest), null);
}

/**
 * snapshot_date는 행별 기준일도 허용한다. 그 경우 행마다 자신의 snapshot으로
 * 성숙도를 계산하고, 값이 비어 있는 행은 마감만 보기에서 보수적으로 제외한다.
 */
export function resolveRetentionSnapshot({ rows = [], fileName = "", fileModifiedAt = null, manualDate = null } = {}) {
  const manual = parseSnapshotDate(manualDate);
  if (manual) return { date: manual, source: "manual", confidence: "high", perRow: false, bufferDays: 0 };

  const rowDates = rows.map((row) => parseSnapshotDate(row?.snapshot_date));
  const validRowDates = rowDates.filter(Boolean);
  if (validRowDates.length) {
    return {
      date: maxDate(validRowDates),
      source: "snapshot_column",
      confidence: "high",
      perRow: true,
      bufferDays: 0,
      validRowDateCount: validRowDates.length,
    };
  }

  const filenameDate = snapshotDateFromFilename(fileName);
  if (filenameDate) return { date: filenameDate, source: "filename", confidence: "high", perRow: false, bufferDays: 0 };

  const dataDate = maxDate(rows.map((row) => parseSnapshotDate(row?.date)).filter(Boolean));
  if (dataDate) return { date: dataDate, source: "data_max_date", confidence: "medium", perRow: false, bufferDays: 0 };

  const modifiedMs = fileModifiedAt == null ? NaN : Number(fileModifiedAt);
  const modified = Number.isFinite(modifiedMs) ? parseSnapshotDate(new Date(modifiedMs).toISOString()) : null;
  if (modified) return { date: modified, source: "file_modified", confidence: "low", perRow: false, bufferDays: LOW_CONFIDENCE_BUFFER_DAYS };

  return { date: null, source: "unknown", confidence: "unknown", perRow: false, bufferDays: 0 };
}

export function snapshotDateForRow(snapshot, row) {
  if (!snapshot?.date) return null;
  return snapshot.perRow ? parseSnapshotDate(row?.snapshot_date) : snapshot.date;
}

export function isMaturedCohort(row, day, snapshot) {
  if (!(day > 0)) return true;
  const cohortDate = parseSnapshotDate(row?.date);
  const asOfDate = snapshotDateForRow(snapshot, row);
  if (!cohortDate || !asOfDate) return false;
  const cutoff = Date.parse(`${asOfDate}T00:00:00Z`) - (day + (snapshot.bufferDays || 0)) * 86400000;
  return Date.parse(`${cohortDate}T00:00:00Z`) <= cutoff;
}

export function maturityCutoffDate(day, snapshot) {
  if (!(day > 0) || !snapshot?.date || snapshot.perRow) return null;
  const cutoffMs = Date.parse(`${snapshot.date}T00:00:00Z`) - (day + (snapshot.bufferDays || 0)) * 86400000;
  return new Date(cutoffMs).toISOString().slice(0, 10);
}

export function retentionMaturitySummary(rows, day, snapshot) {
  if (!(day > 0)) return { mature: rows.length, immature: 0, unknown: 0 };
  let mature = 0, immature = 0, unknown = 0;
  for (const row of rows) {
    if (!snapshotDateForRow(snapshot, row) || !parseSnapshotDate(row?.date)) unknown += 1;
    else if (isMaturedCohort(row, day, snapshot)) mature += 1;
    else immature += 1;
  }
  return { mature, immature, unknown };
}
