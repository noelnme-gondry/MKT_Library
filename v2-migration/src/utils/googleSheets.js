// 구글 시트 연동 — 순수 파싱 헬퍼 (네트워크·OAuth는 컴포넌트층 GoogleSheetConnect.jsx).
// 목표: CsvUploader의 CSV 업로드 파이프라인과 완전히 같은 모양({raw, headers})을 만들어
// 이후 자동매핑·분석 게이트가 CSV든 시트든 구분 없이 동작하게 한다.

// 구글 시트 URL에서 spreadsheetId(필수)와 gid(탭, 선택)를 뽑는다. 형식이 안 맞으면 null.
// 지원 형태: https://docs.google.com/spreadsheets/d/<id>/edit#gid=<gid>
export function parseGoogleSheetUrl(url) {
  if (!url || typeof url !== "string") return null;
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  return {
    spreadsheetId: idMatch[1],
    gid: gidMatch ? gidMatch[1] : null,
  };
}

// Sheets API values.get 응답(2차원 배열, 첫 행=헤더)을 PapaParse({header:true}) 출력과
// 동일한 모양으로 변환. 빈 셀(짧은 행)은 빈 문자열로 채워 컬럼 수를 행마다 맞춘다.
// 완전 빈 행(모든 셀 공백)은 건너뛴다(§7 CSV skipEmptyLines와 동일 동작).
import { tableToRecords } from "@/lib/data-import/detectHeaderRow";

export function sheetValuesToTable(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { headers: [], raw: [] };
  }
  return tableToRecords(values);
}

// 시트 탭이 여러 개일 때 gid로 실제 시트 이름을 찾아 A1 range 문자열을 만든다.
// gid를 못 찾으면(또는 지정 안 하면) 첫 번째 시트 전체를 읽는다.
export function resolveSheetRange(sheetMeta, gid) {
  const sheets = sheetMeta?.sheets || [];
  if (!sheets.length) return null;
  const target = gid != null ? sheets.find((s) => String(s.properties?.sheetId) === String(gid)) : sheets[0];
  const name = (target || sheets[0])?.properties?.title;
  if (!name) return null;
  // 시트명에 공백·특수문자가 있으면 A1 표기에서 작은따옴표로 감싸야 함.
  const quoted = /[^A-Za-z0-9_]/.test(name) ? `'${name.replace(/'/g, "''")}'` : name;
  return quoted;
}
