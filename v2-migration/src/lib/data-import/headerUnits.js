// 광고 플랫폼 내보내기는 비용 열 끝에 통화를 붙인다("Amount spent (USD)", "지출 금액 (KRW)").
// 통화 표기만 떼고 비교한다 — "매출 (D7)" 같은 괄호는 기간 의미라 떼면 다른 필드가 된다.
// 기존 매핑(scoreMappingCandidates)과 의미 매퍼(legacyAliasSignals)가 이 한 함수를 함께 쓴다 —
// 한쪽만 떼면 한 매퍼는 비용을 잡고 다른 매퍼는 못 잡아 분석이 막힌다(2026-09-29).
// 의존성을 두지 않는다: csvConstants와 매퍼 사이에 순환 import가 생기면 모듈 초기화가 깨진다.
const CURRENCY_SUFFIX = /\s*[([]\s*(krw|usd|eur|jpy|gbp|cny|twd|hkd|sgd|원|달러|₩|\$)\s*[)\]]\s*$/i;

export function stripCurrencySuffix(value) {
  const text = String(value || "");
  return text.replace(CURRENCY_SUFFIX, "") || text;
}
