// ─────────────────────────────────────────────────────────────────────────────
// METRIC VIEW — viewConfig(표시/순서)를 후보 지표 목록에 적용하는 순수 리졸버
// ─────────────────────────────────────────────────────────────────────────────
// Phase B: 유저가 지표를 끄거나(hidden) 순서를 바꾼(order) 설정을, 도구가 만든
// "후보 지표 목록(available candidates)"에 적용해 실제 렌더 목록을 만든다.
// 순수함수(사이드이펙트 X, 결정론) → 골든 검증. store/컴포넌트와 독립.
//
// config 계약: { hidden: string[], order: string[] } (둘 다 지표 key 배열)
//  · hidden에 있는 key는 렌더에서 제외.
//  · order는 앞쪽 우선 순서. order에 없는 key는 원래(기본) 상대순서 유지하며 뒤에 붙음.
//  · order에 있지만 현재 후보에 없는 key(=데이터 없어 사라진 지표)는 무시(안전).

/**
 * keys(현재 후보 순서)에 order(유저 지정 순서)를 적용한 완전 순서를 만든다.
 * order에 없는 key는 원래 순서 유지하며 뒤에 append. order의 유령 key는 드롭.
 * @param {string[]} keys 후보 key(기본 순서)
 * @param {string[]} order 유저 지정 순서(부분/전체)
 * @returns {string[]} 완전 순서(후보 key 전체를 정확히 1회씩 포함)
 */
export function materializeOrder(keys, order = []) {
  const present = new Set(keys);
  const head = (order || []).filter((k) => present.has(k));
  const headSet = new Set(head);
  const tail = keys.filter((k) => !headSet.has(k));
  return [...head, ...tail];
}

/**
 * 후보 항목 목록에 viewConfig를 적용해 렌더 목록(가시+정렬)을 반환.
 * @param {Array<Object>} items 후보 항목(도구가 availability 게이팅까지 끝낸 것)
 * @param {{hidden?:string[], order?:string[]}|undefined} config 유저 설정
 * @param {(item:Object)=>string} keyOf 항목→key 추출(기본 it.key)
 * @returns {Array<Object>} hidden 제외 + order 정렬된 항목
 */
export function applyMetricView(items, config, keyOf = (x) => x.key) {
  const list = items || [];
  const hidden = new Set((config && config.hidden) || []);
  const order = (config && config.order) || [];
  const keys = list.map(keyOf);
  const eff = materializeOrder(keys, order);
  const byKey = new Map(list.map((it) => [keyOf(it), it]));
  return eff.filter((k) => !hidden.has(k)).map((k) => byKey.get(k));
}

/**
 * effective 순서에서 key를 dir(-1 위 / +1 아래)만큼 이동한 새 order 배열.
 * 경계 밖이면 그대로. 패널의 ↑/↓ 버튼이 사용(항상 완전 order를 emit).
 * @param {string[]} keys 현재 후보 key(기본 순서)
 * @param {string[]} order 현재 유저 order
 * @param {string} key 이동할 key
 * @param {number} dir -1(위) | +1(아래)
 * @returns {string[]} 새 완전 order
 */
export function moveInOrder(keys, order, key, dir) {
  const eff = materializeOrder(keys, order);
  const i = eff.indexOf(key);
  if (i < 0) return eff;
  const j = i + dir;
  if (j < 0 || j >= eff.length) return eff;
  const next = eff.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
