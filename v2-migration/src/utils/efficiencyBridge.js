/**
 * 효율 변화를 매체가와 반응률로 가른다.
 *
 * 왜 필요한가: "CPA가 20% 올랐다"까지는 어느 도구든 말한다. 마케터가 다음에 할 일은
 * 그 다음 질문에서 갈린다 — **매체가가 올라서**면 입찰·타게팅 폭·시간대를 보고,
 * **반응률이 떨어져서**면 소재·랜딩·오디언스를 본다. 두 처방은 서로 다르다.
 *
 * 항등식(정확):
 *   CPA = (CPM / 1000) / 반응률,  반응률 = 결과 / 노출
 *   → CPA₂/CPA₁ = (CPM₂/CPM₁) ÷ (반응률₂/반응률₁)
 *
 * 곱셈 항등식이라 잔차가 없다. 백분율 덧셈(%ΔCPA ≈ %ΔCPM − %Δ반응률)은 근사이므로
 * 화면에는 비율과 함께 쓰고, 검증은 곱셈 형태로 한다(§8 — 분해는 항등식으로).
 */

const ratio = (to, from) => (from > 0 && Number.isFinite(to) && Number.isFinite(from) ? to / from : null);
const pct = (r) => (r == null ? null : (r - 1) * 100);

function periodMetrics(period) {
  const cost = Number(period?.cost);
  const impressions = Number(period?.impressions);
  const results = Number(period?.results);
  if (!(cost > 0) || !(impressions > 0) || !(results > 0)) return null;
  return {
    cost,
    impressions,
    results,
    cpa: cost / results,
    cpm: (cost / impressions) * 1000,
    responseRate: results / impressions,
  };
}

/**
 * @param {{cost:number, impressions:number, results:number}} before
 * @param {{cost:number, impressions:number, results:number}} after
 */
export function efficiencyBridge(before, after) {
  const from = periodMetrics(before);
  const to = periodMetrics(after);
  // 계산할 수 없으면 0이나 빈 값을 만들어내지 않는다 — 미상은 미상으로(§7).
  if (!from || !to) {
    return { ok: false, reason: "needs-cost-impressions-results", from, to };
  }

  const cpaRatio = ratio(to.cpa, from.cpa);
  const cpmRatio = ratio(to.cpm, from.cpm);
  const responseRatio = ratio(to.responseRate, from.responseRate);

  // 어느 쪽이 더 크게 움직였나. 로그 절댓값으로 비교해야 증감이 대칭으로 다뤄진다
  // (2배와 1/2배가 같은 크기의 변화다).
  const mediaMagnitude = Math.abs(Math.log(cpmRatio));
  const responseMagnitude = Math.abs(Math.log(responseRatio));
  const total = mediaMagnitude + responseMagnitude;
  const mediaShare = total > 0 ? mediaMagnitude / total : null;

  let driver = "balanced";
  if (total === 0) driver = "unchanged";
  else if (mediaShare >= 0.65) driver = "media-price";
  else if (mediaShare <= 0.35) driver = "response-rate";

  // 두 요인이 반대로 움직여 서로 상쇄된 경우는 따로 알린다 — 합만 보면 "변화 없음"으로
  // 읽히지만 안에서는 두 가지가 동시에 일어났다.
  const offsetting = (cpmRatio - 1) * (responseRatio - 1) > 0
    && Math.abs(Math.log(cpaRatio)) < Math.min(mediaMagnitude, responseMagnitude);

  return {
    ok: true,
    from,
    to,
    cpa: { ratio: cpaRatio, changePct: pct(cpaRatio) },
    cpm: { ratio: cpmRatio, changePct: pct(cpmRatio) },
    responseRate: { ratio: responseRatio, changePct: pct(responseRatio) },
    mediaShare,
    driver,
    offsetting,
  };
}
