/* ============================================================
 * 분석 찾기 카드의 "결론 예시" — product-ssot §1.1c 분석 카드 계약.
 *
 * 숫자를 손으로 적지 않는다. 블로그 예시 카드가 실제 엔진으로 계산해 둔
 * `lib/blogExamples/data.json`에서 **도구의 예시 데이터(source: "demo")로 계산한
 * 결론만** 고른다. 카드의 `예시 보고서 보기`가 여는 것도 같은 예시 데이터라서,
 * 카드에서 읽은 문장과 눌러서 본 결과가 어긋나지 않는다. 글 전용 예제 파일로
 * 계산한 결론은 쓰지 않는다(눌렀을 때 다른 숫자가 나온다).
 *
 * 화면은 51KB짜리 원본 대신 이 파생본(`finderExamples.json`)만 읽는다 —
 * `finderExamples.test.js`가 원본에서 다시 파생해 같은지 확인한다(신선도).
 * ============================================================ */

/** data.json → { [toolId]: { ko, en } }. 같은 도구의 글이 여럿이면 slug 순 첫 글. */
export function deriveFinderExamples(data = {}) {
  const out = {};
  for (const slug of Object.keys(data).sort()) {
    const entry = data[slug];
    if (!entry || entry.source !== "demo" || !entry.toolId || out[entry.toolId]) continue;
    const ko = entry.ko?.headline;
    const en = entry.en?.headline;
    if (!ko || !en) continue;
    out[entry.toolId] = { ko, en };
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
