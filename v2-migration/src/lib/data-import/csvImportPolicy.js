// CSV 업로드 상한. XLSX는 xlsxImportPolicy가 25MB/20만행/200만셀/30초로 막는데
// CSV 경로엔 아무 상한이 없어, 파일 전체가 arrayBuffer → UTF-16 문자열 → 워커
// 구조화 복제 → 객체 배열로 최소 3~4중 상주하다 탭 프로세스가 죽었다.
// 탭 사망은 error.js·global-error.js가 잡을 수 없는 유일한 실패라 사전 차단이 유일한 방어다.
//
// 값 근거: 타깃 사용자(10~20만행)의 정상 파일은 15열 기준 30~50MB 수준이므로
// 그보다 넉넉한 100MB를 상한으로 둔다. 병적 케이스(수백 MB)만 차단하는 값이며,
// 운영하며 조정할 수 있도록 상수로 분리한다.
export const CSV_IMPORT_LIMITS = Object.freeze({
  maxFileBytes: 100 * 1024 * 1024,
});

export class CsvImportPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "CsvImportPolicyError";
    this.code = code;
  }
}

export function assertCsvFileSize(byteLength, limits = CSV_IMPORT_LIMITS) {
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    throw new CsvImportPolicyError("csv_empty_file");
  }
  if (byteLength > limits.maxFileBytes) {
    throw new CsvImportPolicyError("csv_file_too_large");
  }
}

export function csvImportErrorMessage(code, locale = "ko", limits = CSV_IMPORT_LIMITS) {
  const mb = Math.round(limits.maxFileBytes / (1024 * 1024));
  const en = locale === "en";
  if (code === "csv_file_too_large") {
    return en
      ? `This CSV is larger than ${mb}MB. Browser-only analysis would run out of memory and crash the tab. Split it by period or channel, or remove unused columns, then upload again.`
      : `CSV 파일이 ${mb}MB를 넘습니다. 브라우저 안에서만 처리하는 구조라 메모리가 부족해 탭이 종료될 수 있습니다. 기간이나 채널로 나누거나 쓰지 않는 컬럼을 지운 뒤 다시 올려주세요.`;
  }
  if (code === "csv_empty_file") {
    return en ? "The file is empty." : "파일이 비어 있습니다.";
  }
  return en ? "Could not read the CSV file." : "CSV 파일을 읽지 못했습니다.";
}

export function csvFailureState(error) {
  if (error?.code === "csv_file_too_large") return "file_too_large";
  if (error?.code === "csv_empty_file") return "empty_file";
  return "parse_error";
}
