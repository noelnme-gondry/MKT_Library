import { PVM_MATH } from "@/utils/pvmMath";

/* ============================================================
 * asoStoreMath — 스토어 전환 분석 (5-27)
 *
 * 새 수학을 만들지 않는다. 스토어 퍼널 산술 + 기존 PVM 분해의 어댑터다.
 *
 * 핵심 매핑: PVM은 `cost / result = CPA` 계약인데, 스토어에서는
 *   cost   → 제품 페이지 조회(product page views)
 *   result → 설치(installs)
 *   "CPA"  → 설치 1건당 필요한 조회 수 (= 1 / 전환율)
 * 로 두면 의미가 그대로 성립한다. 그래서 "전환율이 떨어진 게 진짜 하락인가,
 * 전환이 나쁜 소스의 비중이 늘어서인가"가 PVM의 efficiency vs mix 분해와
 * 정확히 같은 질문이 된다 — 수학은 골든으로 고정된 PVM_MATH를 그대로 쓴다.
 * ============================================================ */

const num = (value) => {
  if (value == null || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

// 노출 → 제품 페이지 조회 → 설치. 각 단계 통과율과 전체 전환율.
export function storeFunnel(rows) {
  const total = { impressions: 0, views: 0, installs: 0 };
  for (const row of rows || []) {
    total.impressions += num(row.impressions);
    total.views += num(row.views);
    total.installs += num(row.installs);
  }
  const rate = (numerator, denominator) => (denominator > 0 ? numerator / denominator : null);
  return {
    ...total,
    // 노출이 없는 내보내기(Play Console 일부)에서는 tapThrough가 null로 남는다.
    tapThrough: rate(total.views, total.impressions),
    viewToInstall: rate(total.installs, total.views),
    impressionToInstall: rate(total.installs, total.impressions),
  };
}

// 소스별 {조회, 설치} 집계 → PVM 계약(Map<key,{cost,result}>)
export function aggregateBySource(rows) {
  const out = new Map();
  for (const row of rows || []) {
    const key = String(row.source ?? "").trim() || "(미지정)";
    const prev = out.get(key) || { cost: 0, result: 0 };
    out.set(key, { cost: prev.cost + num(row.views), result: prev.result + num(row.installs) });
  }
  return out;
}

/**
 * 두 기간의 "설치당 조회 수" 변화를 소스 믹스 효과와 소스별 효율 효과로 분해.
 * 반환 null = 분해 불가(한쪽 기간에 설치가 0이거나 계약 위반) — 억지 숫자를 만들지 않는다.
 */
export function decomposeStoreConversion(rowsBefore, rowsAfter) {
  const result = PVM_MATH.decompose(aggregateBySource(rowsBefore), aggregateBySource(rowsAfter));
  if (!result) return null;
  const before = storeFunnel(rowsBefore);
  const after = storeFunnel(rowsAfter);
  return {
    ...result,
    funnelBefore: before,
    funnelAfter: after,
    conversionDelta:
      before.viewToInstall != null && after.viewToInstall != null
        ? after.viewToInstall - before.viewToInstall
        : null,
  };
}

/**
 * 믹스와 효율 중 어느 쪽이 변화를 주도했는지 판정.
 * 임계는 설정으로 분리해 렌더층이 바꿔 끼울 수 있게 둔다(§8).
 */
export const STORE_VERDICT_CONFIG = { dominantShare: 0.6, negligibleShare: 0.15 };

export function classifyStoreShift(decomposed, config = STORE_VERDICT_CONFIG) {
  if (!decomposed) return { verdict: "unknown", reason: "분해 불가" };
  // PVM은 엔티티별 { mix, rate }만 돌려준다(totals 없음). 효율 항의 이름은 `rate`다.
  const totals = (decomposed.entities || []).reduce(
    (acc, entity) => ({ mix: acc.mix + (entity.mix || 0), rate: acc.rate + (entity.rate || 0) }),
    { mix: 0, rate: 0 },
  );
  const mix = Math.abs(totals.mix);
  const efficiency = Math.abs(totals.rate);
  const sum = mix + efficiency;
  // 두 효과가 모두 0에 가까우면 "변화 없음"이지 "믹스 탓"이 아니다.
  if (sum === 0) return { verdict: "flat", mixShare: null, totals, reason: "변화 없음" };
  const mixShare = mix / sum;
  if (mixShare >= config.dominantShare) return { verdict: "mix", mixShare, totals, reason: "트래픽 구성 변화가 주도" };
  if (mixShare <= config.negligibleShare) return { verdict: "efficiency", mixShare, totals, reason: "소스별 전환율 변화가 주도" };
  return { verdict: "mixed", mixShare, totals, reason: "구성과 효율이 함께 움직임" };
}

/**
 * 날짜별 조회→설치 전환율 시계열. 전체 한 줄 + 소스별 한 줄씩.
 *
 * 판정 카드는 "앞뒤 두 덩어리"만 말해 주기 때문에, 변화가 특정 날짜에 꺾였는지
 * 서서히 밀렸는지가 안 보인다. 분해 결과를 믿을지 판단하려면 그 모양을 봐야 한다.
 * 분모가 0인 날은 값을 만들지 않고 null로 남긴다(§8 — 없는 수를 채우지 않는다).
 */
export function dailyConversionSeries(rows) {
  const byDate = new Map();
  const sources = new Set();
  for (const row of rows || []) {
    const date = String(row.date ?? "").trim();
    if (!date) continue;
    const source = String(row.source ?? "").trim() || "(미지정)";
    sources.add(source);
    if (!byDate.has(date)) byDate.set(date, { total: { views: 0, installs: 0 }, bySource: new Map() });
    const slot = byDate.get(date);
    const views = num(row.views);
    const installs = num(row.installs);
    slot.total.views += views;
    slot.total.installs += installs;
    const prev = slot.bySource.get(source) || { views: 0, installs: 0 };
    slot.bySource.set(source, { views: prev.views + views, installs: prev.installs + installs });
  }
  const dates = [...byDate.keys()].sort();
  const rate = (cell) => (cell && cell.views > 0 ? cell.installs / cell.views : null);
  return {
    dates,
    total: dates.map((date) => rate(byDate.get(date).total)),
    // 소스 순서는 총 설치 내림차순 — 범례가 매번 같은 순서로 나오도록 결정론 유지.
    sources: [...sources]
      .map((source) => ({
        source,
        installs: dates.reduce((sum, date) => sum + (byDate.get(date).bySource.get(source)?.installs || 0), 0),
        values: dates.map((date) => rate(byDate.get(date).bySource.get(source))),
      }))
      .sort((a, b) => b.installs - a.installs || a.source.localeCompare(b.source)),
  };
}
