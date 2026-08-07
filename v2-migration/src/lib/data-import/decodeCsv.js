// CSV 텍스트 인코딩 감지·재디코딩(순수 함수).
//
// 한국 Excel의 기본 "CSV(쉼표로 분리)" 저장 인코딩은 CP949(EUC-KR)다. 이를 UTF-8로만
// 읽으면 한글 헤더(일자·비용·설치…)가 치환문자(U+FFFD)로 깨진 채 파싱은 "성공"하고,
// 자동매핑 점수가 0이 돼 "필수 컬럼 없음"만 뜬다(에러 경로조차 안 탐). KR 시장 타깃이라
// 흔한 실패다. UTF-8 디코딩에 치환문자가 생기면 EUC-KR로 재디코딩해 손실이 줄면 채택한다.
// XLSX(바이너리)·Google Sheets(API UTF-8)는 이 경로를 타지 않는다.

/** 텍스트의 U+FFFD(치환문자) 개수 — UTF-8 디코딩 실패 바이트 수의 척도. */
export function countReplacement(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0xfffd) n += 1;
  }
  return n;
}

/**
 * CSV 바이트를 텍스트로 디코딩한다.
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {{ text: string, reencoded: boolean, encoding: "utf-8"|"euc-kr" }}
 */
export function decodeCsvBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  // UTF-8 BOM(EF BB BF)이 있으면 명시적 UTF-8 — 재디코딩하지 않는다.
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (hasBom) return { text: utf8, reencoded: false, encoding: "utf-8" };

  const utf8Bad = countReplacement(utf8);
  if (utf8Bad === 0) return { text: utf8, reencoded: false, encoding: "utf-8" };

  // 치환문자 발생 → CP949/EUC-KR 재디코딩 시도. 치환문자가 더 적으면 그쪽을 채택.
  try {
    const euckr = new TextDecoder("euc-kr").decode(bytes);
    if (countReplacement(euckr) < utf8Bad) {
      return { text: euckr, reencoded: true, encoding: "euc-kr" };
    }
  } catch {
    // 런타임이 euc-kr 라벨을 지원하지 않으면 UTF-8 결과를 유지한다.
  }
  return { text: utf8, reencoded: false, encoding: "utf-8" };
}
