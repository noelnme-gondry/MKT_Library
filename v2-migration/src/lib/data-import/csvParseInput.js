import { decodeCsvBuffer } from "./decodeCsv";
import { assertCsvFileSize } from "./csvImportPolicy";

// 공용 CSV 업로더와 도구별 드롭존이 같은 입력 안전 계약을 쓴다. 파일을 먼저
// 제한하고, 가능하면 바이트에서 CP949/EUC-KR을 복원한 텍스트를 PapaParse에 넘긴다.
// 일부 테스트·구형 런타임에서 arrayBuffer를 제공하지 않으면 기존 File 파싱으로
// 폴백한다. 크기·빈 파일 차단은 폴백하지 않는다.
export async function prepareCsvParseInput(file) {
  assertCsvFileSize(file?.size);
  try {
    const buffer = await file.arrayBuffer();
    return decodeCsvBuffer(buffer).text;
  } catch {
    return file;
  }
}
