// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM METRIC — 유저가 "조립"하는 커스텀 지표 (Phase C, eval 없는 안전 빌더)
// ─────────────────────────────────────────────────────────────────────────────
// 설계 원칙(§ custom-metrics-data-config-spec.md · §3.3 결정론 · §8.6 거짓숫자 금지):
//  · 자유 텍스트 수식 파싱 금지 → 오타·eval 위험 원천 차단. 유저는 항(term)을
//    드롭다운/숫자입력으로만 조립. 피연산자 = 필드 key(실데이터) 또는 상수.
//  · N항 좌→우 순차 계산(연산자 우선순위 없음, 계산기식) — 예측 가능·결정론.
//    예: A ÷ B × 1000 = ((A÷B)×1000).
//  · compute는 순수함수(agg만). 분모 0/비수치 → null(계산 불가 정직).
//
// def 스키마(신규): { id, name, unit?, terms:[ operand0, {op,...operand}, ... ] }
//   operand = { type:"field", value:<agg키> }  또는  { type:"const", value:<숫자> }
//   terms[0]=첫 피연산자(op 없음), terms[i>0]={op, ...operand}.
// 하위호환(구): { id, name, op, a, b } → terms 2개로 자동 변환.

// 지원 연산 — 2항. 나누기는 분모 falsy→null(§8.6).
export const CUSTOM_OPS = [
  { id: "div", label: "나누기 (÷)", sym: "÷", fn: (x, y) => (y ? x / y : null) },
  { id: "mul", label: "곱하기 (×)", sym: "×", fn: (x, y) => x * y },
  { id: "add", label: "더하기 (+)", sym: "+", fn: (x, y) => x + y },
  { id: "sub", label: "빼기 (−)", sym: "−", fn: (x, y) => x - y },
];

const OP_BY_ID = Object.fromEntries(CUSTOM_OPS.map((o) => [o.id, o]));

// def → terms 배열(신규는 그대로, 구 {op,a,b}는 변환, 그 외 빈배열).
export function defToTerms(def) {
  if (def && Array.isArray(def.terms)) return def.terms;
  if (def && def.op && def.a && def.b) {
    return [
      { type: "field", value: def.a },
      { op: def.op, type: "field", value: def.b },
    ];
  }
  return [];
}

// 항 하나의 값 — 상수면 숫자(콤마 허용), 필드면 agg[value]. 비수치 → null.
function operandValue(term, agg) {
  const v = term && term.type === "const"
    ? Number(String(term.value).replace(/,/g, ""))
    : Number(agg && agg[term && term.value]);
  return isFinite(v) ? v : null;
}

// terms를 좌→우로 접어 계산. 중간 null(분모0·비수치·잘못된 op) → 전체 null.
export function evalTerms(terms, agg) {
  if (!terms || !terms.length) return null;
  let acc = operandValue(terms[0], agg);
  if (acc == null) return null;
  for (let i = 1; i < terms.length; i++) {
    const t = terms[i];
    const op = OP_BY_ID[t && t.op];
    if (!op) return null;
    const rhs = operandValue(t, agg);
    if (rhs == null) return null;
    acc = op.fn(acc, rhs);
    if (acc == null || !isFinite(acc)) return null;
  }
  return isFinite(acc) ? acc : null;
}

// def → agg를 받는 순수 compute. N항·구 2항 모두 지원.
export function customMetricCompute(def) {
  const terms = defToTerms(def);
  return (agg) => evalTerms(terms, agg);
}

// def → metricRegistry 서술자. deps = 참조하는 필드 key만(상수 제외) → "필요 컬럼
// 없으면 숨김" 판정과 정합. source="custom".
export function customMetricToDescriptor(def) {
  const terms = defToTerms(def);
  const deps = terms.filter((t) => t && t.type === "field" && t.value).map((t) => t.value);
  return {
    id: def.id,
    label: def.name,
    source: "custom",
    unit: def.unit || "number",
    terms,
    deps,
    compute: customMetricCompute(def),
  };
}

// 사람이 읽는 수식 미리보기 — "매출 ÷ 비용 × 1000". 필드 라벨 조회는 호출부 주입.
export function customMetricFormula(def, labelOf = (k) => k) {
  const terms = defToTerms(def);
  if (!terms.length) return "";
  const operandStr = (t) => (t.type === "const" ? String(t.value) : labelOf(t.value));
  let s = operandStr(terms[0]);
  for (let i = 1; i < terms.length; i++) {
    const op = OP_BY_ID[terms[i].op];
    s += ` ${op ? op.sym : "?"} ${operandStr(terms[i])}`;
  }
  return s;
}

// 항 하나 유효성 — 필드는 value 필수, 상수는 유한수 필수.
function isValidOperand(t) {
  if (!t) return false;
  if (t.type === "const") return isFinite(Number(t.value)) && String(t.value).trim() !== "";
  return !!t.value; // field
}

// def 유효성 — 이름 필수 + terms 1개+ + 첫 항 유효 + 이후 항은 op·피연산자 유효.
export function isValidCustomMetricDef(def) {
  if (!def || !String(def.name || "").trim()) return false;
  const terms = defToTerms(def);
  if (!terms.length || !isValidOperand(terms[0])) return false;
  for (let i = 1; i < terms.length; i++) {
    if (!OP_BY_ID[terms[i].op] || !isValidOperand(terms[i])) return false;
  }
  return true;
}
