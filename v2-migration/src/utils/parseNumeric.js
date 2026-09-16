// ─────────────────────────────────────────────────────────────────────────────
// 숫자 표기 해석 SSOT — 엔진이 CSV 값을 숫자로 읽는 단 하나의 규칙
// ─────────────────────────────────────────────────────────────────────────────
// 왜 필요한가(2026-09-16 감사): 엔진 13곳이 각자 `String(v).replace(/,/g,"")` 류의
// 파서를 갖고 있었고, 규칙이 조금씩 달라 **같은 CSV 셀이 도구마다 다른 숫자가 됐다**.
// 실측: `"1.000,25"`(유럽식, 실제 1,000.25)가 5-2에서 0, 5-21·5-3에서 1.00025였다.
// 둘 다 틀렸고 서로 달랐다. 콤마만 벗기는 파서는 소수점 구분자를 판별할 수 없으므로
// 값을 1,000배 축소한 채 조용히 통과시킨다.
//
// 해석 규칙은 `lib/data-import/normalizeValues`의 엄격 파서 하나가 소유한다
// (import 파이프라인의 canonical 검증과 같은 규칙 — 경고를 만드는 경로와 숫자를
// 쓰는 경로가 갈리지 않게).
//
// **폴백은 통일하지 않는다.** 소비처마다 "읽을 수 없음"의 의미가 다르기 때문이다:
//   · PVM은 NaN으로 올려 invalidFields에 남기고 계약 검증이 분석을 막는다.
//   · 표시층(parseNum)은 null을 받아 "—"를 그린다.
//   · 합산 집계는 0으로 건너뛴다.
// 폴백을 하나로 묶으면 "읽을 수 없는 값"이 0으로 뭉개지거나 반대로 멀쩡한 도구가
// 통째로 멈춘다. 그래서 **해석은 공유하고 폴백만 각자 고른다.**
import { normalizeNumericValue } from "@/lib/data-import/normalizeValues";

/**
 * 읽을 수 있으면 number, 아니면 null. 판별이 안 되는 표기(유럽식 소수 구분자 등)는
 * 추측하지 않고 거부한다 — 추측한 숫자는 거짓 숫자다(§8).
 * 콤마·공백·통화기호(₩ $ € £ ¥ / KRW USD… / 원)·괄호음수·후행 %·지수표기를 해석한다.
 * @param {unknown} value
 * @returns {number|null}
 */
export function parseNumericStrict(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return normalizeNumericValue(value)?.value ?? null;
}

/** 읽을 수 없으면 0. 합산 집계처럼 결측을 건너뛰는 자리에서 쓴다. */
export function parseNumericOrZero(value) {
  return parseNumericStrict(value) ?? 0;
}

/**
 * 빈 값은 0, 읽을 수 없는 값은 NaN. 둘을 갈라야 하는 자리에서 쓴다
 * (PVM처럼 "결측"과 "오염"을 다르게 다루는 엔진).
 */
export function parseNumericOrNaN(value) {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (String(value).trim() === "") return 0;
  const parsed = parseNumericStrict(value);
  return parsed == null ? NaN : parsed;
}
