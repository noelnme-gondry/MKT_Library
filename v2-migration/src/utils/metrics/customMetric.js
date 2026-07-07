// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM METRIC — 유저가 "조립"하는 커스텀 지표 (Phase C, eval 없는 안전 빌더)
// ─────────────────────────────────────────────────────────────────────────────
// 설계 원칙(§ custom-metrics-data-config-spec.md · §3.3 결정론 · §8.6 거짓숫자 금지):
//  · 자유 텍스트 수식 파싱 금지 → 오타·eval 위험 원천 차단. 유저는 "필드 A ∘ 필드 B"를
//    드롭다운(실제 데이터에 있는 컬럼만)으로 조립. 피연산자는 항상 유효 필드 key.
//  · compute는 순수함수(집계객체 agg만 받음). 분모 0/비수치 → null(계산 불가 정직).
//  · id는 store가 생성(런타임 엔티티) — 여기 순수함수는 id-agnostic.

// 지원 연산 — 2항. 나누기는 분모 falsy→null(§8.6). 순서 = 드롭다운 표시 순서.
export const CUSTOM_OPS = [
  { id: "div", label: "나누기 (÷)", sym: "÷", fn: (x, y) => (y ? x / y : null) },
  { id: "mul", label: "곱하기 (×)", sym: "×", fn: (x, y) => x * y },
  { id: "add", label: "더하기 (+)", sym: "+", fn: (x, y) => x + y },
  { id: "sub", label: "빼기 (−)", sym: "−", fn: (x, y) => x - y },
];

const OP_BY_ID = Object.fromEntries(CUSTOM_OPS.map((o) => [o.id, o]));

// def: { id, name, op, a, b, unit? } — a·b는 agg의 필드 key(피커로만 선택, 오타 불가).
// 반환: agg → number|null 순수 compute. 비수치·비유한·분모0 → null.
export function customMetricCompute(def) {
  const op = OP_BY_ID[def && def.op];
  return (agg) => {
    if (!op || !agg) return null;
    const x = Number(agg[def.a]);
    const y = Number(agg[def.b]);
    if (!isFinite(x) || !isFinite(y)) return null;
    const v = op.fn(x, y);
    return v == null || !isFinite(v) ? null : v;
  };
}

// def → metricRegistry 서술자(getMetricRegistry/computeMetrics와 동일 형태).
// deps=[a,b]로 "필요 컬럼 없으면 숨김" 판정(Phase B)과 정합. source="custom".
export function customMetricToDescriptor(def) {
  return {
    id: def.id,
    label: def.name,
    source: "custom",
    unit: def.unit || "number",
    op: def.op,
    a: def.a,
    b: def.b,
    deps: [def.a, def.b],
    compute: customMetricCompute(def),
  };
}

// 사람이 읽는 수식 미리보기 문자열 — "매출 ÷ 비용" 같은. 라벨 조회는 호출부가 주입.
export function customMetricFormula(def, labelOf = (k) => k) {
  const op = OP_BY_ID[def && def.op];
  if (!op) return "";
  return `${labelOf(def.a)} ${op.sym} ${labelOf(def.b)}`;
}

// def 유효성 — 이름·연산·양 피연산자 필수. 저장 게이트(빌더가 사용).
export function isValidCustomMetricDef(def) {
  return !!(def && String(def.name || "").trim() && OP_BY_ID[def.op] && def.a && def.b);
}
