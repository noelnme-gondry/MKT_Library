export const PROFILE_SAMPLE_LIMIT = 500;

// 시작 행만 보면 기간별 export의 구조가 편향될 수 있다. 항상 같은 인덱스를 고르면
// worker/main thread와 재실행에서도 결과가 같고, 원본 값은 호출 스택 밖으로 나가지 않는다.
export function sampleRowIndexes(rowCount, limit = PROFILE_SAMPLE_LIMIT) {
  const count = Math.max(0, Number(rowCount) || 0);
  const size = Math.min(count, Math.max(0, Number(limit) || 0));
  if (!size) return [];
  if (size === count) return Array.from({ length: count }, (_, index) => index);
  return Array.from({ length: size }, (_, index) => Math.round((index * (count - 1)) / (size - 1)));
}

export function sampleRowsDeterministically(rows = [], limit = PROFILE_SAMPLE_LIMIT) {
  return sampleRowIndexes(rows.length, limit).map((index) => rows[index]).filter(Boolean);
}
